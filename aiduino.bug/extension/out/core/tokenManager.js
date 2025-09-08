/**
 * core/tokenManager.js - Event-driven Token Management System
 * Modular replacement for distributed token logic in extension.js
 */

const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Event-driven Token Manager
 * Handles all token counting, cost calculation, persistence and notifications
 */
class TokenManager {
    constructor(providers = {}) {
        this.providers = providers;
        this.tokenUsage = {};
        this.cacheFile = path.join(os.homedir(), '.aiduino-token-usage.json');
        
        // Event emitters
        this._onTokenUpdateEmitter = new vscode.EventEmitter();
        this._onDailyResetEmitter = new vscode.EventEmitter();
        this._onQuotaWarningEmitter = new vscode.EventEmitter();
        
        // State management
        this.saveTimeout = null;
        this.lastSaveAttempt = 0;
        this.isInitialized = false;
        
        // Configuration
        this.quotaWarningThresholds = { warning: 0.8, critical: 0.95 };
        this.saveDebounceDelay = 500;
        
        this.initialize();
    }

    /**
     * Initialize token manager with data loading and validation
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            await this.loadTokenUsage();
            this.setupDailyReset();
            this.isInitialized = true;
            
            // Emit initialization complete event
            this._onTokenUpdateEmitter.fire({
                type: 'initialized',
                data: this.getUsageSummary()
            });
        } catch (error) {
            console.error('TokenManager initialization failed:', error);
            this.initializeEmptyUsage();
            this.isInitialized = true;
        }
    }

    /**
     * Record token usage for a specific model with automatic cost calculation
     * @param {string} modelId - Model identifier
     * @param {string} inputText - Input text for token estimation
     * @param {string} outputText - Output text for token estimation
     * @param {Object} options - Additional options
     */
    recordUsage(modelId, inputText, outputText, options = {}) {
        if (!this.isInitialized) {
            console.warn('TokenManager not initialized, deferring usage recording');
            setTimeout(() => this.recordUsage(modelId, inputText, outputText, options), 100);
            return;
        }

        const provider = this.providers[modelId];
        if (!provider) {
            console.warn(`Unknown provider for token recording: ${modelId}`);
            return;
        }

        // Ensure model exists in usage data
        this.ensureModelExists(modelId);

        // Calculate tokens
        const inputTokens = options.inputTokens || this.estimateTokens(inputText);
        const outputTokens = options.outputTokens || this.estimateTokens(outputText);
        
        // Calculate costs
        const inputCost = inputTokens * (provider.prices?.input || 0);
        const outputCost = outputTokens * (provider.prices?.output || 0);
        const totalCost = inputCost + outputCost;

        // Update usage data
        const usage = this.tokenUsage[modelId];
        const previousTotal = usage.input + usage.output;
        
        usage.input += inputTokens;
        usage.output += outputTokens;
        usage.cost += totalCost;
        usage.requests = (usage.requests || 0) + 1;
        usage.lastUsed = Date.now();

        // Create usage event data
        const eventData = {
            type: 'usage_recorded',
            modelId,
            session: {
                inputTokens,
                outputTokens,
                cost: totalCost
            },
            total: {
                input: usage.input,
                output: usage.output,
                cost: usage.cost,
                requests: usage.requests
            },
            delta: {
                tokens: inputTokens + outputTokens,
                cost: totalCost
            }
        };

        // Check for quota warnings
        this.checkQuotaWarnings(modelId, provider, eventData);

        // Emit token update event
        this._onTokenUpdateEmitter.fire(eventData);

        // Queue save with debouncing
        this.queueSave();
    }

    /**
     * Estimate token count for text with improved accuracy
     * @param {string} text - Text to analyze
     * @returns {number} Estimated token count
     */
    estimateTokens(text) {
        if (!text) return 0;
        
        // Advanced estimation considering code vs natural language
        const isCode = text.includes('{') || text.includes(';') || text.includes('()');
        
        if (isCode) {
            // Code text: more punctuation and symbols = more tokens
            const words = text.split(/\s+/).length;
            const specialChars = (text.match(/[{}()\[\];,.<>]/g) || []).length;
            const operators = (text.match(/[=+\-*/&|!]/g) || []).length;
            
            return Math.ceil(words * 0.8 + specialChars * 0.3 + operators * 0.2);
        } else {
            // Natural language: standard estimation
            const words = text.split(/\s+/).length;
            return Math.ceil(words * 0.75);
        }
    }

