/**
 * LM Studio HTTP Provider
 * Handles LM Studio-specific request/response processing
 */

/**
 * Extract response from LM Studio JSON
 * @param {string} responseBody - Raw HTTP response body
 * @returns {string} Extracted content
 */
function extractResponse(responseBody) {
    const result = JSON.parse(responseBody);
    
    // LM Studio uses OpenAI-compatible format
    if (result.choices && result.choices[0]?.message?.content) {
        return result.choices[0].message.content;
    } else if (result.error) {
        throw new Error(result.error.message || result.error);
    } else {
        throw new Error('Unknown LM Studio response format');
    }
}

/**
 * Build request body for LM Studio API
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
        temperature: 0.7,
        max_tokens: 2048,
        stream: false
    };
}

/**
 * Get best available LM Studio model
 * @param {string} baseUrl - LM Studio base URL
 * @param {Array} preferredModels - List of preferred model patterns
 * @returns {Promise<string|null>} Best available model name or null
 */
async function detectBestModel(baseUrl, preferredModels) {
    return new Promise((resolve) => {
        const http = require('http');
        const url = new URL('/v1/models', baseUrl);
        
        const req = http.get({
            hostname: url.hostname,
            port: url.port || 1234,
            path: '/v1/models',
            timeout: 5000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    const models = response.data?.map(m => m.id) || [];
                    
                    // Try preferred models first
                    for (const pref of preferredModels) {
                        const found = models.find(model => 
                            model.toLowerCase().includes(pref.toLowerCase())
                        );
                        if (found) return resolve(found);
                    }
                    
                    // Return first available model
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
