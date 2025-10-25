/**
 * Ollama HTTP Provider
 * Handles Ollama-specific request/response processing
 */

const { detectBestModel } = require('./httpProvider');

/**
 * Extract response from Ollama JSON
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
 */
function buildRequest(modelName, prompt) {
    return {
        model: modelName,
        messages: [
            { role: "user", content: prompt }
        ],
        stream: false
    };
}

/**
 * Get best available Ollama model
 */
async function detectBestModelOllama(baseUrl, preferredModels, defaultPort = 11434) {
    return detectBestModel(
        baseUrl,
        '/api/tags',
        defaultPort,  
        preferredModels,
        (response) => response.models?.map(m => m.name) || []
    );
}

module.exports = {
    extractResponse,
    buildRequest,
    detectBestModel: detectBestModelOllama
};
