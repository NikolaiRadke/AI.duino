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
            } else {
                cloudItems.push(item);
            }
        });

        const allItems = [...cloudItems];
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
            
            // Force auto-detection for local providers
            if (provider.type === 'local' && provider.httpConfig) {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Detecting ${provider.name}...`,
                    cancellable: false
                }, async () => {
                    // Clear existing config to force re-detection
                    delete updatedContext.apiKeys[selected.value];
                    
                    // Run auto-detection
                    const detected = await autoDetectLocalProvider(selected.value, minimalModelManager.providers);
                    if (detected) {
                        updatedContext.apiKeys[selected.value] = detected;
                        fileManager.saveApiKey(selected.value, detected, minimalModelManager.providers);
                        updateStatusBar();
                            vscode.window.showInformationMessage(`${provider.name} detected: ${detected.split('|')[0]}`);
                    } else {
                        updateStatusBar();
                            vscode.window.showWarningMessage(`$(warning) ${provider.name} not found...`);
                    }
                });
                
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
 * @returns {Promise<string|null>} Detected URL or null
 */
async function autoDetectLocalProvider(modelId, providers) {
    const provider = providers[modelId];
    if (!provider?.autoDetectUrls) {
        return null;
    }
    
    // Hole den passenden HTTP Provider Handler
    const localProviders = require('../localProviders');
    const providerHandler = localProviders.getHttpProvider(provider.name);
    
    for (const url of provider.autoDetectUrls) {
        if (await testHttpProvider(url, provider)) {
            if (providerHandler && providerHandler.detectBestModel) {
                const bestModel = await providerHandler.detectBestModel(
                    url, 
                    provider.preferredModels, 
                    provider.defaultPort
                );
                return `${url}|${bestModel || provider.fallback}`;
            }
            // Andere Provider (Process-basierte): nur URL zurückgeben
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

module.exports = {
    callAI,
    switchModel,
    setApiKey,
    validateApiConnection
};
