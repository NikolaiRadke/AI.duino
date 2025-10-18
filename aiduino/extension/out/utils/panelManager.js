/*
 * AI.duino - Panel Manager Utility
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 * 
 * Verwaltet Webview Panels mit Singleton-Pattern
 */

"use strict";

const vscode = require('vscode');

// Global panel registry
const activePanels = new Map();

/**
 * Create or reveal a webview panel with singleton pattern
 * @param {Object} options - Panel configuration
 * @param {string} options.id - Unique panel identifier
 * @param {string} options.title - Panel title
 * @param {number} [options.viewColumn=vscode.ViewColumn.One] - View column
 * @param {Object} [options.webviewOptions={}] - Webview options
 * @param {Function} [options.onDispose] - Callback when panel is disposed
 * @param {Function} [options.onReveal] - Callback when existing panel is revealed
 * @returns {vscode.WebviewPanel} The panel instance
 */
function getOrCreatePanel(options) {
    const {
        id,
        title,
        viewColumn = vscode.ViewColumn.One,
        webviewOptions = { enableScripts: true },
        onDispose = null,
        onReveal = null
    } = options;

    // Check if panel already exists
    if (activePanels.has(id)) {
        const existingPanel = activePanels.get(id);
        existingPanel.reveal(viewColumn);
        
        // Call optional reveal callback
        if (onReveal) {
            onReveal(existingPanel);
        }
        
        return existingPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
        id,
        title,
        viewColumn,
        webviewOptions
    );

    // Register panel
    activePanels.set(id, panel);

    // Setup dispose handler
    panel.onDidDispose(() => {
        activePanels.delete(id);
        
        // Call optional dispose callback
        if (onDispose) {
            onDispose();
        }
    });

    return panel;
}

/**
 * Check if a panel is currently active
 * @param {string} id - Panel identifier
 * @returns {boolean} True if panel exists
 */
function isPanelActive(id) {
    return activePanels.has(id);
}

/**
 * Get active panel by id
 * @param {string} id - Panel identifier
 * @returns {vscode.WebviewPanel|null} Panel or null
 */
function getPanel(id) {
    return activePanels.get(id) || null;
}

/**
 * Close a panel programmatically
 * @param {string} id - Panel identifier
 */
function closePanel(id) {
    const panel = activePanels.get(id);
    if (panel) {
        panel.dispose();
    }
}

/**
 * Close all panels
 */
function closeAllPanels() {
    activePanels.forEach(panel => panel.dispose());
    activePanels.clear();
}

module.exports = {
    getOrCreatePanel,
    isPanelActive,
    getPanel,
    closePanel,
    closeAllPanels
};
