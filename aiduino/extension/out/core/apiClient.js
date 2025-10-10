/*
 * AI.duino - Api Client Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */
const https = require('https');
const { spawn } = require('child_process'); 
const vscode = require("vscode");

/**
 * Unified API client for all AI providers
 */
class UnifiedAPIClient {
    constructor() {
        this.timeout = 30000;
        this.maxRetries = 3;
    }

    /**
     * Make API call to specified model
     * @param {string} modelId - Model identifier
     * @param {string} prompt - User prompt
     * @param {Object} context - Extension context with dependencies
     * @returns {Promise<string>} AI response
     */
    async callAPI(modelId, prompt, context) {
        const { minimalModelManager } = context;
        const provider = minimalModelManager.providers[modelId];
    
        // Route to local or remote
        if (provider.type === 'local') {
            return this.callLocalProvider(modelId, prompt, context);
        }
    
        // Existing remote API logic (unchanged)
        const { apiKeys, updateTokenUsage, t } = context;
    
        if (!apiKeys[modelId]) {
            const providerName = provider?.name || 'Unknown Provider';
            throw new Error(t('errors.noApiKey', providerName));
        }

        const config = this.getModelConfig(modelId, prompt, context);
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this.makeRequest(config);
                const extractedResponse = this.extractResponse(modelId, response, minimalModelManager);                
                updateTokenUsage(modelId, prompt, extractedResponse);
                this._triggerSupportHint(context);
                return extractedResponse;
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
     * @returns {Promise<Object>} Response data
     */
    async makeRequest(config) {
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
    
            const timeout = setTimeout(() => {
                req.destroy();
                reject(new Error(t('errors.timeout')));
            }, this.timeout);
    
            const req = https.request(options, (res) => {
                clearTimeout(timeout);
                let responseData = '';
    
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
    
                res.on('end', () => {
                    const parsedData = JSON.parse(responseData);
                    
                    if (res.statusCode === 200) {
                        resolve(parsedData);
                    } else {
                        reject(this.createHttpError(res.statusCode, parsedData));
                    }
                });
            });
    
            req.on('error', (e) => {
                clearTimeout(timeout);
                reject(this.handleNetworkError(e));
            });
    
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
        const { minimalModelManager, apiKeys } = context;
        const provider = minimalModelManager.providers[modelId];
        
        if (!provider || !provider.apiConfig) {
            throw new Error(`Unknown provider or missing API config: ${modelId}`);
        }
    
        const currentModel = minimalModelManager.getCurrentModel(modelId);
        const apiConfig = provider.apiConfig;
        const apiKey = apiKeys[modelId];
        const systemPrompt = "You are a helpful assistant specialized in Arduino programming and electronics.";
        let apiPath;
        if (typeof apiConfig.apiPath === 'function') {
            apiPath = apiConfig.apiPath(currentModel.id, apiKey);
        } else {
            apiPath = apiConfig.apiPath;
        }

        return {
            hostname: provider.hostname,
            path: apiPath,
            headers: apiConfig.headers(apiKey),
            body: apiConfig.buildRequest(currentModel.id, prompt, systemPrompt)
        };
    } 
    
    /**
     * Extract response from API data (enhanced for local providers)
     * @param {string} modelId - Model identifier
     * @param {Object|string} responseData - Raw API response or JSON string
     * @param {Object} minimalModelManager - Model manager
     * @returns {string} Extracted response text
     */
    extractResponse(modelId, responseData, minimalModelManager) {
        const provider = minimalModelManager.providers[modelId];
        if (!provider) {
            throw new Error(`Unknown provider: ${modelId}`);
        }

        // For local providers, delegate to local provider handlers
        if (provider.type === 'local') {
            const localProviders = require('../localProviders');
        
            if (provider.httpConfig) {
                const providerHandler = localProviders.getHttpProvider(provider.name);
                if (providerHandler && providerHandler.extractResponse) {
                    return providerHandler.extractResponse(responseData);
                }
            } else if (provider.processConfig) {
                const providerHandler = localProviders.getProcessProvider(provider.name);
                if (providerHandler && providerHandler.extractResponse) {
                    return providerHandler.extractResponse(responseData);
                }
            }
            
            // Fallback for local providers
            return typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
        }
    
        // For API providers, use the apiConfig.extractResponse function
        if (provider.apiConfig && provider.apiConfig.extractResponse) {
            return provider.apiConfig.extractResponse(responseData);
        }
    
        // Fallback for API providers without extractResponse
        if (responseData && typeof responseData === 'object') {
            // Try common response patterns
            if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
                return responseData.choices[0].message.content;
            }
            if (responseData.content && responseData.content[0] && responseData.content[0].text) {
                return responseData.content[0].text;
            }
            if (responseData.text) {
                return responseData.text;
            }
            if (responseData.message) {
                return responseData.message;
            }
        }

        throw new Error(`Unable to extract response from ${provider.name} API`);
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
        const { apiKeys, updateTokenUsage } = context;
        const provider = context.minimalModelManager.providers[modelId];
    
        // Parse stored configuration (URL|model format from auto-detection)
        const storedConfig = apiKeys[modelId];
        if (!storedConfig || !storedConfig.includes('|')) {
            throw new Error(`${provider.name} not properly configured. Please re-run model selection.`);
        }
    
        const [baseUrl, selectedModel] = storedConfig.split('|');
    
        // Make HTTP request to local provider
        const response = await this.makeLocalHttpRequest(baseUrl, selectedModel, prompt, provider, context.t);
        updateTokenUsage(modelId, prompt, response);
        this._triggerSupportHint(context);
        return response;
    }

