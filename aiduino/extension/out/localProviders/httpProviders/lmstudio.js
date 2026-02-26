/**
 * LM Studio HTTP Provider
 * Handles LM Studio-specific request/response processing
 */

const modelDiscovery = require('../../utils/modelDiscovery');

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
 * Get best available LM Studio model using modelDiscovery service
 * Filters out embedding models and only returns LLM models
 */
async function detectBestModelLMStudio(baseUrl, preferredModels, defaultPort = 1234) {
    try {
        // Get provider config
        const { PROVIDER_CONFIGS } = require('../../config/providerConfigs');
        const provider = PROVIDER_CONFIGS.lmstudio;
        
        // Discover models using modelDiscovery service
        const models = await modelDiscovery.discoverModels('lmstudio', provider, baseUrl);
        
        if (!models || models.length === 0) {
            console.log('[LM Studio] No models found, using fallback');
            return provider.fallback;
        }
        
        // Try to find preferred model
        if (preferredModels && preferredModels.length > 0) {
            for (const preferred of preferredModels) {
                const found = models.find(m => 
                    m.id?.includes(preferred) || m.name?.includes(preferred)
                );
                if (found) {
                    return found.id || found.name;
                }
            }
        }
        
        // Use modelDiscovery's default selection
        return modelDiscovery.selectDefaultModel(models, provider);
    } catch (error) {
        console.error('[LM Studio] Model detection error:', error.message);
        const { PROVIDER_CONFIGS } = require('../../config/providerConfigs');
        return PROVIDER_CONFIGS.lmstudio.fallback;
    }
}

module.exports = {
    extractResponse,
    buildRequest,
    detectBestModel: detectBestModelLMStudio
};
