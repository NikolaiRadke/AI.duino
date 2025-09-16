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
            return {
                version: '1.0',
                categories: {},
                lastUpdated: Date.now()
            };
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
     * @returns {Array} Recent prompts
     */
    getRecentPrompts(category, limit = this.maxSearchResults) {
        const categoryHistory = this.history.categories[category] || [];
        return categoryHistory
            .slice(0, limit)
            .map(entry => ({
                label: this.formatPromptLabel(entry.prompt),
                description: this.formatPromptDescription(entry),
                value: entry.prompt,
                timestamp: entry.timestamp,
                count: entry.count
            }));
    }

    /**
     * Get frequently used prompts
     * @param {string} category - Feature category
     * @param {number} limit - Maximum results
     * @returns {Array} Frequent prompts sorted by count
     */
    getFrequentPrompts(category, limit = this.maxSearchResults) {
        const categoryHistory = this.history.categories[category] || [];
        return categoryHistory
            .filter(entry => entry.count > 1)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit)
            .map(entry => ({
                label: `🔥 ${this.formatPromptLabel(entry.prompt)}`,
                description: this.formatFrequentDescription(entry),
                value: entry.prompt,
                count: entry.count
            }));
    }

    /**
     * Search prompts by text
     * @param {string} category - Feature category
     * @param {string} searchText - Search query
     * @param {number} limit - Maximum results
     * @returns {Array} Matching prompts
     */
    searchPrompts(category, searchText, limit = this.maxSearchResults) {
        if (!searchText || searchText.length < 2) {
            return this.getRecentPrompts(category, limit);
        }

        const categoryHistory = this.history.categories[category] || [];
        const searchLower = searchText.toLowerCase();
        
        return categoryHistory
            .filter(entry => entry.prompt.toLowerCase().includes(searchLower))
            .slice(0, limit)
            .map(entry => ({
                label: this.highlightSearchTerm(entry.prompt, searchText),
                description: this.formatPromptDescription(entry),
                value: entry.prompt
            }));
    }

    /**
     * Get combined history for dropdown
     * @param {string} category - Feature category
     * @param {string} searchText - Optional search text
     * @returns {Array} Combined history items with separators
     */
    getCombinedHistory(category, searchText = '') {
        const items = [];
        
        if (searchText && searchText.length >= 2) {
            // Search mode
            const searchResults = this.searchPrompts(category, searchText);
            if (searchResults.length > 0) {
                items.push({ kind: vscode.QuickPickItemKind.Separator, label: 'Suchergebnisse' });
                items.push(...searchResults);
            }
        } else {
            // Normal mode: frequent + recent
            const frequent = this.getFrequentPrompts(category, 4);
            const recent = this.getRecentPrompts(category, 6);
            
            if (frequent.length > 0) {
                items.push({ kind: vscode.QuickPickItemKind.Separator, label: 'Häufig gefragt' });
                items.push(...frequent);
            }
            
            if (recent.length > 0) {
                items.push({ kind: vscode.QuickPickItemKind.Separator, label: 'Letzte Fragen' });
                items.push(...recent);
            }
        }
        
        return items;
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

    /**
     * Get statistics for a category
     * @param {string} category - Feature category
     * @returns {Object} Statistics
     */
    getStats(category) {
        const categoryHistory = this.history.categories[category] || [];
        return {
            totalPrompts: categoryHistory.length,
            totalUsage: categoryHistory.reduce((sum, entry) => sum + entry.count, 0),
            oldestEntry: categoryHistory.length > 0 ? 
                Math.min(...categoryHistory.map(e => e.timestamp)) : null,
            newestEntry: categoryHistory.length > 0 ? 
                Math.max(...categoryHistory.map(e => e.timestamp)) : null
        };
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
     * @returns {string} Formatted description
     */
    formatPromptDescription(entry) {
        const ago = this.getTimeAgo(entry.timestamp);
        const countText = entry.count > 1 ? ` • ${entry.count}x verwendet` : '';
        return `${ago}${countText}`;
    }

    /**
     * Format description for frequent prompts
     * @param {Object} entry - History entry
     * @returns {string} Formatted description
     */
    formatFrequentDescription(entry) {
        return `${entry.count}x verwendet • ${this.getTimeAgo(entry.timestamp)}`;
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
     * Get human-readable time ago string
     * @param {number} timestamp - Timestamp in milliseconds
     * @returns {string} Time ago string
     */
    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'gerade eben';
        if (minutes < 60) return `vor ${minutes}min`;
        if (hours < 24) return `vor ${hours}h`;
        if (days < 7) return `vor ${days}d`;
        return new Date(timestamp).toLocaleDateString('de-DE');
    }
}

// ===== EXPORT =====
module.exports = { PromptHistoryManager };
