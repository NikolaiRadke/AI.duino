/*
 * AI.duino - API Key Manager Module
 * Copyright 2026 Monster Maker
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
            // Try auto-discovery for local providers first
            let currentValue = '';
            if (provider.type === 'local') {
                // Check if already set
                currentValue = apiKeys[currentModel] || '';
    
                // If not set, try auto-discovery
                if (!currentValue) {
                    const { discoverProvider, findNodeV20Plus } = require('./providerDiscovery');
                    const discovered = await discoverProvider(currentModel, provider);
                    
                    if (discovered) {
                        currentValue = discovered.path;
            
                        // For Gemini CLI, also cache Node.js path
                        if (discovered.nodePath) {
                            // Trigger setNodePath with pre-filled value
                            await this.setNodePath({
                                ...deps,
                                prefilledValue: discovered.nodePath
                            });
                        }
                    } else if (provider.autoDetectUrls?.length > 0) {
                        currentValue = provider.autoDetectUrls[0];
                    }
                }
            }

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

    /**
     * Set Node.js v20+ path for Gemini CLI
     */
    async setNodePath(deps) {
        const { t, fileManager, prefilledValue } = deps;  // <- prefilledValue hinzufügen
        const vscode = require('vscode');
    
        const input = await vscode.window.showInputBox({
            prompt: t('buttons.enterNodePath'),
            placeHolder: '/usr/bin/node',
            value: prefilledValue || '',  // <- Vorbelegter Wert wie bei Binaries
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return t('errors.invalidInput');
                }
                if (!fileManager.fileExists(value)) {
                    return t('errors.fileNotFound');
                }
                return null;
            }
        });
    
        if (input) {
            if (fileManager.saveNodePath(input)) {
                vscode.window.showInformationMessage(t('messages.nodePathSaved'));
                return true;
            } else {
                vscode.window.showErrorMessage(t('errors.saveFailed'));
                return false;
            }
        }
        
        return false;
    }   
}

module.exports = { ApiKeyManager };
