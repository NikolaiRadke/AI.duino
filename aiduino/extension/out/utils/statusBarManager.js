/*
 * AI.duino - Status Bar Manager
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require("vscode");

/**
 * Manages the VS Code status bar item for AI.duino
 * Handles display updates, tooltips, and visual states
 */
class StatusBarManager {
    constructor() {
        this.statusBarItem = null;
        this.isDisposed = false;
    }
    
    /**
     * Create and initialize the status bar item
     * @returns {vscode.StatusBarItem} Created status bar item
     */
    createStatusBar() {
        if (this.statusBarItem) {
            // Already exists, return existing
            return this.statusBarItem;
        }
        
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        
        // Set default command for clicking
        this.statusBarItem.command = "aiduino.quickMenu";
        
        // Show initially
        this.statusBarItem.show();
        
        return this.statusBarItem;
    }
    
    /**
     * Update status bar with current model info and token costs
     * @param {Object} params - Update parameters
     * @param {string} params.currentModel - Current model ID
     * @param {Object} params.tokenUsage - Token usage data
     * @param {Object} params.modelManager - Model manager instance
     * @param {Function} params.t - Translation function
     */
    updateStatusBar({ currentModel, tokenUsage, modelManager, t }) {
        if (!this.statusBarItem || this.isDisposed) {
            return;
        }
        
        // Get provider information
        const providerInfo = modelManager.getProviderInfo(currentModel);
        const hasApiKey = providerInfo.hasApiKey;
        
        // Calculate token costs for display
        const modelUsage = tokenUsage[currentModel] || { input: 0, output: 0, cost: 0 };
        const todayCost = modelUsage.cost.toFixed(3);
        const costDisplay = parseFloat(todayCost) > 0 ? ` (${todayCost})` : '';
        
        if (hasApiKey) {
            // Normal operation - show model with optional cost
            this.statusBarItem.text = `${providerInfo.icon} AI.duino${costDisplay}`;
            
            // Build detailed tooltip
            const totalTokens = modelUsage.input + modelUsage.output;
            const modelStatus = providerInfo.modelName;

            this.statusBarItem.tooltip = 
                `${providerInfo.name} - ${modelStatus}\n` +
                `${t('descriptions.todayUsage', `$${todayCost}`)}`;
            
            // Clear any warning background
            this.statusBarItem.backgroundColor = undefined;
            
        } else {
            // No API key - show warning
            this.statusBarItem.text = `${providerInfo.icon} AI.duino $(warning)`;
            this.statusBarItem.tooltip = 
                (t && t('statusBar.noApiKey')) ? 
                t('statusBar.noApiKey', providerInfo.name) :
                `No API key for ${providerInfo.name}`;
                
            // Set warning background color
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }

    /**
     * Update status bar from extension context (simplified wrapper)
     * @param {Object} context - Extension context from getDependencies()
     */
    updateFromContext(context) {
        if (!context) return;
    
        this.updateStatusBar({
            currentModel: context.currentModel,
            tokenUsage: context.tokenUsage,
            modelManager: context.minimalModelManager,
            t: context.t
        });
    }
    
    /**
     * Show error state in status bar
     * @param {number} errorCount - Number of errors found
     * @param {Function} t - Translation function
     * @param {Object} providerInfo - Provider information
     */
    showErrorState(errorCount, t, providerInfo = null) {
        if (!this.statusBarItem || this.isDisposed) {
            return;
        }
        
        const icon = providerInfo ? providerInfo.icon : '🤖';
        this.statusBarItem.text = `${icon} AI.duino $(error)`;
        this.statusBarItem.tooltip = 
            (t && t('statusBar.errorsFound')) ?
            t('statusBar.errorsFound', errorCount) :
            `${errorCount} errors found`;
        
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    
    /**
     * Dispose the status bar item and cleanup
     */
    dispose() {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = null;
        }
        
        this.isDisposed = true;
    }
}

module.exports = { StatusBarManager };
