/**
 * Ollama HTTP Provider
 * Handles Ollama-specific request/response processing
 */

/**
 * Extract response from Ollama JSON
 * @param {string} responseBody - Raw HTTP response body
 * @returns {string} Extracted content
 */
function extractResponse(responseBody) {
    const result = JSON.parse(responseBody);
    
    if (result.message?.content) {
        return result.message.content;
    } else if (result.error) {
        throw new Error(result.error);
    } else {
        throw new Error('Unknown Ollama response format');
    }
}

/**
 * Build request body for Ollama API
 * @param {string} modelName - Model to use
 * @param {string} prompt - User prompt
 * @returns {Object} Request body object
 */
function buildRequest(modelName, prompt) {
    return {
        model: modelName,
        messages: [
            { role: "system", content: "You are a helpful Arduino programming assistant." },
            { role: "user", content: prompt }
        ],
        stream: false
    };
}

/**
 * Get best available Ollama model
 */
async function detectBestModel(baseUrl, preferredModels) {
    return new Promise((resolve) => {
        const http = require('http');
        const url = new URL('/api/tags', baseUrl);
        
        const req = http.get({
            hostname: url.hostname,
            port: url.port || 11434,
            path: '/api/tags',
            timeout: 5000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    const models = response.models?.map(m => m.name) || [];
                    
                    for (const pref of preferredModels) {
                        const found = models.find(model => model.includes(pref));
                        if (found) return resolve(found);
                    }
                    
                    resolve(models[0] || null);
                } catch {
                    resolve(null);
                }
            });
        });
        
        req.on('error', () => resolve(null));
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
    });
}

module.exports = {
    extractResponse,
    buildRequest,
    detectBestModel
};
