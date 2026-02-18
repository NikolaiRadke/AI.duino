/*
 * AI.duino - Provider Configurations
 * Copyright 2026 Monster Maker
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
    modelDiscovery: {
        enabled: true,                    // Enable automatic model discovery
        endpoint: '/v1/models',           // Optional: Override path
        cacheMinutes: 60,                 // How long to cache models
        extractModels: (data) => data.data || [],  // Extract models from API
        selectDefault: (models) => models[0]  // Select default model
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
const CONFIG_VERSION = '180226'; 
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
        selectBest: (models) => models.find(m => m.id.includes('opus-4-6')) || models.find(m => m.id.includes('sonnet-4-6')) || models.find(m => m.id.includes('opus-4-5')) || models.find(m => m.id.includes('sonnet-4-5')) || models.find(m => m.id.includes('haiku')) || models[0],
        fallback: 'claude-sonnet-4-6',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,  // Cache longer for stable APIs
            extractModels: (data) => data.data?.filter(m => m.type === 'model' && !m.id.includes('deprecated')) || [],
            selectDefault: (models) => models.find(m => m.id.includes('opus-4-6')) || models.find(m => m.id.includes('sonnet-4-6')) || models.find(m => m.id.includes('opus-4-5')) || models.find(m => m.id.includes('sonnet-4-5')) || models.find(m => m.id.includes('haiku')) || models[0],
            staticModels: [
                { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', displayName: 'Opus 4.6' },
                { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', displayName: 'Sonnet 4.6' },
                { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', displayName: 'Opus 4.5' },
                { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', displayName: 'Sonnet 4.5' },
                { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', displayName: 'Haiku 4.5' }
            ]
        },
        prices: {
            input: 3.0 / 1000000,     // $3.00 per 1M tokens (Sonnet 4.6)
            output: 15.0 / 1000000    // $15.00 per 1M tokens (Opus 4.6: $5/$25)
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
            // Only chat models
            if (!m.id.startsWith('gpt-')) return false;
            
            // Exclude non-chat models
            const excludePatterns = ['tts', 'whisper', 'dall-e', 'instruct', 'davinci', 'curie', 'babbage', 'ada'];
            return !excludePatterns.some(pattern => m.id.includes(pattern));
        }) || [],
        selectBest: (models) => models.find(m => m.id.includes('gpt-4o')) || models.find(m => m.id.includes('gpt-4')) || models[0],
        fallback: 'gpt-4o',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,  // Cache longer for stable APIs
            extractModels: (data) => data.data?.filter(m => {
                if (!m.id.startsWith('gpt-')) return false;
                const excludePatterns = ['tts', 'whisper', 'dall-e', 'instruct', 'davinci', 'curie', 'babbage', 'ada'];
                return !excludePatterns.some(pattern => m.id.includes(pattern));
            }) || [],
            selectDefault: (models) => models.find(m => m.id.includes('gpt-4o')) || models.find(m => m.id.includes('gpt-4')) || models[0],
            staticModels: [
                { id: 'gpt-4o', name: 'GPT-4o', displayName: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini', displayName: 'GPT-4o Mini' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', displayName: 'GPT-4 Turbo' }
            ]
        },
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
        selectBest: (models) => models.find(m => m.name.includes('2.5-flash')) || models.find(m => m.name.includes('2.5-pro')) || models.find(m => m.name.includes('2.0-flash')) || models[0],
        fallback: 'models/gemini-2.5-flash',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,
            extractModels: (data) => data.models?.filter(m => m.supportedGenerationMethods?.includes('generateContent')) || [],
            selectDefault: (models) => models.find(m => m.name.includes('2.5-flash')) || models.find(m => m.name.includes('2.5-pro')) || models.find(m => m.name.includes('2.0-flash')) || models[0],
            staticModels: [
                { id: 'models/gemini-2.5-flash', name: 'Gemini 2.5 Flash', displayName: 'Gemini 2.5 Flash' },
                { id: 'models/gemini-2.5-pro', name: 'Gemini 2.5 Pro', displayName: 'Gemini 2.5 Pro' },
                { id: 'models/gemini-2.0-flash', name: 'Gemini 2.0 Flash', displayName: 'Gemini 2.0 Flash' }
            ]
        },
        prices: {
            input: 0.30 / 1000000,    // $0.30 per 1M tokens (Gemini 2.5 Flash)
            output: 2.50 / 1000000    // $2.50 per 1M tokens (2.5 Pro: $1.25/$10.00)
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
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,
            extractModels: (data) => data.data?.filter(m => !m.id.includes('embed')) || [],
            selectDefault: (models) => models.find(m => m.id.includes('medium-3') || m.id.includes('large')) || models[0],
            staticModels: [
                { id: 'mistral-large-latest', name: 'Mistral Large', displayName: 'Mistral Large' },
                { id: 'mistral-medium-3', name: 'Mistral Medium 3', displayName: 'Mistral Medium 3' },
                { id: 'mistral-small-latest', name: 'Mistral Small', displayName: 'Mistral Small' }
            ]
        },
        prices: {
            input: 0.40 / 1000000,    // $0.40 per 1M tokens (Mistral Medium 3, May 2025)
            output: 2.00 / 1000000    // $2.00 per 1M tokens (Large 3: $2/$5)
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
        extractModels: (data) => [{ id: 'sonar', name: 'Sonar' }],
        selectBest: (models) => models[0],
        fallback: 'sonar',
        modelDiscovery: {
            enabled: false,  // No model discovery API
            staticModels: [
                { id: 'sonar', name: 'Sonar', displayName: 'Sonar' }
            ]
        },
        prices: {
           input: 1.0 / 1000000,     // $1.00 per 1M tokens (Sonar, 2026)
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
        extractModels: (data) => (data.models || data.data)?.filter(m => (m.name || m.id)?.includes('command')) || [],
        selectBest: (models) => models.find(m => m.name.includes('command-a')) || models.find(m => m.name.includes('command-r-plus')) || models[0],
        fallback: 'command-a-03-2025',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,
            extractModels: (data) => (data.models || data.data)?.filter(m => (m.name || m.id)?.includes('command')) || [],
            selectDefault: (models) => models.find(m => m.name?.includes('command-a')) || models.find(m => m.name?.includes('command-r-plus')) || models[0],
            staticModels: [
                { id: 'command-a-03-2025', name: 'Command A', displayName: 'Command A' },
                { id: 'command-r-plus', name: 'Command R+', displayName: 'Command R+' },
                { id: 'command-r', name: 'Command R', displayName: 'Command R' }
            ]
        },
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
        keyMinLength: 20,
        hostname: 'api.groq.com',
        apiKeyUrl: 'https://console.groq.com/keys',
        path: '/openai/v1/models',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => data.data || [],
        selectBest: (models) => {
            // Prefer fast models for Arduino development
            const preferred = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];
            for (const model of preferred) {
                const found = models.find(m => m.id === model);
                if (found) return found.id;
            }
            return models[0]?.id || 'llama-3.3-70b-versatile';
        },
        fallback: 'llama-3.3-70b-versatile',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,
            extractModels: (data) => data.data?.filter(m => {
                const id = m.id.toLowerCase();
                
                // Exclude non-chat models
                const excludePatterns = [
                    'whisper',      // Audio models
                    'vision',       // Image models
                    'guard',        // Safety/moderation models
                    'distil',       // Distilled (lower quality) models
                ];
                if (excludePatterns.some(pattern => id.includes(pattern))) return false;
                
                // Only include main chat model families
                const chatFamilies = ['llama', 'mixtral', 'gemma'];
                return chatFamilies.some(family => id.includes(family));
            }) || [],
            selectDefault: (models) => {
                // Prefer fast models for Arduino development
                const preferred = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];
                for (const model of preferred) {
                    const found = models.find(m => m.id === model);
                    if (found) return found;
                }
                return models[0];
            },
            staticModels: [
                { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', displayName: 'Llama 3.3 70B Versatile' },
                { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B Versatile', displayName: 'Llama 3.1 70B Versatile' },
                { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', displayName: 'Llama 3.1 8B Instant' },
                { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', displayName: 'Mixtral 8x7B' },
                { id: 'gemma2-9b-it', name: 'Gemma 2 9B', displayName: 'Gemma 2 9B' }
            ]
        },
        prices: {
            input: 0.59 / 1000000,   // $0.59 per 1M tokens
            output: 0.79 / 1000000   // $0.79 per 1M tokens
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
                temperature: 0.7,
                max_tokens: 2000
            }),
            extractResponse: (data) => {
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    return data.choices[0].message.content;
                }
                throw new Error('Unexpected Groq API response format');
            }
        }
    },
      
    huggingface: {
        name: 'Hugging Face (≥ v2.5.0)',
        icon: '🤗',
        color: '#FF9500',
        keyFile: '.aiduino-hf-api-key',
        keyPrefix: 'hf_',
        keyMinLength: 15,
        hostname: 'api-inference.huggingface.co',
        apiKeyUrl: 'https://huggingface.co/settings/tokens',
        path: '/models',
        requiresModelSelection: true,
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        // Popular open-source models available on HF
        availableModels: [
            { 
                id: 'meta-llama/Llama-3.3-70B-Instruct', 
                name: 'Llama 3.3 70B Instruct',
                pricing: { input: 0.0005 / 1000000, output: 0.0015 / 1000000 }
            },
            { 
                id: 'meta-llama/Llama-3.1-70B-Instruct', 
                name: 'Llama 3.1 70B Instruct',
                pricing: { input: 0.0005 / 1000000, output: 0.0015 / 1000000 }
            },
            { 
                id: 'codellama/CodeLlama-34b-Instruct-hf', 
                name: 'CodeLlama 34B Instruct',
                pricing: { input: 0, output: 0 }
            },
            { 
                id: 'mistralai/Mistral-7B-Instruct-v0.3', 
                name: 'Mistral 7B Instruct',
                pricing: { input: 0, output: 0 }
            },
            { 
                id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', 
                name: 'Mixtral 8x7B Instruct',
                pricing: { input: 0.0002 / 1000000, output: 0.0006 / 1000000 }
            },
            { 
                id: 'deepseek-ai/deepseek-coder-33b-instruct', 
                name: 'DeepSeek Coder 33B',
                pricing: { input: 0, output: 0 }
            },
            { 
                id: 'microsoft/Phi-3-medium-4k-instruct', 
                name: 'Phi-3 Medium',
                pricing: { input: 0, output: 0 }
            },
            { 
                id: 'Qwen/Qwen2.5-Coder-32B-Instruct', 
                name: 'Qwen 2.5 Coder 32B',
                pricing: { input: 0, output: 0 }
            },
            { 
                id: 'google/gemma-2-9b-it', 
                name: 'Gemma 2 9B',
                pricing: { input: 0, output: 0 }
            }
        ],
        extractModels: (data) => [{ id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B Instruct' }],
        selectBest: (models) => models[0],
        fallback: 'meta-llama/Llama-3.3-70B-Instruct',
        modelDiscovery: {
            enabled: false,  // Use static availableModels list instead
            staticModels: [
                { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B Instruct', displayName: 'Llama 3.3 70B' },
                { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B Instruct', displayName: 'Llama 3.1 70B' },
                { id: 'codellama/CodeLlama-34b-Instruct-hf', name: 'CodeLlama 34B Instruct', displayName: 'CodeLlama 34B' },
                { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B Instruct', displayName: 'Mistral 7B' },
                { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B Instruct', displayName: 'Mixtral 8x7B' },
                { id: 'deepseek-ai/deepseek-coder-33b-instruct', name: 'DeepSeek Coder 33B', displayName: 'DeepSeek Coder' },
                { id: 'microsoft/Phi-3-medium-4k-instruct', name: 'Phi-3 Medium', displayName: 'Phi-3 Medium' },
                { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B', displayName: 'Qwen 2.5 Coder' },
                { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', displayName: 'Gemma 2 9B' }
            ]
        },
        prices: {
            input: 0,  // Varies per model
            output: 0
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

    fireworks: {
        name: 'Fireworks AI (≥ v2.5.0)',
        icon: '🔥',
        color: '#FF6B00',
        keyFile: '.aiduino-fireworks-api-key',
        keyPrefix: 'fw-',
        keyMinLength: 20,
        hostname: 'api.fireworks.ai',
        apiKeyUrl: 'https://fireworks.ai/api-keys',
        path: '/inference/v1/models',
        requiresModelSelection: true,
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        // Popular models on Fireworks
        availableModels: [
            { 
                id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', 
                name: 'Llama 3.3 70B Instruct',
                pricing: { input: 0.90 / 1000000, output: 0.90 / 1000000 }
            },
            { 
                id: 'accounts/fireworks/models/qwen2p5-72b-instruct', 
                name: 'Qwen 2.5 72B Instruct',
                pricing: { input: 0.90 / 1000000, output: 0.90 / 1000000 }
            },
            { 
                id: 'accounts/fireworks/models/deepseek-v3', 
                name: 'DeepSeek V3',
                pricing: { input: 0.90 / 1000000, output: 0.90 / 1000000 }
            },
            { 
                id: 'accounts/fireworks/models/mixtral-8x7b-instruct', 
                name: 'Mixtral 8x7B Instruct',
                pricing: { input: 0.50 / 1000000, output: 0.50 / 1000000 }
            },
            { 
                id: 'accounts/fireworks/models/llama-v3p1-8b-instruct', 
                name: 'Llama 3.1 8B Instruct',
                pricing: { input: 0.20 / 1000000, output: 0.20 / 1000000 }
            },
            { 
                id: 'accounts/fireworks/models/gemma-2-9b-it', 
                name: 'Gemma 2 9B',
                pricing: { input: 0.20 / 1000000, output: 0.20 / 1000000 }
            }
        ],
        extractModels: (data) => data.data || [],
        selectBest: (models) => models[0],
        fallback: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,
            extractModels: (data) => data.data || [],
            selectDefault: (models) => models.find(m => m.id?.includes('llama-v3p3')) || models[0],
            staticModels: [
                { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', name: 'Llama 3.3 70B Instruct', displayName: 'Llama 3.3 70B', pricing: { input: 0.90 / 1000000, output: 0.90 / 1000000 } },
                { id: 'accounts/fireworks/models/qwen2p5-72b-instruct', name: 'Qwen 2.5 72B Instruct', displayName: 'Qwen 2.5 72B', pricing: { input: 0.90 / 1000000, output: 0.90 / 1000000 } },
                { id: 'accounts/fireworks/models/mixtral-8x7b-instruct', name: 'Mixtral 8x7B Instruct', displayName: 'Mixtral 8x7B', pricing: { input: 0.50 / 1000000, output: 0.50 / 1000000 } }
            ]
        },
        prices: {
            input: 0,  // Varies per model
            output: 0
        },
        apiConfig: {
            apiPath: '/inference/v1/chat/completions',
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
                throw new Error('Unexpected Fireworks AI response format');
            }
        }
    },

    together: {
        name: 'Together AI (≥ v2.5.0)',
        icon: '🤝',
        color: '#FF9500',
        keyFile: '.aiduino-together-api-key',
        keyPrefix: '',
        keyMinLength: 20,
        hostname: 'api.together.xyz',
        apiKeyUrl: 'https://api.together.xyz/settings/api-keys',
        path: '/v1/models',
        requiresModelSelection: true,
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        // Popular models on Together AI
        availableModels: [
            { 
                id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 
                name: 'Llama 3.3 70B Turbo',
                pricing: { input: 0.88 / 1000000, output: 0.88 / 1000000 }
            },
            { 
                id: 'meta-llama/Llama-3.1-70B-Instruct-Turbo', 
                name: 'Llama 3.1 70B Turbo',
                pricing: { input: 0.88 / 1000000, output: 0.88 / 1000000 }
            },
            { 
                id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', 
                name: 'Qwen 2.5 72B Turbo',
                pricing: { input: 0.88 / 1000000, output: 0.88 / 1000000 }
            },
            { 
                id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', 
                name: 'Mixtral 8x7B Instruct',
                pricing: { input: 0.60 / 1000000, output: 0.60 / 1000000 }
            },
            { 
                id: 'deepseek-ai/DeepSeek-V3', 
                name: 'DeepSeek V3',
                pricing: { input: 0.27 / 1000000, output: 1.10 / 1000000 }
            },
            { 
                id: 'meta-llama/Llama-3.1-8B-Instruct-Turbo', 
                name: 'Llama 3.1 8B Turbo',
                pricing: { input: 0.18 / 1000000, output: 0.18 / 1000000 }
            },
            { 
                id: 'google/gemma-2-9b-it', 
                name: 'Gemma 2 9B',
                pricing: { input: 0.20 / 1000000, output: 0.20 / 1000000 }
            }
        ],
        extractModels: (data) => data.data || [],
        selectBest: (models) => models[0],
        fallback: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,
            extractModels: (data) => data.data || [],
            selectDefault: (models) => models.find(m => m.id?.includes('Llama-3.3')) || models[0],
            staticModels: [
                { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', displayName: 'Llama 3.3 70B', pricing: { input: 0.88 / 1000000, output: 0.88 / 1000000 } },
                { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B Turbo', displayName: 'Qwen 2.5 72B', pricing: { input: 0.88 / 1000000, output: 0.88 / 1000000 } },
                { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B Instruct', displayName: 'Mixtral 8x7B', pricing: { input: 0.60 / 1000000, output: 0.60 / 1000000 } }
            ]
        },
        prices: {
            input: 0,  // Varies per model
            output: 0
        },
        apiConfig: {
            apiPath: '/v1/chat/completions',
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
                throw new Error('Unexpected Together AI response format');
            }
        }
    },

    openrouter: {
        name: 'OpenRouter (≥ v2.5.0)',
        icon: '⚡',
        color: '#FF6B35',
        keyFile: '.aiduino-openrouter-api-key',
        keyPrefix: 'sk-or-',
        keyMinLength: 40,
        hostname: 'openrouter.ai',
        apiKeyUrl: 'https://openrouter.ai/keys',
        path: '/api/v1/models',
        requiresModelSelection: true,
        headers: (key) => ({ 
            'Authorization': `Bearer ${key}`,
            'HTTP-Referer': 'https://github.com/NikolaiRadke/AI.duino',
            'X-Title': 'AI.duino'
        }),
        // Popular models
        availableModels: [
            { 
                id: 'meta-llama/llama-3.3-70b-instruct:free', 
                name: 'Llama 3.3 70B (Free)', 
                pricing: { input: 0, output: 0 }
            },
            { 
                id: 'anthropic/claude-sonnet-4-6', 
                name: 'Claude Sonnet 4.6', 
                pricing: { input: 3.0 / 1000000, output: 15.0 / 1000000 }
            },
            { 
                id: 'anthropic/claude-sonnet-4-5-20250929', 
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
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 60,
            extractModels: (data) => data.data || [],
            selectDefault: (models) => models.find(m => m.id?.includes('llama-3.3') && m.id?.includes('free')) || models[0],
            staticModels: [
                { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', displayName: 'Llama 3.3 70B Free', pricing: { input: 0, output: 0 } },
                { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', displayName: 'Claude Sonnet 4.6', pricing: { input: 3.0 / 1000000, output: 15.0 / 1000000 } },
                { id: 'openai/gpt-4o', name: 'GPT-4o', displayName: 'GPT-4o', pricing: { input: 2.5 / 1000000, output: 10.0 / 1000000 } }
            ]
        },
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
                if (data.error) {
                    const msg = data.error.message || data.error.code || JSON.stringify(data.error);
                    throw new Error(msg);
                }
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
        agentModule: 'claudeCode',
        persistent: true,
        keyFile: '.aiduino-claudecode-path',
        keyPrefix: '', 
        keyMinLength: 5, 
        apiKeyUrl: 'https://docs.claude.com/en/docs/claude-code',
        fallback: 'claude-sonnet-4-6',
        modelDiscovery: {
            enabled: true,
            staticModels: [
                { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', displayName: 'Opus 4.6' },
                { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', displayName: 'Sonnet 4.6' },
                { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', displayName: 'Opus 4.5' },
                { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', displayName: 'Sonnet 4.5' },
                { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', displayName: 'Haiku 4.5' }
            ],
            selectDefault: (models) => models.find(m => m.id.includes('sonnet')) || models[0]
        },
        processConfig: {
            command: 'claude',
            
            buildPrompt: (prompt, context) => {
                return prompt;
            },            
            buildArgs: (prompt, context, modelId) => {
                const args = [
                    '--print', 
                    '--dangerously-skip-permissions',
                    '--output-format', 'json'
                ];
                
                // Add model flag if specified
                if (modelId && modelId !== 'claude-code-local') {
                    args.push('--model', modelId);
                }
                
                args.push(prompt);
                return args;
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
        agentModule: 'codexCli',
        keyFile: '.aiduino-codexcli-path',
        keyPrefix: '',
        keyMinLength: 5,
        apiKeyUrl: 'https://github.com/openai/codex',
        fallback: 'gpt-4o',
        modelDiscovery: {
            enabled: true,
            staticModels: [
                { id: 'gpt-4o', name: 'GPT-4o', displayName: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini', displayName: 'GPT-4o Mini' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', displayName: 'GPT-4 Turbo' }
            ],
            selectDefault: (models) => models.find(m => m.id === 'gpt-4o') || models[0]
        },
        processConfig: {
            command: 'codex',
            
            buildPrompt: (prompt, context) => {
                return prompt;
            },
            
            buildArgs: (prompt, context, modelId) => {
                const args = ['--suggest', '--non-interactive'];
                
                // Add model flag if specified
                if (modelId && modelId !== 'codex-cli-local') {
                    args.push('--model', modelId);
                }
                
                args.push(prompt);
                return args;
            }
        },
        prices: {
            input: 0.0,
            output: 0.0
        }
    },

    mistralvibe: {
        name: 'Mistral Vibe (≥ v2.6.0)',
        icon: '🌟',
        color: '#FF7000',
        type: 'local',
        agentModule: 'mistralVibe',
        persistent: true,
        keyFile: '.aiduino-mistvibe-path',
        keyPrefix: '', 
        keyMinLength: 5, 
        apiKeyUrl: 'https://docs.mistral.ai/mistral-vibe/introduction',
        fallback: 'mistral-large-latest',
        modelDiscovery: {
            enabled: false,  // Mistral Vibe doesn't support --model flag
            staticModels: [
                { id: 'mistral-large-latest', name: 'Mistral Large', displayName: 'Mistral Large' },
                { id: 'mistral-medium-latest', name: 'Mistral Medium', displayName: 'Mistral Medium' },
                { id: 'mistral-small-latest', name: 'Mistral Small', displayName: 'Mistral Small' }
            ],
            selectDefault: (models) => models.find(m => m.id.includes('large')) || models[0]
        },
        processConfig: {
            command: 'vibe',
            
            buildPrompt: (prompt, context) => {
                return prompt;
            },            
            buildArgs: (prompt, context, modelId) => {
                const args = [
                    '--auto-approve',
                    '--output', 'json'
                ];
                
                // Add model flag if specified
                if (modelId && modelId !== 'mistral-vibe-local') {
                    args.push('--model', modelId);
                }
                
                args.push('-p', prompt);
                return args;
            }
        },        
        prices: {
            input: 0.0,
            output: 0.0
        }
    },

    opencode: {
        name: 'OpenCode (≥ v2.6.0)',
        icon: '🙏',
        color: '#00D4AA',
        type: 'local',
        agentModule: 'openCode',
        persistent: true,
        keyFile: '.aiduino-opencode-path',
        keyPrefix: '', 
        keyMinLength: 5, 
        apiKeyUrl: 'https://opencode.ai/docs/',
        fallback: 'opencode-local',
        modelDiscovery: {
            enabled: false,  // OpenCode uses its own model configuration
            staticModels: []
        },
        processConfig: {
            command: 'opencode',
            
            buildPrompt: (prompt, context) => {
                return prompt;
            },            
            buildArgs: (prompt, context, modelId) => {
                const args = ['run', '--format', 'json'];
                
                // Add model flag if specified
                if (modelId && modelId !== 'opencode-local') {
                    args.push('--model', modelId);
                }
                
                args.push(prompt);
                return args;
            }
        },        
        prices: {
            input: 0.0,
            output: 0.0
        }
    },

    geminicli: {
        name: 'Gemini CLI (≥ v2.6.0)',
        icon: '💎',
        color: '#4285F4',
        type: 'local',
        agentModule: 'geminiCli',
        persistent: false,
        keyFile: '.aiduino-geminicli-path',
        keyPrefix: '',
        keyMinLength: 5,
        apiKeyUrl: 'https://geminicli.com/docs/get-started/authentication/',
        fallback: 'gemini-2.5-flash',
        modelDiscovery: {
            enabled: true,
            staticModels: [
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', displayName: 'Gemini 2.5 Flash' },
                { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', displayName: 'Gemini 2.5 Pro' },
                { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', displayName: 'Gemini 2.0 Flash' }
            ],
            selectDefault: (models) => models.find(m => m.id.includes('2.5-flash')) || models[0]
        },
        processConfig: {
            command: 'gemini',
            
            buildPrompt: (prompt, context) => {
                return prompt;
            },
            buildArgs: (prompt, context, modelId) => {
                const args = ['-p', prompt, '--output-format', 'json'];
                
                // Add model flag if specified
                if (modelId && modelId !== 'gemini-cli-local') {
                    args.unshift('--model', modelId);
                }
                
                return args;
            }
        },
        prices: {
            input: 0.0,
            output: 0.0
        }
    },

    groqcode: {
        name: 'Groq Code CLI (≥ v2.6.0)',
        icon: '🚀',
        color: '#F55036',
        type: 'local',
        agentModule: 'groqCode',
        persistent: true,
        keyFile: '.aiduino-groqcode-path',  // Stores PATH to groq command
        keyPrefix: '',  // Paths start with / (or 'groq' for command name)
        keyMinLength: 4,  // Min length for 'groq'
        apiKeyUrl: 'https://github.com/NikolaiRadke/groq-code-cli',
        fallback: 'llama-3.3-70b-versatile',
        modelDiscovery: {
            enabled: false,  // Groq Code CLI doesn't support model selection via flags
            staticModels: [
                { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', displayName: 'Llama 3.3 70B' },
                { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B Versatile', displayName: 'Llama 3.1 70B' },
                { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', displayName: 'Llama 3.1 8B' },
                { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', displayName: 'Mixtral 8x7B' }
            ],
            selectDefault: (models) => models.find(m => m.id.includes('llama-3.3')) || models[0]
        },
        processConfig: {
            command: 'groq',
            buildPrompt: (prompt, context) => {
                return prompt;
            },
            buildArgs: (prompt, context, modelId) => {
                const args = [];
                args.push(prompt);
                return args;
            }
        },
        prices: {
            input: 0.59 / 1000000,
            output: 0.79 / 1000000
        }
    },

    ollama_agentic: {
        name: 'Ollama Agentic (≥ v2.6.0)',
        icon: '🦙',
        color: '#FF6B35',
        type: 'local',
        agentModule: 'ollamaAgentic',
        persistent: true,
        keyFile: '.aiduino-ollama-url',
        keyPrefix: 'http',
        keyMinLength: 7,
        apiKeyUrl: 'https://ollama.com',
        fallback: 'llama3.2-3b-8k',
        autoDetectUrls: ['http://127.0.0.1:11434', 'http://localhost:11434'],
        defaultPort: 11434,
        modelDiscovery: {
            enabled: true,
            endpoint: '/api/tags',
            cacheMinutes: 5,  // Short cache - user might install new models
            extractModels: (data) => data.models || [],
            selectDefault: (models) => models.find(m => m.name?.includes('llama3')) || models[0],
            staticModels: [
                { id: 'llama3.2-3b-8k', name: 'Llama 3.2 3B', displayName: 'Llama 3.2 3B' }
            ]
        },
        processConfig: {
            command: 'ollama',
            
            buildPrompt: (prompt, context) => {
                return prompt;
            },
            
            buildArgs: (prompt, context) => {
                return [];
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
        persistent: false,
        keyFile: '.aiduino-ollama-url',
        keyPrefix: 'http',
        keyMinLength: 7,
        apiKeyUrl: 'https://ollama.com',
        fallback: 'llama3:latest',
        autoDetectUrls: ['http://127.0.0.1:11434', 'http://localhost:11434'],
        defaultPort: 11434,
        modelDiscovery: {
            enabled: true,
            endpoint: '/api/tags',
            cacheMinutes: 5,  // Short cache - user might install new models
            extractModels: (data) => data.models || [],
            selectDefault: (models) => models.find(m => m.name?.includes('llama3')) || models[0],
            staticModels: [
                { id: 'llama3:latest', name: 'Llama 3 Latest', displayName: 'Llama 3' }
            ]
        },
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
        modelDiscovery: {
            enabled: true,
            endpoint: '/v1/models',
            cacheMinutes: 5,  // Short cache - user might load new models
            extractModels: (data) => data.data || [],
            selectDefault: (models) => models.find(m => m.id?.includes('llama-3')) || models[0],
            staticModels: [
                { id: 'llama-3-8b', name: 'Llama 3 8B', displayName: 'Llama 3 8B' }
            ]
        },
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
