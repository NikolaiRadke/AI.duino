/*
 * AI.duino - Provider Configurations
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

// Auto-repair corrupted ChatGPT model in stored API key file
(function repairChatGPTModel() {
    try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        
        const keyFile = path.join(os.homedir(), '.aiduino', '.aiduino-openai-api-key');
        
        if (fs.existsSync(keyFile)) {
            const content = fs.readFileSync(keyFile, 'utf8').trim();
            const [apiKey, savedModel] = content.split('|');
            
            if (savedModel) {
                // Check if model is a TTS model or other non-chat model
                const invalidPatterns = ['tts', 'whisper', 'dall-e', 'instruct', 'davinci', 'curie', 'babbage', 'ada', 'base'];
                const isInvalid = invalidPatterns.some(pattern => savedModel.includes(pattern));
                
                if (isInvalid) {
                    // Replace with valid fallback
                    const repairedContent = `${apiKey}|gpt-4o`;
                    fs.writeFileSync(keyFile, repairedContent, 'utf8');
                    console.log('ChatGPT: Auto-repaired invalid model:', savedModel, '→ gpt-4o');
                }
            }
        }
    } catch (err) {
        // Silent fail - don't break extension if repair fails
        console.error('ChatGPT: Model repair failed (non-critical):', err.message);
    }
})();

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
const CONFIG_VERSION = '120226'; 
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
        extractModels: (data) => data.data?.filter(m => m.type === 'model' && !m.id.includes('deprecated')) || [],
        selectBest: (models) => models.find(m => m.id.includes('opus-4-5')) || models.find(m => m.id.includes('sonnet-4-5')) || models.find(m => m.id.includes('sonnet-4')) || models.find(m => m.id.includes('haiku')) || models[0],
        fallback: 'claude-sonnet-4-5-20250929',
        prices: {
            input: 3.0 / 1000000,     // $3.00 per 1M tokens (Sonnet 4.5)
            output: 15.0 / 1000000    // $15.00 per 1M tokens (Opus 4.5: $5/$25)
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
        extractModels: (data) => data.data?.filter(m => {
            // Whitelist: Only known chat model patterns
            const chatPatterns = [
                'gpt-4o',           // GPT-4o family
                'gpt-4-turbo',      // GPT-4 Turbo family
                'gpt-3.5-turbo'     // GPT-3.5 Turbo family
            ];
            
            // Check if model matches any chat pattern
            const isKnownChatModel = chatPatterns.some(pattern => m.id.includes(pattern));
            
            // Or is exactly 'gpt-4' (the base chat model, not gpt-4-base)
            const isBaseGPT4 = m.id === 'gpt-4';
            
            return isKnownChatModel || isBaseGPT4;
        }) || [],
        selectBest: (models) => models.find(m => m.id.includes('gpt-4o')) || models.find(m => m.id.includes('gpt-4-turbo')) || models.find(m => m.id.includes('gpt-3.5-turbo')) || models[0],
        fallback: 'gpt-4o',
        prices: {
            input: 2.50 / 1000000,    // $2.50 per 1M tokens (GPT-4o pricing, reduced from $5)
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
        apiKeyUrl: 'https://aistudio.google.com/apikey',
        path: '/v1/models?key=',
        headers: () => ({}),
        extractModels: (data) => data.models?.filter(m => m.supportedGenerationMethods?.includes('generateContent')) || [],
        selectBest: (models) => models.find(m => m.name.includes('2.5-flash')) || models.find(m => m.name.includes('1.5-flash')) || models[0],
        fallback: 'models/gemini-2.5-flash',
        prices: {
            input: 0.15 / 1000000,
            output: 0.60 / 1000000
        },
        apiConfig: {
            apiPath: (modelId, key) => {
                if (!modelId.startsWith('models/')) modelId = 'models/' + modelId;
                return `/v1/${modelId}:generateContent?key=${key}`;
            },
            method: 'POST',
            headers: () => ({ 'Content-Type': 'application/json' }),
            buildRequest: (modelId, prompt, systemPrompt) => ({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 65536
                }
            }),
            extractResponse: (data) => {
                if (data.error) throw new Error(data.error.message);
                if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    throw new Error(`Gemini: ${data.candidates?.[0]?.finishReason || 'No response'}`);
                }
                return data.candidates[0].content.parts[0].text;
            }
        }
    },  

    mistral: {
        name: 'Mistral',
        icon: '🌟',
        color: '#FF7000',
        keyFile: '.aiduino-mistral-api-key',
        keyPrefix: '',
        keyMinLength: 32,
        hostname: 'api.mistral.ai',
        apiKeyUrl: 'https://console.mistral.ai/',
        path: '/v1/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => data.data?.filter(m => !m.id.includes('embed')) || [],
        selectBest: (models) => models.find(m => m.id.includes('medium-3') || m.id.includes('large')) || models[0],
        fallback: 'mistral-medium-3',
        prices: {
            input: 2.0 / 1000000,     // $2.00 per 1M tokens (Mistral Large pricing, Sept 2024)
            output: 6.0 / 1000000     // $6.00 per 1M tokens
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
    
    groq: {
        name: 'Groq',
        icon: '⚡',
        color: '#F55036',
        keyFile: '.aiduino-groq-api-key',
        keyPrefix: 'gsk_',
        keyMinLength: 20,
        hostname: 'api.groq.com',
        apiKeyUrl: 'https://console.groq.com/keys',
        path: '/openai/v1/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => data.data?.filter(m => !m.id.includes('whisper') && !m.id.includes('guard')) || [],
        selectBest: (models) => models.find(m => m.id.includes('llama-3.3-70b')) || models.find(m => m.id.includes('llama-3.1-70b')) || models.find(m => m.id.includes('mixtral')) || models[0],
        fallback: 'llama-3.3-70b-versatile',
        prices: {
            input: 0.59 / 1000000,    // $0.59 per 1M tokens (Llama 3.3 70B)
            output: 0.79 / 1000000    // $0.79 per 1M tokens
        },
        apiConfig: {
            apiPath: '/openai/v1/chat/completions',
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
        color: '#20808D',
        keyFile: '.aiduino-perplexity-api-key',
        keyPrefix: 'pplx-',
        keyMinLength: 20,
        hostname: 'api.perplexity.ai',
        apiKeyUrl: 'https://www.perplexity.ai/settings/api',
        path: '/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => {
            // Perplexity returns models in a simpler format
            if (Array.isArray(data)) {
                return data.map(m => ({ id: m }));
            }
            return data.data || [];
        },
        selectBest: (models) => models.find(m => m.id?.includes('llama-3.1-sonar-large')) || models.find(m => m.id?.includes('sonar-pro')) || models[0],
        fallback: 'llama-3.1-sonar-large-128k-online',
        prices: {
            input: 1.0 / 1000000,     // $1.00 per 1M tokens (Sonar Large)
            output: 1.0 / 1000000     // $1.00 per 1M tokens
        },
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

    together: {
        name: 'Together AI',
        icon: '🤝',
        color: '#6366F1',
        keyFile: '.aiduino-together-api-key',
        keyPrefix: '',
        keyMinLength: 32,
        hostname: 'api.together.xyz',
        apiKeyUrl: 'https://api.together.xyz/settings/api-keys',
        path: '/v1/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => data.data?.filter(m => m.type === 'chat') || [],
        selectBest: (models) => models.find(m => m.id.includes('meta-llama/Llama-3.3-70B')) || models.find(m => m.id.includes('mixtral')) || models[0],
        fallback: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        prices: {
            input: 0.88 / 1000000,    // $0.88 per 1M tokens (Llama 3.3 70B)
            output: 0.88 / 1000000    // $0.88 per 1M tokens
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

    fireworks: {
        name: 'Fireworks AI',
        icon: '🎆',
        color: '#FF4500',
        keyFile: '.aiduino-fireworks-api-key',
        keyPrefix: 'fw_',
        keyMinLength: 20,
        hostname: 'api.fireworks.ai',
        apiKeyUrl: 'https://fireworks.ai/api-keys',
        path: '/v1/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => data.data?.filter(m => m.id.includes('llama') || m.id.includes('mistral') || m.id.includes('mixtral')) || [],
        selectBest: (models) => models.find(m => m.id.includes('llama-v3p3-70b')) || models.find(m => m.id.includes('llama-v3p1-70b')) || models[0],
        fallback: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
        prices: {
            input: 0.90 / 1000000,    // $0.90 per 1M tokens (Llama 3.3 70B)
            output: 0.90 / 1000000    // $0.90 per 1M tokens
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

    openrouter: {
        name: 'OpenRouter',
        icon: '🌐',
        color: '#8B5CF6',
        keyFile: '.aiduino-openrouter-api-key',
        keyPrefix: 'sk-or-',
        keyMinLength: 20,
        hostname: 'openrouter.ai',
        apiKeyUrl: 'https://openrouter.ai/keys',
        path: '/api/v1/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        staticModels: [
            { 
                id: 'anthropic/claude-opus-4-5-20251101', 
                name: 'Claude Opus 4.5', 
                pricing: { input: 5.0 / 1000000, output: 25.0 / 1000000 }
            },
            { 
                id: 'anthropic/claude-sonnet-4-5-20250929', 
                name: 'Claude Sonnet 4.5', 
                pricing: { input: 3.0 / 1000000, output: 15.0 / 1000000 }
            },
            { 
                id: 'anthropic/claude-sonnet-4-20250514', 
                name: 'Claude Sonnet 4.5', 
                pricing: { input: 3.0 / 1000000, output: 15.0 / 1000000 }
            },
            { 
                id: 'openai/gpt-4o', 
                name: 'GPT-4o', 
                pricing: { input: 2.5 / 1000000, output: 10.0 / 1000000 }
            },
            { 
                id: 'openai/gpt-4o-mini', 
                name: 'GPT-4o Mini', 
                pricing: { input: 0.15 / 1000000, output: 0.6 / 1000000 }
            },
            { 
                id: 'google/gemini-pro-1.5', 
                name: 'Gemini 1.5 Pro', 
                pricing: { input: 1.25 / 1000000, output: 5.0 / 1000000 }
            },
            { 
                id: 'google/gemini-flash-1.5', 
                name: 'Gemini 1.5 Flash', 
                pricing: { input: 0.075 / 1000000, output: 0.3 / 1000000 }
            },
            { 
                id: 'meta-llama/llama-3.3-70b-instruct:free', 
                name: 'Llama 3.3 70B (Free)', 
                pricing: { input: 0, output: 0 }
            },
            { 
                id: 'meta-llama/llama-3.3-70b-instruct', 
                name: 'Llama 3.3 70B', 
                pricing: { input: 0.59 / 1000000, output: 0.79 / 1000000 }
            },
            { 
                id: 'mistralai/mistral-large', 
                name: 'Mistral Large', 
                pricing: { input: 2.0 / 1000000, output: 6.0 / 1000000 }
            },
            { 
                id: 'deepseek/deepseek-chat', 
                name: 'DeepSeek Chat', 
                pricing: { input: 0.14 / 1000000, output: 0.28 / 1000000 }
            }
        ],
        extractModels: (data) => data.data || [],
        selectBest: (models) => models[0],
        fallback: 'meta-llama/llama-3.3-70b-instruct:free',
        prices: {
            input: 0,  // Varies per model
            output: 0
        },
        apiConfig: {
            apiPath: '/api/v1/chat/completions',
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
                'HTTP-Referer': 'https://github.com/NikolaiRadke/AI.duino',
                'X-Title': 'AI.duino'
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
                throw new Error('Unexpected OpenRouter API response format');
            }
        }
    },

    claudecode: {
        name: 'Claude Code',
        icon: '🤖',
        color: '#FF6B35',
        type: 'local',
        agentModule: 'claudeCode',  // Which agent module to use
        persistent: true, // Killer feature!
        keyFile: '.aiduino-claudecode-path',
        keyPrefix: '', 
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

    codexcli: {
        name: 'Codex CLI',
        icon: '🧠',
        color: '#10A37F',
        type: 'local',
        persistent: true,
        agentModule: 'codexAgent',  // Which agent module to use
        keyFile: '.aiduino-codexcli-path',
        keyPrefix: '',  // Path to codex binary, not API key
        keyMinLength: 5,
        apiKeyUrl: 'https://github.com/openai/codex',
        fallback: 'codex-cli-local',
        processConfig: {
            command: 'codex',
            
            // Build prompt for Codex CLI
            buildPrompt: (prompt, context) => {
                // Use same prompt format as API providers
                return prompt;
            },
            
            // Build command arguments
            buildArgs: (prompt, context) => {
                return [
                    '--suggest',  // Suggest mode (safe, shows changes before applying)
                    '--non-interactive',  // No interactive prompts
                    prompt
                ];
            }
        },
        prices: {
            input: 0.0,   // Costs depend on ChatGPT plan or OpenAI API usage
            output: 0.0   // User must authenticate via 'codex' CLI first
        }
    },
    
    ollama: {
        name: 'Ollama',
        icon: '🦙',
        color: '#FF6B35',
        type: 'local',
        persistent: false,
        keyFile: '.aiduino-ollama-url',
        keyPrefix: 'http',
        keyMinLength: 7,
        apiKeyUrl: 'https://ollama.com',
        fallback: 'llama3:latest',
        autoDetectUrls: ['http://127.0.0.1:11434', 'http://localhost:11434'],
        defaultPort: 11434,
        httpConfig: {
            endpoint: '/api/chat'
        },
        prices: {
            input: 0.0,
            output: 0.0
        }
    },

    lmstudio: {
        name: 'LM Studio',
        icon: '🖥️',
        color: '#4A90E2',
        type: 'local',
        persistent: false,
        keyFile: '.aiduino-lmstudio-url',
        keyPrefix: 'http',
        keyMinLength: 7,
        apiKeyUrl: 'https://lmstudio.ai',
        fallback: 'llama-3-8b',
        autoDetectUrls: ['http://127.0.0.1:1234', 'http://localhost:1234'],
        defaultPort: 1234,
        preferredModels: [
            'llama-3',
            'codestral',
            'mistral',
            'phi-3',
            'qwen',
            'deepseek'
        ],
        httpConfig: {
            endpoint: '/v1/chat/completions'
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
