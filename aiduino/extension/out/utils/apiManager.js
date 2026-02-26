/*
 * AI.duino - API Manager Module
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const modelDiscovery = require('./modelDiscovery');

/**
 * Main AI call function - routes to appropriate client
 * Delegates to agenticClient for CLI-based providers (Claude Code, Codex)
 * or apiClient for HTTP-based providers (Claude API, ChatGPT, etc.)
 * @param {string} prompt - The prompt to send to AI
 * @param {Object} context - Extension context with dependencies
 * @returns {Promise} AI response promise
 */
function callAI(prompt, context) {
    const { apiClient, agenticClient, currentModel, minimalModelManager } = context;
    const provider = minimalModelManager.providers[currentModel];
    
    // Route to agentic or API client
    if (provider.agentModule && agenticClient) {
        return agenticClient.callAgent(currentModel, prompt, context);
    }
    
    return apiClient.callAPI(currentModel, prompt, context);
}

/**
 * Switch AI model with user selection and auto-detection for local providers
 * @param {Object} context - Extension context with dependencies
 * @returns {Promise<void>}
 */
async function switchModel(context) {
    const { 
        executionStates, 
        minimalModelManager, 
        currentModel, 
        fileManager, 
        t,
        setCurrentModel,
        updateStatusBar,
        quickMenuTreeProvider
    } = context;
    
    if (!executionStates.start(executionStates.OPERATIONS.SWITCH_MODEL)) {
        vscode.window.showInformationMessage(t('messages.operationAlreadyRunning'));
        return;
    }
    
    try {
        // Build model selection items
        const items = [];
        const cloudItems = [];
        const aggregatorItems = [];
        const localAgenticItems = [];
        const localHttpItems = [];

        Object.keys(minimalModelManager.providers).forEach(modelId => {
            const provider = minimalModelManager.providers[modelId];
            const currentModelInfo = minimalModelManager.getCurrentModel(modelId);
    
            const item = {
                label: `${provider.icon} ${provider.name}`,
                description: modelId === currentModel ? '✔ ' + t('labels.active') : currentModelInfo.name,
                value: modelId
            };
    
            if (provider.type === 'local') {
                // Separate agentic local providers (processConfig) from HTTP providers (httpConfig)
                if (provider.agentModule || provider.processConfig) {
                    localAgenticItems.push(item);
                } else {
                    localHttpItems.push(item);
                }
            } else if (provider.requiresModelSelection) {
                aggregatorItems.push(item);
            } else {
                cloudItems.push(item);
            }
        });

        const allItems = [...cloudItems];
        if (aggregatorItems.length > 0) {
            allItems.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
            allItems.push(...aggregatorItems);
        }
        if (localAgenticItems.length > 0) {
            allItems.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
            allItems.push(...localAgenticItems);
        }
        if (localHttpItems.length > 0) {
            allItems.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
            allItems.push(...localHttpItems);
        }

        const selected = await vscode.window.showQuickPick(allItems, {
            placeHolder: t('messages.selectModel')
        });
        
        if (selected) {    
            // Update current model
            setCurrentModel(selected.value);

            // Create updated context with new model
            const updatedContext = {
                ...context,
                currentModel: selected.value
            };
    
            if (quickMenuTreeProvider) {
                quickMenuTreeProvider.context = updatedContext;
                quickMenuTreeProvider.refresh();
            }
            fileManager.saveSelectedModel(selected.value);
            
            const provider = minimalModelManager.providers[selected.value];
            
            // Check if model selection is enabled
            // Only for: API providers with modelDiscovery OR marketplace providers with requiresModelSelection
            // NOT for: Local CLI providers (claudecode, mistralvibe, etc.)
            const needsModelSelection = (
                (provider.modelDiscovery?.enabled === true) || 
                (provider.requiresModelSelection === true)
            );
            
            if (needsModelSelection) {
                let apiKey = updatedContext.apiKeys[selected.value];
                
                // Get API key first if not available
                if (!apiKey) {
                    // For local providers with autoDetectUrls, try auto-detection first
                    if (provider.autoDetectUrls) {
                        apiKey = await autoDetectLocalProvider(selected.value, minimalModelManager.providers);
                        if (apiKey) {
                            updatedContext.apiKeys[selected.value] = apiKey;
                            fileManager.saveApiKey(selected.value, apiKey, minimalModelManager.providers);
                        }
                    }

                    if (!apiKey) {
                        const choice = await vscode.window.showWarningMessage(
                            t('messages.apiKeyRequired', provider.name),
                            t('buttons.enterNow'),
                            t('buttons.later')
                        );
                        if (choice === t('buttons.enterNow')) {
                            await setApiKey(updatedContext);
                            apiKey = updatedContext.apiKeys[selected.value];
                        }
                        
                        if (!apiKey) {
                            updateStatusBar();
                            return; // User cancelled or no API key
                        }
                    }
                }
                
                // Strip old model selection if exists (format: key|model)
                const keyOnly = apiKey.split('|')[0];
                
                // Show model picker with discovered models
                const modelChoice = await showModelSelectionPicker(provider, t, keyOnly, selected.value);
                
                if (!modelChoice) {
                    updateStatusBar();
                    return; // User cancelled
                }
                
                // Save selection in format: key|model-id
                const savedConfig = `${keyOnly}|${modelChoice.id}`;
                updatedContext.apiKeys[selected.value] = savedConfig;
                fileManager.saveApiKey(selected.value, savedConfig, minimalModelManager.providers);
                updateStatusBar();
                vscode.window.showInformationMessage(
                    t('messages.modelSwitched', `${provider.name}: ${modelChoice.displayName || modelChoice.name}`)
                );
                return;
            }
            
            // Auto-detection for local HTTP providers (only if not configured)
            if (provider.type === 'local' && provider.httpConfig) {
                // Skip auto-detection if already configured
                if (updatedContext.apiKeys[selected.value]) {
                    updateStatusBar();
                    vscode.window.showInformationMessage(t('messages.modelSwitched', provider.name));
                } else {
                    // Run auto-detection only if not configured
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: t('messages.operationAlreadyRunning'),
                        cancellable: false
                    }, async () => {
                        const detected = await autoDetectLocalProvider(selected.value, minimalModelManager.providers);
                        if (detected) {
                            updatedContext.apiKeys[selected.value] = detected;
                            fileManager.saveApiKey(selected.value, detected, minimalModelManager.providers);
                            updateStatusBar();
                            vscode.window.showInformationMessage(t('messages.apiKeySaved', provider.name));
                        } else {
                            updateStatusBar();
                            vscode.window.showWarningMessage(t('messages.noPath', provider.name));
                        }
                    });
                }
                
            } else {
                // All non-HTTP local providers: Process providers + Remote providers
                updateStatusBar();
    
                if (!minimalModelManager.getProviderInfo(selected.value).hasApiKey) {
                    // Determine message based on provider type
                    const message = (provider.type === 'local' && provider.processConfig) ? 
                        t('messages.pathRequired', provider.name) : 
                        t('messages.apiKeyRequired', provider.name);
            
                    const choice = await vscode.window.showWarningMessage(
                        message,
                        t('buttons.enterNow'),
                        t('buttons.later')
                    );
                    if (choice === t('buttons.enterNow')) {
                        setApiKey(updatedContext);
                    }
                } else {
                    vscode.window.showInformationMessage(t('messages.modelSwitched', provider.name));
                }
            }
        }
    } finally {
        // Always cleanup execution state
        executionStates.stop(executionStates.OPERATIONS.SWITCH_MODEL);
    }
}

