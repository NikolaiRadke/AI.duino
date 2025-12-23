/*
 * AI.duino - API Manager Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');

/**
 * Main API call function - delegates to UnifiedAPIClient
 * @param {string} prompt - The prompt to send to AI
 * @param {Object} context - Extension context with dependencies
 * @returns {Promise} AI response promise
 */
function callAI(prompt, context) {
    const { apiClient, currentModel } = context;
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
        const localItems = [];

        Object.keys(minimalModelManager.providers).forEach(modelId => {
            const provider = minimalModelManager.providers[modelId];
            const currentModelInfo = minimalModelManager.getCurrentModel(modelId);
    
            const item = {
                label: `${provider.icon} ${provider.name}`,
                description: modelId === currentModel ? '✓ ' + t('labels.active') : currentModelInfo.name,
                value: modelId
            };
    
            if (provider.type === 'local') {
                localItems.push(item);
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
        if (localItems.length > 0) {
            allItems.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
            allItems.push(...localItems);
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
            
            // Check if model selection is required (OpenRouter)
            if (provider.requiresModelSelection && provider.availableModels) {
                const modelChoice = await showModelSelectionPicker(provider, t);
                if (!modelChoice) {
                    updateStatusBar();
                    return; // User cancelled
                }
                
                // Save selection in format: sk-or-xxx|model-id
                let apiKey = updatedContext.apiKeys[selected.value];
                if (apiKey) {
                    // Strip old model if exists (format: key|model)
                    const keyOnly = apiKey.split('|')[0];
                    const savedConfig = `${keyOnly}|${modelChoice.id}`;
                    updatedContext.apiKeys[selected.value] = savedConfig;
                    fileManager.saveApiKey(selected.value, savedConfig, minimalModelManager.providers);
                    updateStatusBar();
                    vscode.window.showInformationMessage(
                        t('messages.modelSwitched', `${provider.name}: ${modelChoice.name}`)
                    );
                    return;
                } else {
                    // No API key yet - ask for it first
                    const choice = await vscode.window.showWarningMessage(
                        t('messages.apiKeyRequired', provider.name),
                        t('buttons.enterNow'),
                        t('buttons.later')
                    );
                    if (choice === t('buttons.enterNow')) {
                        await setApiKey(updatedContext);
                        // After entering API key, ask for model again
                        const modelChoice2 = await showModelSelectionPicker(provider, t);
                        if (modelChoice2) {
                            const newApiKey = updatedContext.apiKeys[selected.value];
                            const savedConfig = `${newApiKey}|${modelChoice2.id}`;
                            updatedContext.apiKeys[selected.value] = savedConfig;
                            fileManager.saveApiKey(selected.value, savedConfig, minimalModelManager.providers);
                        }
                    }
                    updateStatusBar();
                    return;
                }
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
    const providerHandler = localProviders.getHttpProvider(provider.name);
    
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
 * @param {Object} provider - Provider config with availableModels
 * @param {Function} t - Translation function
 * @returns {Promise<Object|null>} Selected model or null
 */
async function showModelSelectionPicker(provider, t) {
    const items = provider.availableModels.map(model => ({
        label: `${model.name}`,
        detail: model.pricing.input === 0 ? 
            '💰 Free' : 
            `💰 $${(model.pricing.input * 1000000).toFixed(2)}/$${(model.pricing.output * 1000000).toFixed(2)} per 1M tokens`,
        value: model
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: t('messages.selectModel') || 'Select a model'
    });

    return selected ? selected.value : null;
}

/**
 * Detect best model for cloud provider from API
 * @param {string} modelId - Model identifier (e.g., 'claude', 'chatgpt')
 * @param {string} apiKey - API key for authentication
 * @param {Object} providers - Provider configurations
 * @returns {Promise<string|null>} Best model ID or null
 */
async function detectBestCloudModel(modelId, apiKey, providers) {
    const provider = providers[modelId];
    if (!provider || provider.type === 'local') {
        return null;
    }

    try {
        const https = require('https');
        
        return new Promise((resolve, reject) => {
            const options = {
                hostname: provider.hostname,
                path: provider.path,
                method: 'GET',
                headers: provider.headers(apiKey),
                timeout: 5000
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            console.log(`✗ API returned status ${res.statusCode} for ${provider.name}`);
                            resolve(null);
                            return;
                        }

                        const parsed = JSON.parse(data);
                        const models = provider.extractModels(parsed);
                        
                        if (models && models.length > 0) {
                            const best = provider.selectBest(models);
                            const modelId = best?.id || best?.name || best;
                            console.log(`✓ Detected best model for ${provider.name}: ${modelId}`);
                            resolve(modelId);
                        } else {
                            console.log(`✗ No models found for ${provider.name}, using fallback`);
                            resolve(null);
                        }
                    } catch (e) {
                        console.log(`✗ Failed to parse models for ${provider.name}:`, e.message);
                        resolve(null);
                    }
                });
            });

            req.on('error', (e) => {
                console.log(`✗ Model detection failed for ${provider.name}:`, e.message);
                resolve(null);
            });

            req.on('timeout', () => {
                req.destroy();
                console.log(`✗ Model detection timeout for ${provider.name}`);
                resolve(null);
            });

            req.end();
        });
    } catch (error) {
        console.log(`✗ Model detection error for ${provider.name}:`, error.message);
        return null;
    }
}

module.exports = {
    callAI,
    switchModel,
    setApiKey,
    validateApiConnection,
    autoDetectLocalProvider,
    detectBestCloudModel
};