    /**
     * Handle Process-based local providers (Claude Code, etc.) - REFACTORED
     */
    async callProcessLocalProvider(modelId, prompt, context) {
        const { minimalModelManager, updateTokenUsage, apiKeys } = context; 
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

        updateTokenUsage(modelId, prompt, response);
        this._triggerSupportHint(context);
    
        if (newSessionId && provider.persistent) {
            context.lastSessionId = newSessionId;
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
            
            const http = require('http');
            const req = http.request({
                hostname: new URL(baseUrl).hostname,
                port: new URL(baseUrl).port,
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
                    try {
                        const response = providerHandler.extractResponse(body);
                        resolve(response);
                    } catch (e) {
                        reject(new Error(`${provider.name}: ${e.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                if (error.code === 'ECONNREFUSED') {
                    reject(new Error(t('errors.localProviderNotRunning')));
                } else {
                    reject(new Error(error.message));
                }
            });
            
            req.setTimeout(180000, () => {
                req.destroy();
                reject(new Error(t('errors.localProviderTimeout')));
            });
            
            req.write(buffer);
            req.end();
        });
    }   
    
    /**
     * Handle network errors
     * @param {Error} error - Network error
     * @returns {Error} Enhanced error
     */
    handleNetworkError(error) {
        const errorMessages = {
            'ENOTFOUND': 'DNS resolution failed',
            'ETIMEDOUT': 'Connection timeout',
            'ECONNREFUSED': 'Connection refused',
            'ECONNRESET': 'Connection reset',
            'EHOSTUNREACH': 'Host unreachable',
            'ENETUNREACH': 'Network unreachable',
            'ECONNABORTED': 'Connection aborted'
        };
        
        const message = errorMessages[error.code] || `Network error: ${error.message}`;
        return new Error(message);
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
    
        // Add model context to error WITH error types
        if (error.message.includes('Invalid API Key')) {
            const enhancedError = new Error(t('errors.invalidApiKey', modelName));
            enhancedError.type = 'API_KEY_ERROR';  
            return enhancedError;
        } else if (error.message.includes('Rate Limit')) {
            const enhancedError = new Error(t('errors.rateLimit', modelName));
            enhancedError.type = 'RATE_LIMIT_ERROR'; 
            return enhancedError;
        } else if (error.message.includes('Server Error') || error.message.includes('Service Unavailable')) {
            const enhancedError = new Error(t('errors.serverUnavailable', modelName));
            enhancedError.type = 'SERVER_ERROR';  
            return enhancedError;
        }
        
        return new Error(`${modelName}: ${error.message}`);
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
            uiTools.showSupportHint(contextWithT).catch(() => {}); // Fehler wieder silent
        }
    }
}

module.exports = {
    UnifiedAPIClient
};