/**
 * API Key setup wrapper - delegates to ApiKeyManager
 * @param {Object} context - Extension context with dependencies
 * @returns {Promise<boolean>} True if API key was successfully set
 */
async function setApiKey(context) {
    const { 
        apiKeyManager, 
        t, 
        currentModel, 
        minimalModelManager, 
        fileManager, 
        validation, 
        apiKeys, 
        updateStatusBar 
    } = context;
    
    // Prepare dependencies for ApiKeyManager
    const deps = {
        t,
        currentModel,
        providers: minimalModelManager.providers,
        fileManager,
        validation,
        apiKeys,
        updateStatusBar
    };
    
    return await apiKeyManager.setApiKey(deps);
}

/**
 * Validate API connection for current model
 * @param {Object} context - Extension context with dependencies
 * @returns {Promise<boolean>} True if connection is valid
 */
async function validateApiConnection(context) {
    const { currentModel, minimalModelManager, apiKeys, t } = context;
    
    const hasApiKey = minimalModelManager.getProviderInfo(currentModel).hasApiKey;
    
    if (!hasApiKey) {
        const provider = minimalModelManager.providers[currentModel];
        vscode.window.showWarningMessage(t('messages.noApiKey', provider.name));
        return false;
    }
    
    return true;
}

/**
 * Auto-detect local HTTP provider
 * @param {string} modelId - Model identifier
 * @param {Object} providers - Provider configurations
 * @param {string|null} manualUrl - Optional manual URL to test (instead of autoDetectUrls)
 * @returns {Promise<string|null>} Detected URL or null
 */
async function autoDetectLocalProvider(modelId, providers, manualUrl = null) {
    const provider = providers[modelId];
    if (!provider?.autoDetectUrls && !manualUrl) {
        return null;
    }
    
    const localProviders = require('../localProviders');
    const providerHandler = localProviders.getHttpProvider(provider.httpHandler || provider.name);
    
    // If manual URL provided, test only that one
    const urlsToTest = manualUrl ? [manualUrl] : provider.autoDetectUrls;
    
    for (const url of urlsToTest) {
        if (await testHttpProvider(url, provider)) {
            if (providerHandler && providerHandler.detectBestModel) {
                const bestModel = await providerHandler.detectBestModel(
                    url, 
                    provider.preferredModels, 
                    provider.defaultPort
                );
                return `${url}|${bestModel || provider.fallback}`;
            }
            return url;
        }
    }
    return null;
}

