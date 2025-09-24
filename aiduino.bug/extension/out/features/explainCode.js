/*
 * AI.duino - Explain Code Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const featureUtils = require('./featureUtils');

/**
 * Main explainCode function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function explainCode(context) {
    return featureUtils.executeFeature(
        context.executionStates.OPERATIONS.EXPLAIN,
        async () => {
            // Validate editor and selection
            const validation = featureUtils.validateEditorAndSelection(
                context.t,
                'messages.noEditor',
                'messages.selectCodeToExplain'
            );
            if (!validation) return;
            
            const { selectedText } = validation;
            
            // Build prompt with board context
            const prompt = context.promptManager.getPrompt('explainCode', selectedText) + shared.getBoardContext();
            
            // Call AI with progress
            const response = await featureUtils.callAIWithProgress(
                prompt,
                'progress.explaining',
                context
            );
            
            // Process response - wrap long lines for better readability
            const wrappedResponse = response.split('\n').map(line => 
                line.length > 80 ? shared.wrapText(line, 80) : line
            ).join('\n');
            
            // Create formatted content with header
            const model = context.minimalModelManager.providers[context.currentModel];
            const formattedContent = [
                `🤖 ${context.t('output.explanationFrom', model.name.toUpperCase())}`,
                '='.repeat(50),
                '',
                wrappedResponse
            ].join('\n');
            
            // Create and show document
            await featureUtils.createAndShowDocument(
                formattedContent,
                'markdown',
                context.t('commands.explainCode')
            );
        },
        context
    );
}

module.exports = {
    explainCode
};
