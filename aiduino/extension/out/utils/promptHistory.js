/*
 * AI.duino - Prompt History Manager
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');

/**
 * Generic Prompt History Manager for AI.duino
 * Handles storage and retrieval of user prompts across different features
 */
class PromptHistoryManager {
    constructor() {
        this.historyFile = path.join(os.homedir(), '.aiduino', '.aiduino-prompt-history.json');
        this.maxEntriesPerCategory = 20;
        this.maxSearchResults = 8;
        this.history = this.loadHistory();
    }

    /**
     * Load history from file
     * @returns {Object} History data structure
     */
    loadHistory() {
        if (!fs.existsSync(this.historyFile)) {
            return this.createEmptyHistory();
        }

        try {
            const data = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
            return data.version ? data : this.migrateOldFormat(data);
        } catch (error) {
            return this.createEmptyHistory();
        }
    }

    /**
     * Create empty history structure
     * @returns {Object} Empty history
     */
    createEmptyHistory() {
        return {
            version: '1.0',
            categories: {},
            lastUpdated: Date.now()
        };
    }

    /**
     * Migrate old history format (if needed)
     * @param {Object} oldData - Old format data
     * @returns {Object} New format data
     */
    migrateOldFormat(oldData) {
        return {
            version: '1.0',
            categories: { askAI: oldData.prompts || [] },
            lastUpdated: Date.now()
        };
    }

    /**
     * Save history to file
     */
    saveHistory() {
        try {
            this.history.lastUpdated = Date.now();
            const data = JSON.stringify(this.history, null, 2);
            
            // Atomic write
            const tempFile = this.historyFile + '.tmp';
            fs.writeFileSync(tempFile, data, { mode: 0o600 });
            fs.renameSync(tempFile, this.historyFile);
        } catch (error) {
            console.error('Failed to save prompt history:', error);
        }
    }

    /**
     * Add prompt to history
     * @param {string} category - Feature category (askAI, explainError, etc.)
     * @param {string} prompt - User prompt text
     * @param {Object} metadata - Optional metadata (board, timestamp, etc.)
     */
    addPrompt(category, prompt, metadata = {}) {
        if (!prompt || !prompt.trim()) return;

        const trimmedPrompt = prompt.trim();
        
        // Initialize category if not exists
        if (!this.history.categories[category]) {
            this.history.categories[category] = [];
        }

        const categoryHistory = this.history.categories[category];
        
        // Check for duplicates and remove if found
        const existingIndex = categoryHistory.findIndex(entry => 
            entry.prompt.toLowerCase() === trimmedPrompt.toLowerCase()
        );
        
        if (existingIndex !== -1) {
            categoryHistory.splice(existingIndex, 1);
        }

        // Add new entry at the beginning
        const entry = {
            prompt: trimmedPrompt,
            timestamp: Date.now(),
            count: this.getPromptCount(category, trimmedPrompt) + 1,
            ...metadata
        };

        categoryHistory.unshift(entry);

        // Limit size
        if (categoryHistory.length > this.maxEntriesPerCategory) {
            categoryHistory.splice(this.maxEntriesPerCategory);
        }

        this.saveHistory();
    }

    /**
     * Get usage count for a prompt
     * @param {string} category - Feature category
     * @param {string} prompt - Prompt text
     * @returns {number} Usage count
     */
    getPromptCount(category, prompt) {
        const categoryHistory = this.history.categories[category] || [];
        const existing = categoryHistory.find(entry => 
            entry.prompt.toLowerCase() === prompt.toLowerCase()
        );
        return existing ? existing.count : 0;
    }