    /**
     * Get usage statistics for a specific model
     * @param {string} modelId - Model identifier
     * @returns {Object} Usage statistics
     */
    getModelUsage(modelId) {
        this.ensureModelExists(modelId);
        return { ...this.tokenUsage[modelId] };
    }

    /**
     * Get usage summary for all models
     * @returns {Object} Complete usage summary
     */
    getUsageSummary() {
        const summary = {
            date: this.tokenUsage.daily,
            totalCost: 0,
            totalTokens: 0,
            totalRequests: 0,
            models: {}
        };

        Object.keys(this.providers).forEach(modelId => {
            this.ensureModelExists(modelId);
            const usage = this.tokenUsage[modelId];
            
            summary.models[modelId] = { ...usage };
            summary.totalCost += usage.cost;
            summary.totalTokens += (usage.input + usage.output);
            summary.totalRequests += (usage.requests || 0);
        });

        return summary;
    }

    /**
     * Reset daily statistics (called automatically at midnight)
     */
    resetDaily() {
        const oldSummary = this.getUsageSummary();
        
        // Reset all model stats
        Object.keys(this.providers).forEach(modelId => {
            this.tokenUsage[modelId] = {
                input: 0,
                output: 0,
                cost: 0,
                requests: 0,
                lastUsed: null
            };
        });
        
        // Update date
        this.tokenUsage.daily = new Date().toDateString();
        
        // Emit reset event
        this._onDailyResetEmitter.fire({
            type: 'daily_reset',
            previousSummary: oldSummary,
            newDate: this.tokenUsage.daily
        });

        // Force immediate save
        this.saveTokenUsage(true);
    }

    /**
     * Check for quota warnings and emit events if needed
     * @param {string} modelId - Model identifier
     * @param {Object} provider - Provider configuration
     * @param {Object} eventData - Current usage event data
     */
    checkQuotaWarnings(modelId, provider, eventData) {
        if (!provider.quotaLimits) return;

        const usage = eventData.total;
        const limits = provider.quotaLimits;
        
        // Check different quota types
        ['daily', 'monthly'].forEach(period => {
            const limit = limits[period];
            if (!limit) return;
            
            const currentUsage = period === 'daily' ? usage.cost : usage.cost; // Simplified for demo
            const ratio = currentUsage / limit.cost;
            
            if (ratio >= this.quotaWarningThresholds.critical && !this.hasWarningBeenShown(modelId, period, 'critical')) {
                this.emitQuotaWarning(modelId, period, 'critical', ratio, limit);
            } else if (ratio >= this.quotaWarningThresholds.warning && !this.hasWarningBeenShown(modelId, period, 'warning')) {
                this.emitQuotaWarning(modelId, period, 'warning', ratio, limit);
            }
        });
    }

    /**
     * Emit quota warning event
     * @param {string} modelId - Model identifier
     * @param {string} period - Time period (daily/monthly)
     * @param {string} level - Warning level (warning/critical)
     * @param {number} ratio - Usage ratio (0-1)
     * @param {Object} limit - Quota limit configuration
     */
    emitQuotaWarning(modelId, period, level, ratio, limit) {
        this._onQuotaWarningEmitter.fire({
            type: 'quota_warning',
            modelId,
            period,
            level,
            ratio,
            limit,
            usage: this.getModelUsage(modelId)
        });
        
        // Mark warning as shown (simplified - could be more sophisticated)
        this.markWarningShown(modelId, period, level);
    }

