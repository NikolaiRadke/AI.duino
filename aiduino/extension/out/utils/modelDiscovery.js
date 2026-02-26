/*
 * AI.duino - Model Discovery Service
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 * 
 * This module handles dynamic model discovery from AI providers.
 * It queries provider APIs for available models, caches results,
 * and provides fallback mechanisms when discovery fails.
 */

"use strict";

const https = require('https');
const http = require('http');

// In-memory cache for discovered models
const modelCache = new Map();

/**
 * Discover available models from a provider
 * @param {string} providerId - Provider identifier (e.g., 'claude', 'chatgpt')
 * @param {object} providerConfig - Provider configuration from providerConfigs.js
 * @param {string} apiKey - API key or URL for authentication
 * @returns {Promise<Array>} Array of available models
 */
async function discoverModels(providerId, providerConfig, apiKey) {
    // Check if discovery is enabled for this provider
    if (!providerConfig.modelDiscovery?.enabled) {
        console.log(`[ModelDiscovery] Discovery disabled for ${providerId}, using fallback`);
        return [{ id: providerConfig.fallback, name: providerConfig.fallback }];
    }

    // Check cache first
    const cached = getCachedModels(providerId, providerConfig);
    if (cached) {
        console.log(`[ModelDiscovery] Using cached models for ${providerId} (${cached.length} models)`);
        return cached;
    }

    console.log(`[ModelDiscovery] Discovering models for ${providerId}...`);

    try {
        const models = await fetchModelsFromProvider(providerId, providerConfig, apiKey);
        
        if (!models || models.length === 0) {
            console.warn(`[ModelDiscovery] No models found for ${providerId}, using fallback`);
            return [{ id: providerConfig.fallback, name: providerConfig.fallback }];
        }

        // Cache the results
        cacheModels(providerId, providerConfig, models);
        
        console.log(`[ModelDiscovery] Found ${models.length} models for ${providerId}`);
        return models;

    } catch (error) {
        console.error(`[ModelDiscovery] Error discovering models for ${providerId}:`, error.message);
        return [{ id: providerConfig.fallback, name: providerConfig.fallback }];
    }
}

/**
 * Fetch models from provider API
 * @private
 */
async function fetchModelsFromProvider(providerId, providerConfig, apiKey) {
    const discovery = providerConfig.modelDiscovery;
    
    // Determine endpoint - use discovery.endpoint or fallback to provider.path
    const endpoint = discovery.endpoint || providerConfig.path;
    if (!endpoint) {
        throw new Error(`No discovery endpoint configured for ${providerId}`);
    }

    // Handle special cases for local providers
    if (providerConfig.type === 'local') {
        return await fetchModelsFromLocalProvider(providerId, providerConfig, apiKey, endpoint);
    }

    // Standard HTTP/HTTPS API request
    const method = discovery.method || 'GET';
    const protocol = providerConfig.hostname?.includes('localhost') || providerConfig.hostname?.includes('127.0.0.1') 
        ? http : https;

    // Build URL - special handling for Gemini (needs API key in URL)
    let url = `https://${providerConfig.hostname}${endpoint}`;
    if (providerId === 'gemini') {
        url += apiKey;
    }

    // Get headers - use discovery headers or fallback to provider headers
    const headers = discovery.headers 
        ? (typeof discovery.headers === 'function' ? discovery.headers(apiKey) : discovery.headers)
        : (typeof providerConfig.headers === 'function' ? providerConfig.headers(apiKey) : providerConfig.headers);

    const options = {
        method: method,
        headers: headers || {}
    };

    const data = await makeHttpRequest(url, options);
    
    // Extract models using provider-specific logic
    let models = [];
    if (discovery.extractModels) {
        models = discovery.extractModels(data);
    } else if (providerConfig.extractModels) {
        models = providerConfig.extractModels(data);
    } else {
        // Default extraction for OpenAI-compatible APIs
        models = data.data || data.models || [];
    }

    // Filter models if configured
    if (discovery.filterModels) {
        models = discovery.filterModels(models);
    }

    // Sort models if configured
    if (discovery.sortModels) {
        models = discovery.sortModels(models);
    }

    // Normalize model format
    return models.map(m => ({
        id: m.id || m.name || m,
        name: m.name || m.id || m,
        displayName: m.display_name || m.name || m.id || m
    }));
}