    /**
     * Get recent prompts for a category
     * @param {string} category - Feature category
     * @param {number} limit - Maximum results
     * @param {Function} t - Translation function
     * @param {string} currentLocale - Current locale
     * @returns {Array} Recent prompts
     */
    getRecentPrompts(category, limit = this.maxSearchResults, t = null, currentLocale = 'en') {
    const categoryHistory = this.history.categories[category] || [];
    const items = categoryHistory
        .slice(0, limit)
        .map(entry => ({
            label: this.formatPromptLabel(entry.prompt),
            description: t ? this.formatPromptDescription(entry, t, currentLocale) : '',
            value: entry.prompt,
            timestamp: entry.timestamp,
            count: entry.count
        }));
    
    // Add placeholder at beginning
    items.unshift({
        label: '💭 ' + (t ? t('buttons.newInput') : 'New input'),
        description: '',
        value: '__PLACEHOLDER__',
        timestamp: Date.now(),
        count: 0
    });
    
    return items;
}

    /**
     * Search prompts by text
     * @param {string} category - Feature category
     * @param {string} searchText - Search query
     * @param {number} limit - Maximum results
     * @param {Function} t - Translation function
     * @param {string} currentLocale - Current locale
     * @returns {Array} Matching prompts
     */
    searchPrompts(category, searchText, limit = this.maxSearchResults, t = null, currentLocale = 'en') {
        if (!searchText || searchText.length < 2) {
            return this.getRecentPrompts(category, limit, t, currentLocale);
        }

        const categoryHistory = this.history.categories[category] || [];
        const searchLower = searchText.toLowerCase();
        
        return categoryHistory
            .filter(entry => entry.prompt.toLowerCase().includes(searchLower))
            .slice(0, limit)
            .map(entry => ({
                label: this.highlightSearchTerm(entry.prompt, searchText),
                description: t ? this.formatPromptDescription(entry, t, currentLocale) : '',
                value: entry.prompt
            }));
    }

    /**
     * Get history for dropdown (simplified)
     * @param {string} category - Feature category
     * @param {string} searchText - Optional search text
     * @param {Function} t - Translation function
     * @param {string} currentLocale - Current locale
     * @returns {Array} History items without separators
     */
    getCombinedHistory(category, searchText = '', t = null, currentLocale = 'en') {
        if (searchText && searchText.length >= 2) {
            return this.searchPrompts(category, searchText, this.maxSearchResults, t, currentLocale);
        } else {
            return this.getRecentPrompts(category, this.maxSearchResults, t, currentLocale);
        }
    }

    /**
     * Clear history for a category
     * @param {string} category - Feature category
     */
    clearHistory(category) {
        if (this.history.categories[category]) {
            this.history.categories[category] = [];
            this.saveHistory();
        }
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Format prompt label for display
     * @param {string} prompt - Original prompt
     * @returns {string} Formatted label
     */
    formatPromptLabel(prompt) {
        return prompt.length > 60 ? prompt.substring(0, 57) + '...' : prompt;
    }

    /**
     * Format prompt description with timestamp
     * @param {Object} entry - History entry
     * @param {Function} t - Translation function
     * @param {string} currentLocale - Current locale
     * @returns {string} Formatted description
     */
    formatPromptDescription(entry, t, currentLocale) {
        return this.getTimeAgo(entry.timestamp, t, currentLocale);
    }

    /**
     * Highlight search term in text
     * @param {string} text - Original text
     * @param {string} searchTerm - Search term to highlight
     * @returns {string} Text with highlighted term
     */
    highlightSearchTerm(text, searchTerm) {
        // VS Code doesn't support HTML in QuickPick, so we use simple formatting
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '→$1←');
    }

    /**
     * Get human-readable time ago string for Arduino IDE
     * @param {number} timestamp - Timestamp in milliseconds
     * @param {Function} t - Translation function
     * @param {string} currentLocale - Current locale (e.g. 'de', 'en')
     * @returns {string} Localized time ago string
     */
    getTimeAgo(timestamp, t, currentLocale) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return t('time.justNow');
        if (minutes < 60) return t('time.minutesAgo', minutes);
        if (hours < 24) return t('time.hoursAgo', hours);
        if (days < 7) return t('time.daysAgo', days);
        
        // For older entries, use simple date formatting
        return new Date(timestamp).toLocaleDateString();
    }
}

// ===== EXPORT =====
module.exports = { PromptHistoryManager };
