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
        output: 0.002 / 1000             // Cost per output token
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
const CONFIG_VERSION = '170926'; 
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
        // Prefer the newest Sonnet by release date, then the newest Haiku, then anything.
        // Sorting by created_at avoids hardcoding model IDs that age out every few months.
        selectBest: (models) => {
            const newest = [...models].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
            return newest.find(m => m.id?.includes('sonnet')) || newest.find(m => m.id?.includes('haiku')) || newest[0];
        },
        fallback: 'claude-sonnet-5',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,  // Cache longer for stable APIs
            extractModels: (data) => data.data?.filter(m => m.type === 'model' && !m.id.includes('deprecated')) || [],
            selectDefault: (models) => {
                const newest = [...models].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
                return newest.find(m => m.id?.includes('sonnet')) || newest.find(m => m.id?.includes('haiku')) || newest[0];
            },
            staticModels: [
                { id: 'claude-opus-5', name: 'Claude Opus 5', displayName: 'Opus 5' },
                { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', displayName: 'Sonnet 5' },
                { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', displayName: 'Haiku 4.5' },
                { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', displayName: 'Opus 4.8' },
                { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', displayName: 'Sonnet 4.6' }
            ]
        },
        prices: {
            input: 2.0 / 1000000,     // $2.00 per 1M tokens (Sonnet 5 standard rate, planned increase cancelled)
            output: 10.0 / 1000000    // $10.00 per 1M tokens; Opus 5: $5.00/$25.00, Haiku 4.5: $1.00/$5.00
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
            // Opus 5 and Sonnet 5 think by default, so content[0] may be a thinking block
            extractResponse: (data) => {
                const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('');
                if (!text) throw new Error(`Claude: ${data.stop_reason || 'No text response'}`);
                return text;
            }
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
            if (!m.id?.startsWith('gpt-')) return false;
            
            // Exclude non-chat models (image, audio, realtime and legacy completion models)
            const excludePatterns = ['tts', 'whisper', 'dall-e', 'instruct', 'davinci', 'curie', 'babbage', 'ada',
                                     'image', 'realtime', 'transcribe', 'audio', 'search', 'embedding', 'moderation', 'cyber'];
            return !excludePatterns.some(pattern => m.id.includes(pattern));
        }) || [],
        // Prefer the balanced tier, then the newest model by creation date.
        // OpenAI renames tiers between generations, so match on tier suffix, not exact IDs.
        selectBest: (models) => {
            const newest = [...models].sort((a, b) => (b.created || 0) - (a.created || 0));
            return newest.find(m => m.id?.includes('terra')) || newest.find(m => m.id?.includes('mini')) || newest[0];
        },
        fallback: 'gpt-5.6-terra',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,  // Cache longer for stable APIs
            extractModels: (data) => data.data?.filter(m => {
                if (!m.id?.startsWith('gpt-')) return false;
                const excludePatterns = ['tts', 'whisper', 'dall-e', 'instruct', 'davinci', 'curie', 'babbage', 'ada',
                                         'image', 'realtime', 'transcribe', 'audio', 'search', 'embedding', 'moderation', 'cyber'];
                return !excludePatterns.some(pattern => m.id.includes(pattern));
            }) || [],
            selectDefault: (models) => {
                const newest = [...models].sort((a, b) => (b.created || 0) - (a.created || 0));
                return newest.find(m => m.id?.includes('terra')) || newest.find(m => m.id?.includes('mini')) || newest[0];
            },
            staticModels: [
                { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', displayName: 'GPT-5.6 Terra' },
                { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', displayName: 'GPT-5.6 Sol' },
                { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', displayName: 'GPT-5.6 Luna' },
                { id: 'gpt-5.5', name: 'GPT-5.5', displayName: 'GPT-5.5' },
                { id: 'gpt-5.4', name: 'GPT-5.4', displayName: 'GPT-5.4' }
            ]
        },
        prices: {
            input: 2.00 / 1000000,    // $2.00 per 1M tokens (GPT-5.6 Terra)
            output: 12.00 / 1000000   // $12.00 per 1M tokens; Sol: $4.00/$20.00 (promo until at least Nov 21, 2026), Luna: $0.20/$1.20
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
        keyPrefix: '',
        keyMinLength: 20,
        hostname: 'generativelanguage.googleapis.com',
        apiKeyUrl: 'https://aistudio.google.com/apikey',
        path: '/v1/models?key=',
        headers: () => ({}),
        // Keep only Gemini text models. Image, embedding, imagen and gemma entries
        // also advertise generateContent, so filter them out explicitly.
        extractModels: (data) => data.models?.filter(m => {
            if (!m.supportedGenerationMethods?.includes('generateContent')) return false;
            const id = String(m.name || '');
            if (!id.startsWith('models/gemini-')) return false;
            return !['-image', 'embedding', 'aqa', '-tts', '-live', 'transcribe', 'robotics', 'computer-use'].some(p => id.includes(p));
        }) || [],
        // Pick the highest Flash version number rather than a fixed model ID.
        // Google ships new Flash generations every few months and retires the old ones.
        selectBest: (models) => {
            const version = (m) => parseFloat((String(m.name || m.id || '').match(/gemini-(\d+(?:\.\d+)?)-flash(?:-\d+)?$/) || [])[1] || -1);
            const flash = models.filter(m => version(m) >= 0).sort((a, b) => version(b) - version(a));
            return flash[0] || models.find(m => String(m.name || m.id || '').includes('flash')) || models[0];
        },
        fallback: 'models/gemini-3.8-flash',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,
            extractModels: (data) => data.models?.filter(m => {
                if (!m.supportedGenerationMethods?.includes('generateContent')) return false;
                const id = String(m.name || '');
                if (!id.startsWith('models/gemini-')) return false;
                return !['-image', 'embedding', 'aqa', '-tts', '-live', 'transcribe', 'robotics', 'computer-use'].some(p => id.includes(p));
            }) || [],
            selectDefault: (models) => {
                const version = (m) => parseFloat((String(m.name || m.id || '').match(/gemini-(\d+(?:\.\d+)?)-flash(?:-\d+)?$/) || [])[1] || -1);
                const flash = models.filter(m => version(m) >= 0).sort((a, b) => version(b) - version(a));
                return flash[0] || models.find(m => String(m.name || m.id || '').includes('flash')) || models[0];
            },
            staticModels: [
                { id: 'models/gemini-3.8-flash', name: 'Gemini 3.8 Flash', displayName: 'Gemini 3.8 Flash' },
                { id: 'models/gemini-3.7-flash', name: 'Gemini 3.7 Flash', displayName: 'Gemini 3.7 Flash' },
                { id: 'models/gemini-3.6-flash', name: 'Gemini 3.6 Flash', displayName: 'Gemini 3.6 Flash' },
                { id: 'models/gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', displayName: 'Gemini 3.5 Flash-Lite' },
                { id: 'models/gemini-2.5-pro', name: 'Gemini 2.5 Pro', displayName: 'Gemini 2.5 Pro' }
            ]
        },
        prices: {
            input: 0.75 / 1000000,    // $0.75 per 1M tokens (Gemini 3.6-3.8 Flash until Dec 31, 2026; $1.50 from Jan 1, 2027)
            output: 3.75 / 1000000    // $3.75 per 1M tokens ($7.50 from Jan 1, 2027); 3.1 Pro Preview: $2.00/$12.00
        },
        apiConfig: {
            apiPath: (modelId, key) => {
                if (!modelId.startsWith('models/')) modelId = 'models/' + modelId;
                return `/v1/${modelId}:generateContent?key=${key}`;
            },
            method: 'POST',
            headers: () => ({ 'Content-Type': 'application/json' }),
            // Note: temperature/top_p/top_k are deprecated for Gemini 3.x and are
            // intentionally omitted here. apiClient only overrides fields that exist,
            // so leaving temperature out also keeps the user setting from being sent.
            buildRequest: (modelId, prompt, systemPrompt) => ({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
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
        extractModels: (data) => data.data?.filter(m => !m.id?.includes('embed')) || [],
        // Mistral keeps stable '-latest' aliases, so prefer those over pinned snapshots.
        selectBest: (models) => models.find(m => m.id === 'mistral-large-latest') || models.find(m => m.id?.includes('large')) || models.find(m => m.id?.includes('small-latest')) || models[0],
        fallback: 'mistral-large-latest',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,
            extractModels: (data) => data.data?.filter(m => !m.id?.includes('embed')) || [],
            selectDefault: (models) => models.find(m => m.id === 'mistral-large-latest') || models.find(m => m.id?.includes('large')) || models.find(m => m.id?.includes('small-latest')) || models[0],
            staticModels: [
                { id: 'mistral-large-latest', name: 'Mistral Large 3', displayName: 'Mistral Large 3' },
                { id: 'mistral-small-latest', name: 'Mistral Small 4', displayName: 'Mistral Small 4' },
                { id: 'codestral-latest', name: 'Codestral', displayName: 'Codestral' },
                { id: 'mistral-medium-latest', name: 'Mistral Medium 3.5', displayName: 'Mistral Medium 3.5' }
            ]
        },
        prices: {
            input: 0.50 / 1000000,    // $0.50 per 1M tokens (Mistral Large 3)
            output: 1.50 / 1000000    // $1.50 per 1M tokens; Small 4: $0.15/$0.60, Medium 3.5: $1.50/$7.50
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
        path: '/v1/agent',
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        extractModels: (data) => [{ id: 'perplexity/sonar', name: 'Sonar' }],
        selectBest: (models) => models[0],
        fallback: 'perplexity/sonar',
        modelDiscovery: {
            enabled: false,  // No model discovery API
            staticModels: [
                { id: 'perplexity/sonar', name: 'Sonar', displayName: 'Sonar' }
            ]
        },
        prices: {
           input: 0.25 / 1000000,    // $0.25 per 1M tokens (perplexity/sonar via Agent API)
           output: 2.50 / 1000000    // $2.50 per 1M tokens; plus $5.00 per 1,000 web searches
        },
        apiConfig: {
            // Sonar Chat Completions is supported only until Sep 27, 2026 - migrated to Agent API
            apiPath: '/v1/agent',
            method: 'POST',
            headers: (key) => ({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            }),
            // temperature is omitted on purpose; web search must be enabled explicitly as a tool
            buildRequest: (modelId, prompt, systemPrompt) => ({
                // Map legacy stored IDs like 'sonar' to 'perplexity/sonar'
                model: String(modelId || '').includes('/') ? modelId : `perplexity/${modelId || 'sonar'}`,
                ...(systemPrompt ? { instructions: systemPrompt } : {}),
                input: prompt,
                tools: [{ type: 'web_search' }],
                max_output_tokens: 2000
            }),
            extractResponse: (data) => {
                if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
                if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
                const text = (data.output || []).filter(item => item.type === 'message')
                    .flatMap(item => item.content || [])
                    .filter(part => part.type === 'output_text')
                    .map(part => part.text).join('');
                if (!text) throw new Error(`Perplexity: ${data.status || 'No response'}`);
                return text;
            }
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
        selectBest: (models) => models.find(m => m.name === 'command-a-03-2025') || models.find(m => m.name?.includes('command-r-plus')) || models[0],
        fallback: 'command-a-03-2025',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,
            extractModels: (data) => (data.models || data.data)?.filter(m => (m.name || m.id)?.includes('command')) || [],
            selectDefault: (models) => models.find(m => m.name === 'command-a-03-2025') || models.find(m => m.name?.includes('command-r-plus')) || models[0],
            staticModels: [
                { id: 'command-a-03-2025', name: 'Command A', displayName: 'Command A' },
                { id: 'command-r-plus-08-2024', name: 'Command R+ 08-2024', displayName: 'Command R+' },
                { id: 'command-r-08-2024', name: 'Command R 08-2024', displayName: 'Command R' }
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
            // Llama 3.3/3.1 were shut down for free/developer tiers on Aug 16, 2026
            const preferred = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
            for (const model of preferred) {
                const found = models.find(m => m.id === model);
                if (found) return found.id;
            }
            return models[0]?.id || 'openai/gpt-oss-120b';
        },
        fallback: 'openai/gpt-oss-120b',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,
            extractModels: (data) => data.data?.filter(m => {
                const id = String(m.id || '').toLowerCase();
                
                // Exclude non-chat models
                const excludePatterns = [
                    'whisper',      // Audio models
                    'vision',       // Image models
                    'guard',        // Safety/moderation models
                    'distil',       // Distilled (lower quality) models
                    'safeguard',    // Safety models
                    'orpheus',      // TTS models
                    'scout',        // Preview only
                ];
                if (excludePatterns.some(pattern => id.includes(pattern))) return false;
                
                // Only include main chat model families
                // Llama models remain for enterprise contracts only and return 404 otherwise
                const chatFamilies = ['openai/gpt-oss', 'qwen'];
                return chatFamilies.some(family => id.includes(family));
            }) || [],
            selectDefault: (models) => models.find(m => m.id === 'openai/gpt-oss-120b') || models.find(m => m.id === 'qwen/qwen3.8-27b') || models[0],
            staticModels: [
                { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', displayName: 'GPT OSS 120B' },
                { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', displayName: 'GPT OSS 20B' },
                { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Preview)', displayName: 'Qwen 3.8 27B' }
            ]
        },
        prices: {
            input: 0.15 / 1000000,    // $0.15 per 1M tokens (GPT OSS 120B)
            output: 0.60 / 1000000    // $0.60 per 1M tokens; GPT OSS 20B: $0.075/$0.30, Qwen 3.8 27B: $0.80/$4.00
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
                temperature: 0.7,
                // Reasoning tokens count against max_tokens: keep effort low for GPT OSS,
                // and hide Qwen's <think> output, which is returned inline by default
                ...(String(modelId).startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
                ...(String(modelId).startsWith('qwen/') ? { reasoning_format: 'hidden' } : {})
            }),
            extractResponse: (data) => data.choices[0].message.content
        }
    },

    huggingface: {
        name: 'HuggingFace (≥ v2.5.0)',
        icon: '🤗',
        color: '#FF9D00',
        keyFile: '.aiduino-huggingface-api-key',
        keyPrefix: 'hf_',
        keyMinLength: 15,
        hostname: 'router.huggingface.co',
        apiKeyUrl: 'https://huggingface.co/settings/tokens',
        path: '/v1/models',
        requiresModelSelection: true,
        headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
        // Popular open-source models available on HF
        availableModels: [
            { 
                id: 'meta-llama/Llama-3.3-70B-Instruct', 
                name: 'Llama 3.3 70B Instruct',
                pricing: { input: 0.135 / 1000000, output: 0.40 / 1000000 }
            },
            { 
                id: 'Qwen/Qwen2.5-Coder-32B-Instruct', 
                name: 'Qwen 2.5 Coder 32B',
                pricing: { input: 0.06 / 1000000, output: 0.20 / 1000000 }
            },
            { 
                id: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', 
                name: 'Qwen3 Coder 480B',
                pricing: { input: 0.38 / 1000000, output: 1.55 / 1000000 }
            },
            { 
                id: 'Qwen/Qwen3-32B', 
                name: 'Qwen3 32B',
                pricing: { input: 0.08 / 1000000, output: 0.25 / 1000000 }
            },
            { 
                id: 'meta-llama/Llama-3.1-8B-Instruct', 
                name: 'Llama 3.1 8B Instruct',
                pricing: { input: 0.02 / 1000000, output: 0.05 / 1000000 }
            },
            { 
                id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', 
                name: 'Llama 4 Scout 17B',
                pricing: { input: 0.09 / 1000000, output: 0.29 / 1000000 }
            },
            { 
                id: 'deepseek-ai/DeepSeek-V3.2', 
                name: 'DeepSeek V3.2',
                pricing: { input: 0.26 / 1000000, output: 0.38 / 1000000 }
            },
            { 
                id: 'google/gemma-3-27b-it', 
                name: 'Gemma 3 27B',
                pricing: { input: 0.08 / 1000000, output: 0.16 / 1000000 }
            }
        ],
        extractModels: (data) => [{ id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B Instruct' }],
        selectBest: (models) => models[0],
        fallback: 'meta-llama/Llama-3.3-70B-Instruct',
        modelDiscovery: {
            enabled: false,  // Use static availableModels list instead
            staticModels: [
                { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B Instruct', displayName: 'Llama 3.3 70B' },
                { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B', displayName: 'Qwen 2.5 Coder' },
                { id: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', name: 'Qwen3 Coder 480B', displayName: 'Qwen3 Coder 480B' },
                { id: 'Qwen/Qwen3-32B', name: 'Qwen3 32B', displayName: 'Qwen3 32B' },
                { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instruct', displayName: 'Llama 3.1 8B' },
                { id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', name: 'Llama 4 Scout 17B', displayName: 'Llama 4 Scout' },
                { id: 'deepseek-ai/DeepSeek-V3.2', name: 'DeepSeek V3.2', displayName: 'DeepSeek V3.2' },
                { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', displayName: 'Gemma 3 27B' }
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
            buildRequest: (modelId, prompt, systemPrompt) => ({
                model: modelId,
                messages: [
                    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
                    { role: "user", content: prompt }
                ],
                max_tokens: 2000,
                temperature: 0.7
            }),
            extractResponse: (data) => {
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    return data.choices[0].message.content;
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
        // Models from the Fireworks serverless pricing list (Sep 2026)
        availableModels: [
            { 
                id: 'accounts/fireworks/models/gpt-oss-120b', 
                name: 'GPT OSS 120B',
                pricing: { input: 0.15 / 1000000, output: 0.60 / 1000000 }
            },
            { 
                id: 'accounts/fireworks/models/deepseek-v4-flash-0731', 
                name: 'DeepSeek V4 Flash (0731)',
                pricing: { input: 0.22 / 1000000, output: 0.66 / 1000000 }
            },
            { 
                id: 'accounts/fireworks/models/qwen3p8-max', 
                name: 'Qwen 3.8 Max',
                pricing: { input: 2.00 / 1000000, output: 6.00 / 1000000 }
            },
            { 
                id: 'accounts/fireworks/models/nemotron-lightning-3p5-30b-a3b', 
                name: 'NVIDIA Nemotron 3.5 Lightning 30B',
                pricing: { input: 0.05 / 1000000, output: 0.20 / 1000000 }
            }
        ],
        extractModels: (data) => data.data || [],
        selectBest: (models) => models[0],
        fallback: 'accounts/fireworks/models/gpt-oss-120b',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,
            extractModels: (data) => data.data || [],
            selectDefault: (models) => models.find(m => m.id?.endsWith('/gpt-oss-120b')) || models[0],
            staticModels: [
                { id: 'accounts/fireworks/models/gpt-oss-120b', name: 'GPT OSS 120B', displayName: 'GPT OSS 120B', pricing: { input: 0.15 / 1000000, output: 0.60 / 1000000 } },
                { id: 'accounts/fireworks/models/deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash (0731)', displayName: 'DeepSeek V4 Flash', pricing: { input: 0.22 / 1000000, output: 0.66 / 1000000 } },
                { id: 'accounts/fireworks/models/qwen3p8-max', name: 'Qwen 3.8 Max', displayName: 'Qwen 3.8 Max', pricing: { input: 2.00 / 1000000, output: 6.00 / 1000000 } }
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
        // Models from the Together serverless list (Sep 2026)
        availableModels: [
            { 
                id: 'openai/gpt-oss-120b', 
                name: 'GPT OSS 120B',
                pricing: { input: 0.15 / 1000000, output: 0.60 / 1000000 }
            },
            { 
                id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 
                name: 'Llama 3.3 70B Turbo',
                pricing: { input: 1.04 / 1000000, output: 1.04 / 1000000 }
            },
            { 
                id: 'deepseek-ai/DeepSeek-V4-Flash-0731', 
                name: 'DeepSeek V4 Flash (0731)',
                pricing: { input: 0.14 / 1000000, output: 0.28 / 1000000 }
            },
            { 
                id: 'Qwen/Qwen3.8-Flash', 
                name: 'Qwen 3.8 Flash',
                pricing: { input: 0.15 / 1000000, output: 0.47 / 1000000 }
            }
        ],
        extractModels: (data) => data.data || [],
        selectBest: (models) => models[0],
        fallback: 'openai/gpt-oss-120b',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 120,
            extractModels: (data) => data.data || [],
            selectDefault: (models) => models.find(m => m.id === 'openai/gpt-oss-120b') || models.find(m => m.id?.includes('Llama-3.3')) || models[0],
            staticModels: [
                { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', displayName: 'GPT OSS 120B', pricing: { input: 0.15 / 1000000, output: 0.60 / 1000000 } },
                { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', displayName: 'Llama 3.3 70B', pricing: { input: 1.04 / 1000000, output: 1.04 / 1000000 } },
                { id: 'deepseek-ai/DeepSeek-V4-Flash-0731', name: 'DeepSeek V4 Flash (0731)', displayName: 'DeepSeek V4 Flash', pricing: { input: 0.14 / 1000000, output: 0.28 / 1000000 } }
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
                id: 'google/gemma-4-31b-it:free', 
                name: 'Gemma 4 31B (Free)', 
                pricing: { input: 0, output: 0 }
            },
            { 
                id: 'qwen/qwen3-coder', 
                name: 'Qwen3 Coder', 
                pricing: { input: 0.30 / 1000000, output: 1.00 / 1000000 }
            },
            { 
                id: 'openai/gpt-5.6-luna', 
                name: 'GPT-5.6 Luna', 
                pricing: { input: 0.20 / 1000000, output: 1.20 / 1000000 }
            },
            { 
                id: 'openai/gpt-5.6-terra', 
                name: 'GPT-5.6 Terra', 
                pricing: { input: 2.00 / 1000000, output: 12.00 / 1000000 }
            },
            { 
                id: 'anthropic/claude-haiku-4.5', 
                name: 'Claude Haiku 4.5', 
                pricing: { input: 1.00 / 1000000, output: 5.00 / 1000000 }
            },
            { 
                id: 'anthropic/claude-sonnet-5', 
                name: 'Claude Sonnet 5', 
                pricing: { input: 2.00 / 1000000, output: 10.00 / 1000000 }
            },
            { 
                id: 'google/gemini-3.1-flash-lite', 
                name: 'Gemini 3.1 Flash-Lite', 
                pricing: { input: 0.25 / 1000000, output: 1.50 / 1000000 }
            },
            { 
                id: 'google/gemini-3.8-flash', 
                name: 'Gemini 3.8 Flash', 
                pricing: { input: 0.75 / 1000000, output: 3.75 / 1000000 }
            },
            { 
                id: 'meta-llama/llama-3.3-70b-instruct', 
                name: 'Llama 3.3 70B', 
                pricing: { input: 0.10 / 1000000, output: 0.32 / 1000000 }
            },
            { 
                id: 'mistralai/mistral-large-2512', 
                name: 'Mistral Large 3', 
                pricing: { input: 0.50 / 1000000, output: 1.50 / 1000000 }
            },
            { 
                id: 'deepseek/deepseek-v3.2', 
                name: 'DeepSeek V3.2', 
                pricing: { input: 0.27 / 1000000, output: 0.40 / 1000000 }
            }
        ],
        extractModels: (data) => data.data || [],
        selectBest: (models) => models[0],
        fallback: 'google/gemma-4-31b-it:free',
        modelDiscovery: {
            enabled: true,
            cacheMinutes: 60,
            extractModels: (data) => data.data || [],
            // Prefer a free coding-capable model, then any free model.
            // OpenRouter's free tier rotates, so match on the ':free' suffix, not a fixed ID.
            selectDefault: (models) => models.find(m => m.id === 'google/gemma-4-31b-it:free') || models.find(m => m.id?.endsWith(':free')) || models[0],
            staticModels: [
                { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B (Free)', displayName: 'Gemma 4 31B Free', pricing: { input: 0, output: 0 } },
                { id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', displayName: 'Qwen3 Coder', pricing: { input: 0.30 / 1000000, output: 1.00 / 1000000 } },
                { id: 'openai/gpt-5.6-terra', name: 'GPT-5.6 Terra', displayName: 'GPT-5.6 Terra', pricing: { input: 2.00 / 1000000, output: 12.00 / 1000000 } },
                { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', displayName: 'Claude Sonnet 5', pricing: { input: 2.00 / 1000000, output: 10.00 / 1000000 } },
                { id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash', displayName: 'Gemini 3.8 Flash', pricing: { input: 0.75 / 1000000, output: 3.75 / 1000000 } }
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
        fallback: 'claude-sonnet-5',
        modelDiscovery: {
            cliDefault: true,  // Omit --model flag when 'default' is selected
            enabled: true,
            staticModels: [
                { id: 'claude-opus-5', name: 'Claude Opus 5', displayName: 'Opus 5' },
                { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', displayName: 'Sonnet 5' },
                { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', displayName: 'Haiku 4.5' },
                { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', displayName: 'Opus 4.8' },
                { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', displayName: 'Sonnet 4.6' }
            ],
            selectDefault: (models) => models.find(m => m.id?.includes('sonnet-5')) || models.find(m => m.id?.includes('sonnet')) || models[0]
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
        fallback: 'gpt-5.6-terra',
        modelDiscovery: {
            cliDefault: true,  // Omit --model flag when 'default' is selected
            enabled: true,
            staticModels: [
                { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', displayName: 'GPT-5.6 Terra' },
                { id: 'gpt-5.6-sol',   name: 'GPT-5.6 Sol',   displayName: 'GPT-5.6 Sol' },
                { id: 'gpt-5.6-luna',  name: 'GPT-5.6 Luna',  displayName: 'GPT-5.6 Luna' },
                { id: 'gpt-6-astra',   name: 'GPT-6 Astra',   displayName: 'GPT-6 Astra' },  // GPT-5.5 retires from Codex on Oct 14, 2026
                { id: 'gpt-5.4',       name: 'GPT-5.4',       displayName: 'GPT-5.4' }
            ],
            selectDefault: (models) => models.find(m => m.id?.includes('terra')) || models[0]
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
            // Model selection via CLI parameters is not supported by Mistral Vibe.
            // The model must be configured within Vibe itself using the /model command.
            cliDefault: true,
            enabled: false,
            staticModels: []
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
            // Model selection via CLI parameters is not supported by OpenCode.
            // The model must be configured within OpenCode itself.
            cliDefault: true,
            enabled: false,
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
        fallback: 'gemini-flash-latest',
        modelDiscovery: {
            cliDefault: true,  // Omit --model flag when 'default' is selected
            enabled: true,
            staticModels: [
                { id: 'gemini-flash-latest', name: 'Gemini Flash (latest)', displayName: 'Gemini Flash (latest)' },
                { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', displayName: 'Gemini 3.8 Flash' },
                { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', displayName: 'Gemini 3.7 Flash' },
                { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', displayName: 'Gemini 3.6 Flash' },
                { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Preview)', displayName: 'Gemini 3.1 Pro' }
            ],
            selectDefault: (models) => models.find(m => m.id === 'gemini-flash-latest') || models.find(m => m.id?.includes('flash')) || models[0]
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
        fallback: 'openai/gpt-oss-120b',
        modelDiscovery: {
            // Model selection via CLI parameters is not supported by Groq Code CLI.
            // The model must be configured within the CLI itself.
            cliDefault: true,
            enabled: false,
            staticModels: []
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
            input: 0.15 / 1000000,    // GPT OSS 120B on Groq
            output: 0.60 / 1000000
        }
    },

    ollama_agentic: {
        name: 'Ollama Agentic (≥ v2.6.0)',
        icon: '🦙',
        color: '#FF6B35',
        type: 'local',
        agentModule: 'ollamaAgentic',
        persistent: true,
        keyFile: '.aiduino-ollama-agentic-url',
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
        httpConfig: {
            endpoint: '/api/chat'
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