/**
 * Fetch models from local providers (Ollama, LM Studio)
 * @private
 */
async function fetchModelsFromLocalProvider(providerId, providerConfig, baseUrl, endpoint) {
    // Clean up base URL
    baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    // Build full URL
    const url = `${baseUrl}${endpoint}`;
    console.log(`[ModelDiscovery] Fetching from local provider: ${url}`);

    const protocol = baseUrl.startsWith('https') ? https : http;
    const options = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    };

    const data = await makeHttpRequest(url, options);

    // Provider-specific extraction
    let models = [];
    if (providerId === 'ollama' || providerId === 'ollama_agentic') {
        // Ollama returns { models: [...] }
        models = data.models || [];
        return models.map(m => ({
            id: m.name || m.model || m,
            name: m.name || m.model || m,
            displayName: m.name || m.model || m
        }));
    } else if (providerId === 'lmstudio') {
        // LM Studio uses OpenAI-compatible format
        models = data.data || [];
        return models.map(m => ({
            id: m.id,
            name: m.id,
            displayName: m.id
        }));
    }

    return models;
}

/**
 * Make HTTP/HTTPS request
 * @private
 */
function makeHttpRequest(url, options) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = protocol.request(requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON response: ${e.message}`));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

/**
 * Get cached models if available and not expired
 * @private
 */
function getCachedModels(providerId, providerConfig) {
    const cacheEntry = modelCache.get(providerId);
    if (!cacheEntry) return null;

    const cacheMinutes = providerConfig.modelDiscovery?.cacheMinutes || 60;
    const maxAge = cacheMinutes * 60 * 1000; // Convert to milliseconds
    const age = Date.now() - cacheEntry.timestamp;

    if (age > maxAge) {
        console.log(`[ModelDiscovery] Cache expired for ${providerId}`);
        modelCache.delete(providerId);
        return null;
    }

    return cacheEntry.models;
}

/**
 * Cache discovered models
 * @private
 */
function cacheModels(providerId, providerConfig, models) {
    modelCache.set(providerId, {
        models: models,
        timestamp: Date.now()
    });
}

/**
 * Clear cache for a specific provider or all providers
 * @param {string} providerId - Optional provider ID to clear specific cache
 */
function clearCache(providerId = null) {
    if (providerId) {
        modelCache.delete(providerId);
        console.log(`[ModelDiscovery] Cache cleared for ${providerId}`);
    } else {
        modelCache.clear();
        console.log(`[ModelDiscovery] All model caches cleared`);
    }
}

/**
 * Get default model for a provider from discovered models
 * @param {Array} models - Array of discovered models
 * @param {object} providerConfig - Provider configuration
 * @returns {string} Model ID to use as default
 */
function selectDefaultModel(models, providerConfig) {
    if (!models || models.length === 0) {
        return providerConfig.fallback;
    }

    // Use provider's selectDefault function if configured
    if (providerConfig.modelDiscovery?.selectDefault) {
        try {
            const selected = providerConfig.modelDiscovery.selectDefault(models);
            return selected?.id || selected || providerConfig.fallback;
        } catch (error) {
            console.error('[ModelDiscovery] Error in selectDefault:', error);
        }
    }

    // Use legacy selectBest function if available
    if (providerConfig.selectBest) {
        try {
            const selected = providerConfig.selectBest(models);
            return selected?.id || selected || providerConfig.fallback;
        } catch (error) {
            console.error('[ModelDiscovery] Error in selectBest:', error);
        }
    }

    // Default: return first model
    return models[0]?.id || providerConfig.fallback;
}

module.exports = {
    discoverModels,
    clearCache,
    selectDefaultModel
};
