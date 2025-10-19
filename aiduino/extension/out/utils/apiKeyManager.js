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
            vscode.window.showInformationMessage(t('messages.operationAlreadyRunning'));
            return false;
        }
        
        this.isSettingKey = true;
        
        try {
            const provider = providers[currentModel];
            if (!provider) {
                vscode.window.showErrorMessage(t('errors.unknownProvider') + `: ${currentModel}`);
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
                let finalValue = input;
        
               // For HTTP-based local providers: Run model detection
                if (provider.type === 'local' && provider.httpConfig) {
                    let normalizedUrl = input;
    
                    // Normalize URL: Add default port if missing
                    try {
                        const testUrl = new URL(input);
                        if (!testUrl.port && provider.defaultPort) {
                            normalizedUrl = `${testUrl.protocol}//${testUrl.hostname}:${provider.defaultPort}${testUrl.pathname}`;
                        }
                    } catch (e) {
                        // Keep original if URL parsing fails
                    }
    
                    // Use existing autoDetectLocalProvider with manual URL
                    const apiManager = require('./apiManager');
                    const detected = await apiManager.autoDetectLocalProvider(currentModel, providers, normalizedUrl);
    
                    if (detected) {
                        finalValue = detected;
                    } else {
                        vscode.window.showErrorMessage(`${providerName} ${t('errors.localProviderNotRunning')} (${normalizedUrl})`);
                        return false;
                    }
                }
    
                // Save API key using fileManager
                if (fileManager.saveApiKey(currentModel, finalValue, providers)) {
                    // Update in-memory API keys
                    apiKeys[currentModel] = finalValue;
        
                    // Update status bar
                    updateStatusBar();
        
                    // Show success message
                    const successMessage = t('messages.apiKeySaved', providerName);
                    vscode.window.showInformationMessage(successMessage);
        
                    return true;
                } else {
                    const errorMessage = t('errors.saveFailed');
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
     * Cleanup any ongoing operations
     */
    dispose() {
        this.isSettingKey = false;
    }
}

module.exports = { ApiKeyManager };
