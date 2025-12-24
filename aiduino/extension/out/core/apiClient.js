/*
 * AI.duino - Api Client Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */
const https = require('https');
const { spawn } = require('child_process'); 
const vscode = require("vscode");
const { handleNetworkError } = require('../utils/network');

/**
 * Unified API client for all AI providers
 */
class UnifiedAPIClient {
    constructor(context = null) {
        this.context = context;
        this.maxRetries = context?.settings.get('apiMaxRetries') ?? 3;
        this.timeout = context?.settings.get('apiTimeout') ?? 30000;
    }

    /**
     * Make API call to specified model
     * @param {string} modelId - Model identifier
     * @param {string} prompt - User prompt
     * @param {Object} context - Extension context with dependencies
     * @returns {Promise<string>} AI response text
     */
    async callAPI(modelId, prompt, context) {
        const { minimalModelManager } = context;
        const provider = minimalModelManager.providers[modelId];
    
        // Route to local or remote
        if (provider.type === 'local') {
            return this.callLocalProvider(modelId, prompt, context);
        }
    
        // Existing remote API logic
        const { apiKeys, tokenManager, settings, t } = context;
    
        if (!apiKeys[modelId]) {
            const providerName = provider?.name || 'Unknown Provider';
            throw new Error(t('errors.noApiKey', providerName));
        }

        const config = this.getModelConfig(modelId, prompt, context);
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this.makeRequest(config, t);
                const extracted = this.extractResponse(modelId, response, minimalModelManager);
                
                // Handle token usage
                if (tokenManager) {
                    let usage = extracted.usage;
                    
                    // If API didn't provide token counts, estimate them
                    if (!usage) {
                        const TokenManager = require('./tokenManager');
                        usage = {
                            inputTokens: TokenManager.estimateTokens(prompt, settings),
                            outputTokens: TokenManager.estimateTokens(extracted.text, settings),
                            estimated: true
                        };
                    }
                    
                    tokenManager.update(modelId, usage);
                    context.updateStatusBar?.();
                }
                
                this._triggerSupportHint(context);
                return extracted.text;
            } catch (error) {
                if (attempt === this.maxRetries || !this.isRetryableError(error)) {
                    throw this.enhanceError(modelId, error, minimalModelManager, t);
                }
                
                await this.delay(1000 * attempt);
            }
        }
    }

    /**
     * Make HTTP request
     * @param {Object} config - Request configuration
     * @param {Function} t - Translation function
     * @returns {Promise<Object>} Response data
     */
    async makeRequest(config, t) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(config.body);
        
            const options = {
                hostname: config.hostname,
                port: 443,
                path: config.path,
                method: 'POST',
                headers: {
                    ...config.headers,
                    'Content-Length': Buffer.byteLength(data)
                }
            };
    
            const req = https.request(options, (res) => {
                clearTimeout(timeout);
                let responseData = '';
    
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
    
                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(responseData);
                        
                        if (res.statusCode === 200) {
                            resolve(parsedData);
                        } else {
                            reject(this.createHttpError(res.statusCode, parsedData));
                        }
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });
    
            req.on('error', (e) => {
                clearTimeout(timeout);
                reject(handleNetworkError(e, t)); 
            });

            const timeout = setTimeout(() => {
                req.destroy();
                const timeoutError = new Error(t('errors.timeout'));
                timeoutError.type = 'NETWORK_ERROR';  
                timeoutError.code = 'ETIMEDOUT'; 
                reject(timeoutError);
            }, this.timeout);
    
            req.write(data);
            req.end();
        });
    }
    
    /**
     * Get model configuration for API request
     * @param {string} modelId - Model identifier
     * @param {string} prompt - User prompt
     * @param {Object} context - Extension context
     * @returns {Object} Request configuration
     */
    getModelConfig(modelId, prompt, context) {
        const { minimalModelManager, apiKeys, settings } = context; 
        const provider = minimalModelManager.providers[modelId];
    
        if (!provider || !provider.apiConfig) {
            throw new Error(`Unknown provider or missing API config: ${modelId}`);
        }

        const apiConfig = provider.apiConfig;
        
        // Parse API key and selected model
        let apiKey = apiKeys[modelId];
        let selectedModel = provider.fallback; // Default fallback
        
        // Check if stored config contains model selection (format: key|model-id)
        if (apiKey && apiKey.includes('|')) {
            [apiKey, selectedModel] = apiKey.split('|');
            
            // Validate stored model against provider's filter
            if (provider.extractModels) {
                const testData = { data: [{ id: selectedModel }] };
                const validModels = provider.extractModels(testData);
                
                if (validModels.length === 0) {
                    // Stored model is no longer valid - use fallback
                    console.log(`⚠️ Stored model "${selectedModel}" is invalid, using fallback: ${provider.fallback}`);
                    selectedModel = provider.fallback;
                    
                    // Save corrected API key (without invalid model)
                    const fileManager = require('../utils/fileManager');
                    fileManager.saveApiKey(modelId, apiKey, minimalModelManager.providers);
                }
            }
        }
        
        const systemPrompt = "You are a helpful assistant specialized in Arduino programming and electronics.";
    
        let apiPath;
        if (typeof apiConfig.apiPath === 'function') {
            apiPath = apiConfig.apiPath(selectedModel, apiKey);
        } else {
            apiPath = apiConfig.apiPath;
        }

        // Build request body with provider defaults
        const body = apiConfig.buildRequest(selectedModel, prompt, systemPrompt);
        
        // Override with user settings (if available)
        if (settings) {
            if (body.max_tokens !== undefined) {
                body.max_tokens = settings.get('maxTokensPerRequest');
            }
            if (body.max_completion_tokens !== undefined) {  // OpenAI uses this
                body.max_completion_tokens = settings.get('maxTokensPerRequest');
            }
            if (body.temperature !== undefined) {
                body.temperature = settings.get('temperature');
            }
            if (body.generationConfig?.temperature !== undefined) {  // Gemini uses this
                body.generationConfig.temperature = settings.get('temperature');
            }
            if (body.generationConfig?.maxOutputTokens !== undefined) {  // Gemini
                body.generationConfig.maxOutputTokens = settings.get('maxTokensPerRequest');
            }
        }

        return {
            hostname: provider.hostname,
            path: apiPath,
            headers: apiConfig.headers(apiKey),
            body: body 
        };
    }
    
    /**
     * Extract response and token usage from API data
     * @param {string} modelId - Model identifier
     * @param {Object|string} responseData - Raw API response or JSON string
     * @param {Object} minimalModelManager - Model manager
     * @returns {Object} {text: string, usage: {inputTokens, outputTokens, estimated}}
     */
    extractResponse(modelId, responseData, minimalModelManager) {
        const provider = minimalModelManager.providers[modelId];
        if (!provider) {
            throw new Error(`Unknown provider: ${modelId}`);
        }

        let text = null;
        let usage = null;

        // For local providers, delegate to local provider handlers
        if (provider.type === 'local') {
            const localProviders = require('../localProviders');
        
            if (provider.httpConfig) {
                const providerHandler = localProviders.getHttpProvider(provider.name);
                if (providerHandler && providerHandler.extractResponse) {
                    text = providerHandler.extractResponse(responseData);
                }
            } else if (provider.processConfig) {
                const providerHandler = localProviders.getProcessProvider(provider.name);
                if (providerHandler && providerHandler.extractResponse) {
                    text = providerHandler.extractResponse(responseData);
                }
            }
            
            // Fallback for local providers
            if (!text) {
                text = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
            }
            
            // Local providers don't provide token counts
            return { text, usage: null };
        }
    
        // For API providers, use the apiConfig.extractResponse function
        if (provider.apiConfig && provider.apiConfig.extractResponse) {
            text = provider.apiConfig.extractResponse(responseData);
        }
    
        // Fallback for API providers without extractResponse
        if (!text && responseData && typeof responseData === 'object') {
            // Try common response patterns
            if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
                text = responseData.choices[0].message.content;
            } else if (responseData.content && responseData.content[0] && responseData.content[0].text) {
                text = responseData.content[0].text;
            } else if (responseData.text) {
                text = responseData.text;
            } else if (responseData.message) {
                text = responseData.message;
            }
        }

        if (!text) {
            throw new Error(`Unable to extract response from ${provider.name} API`);
        }

        // Extract token usage from API response
        usage = this.extractTokenUsage(modelId, responseData, provider);

        return { text, usage };
    }

    /**
     * Extract token usage from API response
     * @param {string} modelId - Model identifier
     * @param {Object} responseData - API response data
     * @param {Object} provider - Provider configuration
     * @returns {Object|null} {inputTokens, outputTokens, estimated: false} or null
     */
    extractTokenUsage(modelId, responseData, provider) {
        if (!responseData || typeof responseData !== 'object') return null;

        // Use provider-specific extraction if available
        if (provider.apiConfig && provider.apiConfig.extractTokenUsage) {
            return provider.apiConfig.extractTokenUsage(responseData);
        }

        // Standard patterns for common providers
        let inputTokens = 0;
        let outputTokens = 0;

        // OpenAI/ChatGPT/Groq/OpenRouter format
        if (responseData.usage) {
            inputTokens = responseData.usage.prompt_tokens || 0;
            outputTokens = responseData.usage.completion_tokens || 0;
        }
        // Claude format
        else if (responseData.usage && responseData.usage.input_tokens) {
            inputTokens = responseData.usage.input_tokens || 0;
            outputTokens = responseData.usage.output_tokens || 0;
        }
        // Gemini format
        else if (responseData.usageMetadata) {
            inputTokens = responseData.usageMetadata.promptTokenCount || 0;
            outputTokens = responseData.usageMetadata.candidatesTokenCount || 0;
        }

        // Return null if no token info found (will trigger estimation)
        if (inputTokens === 0 && outputTokens === 0) return null;

        return {
            inputTokens,
            outputTokens,
            estimated: false
        };
    }
 
    /**
     * Create HTTP error with appropriate message
     * @param {number} statusCode - HTTP status code
     * @param {Object} responseData - Error response data
     * @returns {Error} HTTP error
     */
    createHttpError(statusCode, responseData) {
        // Special handling for quota errors
        if (responseData?.error?.message?.includes('quota')) {
            const error = new Error(t('errors.quotaExceeded'));
            error.type = 'QUOTA_ERROR';
            return error;
        }
        
        const errorMessages = {
            401: 'Invalid API Key',
            403: 'Access Forbidden',
            429: 'Rate Limit Exceeded',
            500: 'Internal Server Error',
            502: 'Bad Gateway',
            503: 'Service Unavailable'
        };

        const message = errorMessages[statusCode] || 'Unknown HTTP Error';
        const details = responseData.error?.message || responseData.message || t('errors.noDetailsAvailable');
        
        return new Error(`${message} (${statusCode}): ${details}`);
    }

    /**
     * Handle local providers (like Claude Code)
     */
     async callLocalProvider(modelId, prompt, context) {
        const { minimalModelManager } = context; 
        const provider = minimalModelManager.providers[modelId];
        
        // Route to HTTP or Process based on config
        if (provider.httpConfig) {
            return this.callHttpLocalProvider(modelId, prompt, context);
        } else if (provider.processConfig) {
            return this.callProcessLocalProvider(modelId, prompt, context);
        } else {
            throw new Error(`Local provider ${modelId} has no valid config`);
        }
    }

    /**
     * Handle HTTP-based local providers (Ollama, LocalAI, etc.)
     */
    async callHttpLocalProvider(modelId, prompt, context) {
        const { apiKeys, tokenManager, settings } = context;
        const provider = context.minimalModelManager.providers[modelId];
    
        // Parse stored configuration (URL|model format from auto-detection)
        const storedConfig = apiKeys[modelId];
        if (!storedConfig || !storedConfig.includes('|')) {
            throw new Error(`${provider.name} not properly configured. Please re-run model selection.`);
        }
    
        const [baseUrl, selectedModel] = storedConfig.split('|');
    
        // Make HTTP request to local provider
        const response = await this.makeLocalHttpRequest(baseUrl, selectedModel, prompt, provider, context.t);
        
        // Update token usage with estimation (local providers don't provide counts)
        if (tokenManager) {
            const TokenManager = require('./tokenManager');
            tokenManager.update(modelId, {
                inputTokens: TokenManager.estimateTokens(prompt, settings),
                outputTokens: TokenManager.estimateTokens(response, settings),
                estimated: true
            });
            context.updateStatusBar?.();
        }
        
        this._triggerSupportHint(context);
        return response;
    }

    /**
     * Handle Process-based local providers (Claude Code, etc.) - REFACTORED
     */
    async callProcessLocalProvider(modelId, prompt, context) {
        const { minimalModelManager, tokenManager, settings, apiKeys } = context; 
        const provider = minimalModelManager.providers[modelId];
    
        const localProviders = require('../localProviders');
        const providerHandler = localProviders.getProcessProvider(provider.name);
    
        if (!providerHandler) {
            throw new Error(`No process handler found for ${provider.name}`);
        }

        const toolPath = apiKeys[modelId] || provider.processConfig?.command;
    
        if (!toolPath) {
            const { t } = context;
            throw new Error(t('errors.localProviderNotFound', provider.name, 'not configured'));
        }

        const sessionId = context.sessionId || null;
        const output = await providerHandler.executeCommand(toolPath, prompt, context, sessionId);

        const extracted = providerHandler.extractResponse ? 
            providerHandler.extractResponse(output) : 
            { response: output, sessionId: null };

        const response = extracted.response || extracted;
        const newSessionId = extracted.sessionId || null;

        // Update token usage with estimation (local providers don't provide counts)
        if (tokenManager) {
            const TokenManager = require('./tokenManager');
            tokenManager.update(modelId, {
                inputTokens: TokenManager.estimateTokens(prompt, settings),
                outputTokens: TokenManager.estimateTokens(response, settings),
                estimated: true
            });
            context.updateStatusBar?.();
        }
        
        this._triggerSupportHint(context);
    
        if (newSessionId && provider.persistent) {
            context.lastSessionId = newSessionId;
            // Return object with session ID for persistent providers
            return { text: response, sessionId: newSessionId };
        }

        return response;
    }

    /**
     * Make direct HTTP request to local provider
     */
    async makeLocalHttpRequest(baseUrl, modelName, prompt, provider, t) {
        const localProviders = require('../localProviders');
        const providerHandler = localProviders.getHttpProvider(provider.name);
    
        if (!providerHandler) {
            throw new Error(`No handler found for ${provider.name}`);
        }

        return new Promise((resolve, reject) => {
            const requestBody = providerHandler.buildRequest(modelName, prompt);
            const data = JSON.stringify(requestBody);
            const buffer = Buffer.from(data, 'utf8');
            
            // Flag to prevent race condition between timeout and response
            let completed = false;
            
            const http = require('http');
            const parsedUrl = new URL(baseUrl);
            
            const req = http.request({
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || provider.defaultPort || 80, 
                path: provider.httpConfig.endpoint,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': buffer.length
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (completed) return; // Already timed out or errored
                    completed = true;
                    
                    try {
                        const response = providerHandler.extractResponse(body);
                        resolve(response);
                    } catch (e) {
                        reject(new Error(`${provider.name}: ${e.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                if (completed) return; // Already resolved or timed out
                completed = true;
                
                if (error.code === 'ECONNREFUSED') {
                    reject(new Error(t('errors.localProviderNotRunning')));
                } else {
                    reject(new Error(error.message));
                }
            });
            
            req.setTimeout(600000, () => {  // 10 minutes for slow CPU inference
                if (completed) return; // Already resolved
                completed = true;
                
                req.destroy();
                reject(new Error(t('errors.localProviderTimeout')));
            });
            
            req.write(buffer);
            req.end();
        });
    }   

    /**
     * Enhance error with model context
     * @param {string} modelId - Model identifier
     * @param {Error} error - Original error
     * @param {Object} minimalModelManager - Model manager
     * @param {Function} t - Translation function
     * @returns {Error} Enhanced error
     */
    enhanceError(modelId, error, minimalModelManager, t) {
        const modelName = minimalModelManager.providers[modelId]?.name || t('errors.unknownProvider');

        // Network errors - preserve type and code WITHOUT adding model name
        if (error.type === 'NETWORK_ERROR' || 
            error.code === 'ENOTFOUND' || 
            error.code === 'ETIMEDOUT' || 
            error.code === 'ECONNREFUSED' ||
            error.code === 'ECONNRESET' ||
            error.code === 'EHOSTUNREACH' ||
            error.code === 'ENETUNREACH' ||
            error.code === 'ECONNABORTED') {
            // Keep original error with type and code intact
            if (!error.type) error.type = 'NETWORK_ERROR';
            return error;
        }

        // API Key errors
        if (error.message.includes('Invalid API Key')) {
            const enhancedError = new Error(t('errors.invalidApiKey', modelName));
            enhancedError.type = 'API_KEY_ERROR';  
            return enhancedError;
        }
        
        // Rate Limit errors
        if (error.message.includes('Rate Limit')) {
            const enhancedError = new Error(t('errors.rateLimit', modelName));
            enhancedError.type = 'RATE_LIMIT_ERROR'; 
            return enhancedError;
        }
        
        // Server errors
        if (error.message.includes('Server Error') || error.message.includes('Service Unavailable')) {
            const enhancedError = new Error(t('errors.serverUnavailable', modelName));
            enhancedError.type = 'SERVER_ERROR';  
            return enhancedError;
        }
        
        // Generic errors - add model name and preserve properties
        const enhancedError = new Error(`${modelName}: ${error.message}`);
        
        // Copy type and code if they exist
        if (error.type) enhancedError.type = error.type;
        if (error.code) enhancedError.code = error.code;
        
        return enhancedError;
    }   

    /**
     * Check if error is retryable
     * @param {Error} error - Error to check
     * @returns {boolean} Whether error is retryable
     */
    isRetryableError(error) {
        // Retry on network errors and temporary server issues
        return error.message.includes('timeout') ||
               error.message.includes('ECONNRESET') ||
               error.message.includes('ECONNREFUSED') ||
               error.message.includes('Service Unavailable') ||
               error.message.includes('502') ||
               error.message.includes('503');
    }

    /**
     * Delay execution
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Trigger support hint after successful API call
     * @param {Object} context - Extension context
     * @private
     */
    _triggerSupportHint(context) {
        if (context.globalContext && !context.skipSupportHint) {
            const uiTools = require('../utils/ui');
            const contextWithT = { ...context.globalContext, t: context.t };
            uiTools.showSupportHint(contextWithT).catch(() => {}); 
        }
    }
}

module.exports = {
    UnifiedAPIClient
};
