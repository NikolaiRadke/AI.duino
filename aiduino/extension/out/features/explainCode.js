/*
 * AI.duino - Explain Code Feature Module (Refactored for Webview)
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const codeFeatureBase = require('./codeFeatureBase');

/**
 * Main explainCode function with multi-context support
 * Now uses webview panel for consistent UX across all features
 * @param {Object} context - Extension context with dependencies
 */
async function explainCode(context) {
    return codeFeatureBase.executeCodeFeature(context, {
        operation: context.executionStates.OPERATIONS.EXPLAIN,
        promptKeys: {
            selection: 'explainCode',
            file: 'explainCodeFile',
            sketch: 'explainCodeSketch',
            suffix: null
        },
        commandKey: 'explainCode',
        panelId: 'aiExplainCode',
        icon: '📖',
        instructionsKey: null,
        instructionsPrompt: null,
        instructionsPlaceholder: null,
        historyCategory: 'explainCode',
        progressKey: 'progress.explaining',
        skipInstructions: true  // No custom instructions for explainCode
    });
}

module.exports = {
    explainCode
};
