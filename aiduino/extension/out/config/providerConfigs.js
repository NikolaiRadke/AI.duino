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
<<<<<<< HEAD
const CONFIG_VERSION = '011025'; 
>>>>>>> 51c3e3ad3a12a55210871f968cf2c441def9d5dc
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
            input: 3.0 / 1000000,     // $3.00 per 1M tokens (was: 3.0 / 1000)
            output: 15.0 / 1000000    // $15.00 per 1M tokens (was: 15.0 / 1000)
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
        selectBest: (models) => models.find(m => m.id.includes('gpt-4o')) || models.find(m => m.id.includes('gpt-4')) || models[0],
        fallback: 'gpt-4o',
        prices: {
            input: 1.25 / 1000000,    // $1.25 per 1M tokens
            output: 10.0 / 1000000    // $10.00 per 1M tokens
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
                    { role: "system", content: systemPrompt || "You are a helpful assistant." },
                    { role: "user", content: prompt }
                ],
                max_completion_tokens: 2000,
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
            input: 0.075 / 1000000,
            output: 0.30 / 1000000
        },
        apiConfig: {
            apiPath: (modelId, key) => {
                if (!modelId.startsWith('models/')) modelId = 'models/' + modelId;
                return `/v1/${modelId}:generateContent?key=${key}`;
            },
            method: 'POST',
            headers: () => ({ 'Content-Type': 'application/json' }),
            buildRequest: (modelId, prompt) => ({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192
                }
            }),
            extractResponse: (data) => {
                if (data.error) throw new Error(data.error.message);
                return data.candidates[0].content.parts[0].text;
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
            input: 0.40 / 1000000,    // $0.40 per 1M tokens (was: 0.40 / 1000)
            output: 2.0 / 1000000     // $2.00 per 1M tokens (was: 2.0 / 1000)
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
           input: 1.0 / 1000000,     // $1.00 per 1M tokens (was: 1.0 / 1000)
           output: 3.0 / 1000000     // $3.00 per 1M tokens (was: 3.0 / 1000)
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
        selectBest: (models) => models.find(m => m.name.includes('command-a')) || models.find(m => m.name.includes('command-r-plus')) || models[0],
        fallback: 'command-a-03-2025',
        prices: {
            input: 2.5 / 1000000,     // $2.50 per 1M tokens
            output: 10.0 / 1000000    // $10.00 per 1M tokens
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
                preamble: systemPrompt || "You are a helpful assistant specialized in Arduino programming and electronics.",
                max_tokens: 2000,
                temperature: 0.7
            }),
            extractResponse: (data) => {
                if (data.text) {
                    return data.text;
                }
                throw new Error('Unexpected Cohere response format');
            }
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
            input: 0.59 / 1000000,    // $0.59 per 1M tokens (was: 0.59 / 1000)
            output: 0.79 / 1000000    // $0.79 per 1M tokens (was: 0.79 / 1000)
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
        // NOTE: Vertex AI requires Google Cloud Platform setup
        // Before using this provider, you must:
        // 1. Create a Google Cloud Project at https://console.cloud.google.com
        // 2. Enable the Vertex AI API for your project
        // 3. Create a Service Account with Vertex AI permissions
        // 4. Generate an OAuth 2.0 access token (starts with 'ya29.')
        // 5. Replace 'YOUR_PROJECT_ID' in the apiPath with your actual GCP project ID
        // 
        // This provider is designed for enterprise users. For simple AI integration,
        // consider using the direct Gemini provider instead.
        
        name: 'Vertex AI',
        icon: '☁️',
        color: '#4285F4',
        keyFile: '.aiduino-vertex-api-key',
        keyPrefix: 'ya29.',
        keyMinLength: 20,
        hostname: 'us-central1-aiplatform.googleapis.com',
        apiKeyUrl: 'https://console.cloud.google.com/apis/credentials',
        path: '/v1/projects/PROJECT_ID/locations/us-central1/publishers/google/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => data.models?.filter(m => m.name.includes('gemini')) || [],
        selectBest: (models) => models.find(m => m.name.includes('gemini-1.5-pro')) || models[0],
        fallback: 'gemini-1.5-pro',
        prices: {
            input: 1.25 / 1000000,
            output: 5.0 / 1000000
        },
        apiConfig: {
            apiPath: (modelId, key, projectId) => {
                const project = projectId || 'YOUR_PROJECT_ID'; // Replace with your GCP project ID
                return `/v1/projects/${project}/locations/us-central1/publishers/google/models/${modelId}:predict`;
            },
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            }),
            buildRequest: (modelId, prompt, systemPrompt) => ({
                instances: [{
                    content: prompt
                }],
                parameters: {
                    temperature: 0.7,
                    maxOutputTokens: 2000,
                    topP: 0.8,
                    topK: 40
                }
            }),
            extractResponse: (data) => {
                if (data.predictions && data.predictions[0]) {
                    return data.predictions[0].content || data.predictions[0].candidates?.[0]?.content;
                }
                throw new Error('Unexpected Vertex AI response format');
            }
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
            input: 0.0005 / 1000000,  // $0.0005 per 1M tokens
            output: 0.0015 / 1000000  // $0.0015 per 1M tokens
        },
        apiConfig: {
            apiPath: (modelId) => `/models/${modelId}`,
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            }),
            buildRequest: (modelId, prompt, systemPrompt) => ({
                inputs: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
                parameters: {
                    max_new_tokens: 2000,
                    temperature: 0.7,
                    return_full_text: false,
                    do_sample: true
                }
            }),
            extractResponse: (data) => {
                if (Array.isArray(data) && data[0] && data[0].generated_text) {
                    return data[0].generated_text;
                }
                if (data.generated_text) {
                    return data.generated_text;
                }
                throw new Error('Unexpected Hugging Face response format');
            }
        }
    },

    claudecode: {
        name: 'Claude Code',
        icon: '🤖',
        color: '#FF6B35',
        type: 'local',
        keyFile: '.aiduino-claudecode-path',
        keyPrefix: '/', 
        keyMinLength: 5, 
        apiKeyUrl: 'https://docs.claude.com/en/docs/claude-code',
        fallback: 'claude-code-local',
        processConfig: {
            command: 'claude',
            
            buildPrompt: (prompt, context) => {
                // Use same prompt format as API providers for consistency
                return prompt;
            },            
            buildArgs: (prompt, context) => {
                return [
                    '--print', 
                    '--dangerously-skip-permissions',
                    '--output-format', 'json',
                    prompt
                ];
            }
        },        
        prices: {
            input: 0.0,
            output: 0.0
        }
    },

    ollama: {
        name: 'Ollama',
        icon: '🦙',
        color: '#FF6B35',
        type: 'local',
        keyFile: '.aiduino-ollama-url',
        keyPrefix: 'http',
        keyMinLength: 7,
        apiKeyUrl: 'https://ollama.com',
        fallback: 'llama3:latest',
        autoDetectUrls: ['http://127.0.0.1:11434', 'http://localhost:11434'],
        httpConfig: {
            endpoint: '/api/chat'
        },
        prices: {
            input: 0.0,
            output: 0.0
        }
    }      
};  
    
module.exports = {
    PROVIDER_CONFIGS,
    CONFIG_VERSION,
    REMOTE_CONFIG_URL
};
