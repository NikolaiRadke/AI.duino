/*
 * AI.duino - Improve Code Feature Module (Refactored)
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const codeFeatureBase = require('./codeFeatureBase');

/**
 * Main improveCode function with multi-context support
 * Uses shared codeFeatureBase for standardized flow
 * @param {Object} context - Extension context with dependencies
 */
async function improveCode(context) {
    return codeFeatureBase.executeCodeFeature(context, {
        operation: context.executionStates.OPERATIONS.IMPROVE,
        useCodeTemperature: true,
        promptKeys: {
            selection: 'improveCode',
            file: 'improveCodeFile',
            sketch: 'improveCodeSketch',
            suffix: 'improveCodeSuffix'
        },
        commandKey: 'improveCode',
        panelId: 'aiImproveCode',
        icon: '🔧',
        instructionsKey: 'aiduino.customInstructions',
        instructionsPrompt: 'commentInstructions',
        instructionsPlaceholder: 'placeholders.customInstructions',
        historyCategory: 'improveCode',
        progressKey: 'progress.optimizing'
    });
}

module.exports = {
    improveCode
};
