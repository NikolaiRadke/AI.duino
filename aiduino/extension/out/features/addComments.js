/*
 * AI.duino - Add Comments Feature Module (Refactored)
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const codeFeatureBase = require('./codeFeatureBase');

/**
 * Main addComments function with multi-context support
 * Uses shared codeFeatureBase for standardized flow
 * @param {Object} context - Extension context with dependencies
 */
async function addComments(context) {
    return codeFeatureBase.executeCodeFeature(context, {
        operation: context.executionStates.OPERATIONS.COMMENTING,
        useCodeTemperature: true,
        promptKeys: {
            selection: 'addCommentsSelected',
            file: 'addCommentsFile',
            sketch: 'addCommentsSketch',
            suffix: 'addCommentsSuffix'
        },
        commandKey: 'addComments',
        panelId: 'aiAddComments',
        icon: '💬',
        instructionsKey: 'aiduino.commentInstructions',
        instructionsPrompt: 'commentInstructions',
        instructionsPlaceholder: 'placeholders.commentInstructions',
        historyCategory: 'addComments',
        progressKey: 'progress.addingComments'
    });
}

module.exports = {
    addComments
};
