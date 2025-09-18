/*
 * AI.duino -Prompt Manager Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */


const fs = require('fs');
const path = require('path');
const os = require('os');

class PromptManager {
    constructor() {
        this.currentLocale = 'en';
        this.customPromptsFile = null;
        this.backupFile = null;
        this.updateFilePaths();
    }

    updateFilePaths() {
        this.customPromptsFile = path.join(os.homedir(), `.aiduino/.aiduino-custom-prompts-${this.currentLocale}.json`);
    }

    initialize(i18n, locale = 'en') {
        this.currentLocale = locale;
        this.updateFilePaths();
        this.defaultPrompts = i18n.prompts || {};
        this.customPrompts = null;
        this.loadCustomPrompts();
    }

    /**
     * Load custom prompts from file or create default structure
     */
    loadCustomPrompts() {
        if (!fs.existsSync(this.customPromptsFile)) {
            this.customPrompts = null;
            return false;
        }

        const content = fs.readFileSync(this.customPromptsFile, 'utf8');
        this.customPrompts = JSON.parse(content);
        
        // Validate structure and add missing prompts
        this.validateAndUpdateStructure();
        return true;
    }

    /**
     * Validate custom prompts structure and add missing default prompts
     */
    validateAndUpdateStructure() {
        if (!this.customPrompts || typeof this.customPrompts !== 'object') {
            this.customPrompts = {};
        }

        let updated = false;
        
        // Add missing prompts from defaults
        Object.keys(this.defaultPrompts).forEach(key => {
            if (!this.customPrompts.hasOwnProperty(key)) {
                this.customPrompts[key] = this.defaultPrompts[key];
                updated = true;
            }
        });

        // Save if updated
        if (updated) {
            this.saveCustomPrompts();
        }
    }

    /**
     * Get prompt - custom if available, otherwise default
     * @param {string} key - Prompt key
     * @param {...any} args - Arguments for string replacement
     * @returns {string} The prompt text
     */
    getPrompt(key, ...args) {
        let prompt = this.customPrompts?.[key] || this.defaultPrompts?.[key] || key;
        
        // Replace placeholders {0}, {1}, etc.
        if (typeof prompt === 'string' && args.length > 0) {
            prompt = prompt.replace(/{(\d+)}/g, (match, index) => {
                return args[parseInt(index)] || match;
            });
        }
        
        return prompt;
    }

    /**
     * Save custom prompts to file
     */
    saveCustomPrompts() {
        // Add metadata
        const dataToSave = {
            _metadata: {
                version: '1.0',
                created: new Date().toISOString(),
                description: 'AI.duino Custom Prompts - Edit with caution'
            },
            ...this.customPrompts
        };

        const content = JSON.stringify(dataToSave, null, 2);
        const tempFile = this.customPromptsFile + '.tmp';
        fs.writeFileSync(tempFile, content, { mode: 0o600 });
        fs.renameSync(tempFile, this.customPromptsFile);
        return true;
    }

    /**
     * Update a specific prompt
     * @param {string} key - Prompt key
     * @param {string} value - New prompt value
     */
    updatePrompt(key, value) {
        if (!this.customPrompts) {
            this.customPrompts = { ...this.defaultPrompts };
        }
        
        this.customPrompts[key] = value;
        this.saveCustomPrompts();
    }

    /**
     * Get all prompts for editor
     * @returns {Object} All prompts with metadata
     */
    getAllPrompts() {
        const prompts = this.customPrompts || this.defaultPrompts;
        return {
            isCustom: !!this.customPrompts,
            prompts: prompts || {},
            defaults: this.defaultPrompts || {}
        };
    }

    /**
     * Check if all custom prompts match defaults and delete file if so
     */
    cleanupIfUnchanged() {
        if (!this.customPrompts) return;
    
        const hasModifiedPrompts = Object.keys(this.customPrompts)
            .filter(k => k !== '_metadata')
            .some(k => this.customPrompts[k] !== this.defaultPrompts[k]);
    
        if (!hasModifiedPrompts) {
            // All prompts match defaults - delete file
            if (fs.existsSync(this.customPromptsFile)) {
                fs.unlinkSync(this.customPromptsFile);
            }
            this.customPrompts = null;
        }
    }
}

module.exports = {
    PromptManager
};
