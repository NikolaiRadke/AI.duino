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
 * Switch AI model with user selection and API key validation
 * @param {Object} context - Extension context with dependencies
 * @returns {Promise<void>}
 */
async function switchModel(context) {
    const { 
        executionStates, 
        minimalModelManager, 
        currentModel, 
        fileManager, 
        t 
    } = context;
    
    if (!executionStates.start(executionStates.OPERATIONS.SWITCH_MODEL)) {
        vscode.window.showInformationMessage("Model switch is already running! Please wait...");
        return;
    }
    
    try {
        // Build model selection items
        const items = Object.keys(minimalModelManager.providers).map(modelId => {
            const provider = minimalModelManager.providers[modelId];
            const currentModelInfo = minimalModelManager.getCurrentModel(modelId);
            return {
                label: `${provider.icon} ${provider.name}`,
                description: modelId === currentModel ? '✓ ' + t('labels.active') : currentModelInfo.name,
                value: modelId
            };
        });
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: t('messages.selectModel')
        });
        
        if (selected) {
            // Update current model via callback
            context.setCurrentModel(selected.value);
            fileManager.saveSelectedModel(selected.value);
            context.updateStatusBar();
            
            // Check if API key is needed
            if (!minimalModelManager.getProviderInfo(selected.value).hasApiKey) {
                const provider = minimalModelManager.providers[selected.value];
                const isLocal = provider.type === 'local';
    
                const message = isLocal ? 
                    t('messages.pathRequired', provider.name) : 
                    t('messages.apiKeyRequired', provider.name);
    
                const choice = await vscode.window.showWarningMessage(
                    message,
                    t('buttons.enterNow'),
                    t('buttons.later')
                );
                if (choice === t('buttons.enterNow')) {
                    // Don't await setApiKey to avoid blocking the execution state
                    setApiKey(context);
                }
            } else {
                const provider = minimalModelManager.providers[selected.value];
                vscode.window.showInformationMessage(t('messages.modelSwitched', provider.name));
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
    
    if (!apiKeyManager) {
        vscode.window.showErrorMessage("API Key Manager not initialized");
        return false;
    }
    
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
 * Get provider display name for a model
 * @param {string} modelId - Model identifier
 * @param {Object} minimalModelManager - Model manager instance
 * @returns {string} Provider name or 'Unknown'
 */
function getProviderName(modelId, minimalModelManager) {
    return minimalModelManager.providers[modelId]?.name || 'Unknown';
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

module.exports = {
    callAI,
    switchModel,
    setApiKey,
    getProviderName,
    validateApiConnection
};
