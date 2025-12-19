/**
 * LM Studio HTTP Provider
 * Handles LM Studio-specific request/response processing
 */

const { detectBestModel } = require('./httpProvider');

/**
 * Extract response from LM Studio JSON
 */
function extractResponse(responseBody) {
    const result = JSON.parse(responseBody);
    
    if (result.choices && result.choices[0]?.message?.content) {
        return result.choices[0].message.content;
    } else if (result.error) {
        const errorMsg = result.error.message || result.error;
        
        // Check if the error is about an embedding model
        if (errorMsg.includes('not llm') || errorMsg.includes('embedding')) {
            throw new Error('The selected model is not a language model (LLM).');
        }
        
        throw new Error(errorMsg);
    } else {
        throw new Error('Unknown LM Studio response format');
    }
}

/**
 * Build request body for LM Studio API
 */
function buildRequest(modelName, prompt) {
    return {
        model: modelName,
        messages: [
            { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2048,
        stream: false
    };
}

/**
 * Get best available LM Studio model
 * Filters out embedding models and only returns LLM models
 */
async function detectBestModelLMStudio(baseUrl, preferredModels, defaultPort = 1234) {
    return detectBestModel(
        baseUrl,
        '/v1/models',
        defaultPort, 
        preferredModels,
        (response) => {
            if (!response.data) return [];
            // Filter out embedding models - only include models with object: "model"
            // Embedding models have object: "embedding" 
            return response.data
                .filter(m => !m.object || m.object === 'model')
                .map(m => m.id) || [];
        }
    );
}
module.exports = {
    extractResponse,
    buildRequest,
    detectBestModel: detectBestModelLMStudio
};
