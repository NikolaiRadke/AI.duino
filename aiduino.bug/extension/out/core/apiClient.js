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
    
        // Local provider JSON parsing (like Claude Code)
        if (provider.type === 'local' && typeof responseData === 'string') {
            try {
                const jsonResponse = JSON.parse(responseData);
                return jsonResponse.result || responseData;
            } catch {
                return responseData; // Fallback to raw text
            }
        }

        // Existing API provider logic
        return provider.apiConfig.extractResponse(responseData);
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
        const { minimalModelManager, updateTokenUsage, apiKeys, t } = context; 
        const provider = minimalModelManager.providers[modelId];
        const claudePath = apiKeys[modelId] || 'claude';
        const editor = vscode.window.activeTextEditor;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const shared = require('../shared');
    
        const localContext = {
            board: shared.getBoardDisplayName(shared.detectArduinoBoard()),
            activeFile: editor?.document.fileName,
            selectedCode: editor && !editor.selection.isEmpty ? 
                editor.document.getText(editor.selection) : null,
            workspaceFolder: workspaceFolder?.uri.fsPath
        };
        const enhancedPrompt = provider.processConfig.buildPrompt(prompt, localContext);
        const args = provider.processConfig.buildArgs(enhancedPrompt, localContext);
        
        // Execute process and return response
        return new Promise((resolve, reject) => {
            const childProcess = spawn(claudePath, args, {
                cwd: '/tmp',
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: true,
                windowsHide: true
            });
            
            childProcess.unref();
            
            let stdout = '';
            let stderr = '';
            
            childProcess.stdout.on('data', (data) => stdout += data.toString());
            childProcess.stderr.on('data', (data) => stderr += data.toString());
            
            childProcess.on('close', (code) => {
                if (code === 0 && stdout.trim()) {
                    const extractedResponse = this.extractResponse(modelId, stdout.trim(), minimalModelManager);
                    updateTokenUsage(modelId, prompt, extractedResponse);
                    resolve(extractedResponse);
                } else {
                    reject(new Error(stderr || t('errors.processFailedWithCode', code)));
                }
            });
    
            childProcess.on('error', (error) => {
                if (error.code === 'ENOENT') {
                    reject(new Error(t('errors.claudeCodeNotFound', claudePath)));
                } else {
                    reject(new Error(t('errors.processError', error.message)));
                }
            });
            
            // 3 minute timeout
            setTimeout(() => {
                childProcess.kill();
                    reject(new Error(t('errors.claudeCodeTimeout')));
            }, 180000);
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
}

module.exports = {
    UnifiedAPIClient
};
