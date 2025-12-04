/*
 * AI.duino - Token Manager Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 * 
 * Centralized token usage tracking with support for real API token counts
 */

"use strict";

const fs = require('fs');
const path = require('path');

class TokenManager {
    constructor(storagePath, eventManager) {
        this.storagePath = storagePath;
        this.eventManager = eventManager;
        this.tokenUsage = null;
        this.providers = null;
    }

    /**
     * Initialize token manager with provider list
     * @param {Object} providers - Provider configurations from minimalModelManager
     */
    initialize(providers) {
        this.providers = providers;
        this.tokenUsage = {
            daily: new Date().toDateString()
        };

        if (!providers) return;

        // Initialize for each model
        Object.keys(providers).forEach(modelId => {
            this.tokenUsage[modelId] = { input: 0, output: 0, cost: 0 };
        });
    }

    /**
     * Load token usage from file
     */
    load() {
        const today = new Date().toDateString();

        if (!fs.existsSync(this.storagePath)) {
            this.initialize(this.providers);
            this.save();
            return;
        }

        try {
            const fileContent = fs.readFileSync(this.storagePath, 'utf8');
            const data = JSON.parse(fileContent);

            if (!this.providers) return;

            // Check if data is from today
            if (!data || !data.daily || data.daily !== today) {
                this.initialize(this.providers);
                this.save();
                return;
            }

            // Same day - restore data
            this.tokenUsage = data;

            // Ensure all models exist in loaded data
            Object.keys(this.providers).forEach(modelId => {
                if (!this.tokenUsage[modelId]) {
                    this.tokenUsage[modelId] = { input: 0, output: 0, cost: 0 };
                }
            });
        } catch (error) {
            console.error('Failed to load token usage:', error);
            this.initialize(this.providers);
            this.save();
        }
    }

    /**
     * Save token usage to file with debouncing
     */
    save() {
        if (!this.eventManager) {
            // Direct save without debouncing
            this._doSave();
            return;
        }

        this.eventManager.debouncedSave(() => this._doSave());
    }

    /**
     * Internal save implementation
     * @private
     */
    _doSave() {
        try {
            const data = JSON.stringify(this.tokenUsage, null, 2);
            fs.writeFileSync(this.storagePath, data, { mode: 0o600 });
        } catch (error) {
            console.error('Failed to save token usage:', error);
        }
    }

    /**
     * Update token usage with real or estimated counts
     * @param {string} modelId - Model identifier
     * @param {Object} usage - Token usage data
     * @param {number} usage.inputTokens - Input token count
     * @param {number} usage.outputTokens - Output token count
     * @param {boolean} usage.estimated - Whether counts are estimated
     */
    update(modelId, usage) {
        if (!this.tokenUsage || !this.tokenUsage[modelId]) return;
        if (!this.providers || !this.providers[modelId]) return;

        const { inputTokens, outputTokens } = usage;

        this.tokenUsage[modelId].input += inputTokens;
        this.tokenUsage[modelId].output += outputTokens;

        // Calculate costs
        const provider = this.providers[modelId];
        const inputCost = inputTokens * provider.prices.input;
        const outputCost = outputTokens * provider.prices.output;
        this.tokenUsage[modelId].cost += (inputCost + outputCost);

        this.save();
    }

    /**
     * Estimate token count for text (fallback when API doesn't provide counts)
     * @param {string} text - Text to analyze
     * @param {Object} settings - Settings manager for estimation factors
     * @returns {number} Estimated token count
     */
    static estimateTokens(text, settings = null) {
        if (!text) return 0;

        // Better estimation for code vs text
        const words = text.split(/\s+/).length;
        const codeBlocks = (text.match(/```/g) || []).length / 2;
        const specialChars = (text.match(/[{}()\[\];,.<>]/g) || []).length;

        // Get estimation factors from settings
        const multiplier = settings?.get('tokenEstimationMultiplier') ?? 0.75;
        const codeBlockFactor = settings?.get('tokenEstimationCodeBlock') ?? 10;
        const specialCharFactor = settings?.get('tokenEstimationSpecialChars') ?? 0.2;

        // Base: ~0.75 words per token (more accurate than character count)
        let tokens = words * multiplier;
        tokens += codeBlocks * codeBlockFactor;
        tokens += specialChars * specialCharFactor;

        return Math.ceil(tokens);
    }

    /**
     * Get current token usage data
     * @returns {Object} Token usage statistics
     */
    getUsage() {
        return this.tokenUsage;
    }

    /**
     * Get usage for specific model
     * @param {string} modelId - Model identifier
     * @returns {Object} Model usage stats
     */
    getModelUsage(modelId) {
        return this.tokenUsage?.[modelId] || { input: 0, output: 0, cost: 0 };
    }

    /**
     * Reset token usage (for testing or manual reset)
     */
    reset() {
        this.initialize(this.providers);
        this.save();
    }
}

module.exports = TokenManager;
