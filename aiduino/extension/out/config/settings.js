/*
 * AI.duino - Centralized Settings Management
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');

class SettingsManager {
    constructor(context) {
        this.context = context;
        this.vsCodeConfigPrefix = 'aiduino';
        
        // All default values
        this.defaults = {
            // ===== AI BEHAVIOR =====
            temperature: 0.7,
            maxTokensPerRequest: 2000,
            customInstructionsEnabled: true,
            
            // ===== PERFORMANCE =====
            apiTimeout: 30000,                      // 30 seconds
            apiMaxRetries: 3,
            debounceConfigChange: 300,              // ms
            debounceSaveOperation: 500,             // ms
            debounceErrorClear: 5000,               // ms
            inlineCompletionDelay: 500,             // ms (Rate limiting)
            
            // ===== UI PREFERENCES =====
            language: 'auto',
            defaultModel: 'claude',
            inlineCompletionEnabled: false,

            // ===== INLINE COMPLETION =====
            inlineCompletionDelay: 500,             // Rate limiting delay (ms)
            inlineCompletionContextLines: 10,       // Lines before cursor for context
            inlineCompletionMinCommentLength: 4,    // Min comment length to trigger
            inlineCompletionMaxLinesComment: 15,    // Max lines for comment-to-code
            inlineCompletionMaxLinesSimple: 3,      // Max lines for simple completions

            // ===== UPDATES =====
            autoUpdateConfigs: true,
            autoCheckExtensionUpdates: true,
            updateCheckInterval: 86400000,          // 24h in ms
            updateCheckDelay: 3000,                 // Startup delay
            
            // ===== SUPPORT HINTS =====
            supportHintsEnabled: true,
            supportHintInterval: 30,        // Days
            supportHintMilestones: [10, 50, 100, 250],

            // ===== CHAT PANEL =====
            maxChats: 10,
            maxMessagesPerChat: 100,
            
            // ===== ADVANCED =====
            tokenEstimationMultiplier: 0.75,
            tokenEstimationCodeBlock: 10,
            tokenEstimationSpecialChars: 0.2
        };
        
        // Mapping: Which settings come from VS Code Config vs GlobalState
        this.vsCodeSettings = [
            'language',
            'autoDetectErrors', 
            'defaultModel',
            'maxTokensPerRequest',
            'temperature',
            'customInstructionsEnabled',
            'inlineCompletionEnabled'
        ];
        
        this.globalStateSettings = [
            'supportHintsEnabled',
            'supportHintInterval',
            'commentInstructions',
            'customInstructions',
            'useCount',
            'lastSupportHint',
            'autoUpdateConfigs',
            'autoCheckExtensionUpdates'
        ];
    }
    
    /**
     * Main method: Get setting value
     * Priority: VS Code Config > GlobalState > Default
     * @param {string} key - Setting key
     * @returns {any} Setting value
     */
    get(key) {
        // 1. Try VS Code Configuration
        if (this.vsCodeSettings.includes(key)) {
            const config = vscode.workspace.getConfiguration(this.vsCodeConfigPrefix);
            const value = config.get(key);
            if (value !== undefined) {
                return value;
            }
        }
        
        // 2. Try GlobalState
        if (this.globalStateSettings.includes(key)) {
            const stateKey = `aiduino.${key}`;
            const value = this.context.globalState.get(stateKey);
            if (value !== undefined) {
                return value;
            }
        }
        
        // 3. Fallback to default
        return this.defaults[key];
    }
    
    /**
     * Set setting value
     * Automatically saves to the correct location
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     * @param {boolean} global - Target (true=User, false=Workspace)
     * @returns {Promise<void>}
     */
    async set(key, value, global = true) {
        // VS Code Configuration Settings
        if (this.vsCodeSettings.includes(key)) {
            const config = vscode.workspace.getConfiguration(this.vsCodeConfigPrefix);
            await config.update(key, value, global);
            return;
        }
        
        // GlobalState Settings
        if (this.globalStateSettings.includes(key)) {
            const stateKey = `aiduino.${key}`;
            await this.context.globalState.update(stateKey, value);
            return;
        }
        
        // Unknown setting - save as GlobalState
        const stateKey = `aiduino.${key}`;
        await this.context.globalState.update(stateKey, value);
    }
    
    /**
     * Get all settings (for UI panel)
     * @returns {Object} All current settings grouped
     */
    getAll() {
        return {
            aiBehavior: {
                temperature: this.get('temperature'),
                maxTokensPerRequest: this.get('maxTokensPerRequest'),
                customInstructionsEnabled: this.get('customInstructionsEnabled')
            },
            performance: {
                apiTimeout: this.get('apiTimeout'),
                apiMaxRetries: this.get('apiMaxRetries'),
                debounceConfigChange: this.get('debounceConfigChange'),
                debounceSaveOperation: this.get('debounceSaveOperation'),
                debounceErrorClear: this.get('debounceErrorClear'),
                inlineCompletionDelay: this.get('inlineCompletionDelay')
            },
            uiPreferences: {
                language: this.get('language'),
                autoDetectErrors: this.get('autoDetectErrors'),
                defaultModel: this.get('defaultModel'),
                inlineCompletionEnabled: this.get('inlineCompletionEnabled')
            },
            updates: {
                autoUpdateConfigs: this.get('autoUpdateConfigs'),
                autoCheckExtensionUpdates: this.get('autoCheckExtensionUpdates'),
                updateCheckDelay: this.get('updateCheckDelay')
            },
            supportHints: {
                enabled: this.get('supportHintsEnabled'),
                interval: this.get('supportHintInterval'),
                milestones: this.get('supportHintMilestones'),
                useCount: this.get('useCount') || 0,
                lastShown: this.get('lastSupportHint') || 0
            },
            advanced: {
                tokenEstimationMultiplier: this.get('tokenEstimationMultiplier'),
                tokenEstimationCodeBlock: this.get('tokenEstimationCodeBlock'),
                tokenEstimationSpecialChars: this.get('tokenEstimationSpecialChars')
            }
        };
    }
    
    /**
     * Reset setting to default value
     * @param {string} key - Setting key
     * @returns {Promise<void>}
     */
    async reset(key) {
        const defaultValue = this.defaults[key];
        await this.set(key, defaultValue);
    }
    
    /**
     * Reset all settings to defaults
     * @returns {Promise<void>}
     */
    async resetAll() {
        for (const key of Object.keys(this.defaults)) {
            await this.reset(key);
        }
    }
    
    /**
     * Validate setting value
     * @param {string} key - Setting key
     * @param {any} value - Value to validate
     * @returns {boolean} Valid or not
     */
    validate(key, value) {
        switch (key) {
            case 'temperature':
                return typeof value === 'number' && value >= 0 && value <= 1;
            
            case 'maxTokensPerRequest':
                return typeof value === 'number' && value >= 500 && value <= 4000;
            
            case 'apiTimeout':
                return typeof value === 'number' && value >= 5000 && value <= 120000;
            
            case 'apiMaxRetries':
                return typeof value === 'number' && value >= 0 && value <= 10;
            
            case 'supportHintInterval':
                return typeof value === 'number' && value >= 0 && value <= 365;
            
            case 'language':
                return typeof value === 'string';
            
            case 'autoDetectErrors':
            case 'customInstructionsEnabled':
            case 'inlineCompletionEnabled':
            case 'autoUpdateConfigs':
            case 'supportHintsEnabled':
                return typeof value === 'boolean';
            
            default:
                return true; // Unknown keys are allowed
        }
    }
    
    /**
     * Migration helper: Find hardcoded values in code
     * @returns {Object} Mapping of old values to settings
     */
    getMigrationMapping() {
        return {
            // apiClient.js
            'maxRetries = 3': 'settings.get("apiMaxRetries")',
            'timeout = 30000': 'settings.get("apiTimeout")',
            
            // providerConfigs.js
            'max_tokens: 2000': 'settings.get("maxTokensPerRequest")',
            'temperature: 0.7': 'settings.get("temperature")',
            
            // configUpdater.js
            'UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000': 'settings.get("updateCheckInterval")',
            '3000': 'settings.get("updateCheckDelay")',
            
            // eventManager.js
            'DEBOUNCE_DELAYS.CONFIG_CHANGE (300)': 'settings.get("debounceConfigChange")',
            'DEBOUNCE_DELAYS.SAVE_OPERATION (500)': 'settings.get("debounceSaveOperation")',
            'DEBOUNCE_DELAYS.ERROR_CLEAR (5000)': 'settings.get("debounceErrorClear")',
            
            // completionProvider.js
            'minDelayMs = 500': 'settings.get("inlineCompletionDelay")',
            
            // ui.js
            '30 (days)': 'settings.get("supportHintInterval")',
            '[10, 50, 100, 250]': 'settings.get("supportHintMilestones")'
        };
    }
}

module.exports = { SettingsManager };
