/**
 * utils/promptManager.js - Custom Prompt Management System
 * Manages user-customizable prompts with fallback to locale defaults
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');


class PromptManager {
    constructor() {
        this.currentLocale = 'en'; // Default
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
        try {
            if (fs.existsSync(this.customPromptsFile)) {
                const content = fs.readFileSync(this.customPromptsFile, 'utf8');
                this.customPrompts = JSON.parse(content);
                
                // Validate structure and add missing prompts
                this.validateAndUpdateStructure();
                return true;
            }
        } catch (error) {
            console.log('AI.duino: Failed to load custom prompts, using defaults');
        }
        
        this.customPrompts = null;
        return false;
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
        try {
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
        } catch (error) {
            console.error('Failed to save custom prompts:', error);
            return false;
        }
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
        try {
            if (fs.existsSync(this.customPromptsFile)) {
                fs.unlinkSync(this.customPromptsFile);
            }
        } catch (error) {
            console.error('Failed to delete custom prompts file:', error);
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

    /**
     * Check if custom prompts file exists
     * @returns {boolean}
     */
    hasCustomPrompts() {
        return this.customPrompts !== null;
    }

    /**
     * Export prompts to a file for sharing
     * @param {string} exportPath - Path to export file
     */
    exportPrompts(exportPath) {
        try {
            const data = {
                _metadata: {
                    version: '1.0',
                    exported: new Date().toISOString(),
                    source: 'AI.duino Custom Prompts'
                },
                ...(this.customPrompts || this.defaultPrompts)
            };
            
            return fileManager.safeWriteFile(exportPath, JSON.stringify(data, null, 2));
        } catch (error) {
            return false;
        }
    }

    /**
     * Import prompts from a file  
     * @param {string} importPath - Path to import file
     */
    importPrompts(importPath) {
        try {
            if (!fileManager.isFileReadable(importPath)) {
                return false;
            }
            
            const content = fs.readFileSync(importPath, 'utf8');
            const data = JSON.parse(content);
            
            // Remove metadata before importing
            const { _metadata, ...prompts } = data;
            
            this.customPrompts = prompts;
            this.validateAndUpdateStructure();
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = {
    PromptManager
};
