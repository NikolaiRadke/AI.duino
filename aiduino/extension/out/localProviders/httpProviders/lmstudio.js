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
        throw new Error(result.error.message || result.error);
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
 */
async function detectBestModelLMStudio(baseUrl, preferredModels, defaultPort = 1234) {
    return detectBestModel(
        baseUrl,
        '/v1/models',
        defaultPort, 
        preferredModels,
        (response) => response.data?.map(m => m.id) || []
    );
}
module.exports = {
    extractResponse,
    buildRequest,
    detectBestModel: detectBestModelLMStudio
};
