/*
 * AI.duino - Provider Configurations
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

// ===== HOW TO ADD NEW PROVIDERS =====
// 1. Add provider configuration to PROVIDER_CONFIGS object below
// 2. Optional: Extend keywords in package.json: ["arduino", "ai", "claude", "chatgpt", "vertex", "huggingface", ...]
// 3. Reload extension - Done! New provider appears automatically in:
//    - Model Switch Menu
//    - API Key Setup  
//    - Token Statistics
//    - Status Bar

// ===== PROVIDER TEMPLATE FOR NEW PROVIDERS =====
/*
your_provider: {
    name: 'Your Provider Name',
    icon: '🔥',                           // Emoji for UI
    color: '#FF0000',                     // Hex color for themes
    keyFile: '.aiduino-yourprovider-api-key', // Filename for API key
    keyPrefix: 'sk-',                     // API key must start with this
    keyMinLength: 15,                     // Minimum key length
    hostname: 'api.yourprovider.com',     // API hostname
    apiKeyUrl:                            // API URL
    path: '/v1/models',                   // Path for model list
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }), // HTTP headers
    extractModels: (data) => data.models || [],  // Extract models from API response
    selectBest: (models) => models[0],    // Select best model
    fallback: 'default-model-id',         // Fallback when API unreachable
    prices: {
        input: 0.001 / 1000,              // Cost per input token
        output: 0.002 / 1000              // Cost per output token
    },
    apiConfig: {
        apiPath: '/v1/chat/completions', // API path for chat
        method: 'POST',
        headers: (key) => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        }),
        buildRequest: (modelId, prompt, systemPrompt) => ({
            model: modelId,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            max_tokens: 2000,
            temperature: 0.7
        }),
        extractResponse: (data) => data.choices[0].message.content
    }
}
*/

// Version
const CONFIG_VERSION = '040925'; 
const REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/NikolaiRadke/AI.duino/refs/heads/main/aiduino/extension/out/config/providerConfigs.js';