    /**
     * Load token usage from persistent storage
     */
    async loadTokenUsage() {
        try {
            const currentDate = new Date().toDateString();
            
            if (!fs.existsSync(this.cacheFile)) {
                this.initializeEmptyUsage();
                return;
            }

            const fileContent = await fs.promises.readFile(this.cacheFile, 'utf8');
            const data = JSON.parse(fileContent);
            
            // Validate data structure
            if (!data || typeof data !== 'object' || !data.daily) {
                throw new Error('Invalid data structure');
            }
            
            // Check if same day
            if (data.daily === currentDate) {
                this.tokenUsage = data;
                // Ensure all current providers exist
                Object.keys(this.providers).forEach(modelId => {
                    this.ensureModelExists(modelId);
                });
            } else {
                // Different day - reset but keep structure
                this.initializeEmptyUsage();
            }
            
        } catch (error) {
            console.warn('Failed to load token usage:', error.message);
            this.initializeEmptyUsage();
        }
    }

    /**
     * Save token usage with debouncing and error handling
     * @param {boolean} immediate - Force immediate save
     */
    queueSave(immediate = false) {
        // Clear existing timeout
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }

        if (immediate) {
            this.saveTokenUsage(true);
            return;
        }

        // Queue save with debouncing
        this.saveTimeout = setTimeout(() => {
            this.saveTokenUsage();
            this.saveTimeout = null;
        }, this.saveDebounceDelay);
    }

    /**
     * Perform actual save operation
     * @param {boolean} immediate - Skip debouncing checks
     */
    async saveTokenUsage(immediate = false) {
        // Prevent rapid successive saves
        const now = Date.now();
        if (!immediate && (now - this.lastSaveAttempt) < 100) {
            return;
        }
        this.lastSaveAttempt = now;

        try {
            const data = JSON.stringify(this.tokenUsage, null, 2);
            
            // Atomic write using temporary file
            const tempFile = this.cacheFile + '.tmp';
            await fs.promises.writeFile(tempFile, data, { mode: 0o600 });
            await fs.promises.rename(tempFile, this.cacheFile);
            
        } catch (error) {
            console.error('Failed to save token usage:', error);
            // Emit save error event
            this._onTokenUpdateEmitter.fire({
                type: 'save_error',
                error: error.message
            });
        }
    }

    /**
     * Initialize empty usage structure
     */
    initializeEmptyUsage() {
        this.tokenUsage = {
            daily: new Date().toDateString()
        };
        
        // Initialize for all known providers
        Object.keys(this.providers).forEach(modelId => {
            this.ensureModelExists(modelId);
        });
    }

    /**
     * Ensure model exists in usage data
     * @param {string} modelId - Model identifier
     */
    ensureModelExists(modelId) {
        if (!this.tokenUsage[modelId]) {
            this.tokenUsage[modelId] = {
                input: 0,
                output: 0,
                cost: 0,
                requests: 0,
                lastUsed: null
            };
        }
    }

    /**
     * Setup automatic daily reset at midnight
     */
    setupDailyReset() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const msUntilMidnight = tomorrow.getTime() - now.getTime();
        
        setTimeout(() => {
            this.resetDaily();
            // Setup recurring daily reset
            setInterval(() => this.resetDaily(), 24 * 60 * 60 * 1000);
        }, msUntilMidnight);
    }

    /**
     * Utility methods for quota warning tracking
     */
    hasWarningBeenShown(modelId, period, level) {
        // Simplified implementation - could use more sophisticated tracking
        const key = `${modelId}_${period}_${level}`;
        const shown = this.tokenUsage._warnings?.[key];
        return shown && (Date.now() - shown) < 24 * 60 * 60 * 1000; // 24h cooldown
    }

    markWarningShown(modelId, period, level) {
        if (!this.tokenUsage._warnings) {
            this.tokenUsage._warnings = {};
        }
        const key = `${modelId}_${period}_${level}`;
        this.tokenUsage._warnings[key] = Date.now();
    }

    /**
     * Event subscriptions - public API
     */
    get onTokenUpdate() { return this._onTokenUpdateEmitter.event; }
    get onDailyReset() { return this._onDailyResetEmitter.event; }
    get onQuotaWarning() { return this._onQuotaWarningEmitter.event; }

    /**
     * Cleanup and disposal
     */
    dispose() {
        // Force final save
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTokenUsage(true);
        }
        
        // Dispose event emitters
        this._onTokenUpdateEmitter.dispose();
        this._onDailyResetEmitter.dispose();
        this._onQuotaWarningEmitter.dispose();
        
        this.isInitialized = false;
    }
}

module.exports = {
    TokenManager
};
