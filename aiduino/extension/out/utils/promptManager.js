/**
 * utils/promptManager.js - Custom Prompt Management System
 * Manages user-customizable prompts with fallback to locale defaults
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
        this.customPromptsFile = path.join(os.homedir(), `.aiduino-custom-prompts-${this.currentLocale}.json`);
        this.backupFile = path.join(os.homedir(), `.aiduino-custom-prompts-${this.currentLocale}.backup.json`);
    }

    initialize(i18n, locale = 'en') {
        this.currentLocale = locale;
        this.updateFilePaths();
        this.defaultPrompts = i18n.prompts || {};
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
     * Save custom prompts to file with backup
     */
    saveCustomPrompts() {
        // Create backup first
        if (fs.existsSync(this.customPromptsFile)) {
            fs.copyFileSync(this.customPromptsFile, this.backupFile);
        }

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
        fs.writeFileSync(this.customPromptsFile, content, { mode: 0o600 });
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
     * Reset all prompts to defaults
     */
    resetToDefaults() {
        this.customPrompts = null;
        if (fs.existsSync(this.customPromptsFile)) {
            fs.unlinkSync(this.customPromptsFile);
        }
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
}

module.exports = {
    PromptManager
};