/**
 * Test HTTP provider connection
 * @param {string} url - URL to test
 * @param {Object} provider - Provider configuration
 * @returns {Promise<boolean>} True if accessible
 */
async function testHttpProvider(url, provider) {
    const { testConnection } = require('../localProviders/httpProviders/httpProvider');
    return testConnection(url, provider.defaultPort || 80, 3000);
}

/**
 * Show model selection picker for providers with multiple models
 * @param {Object} provider - Provider config with availableModels or discovered models
 * @param {Function} t - Translation function
 * @param {string} apiKey - Optional API key for dynamic model discovery
 * @returns {Promise<Object|null>} Selected model or null
 */
async function showModelSelectionPicker(provider, t, apiKey = null, modelId = null) {
    let models = provider.availableModels || [];
    
    // For local providers with staticModels, use them directly (no API discovery possible)
    if (provider.type === 'local' && provider.modelDiscovery?.staticModels && !provider.httpConfig) {
        models = provider.modelDiscovery.staticModels;
    }
    // For API providers, try dynamic model discovery
    else if (apiKey && provider.modelDiscovery?.enabled) {
        try {
            const discoveredModels = await modelDiscovery.discoverModels(
                modelId || provider.name.toLowerCase().replace(/\s/g, ''),
                provider,
                apiKey
            );
            if (discoveredModels && discoveredModels.length > 0) {
                models = discoveredModels;
            }
        } catch (error) {
            console.log(`[ModelDiscovery] Failed to discover models for ${provider.name}, using static list`);
        }
    }
    
    // Fallback to static models if no models available
    if (models.length === 0 && provider.modelDiscovery?.staticModels) {
        models = provider.modelDiscovery.staticModels;
    }
    
    // Safety check
    if (models.length === 0) {
        console.error(`[ModelPicker] No models available for ${provider.name}`);
        return null;
    }
    
    // Determine recommended model using selectDefault or selectBest
    let recommendedModel = null;
    if (provider.modelDiscovery?.selectDefault) {
        try {
            const selected = provider.modelDiscovery.selectDefault(models);
            recommendedModel = models.find(m => 
                (m.id || m.name) === (selected?.id || selected?.name || selected)
            );
        } catch (e) {
            console.log(`[ModelPicker] selectDefault failed:`, e.message);
        }
    } else if (provider.selectBest) {
        try {
            const selected = provider.selectBest(models);
            recommendedModel = models.find(m => 
                (m.id || m.name) === (selected?.id || selected?.name || selected)
            );
        } catch (e) {
            console.log(`[ModelPicker] selectBest failed:`, e.message);
        }
    }
    
    // If no recommendation found, use first model
    if (!recommendedModel && models.length > 0) {
        recommendedModel = models[0];
    }
    
    // Map models to QuickPick items with recommendation indicator
    const items = models.map(model => ({
        label: model === recommendedModel ? 
            `⭐ ${model.displayName || model.name || model.id}` : 
            `${model.displayName || model.name || model.id}`,
        description: model === recommendedModel ? '(Recommended)' : '',
        detail: model.pricing ? 
            (model.pricing.input === 0 ? 
                '💰 Free' : 
                `💰 $${(model.pricing.input * 1000000).toFixed(2)}/$${(model.pricing.output * 1000000).toFixed(2)} per 1M tokens`
            ) : '',
        value: model
    }));
    
    // Sort items: recommended model first, then others
    items.sort((a, b) => {
        if (a.value === recommendedModel) return -1;
        if (b.value === recommendedModel) return 1;
        return 0;
    });
    
    // The first item is now the recommended one
    const activeItem = items[0];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: t('messages.selectModel') || 'Select a model',
        title: `${provider.icon} ${provider.name} - ${t('messages.selectModel') || 'Select Model'}`,
        matchOnDetail: true,
        activeItem: activeItem
    });

    return selected ? selected.value : null;
}

/**
 * Get available models for a provider
 * @param {string} modelId - Model identifier (e.g., 'claude', 'chatgpt')
 * @param {string} apiKey - API key for authentication
 * @param {Object} providers - Provider configurations
 * @returns {Promise<Array>} Array of available models
 */
async function getAvailableModels(modelId, apiKey, providers) {
    const provider = providers[modelId];
    if (!provider) {
        return [];
    }

    try {
        // Use modelDiscovery service
        const models = await modelDiscovery.discoverModels(modelId, provider, apiKey);
        return models || [];
    } catch (error) {
        console.log(`✗ Model discovery error for ${provider.name}:`, error.message);
        return [];
    }
}

module.exports = {
    callAI,
    switchModel,
    setApiKey,
    validateApiConnection,
    autoDetectLocalProvider,
    getAvailableModels
};
