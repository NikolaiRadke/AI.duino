/**
 * Ollama HTTP Provider
 * Handles Ollama-specific request/response processing
 */

const modelDiscovery = require('../../utils/modelDiscovery');

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
 * Get best available Ollama model using modelDiscovery service
 */
async function detectBestModelOllama(baseUrl, preferredModels, defaultPort = 11434) {
    try {
        // Get provider config
        const { PROVIDER_CONFIGS } = require('../../config/providerConfigs');
        const provider = PROVIDER_CONFIGS.ollama;
        
        // Discover models using modelDiscovery service
        const models = await modelDiscovery.discoverModels('ollama', provider, baseUrl);
        
        if (!models || models.length === 0) {
            console.log('[Ollama] No models found, using fallback');
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
        console.error('[Ollama] Model detection error:', error.message);
        const { PROVIDER_CONFIGS } = require('../../config/providerConfigs');
        return PROVIDER_CONFIGS.ollama.fallback;
    }
}

module.exports = {
    extractResponse,
    buildRequest,
    detectBestModel: detectBestModelOllama
};
