/**
 * core/apiClient.js - Unified API Client
 * Handles HTTP requests to different AI providers with unified interface
 */

const https = require('https');

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
        const { apiKeys, minimalModelManager, updateTokenUsage, t } = context;
        
        if (!apiKeys[modelId]) {
            const providerName = minimalModelManager.providers[modelId]?.name || 'Unknown Provider';
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
                reject(new Error('Request timeout'));
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
     * Extract response from API data
     * @param {string} modelId - Model identifier
     * @param {Object} responseData - Raw API response
     * @param {Object} minimalModelManager - Model manager
     * @returns {string} Extracted response text
     */
    extractResponse(modelId, responseData, minimalModelManager) {
        const provider = minimalModelManager.providers[modelId];
        if (!provider || !provider.apiConfig) {
            throw new Error(`Unknown provider: ${modelId}`);
        }

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
            const error = new Error('Quota exceeded');
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
        const details = responseData.error?.message || responseData.message || 'No details available';
        
        return new Error(`${message} (${statusCode}): ${details}`);
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
        const modelName = minimalModelManager.providers[modelId]?.name || 'Unknown Provider';
        
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
