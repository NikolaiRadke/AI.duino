/*
 * AI.duino - API Key Manager Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require("vscode");

/**
 * API Key Manager - Handles API key input and validation
 * 
 * This module manages API key setup for AI providers with validation
 */
class ApiKeyManager {
    constructor() {
        this.isSettingKey = false;
    }

    /**
     * Set API key for current model with validation
     * @param {Object} deps - Dependencies { t, currentModel, providers, fileManager, validation, apiKeys, updateStatusBar }
     * @returns {boolean} True if key was successfully set
     */
    async setApiKey(deps) {
        const { t, currentModel, providers, fileManager, validation, apiKeys, updateStatusBar } = deps;
        
        // Prevent multiple simultaneous API key setups
        if (this.isSettingKey) {
            vscode.window.showInformationMessage("API Key setup is already running! Please wait...");
            return false;
        }
        
        this.isSettingKey = true;
        
        try {
            const provider = providers[currentModel];
            if (!provider) {
                vscode.window.showErrorMessage(`Unknown provider: ${currentModel}`);
                return false;
            }
            
            const providerName = provider.name;
            const currentValue = provider.type === 'local' ? (apiKeys[currentModel] || '') : '';

            const input = await vscode.window.showInputBox({
                prompt: provider.type === 'local' ? 
                    `${providerName} ${t('buttons.enterPath')}` : 
                    `${providerName} ${t('buttons.enterApiKey')}`,
                placeHolder: provider.keyPrefix + '...',
                value: currentValue, 
                password: provider.type !== 'local',  
                ignoreFocusOut: true,
                validateInput: (value) => {
                    return validation.validateApiKey(
                        value, 
                        provider.keyPrefix, 
                        provider.keyMinLength || 15, 
                        t
                    );
                }
            })
            
            if (input) {
                // Save API key using fileManager
                if (fileManager.saveApiKey(currentModel, input, providers)) {
                    // Update in-memory API keys
                    apiKeys[currentModel] = input;
                    
                    // Update status bar
                    updateStatusBar();
                    
                    // Show success message
                    const successMessage = t('messages.apiKeySaved', providerName) || 
                                         `${providerName} API key saved!`;
                    vscode.window.showInformationMessage(successMessage);
                    
                    return true;
                } else {
                    const errorMessage = t('errors.saveFailed', 'File save failed') || 
                                        `Failed to save API key: File save failed`;
                    vscode.window.showErrorMessage(errorMessage);
                    return false;
                }
            }
            
            return false;
            
        } finally {
            // Always cleanup the lock
            this.isSettingKey = false;
        }
    }

    /**
     * Check if API key setup is currently running
     * @returns {boolean} True if setup is in progress
     */
    isSetupInProgress() {
        return this.isSettingKey;
    }

    /**
     * Get provider name for current model
     * @param {string} modelId - Model identifier
     * @param {Object} providers - Provider configurations
     * @returns {string} Provider display name
     */
    getProviderName(modelId, providers) {
        return providers[modelId]?.name || 'Unknown';
    }

    /**
     * Cleanup any ongoing operations
     */
    dispose() {
        this.isSettingKey = false;
    }
}

module.exports = { ApiKeyManager };