// All AI provider configurations
const PROVIDER_CONFIGS = {
    claude: {
        name: 'Claude',
        icon: '🤖',
        color: '#6B46C1',
        keyFile: '.aiduino-claude-api-key',
        keyPrefix: 'sk-ant-',
        keyMinLength: 20,
        hostname: 'api.anthropic.com',
        apiKeyUrl: 'https://console.anthropic.com/api-keys',
        path: '/v1/models',
        headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
        extractModels: (data) => data.data?.filter(m => m.type === 'text' && !m.id.includes('deprecated')) || [],
        selectBest: (models) => models.find(m => m.id.includes('sonnet-4')) || models.find(m => m.id.includes('3-5-sonnet')) || models[0],
        fallback: 'claude-3-5-sonnet-20241022',
        prices: {
            input: 3.0 / 1000000,     // $3.00 per 1M tokens (war: 3.0 / 1000)
            output: 15.0 / 1000000    // $15.00 per 1M tokens (war: 15.0 / 1000)
        },
        apiConfig: {
            apiPath: '/v1/messages',
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01'
            }),
            buildRequest: (modelId, prompt) => ({
                model: modelId,
                max_tokens: 2000,
                messages: [{ role: "user", content: prompt }]
            }),
            extractResponse: (data) => data.content[0].text
        }
    },
    
    chatgpt: {
        name: 'ChatGPT',
        icon: '🧠',
        color: '#10A37F',
        keyFile: '.aiduino-openai-api-key',
        keyPrefix: 'sk-',
        keyMinLength: 20,
        hostname: 'api.openai.com',
        apiKeyUrl: 'https://platform.openai.com/api-keys',
        path: '/v1/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => data.data?.filter(m => m.id.startsWith('gpt-') && !m.id.includes('instruct')) || [],
        selectBest: (models) => models.find(m => m.id.includes('gpt-5')) || models.find(m => m.id.includes('gpt-4')) || models[0],
        fallback: 'gpt-5',
        prices: {
            input: 1.25 / 1000000,    // $1.25 per 1M tokens (war: 1.25 / 1000)
            output: 10.0 / 1000000    // $10.00 per 1M tokens (war: 10.0 / 1000)
        },
        apiConfig: {
            apiPath: '/v1/chat/completions',
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            }),
            buildRequest: (modelId, prompt, systemPrompt) => ({
                model: modelId,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                max_tokens: 2000,
                temperature: 0.7
            }),
            extractResponse: (data) => data.choices[0].message.content
        }
    },

    gemini: {
        name: 'Gemini',
        icon: '💎',
        color: '#4285F4',
        keyFile: '.aiduino-gemini-api-key',
        keyPrefix: 'AIza',
        keyMinLength: 20,
        hostname: 'generativelanguage.googleapis.com',
        apiKeyUrl: 'https://makersuite.google.com/app/apikey',
        path: '/v1/models?key=',
        headers: () => ({}),
        extractModels: (data) => data.models?.filter(m => m.supportedGenerationMethods?.includes('generateContent')) || [],
        selectBest: (models) => models.find(m => m.name.includes('2.5-flash')) || models.find(m => m.name.includes('1.5-flash')) || models[0],
        fallback: 'models/gemini-2.5-flash',
        prices: {
            input: 0.075 / 1000,   // $0.075 per 1M tokens (2.5 Flash) - Updated Sept 2025
            output: 0.30 / 1000    // $0.30 per 1M tokens (2.5 Flash) - Updated Sept 2025
        },
        apiConfig: {
            apiPath: (modelId, key) => {
                if (!modelId.startsWith('models/')) {
                    modelId = 'models/' + modelId;
                }
                return `/v1beta/${modelId}:generateContent?key=${key}`;
            },
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json'
            }),
            buildRequest: (modelId, prompt) => ({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 2048,
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                ]
            }),         
            extractResponse: (data) => {
                if (data.error) {
                    throw new Error(`Gemini API Error: ${data.error.message || JSON.stringify(data.error)}`);
                }
                
                if (data.candidates && data.candidates[0]) {
                    const candidate = data.candidates[0];
                    
                    if (candidate.finishReason === 'SAFETY') {
                        throw new Error('Response blocked due to safety settings');
                    }
                    
                    if (candidate.content && 
                        candidate.content.parts && 
                        candidate.content.parts[0] &&
                        candidate.content.parts[0].text) {
                        return candidate.content.parts[0].text;
                    }
                }
                
                throw new Error('Unexpected response format from Gemini');
            }           
        }
    },

    mistral: {
        name: 'Mistral',
        icon: '🌟',
        color: '#FF7000',
        keyFile: '.aiduino-mistral-api-key',
        keyPrefix: 'sk-',
        keyMinLength: 15,
        hostname: 'api.mistral.ai',
        apiKeyUrl: 'https://console.mistral.ai/',
        path: '/v1/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => data.data?.filter(m => !m.id.includes('embed')) || [],
        selectBest: (models) => models.find(m => m.id.includes('medium-3') || m.id.includes('large')) || models[0],
        fallback: 'mistral-medium-3',
        prices: {
            input: 0.40 / 1000000,    // $0.40 per 1M tokens (war: 0.40 / 1000)
            output: 2.0 / 1000000     // $2.00 per 1M tokens (war: 2.0 / 1000)
        },
        apiConfig: {
            apiPath: '/v1/chat/completions',
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            }),
            buildRequest: (modelId, prompt, systemPrompt) => ({
                model: modelId,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                max_tokens: 2000,
                temperature: 0.7
            }),
            extractResponse: (data) => data.choices[0].message.content
        }
    },
    
    perplexity: {
        name: 'Perplexity',
        icon: '🔍',
        color: '#20B2AA',
        keyFile: '.aiduino-perplexity-api-key',
        keyPrefix: 'pplx-',
        keyMinLength: 15,
        hostname: 'api.perplexity.ai',
        apiKeyUrl: 'https://www.perplexity.ai/settings/api',
        path: '/chat/completions',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => [{ id: 'llama-3.1-sonar-large-128k-online', name: 'Llama 3.1 Sonar Large' }],
        selectBest: (models) => models[0],
        fallback: 'llama-3.1-sonar-large-128k-online',
        prices: {
           input: 1.0 / 1000000,     // $1.00 per 1M tokens (war: 1.0 / 1000)
           output: 3.0 / 1000000     // $3.00 per 1M tokens (war: 3.0 / 1000)
        }   ,
        apiConfig: {
            apiPath: '/chat/completions',
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            }),
            buildRequest: (modelId, prompt, systemPrompt) => ({
                model: modelId,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                max_tokens: 2000,
                temperature: 0.7
            }),
            extractResponse: (data) => data.choices[0].message.content
        }
    },
    
    cohere: {
        name: 'Cohere',
        icon: '🔥',
        color: '#39C5BB',
        keyFile: '.aiduino-cohere-api-key',
        keyPrefix: 'co-',
        keyMinLength: 15,
        hostname: 'api.cohere.ai',
        apiKeyUrl: 'https://dashboard.cohere.ai/api-keys',
        path: '/v1/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => data.models?.filter(m => m.name.includes('command')) || [],
        selectBest: (models) => models.find(m => m.name.includes('command-r-plus')) || models[0],
        fallback: 'command-r-plus',
        prices: {
            input: 2.5 / 1000000,     // $2.50 per 1M tokens (war: 2.5 / 1000)
            output: 10.0 / 1000000    // $10.00 per 1M tokens (war: 10.0 / 1000)
        },
        apiConfig: {
            apiPath: '/v1/chat',
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            }),
            buildRequest: (modelId, prompt, systemPrompt) => ({
                model: modelId,
                message: prompt,
                max_tokens: 2000,
                temperature: 0.7
            }),
            extractResponse: (data) => data.text || data.message || data.choices[0].message.content
        }
    },
    
    groq: {
        name: 'Groq',
        icon: '🚀',
        color: '#F55036',
        keyFile: '.aiduino-groq-api-key',
        keyPrefix: 'gsk_',
        hostname: 'api.groq.com',
        apiKeyUrl: 'https://console.groq.com/keys',
        path: '/openai/v1/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => data.data?.filter(m => m.id.includes('llama') || m.id.includes('mixtral')) || [],
        selectBest: (models) => models.find(m => m.id.includes('llama-3.1')) || models[0],
        fallback: 'llama-3.3-70b-versatile',  // Statt llama-3.1-70b-versatile
        prices: {
            input: 0.59 / 1000000,    // $0.59 per 1M tokens (war: 0.59 / 1000)
            output: 0.79 / 1000000    // $0.79 per 1M tokens (war: 0.79 / 1000)
        },
        apiConfig: {
            apiPath: '/openai/v1/chat/completions',
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            }),
            buildRequest: (modelId, prompt, systemPrompt) => {
                const messages = [];
                if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim()) {
                    messages.push({ role: "system", content: systemPrompt.trim() });
                }      
                messages.push({ role: "user", content: prompt });              
                return {
                    model: modelId,
                    messages: messages,
                    max_tokens: 2000,
                    temperature: 0.7
                };
            },
            extractResponse: (data) => {
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    return data.choices[0].message.content;
                }
                throw new Error('Unexpected Groq API response format');
            }
        }
    },
     
    vertex: {
        name: 'Vertex AI',
        icon: '☁️',
        color: '#4285F4',
        keyFile: '.aiduino-vertex-api-key',
        keyPrefix: 'ya29.',
        keyMinLength: 20,
        hostname: 'us-central1-aiplatform.googleapis.com',
        apiKeyUrl: 'https://console.cloud.google.com/apis/credentials',
        path: '/v1/projects/YOUR_PROJECT/locations/us-central1/publishers/anthropic/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => data.models?.filter(m => m.name.includes('claude')) || [],
        selectBest: (models) => models.find(m => m.name.includes('claude-3')) || models[0],
        fallback: 'claude-3-sonnet@20240229',
        prices: {
           input: 3.0 / 1000000,     // $3.00 per 1M tokens (war: 3.0 / 1000)
           output: 15.0 / 1000000    // $15.00 per 1M tokens (war: 15.0 / 1000)
        },
        apiConfig: {
            apiPath: '/v1/projects/YOUR_PROJECT/locations/us-central1/publishers/anthropic/models/claude-3-sonnet@20240229:predict',
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            }),
            buildRequest: (modelId, prompt, systemPrompt) => ({
                instances: [{
                    messages: [
                        { role: "human", content: prompt }
                    ],
                    max_tokens: 2000,
                    temperature: 0.7
                }]
            }),
            extractResponse: (data) => data.predictions[0].content[0].text
        }
    },
    
    huggingface: {
        name: 'Hugging Face',
        icon: '🤗',
        color: '#FF9500',
        keyFile: '.aiduino-hf-api-key',
        keyPrefix: 'hf_',
        keyMinLength: 15,
        hostname: 'api-inference.huggingface.co',
        apiKeyUrl: 'https://huggingface.co/settings/tokens',
        path: '/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => [{ id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B Instruct' }],
        selectBest: (models) => models[0],
        fallback: 'meta-llama/Llama-3.3-70B-Instruct',
        prices: {
           input: 0.0005 / 1000000,  // $0.0005 per 1M tokens (war: 0.0005 / 1000)
           output: 0.0015 / 1000000  // $0.0015 per 1M tokens (war: 0.0015 / 1000)
        },
        apiConfig: {
            apiPath: '/models/meta-llama/Llama-3.3-70B-Instruct',
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            }),
            buildRequest: (modelId, prompt, systemPrompt) => ({
                inputs: prompt,
                parameters: {
                    max_new_tokens: 2000,
                    temperature: 0.7,
                    return_full_text: false
                }
            }),
            extractResponse: (data) => data[0].generated_text
        }
    }
};

module.exports = {
    PROVIDER_CONFIGS,
    CONFIG_VERSION,
    REMOTE_CONFIG_URL
};
