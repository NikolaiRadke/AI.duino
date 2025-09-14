/*
 * AI.duino - Add Comments Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */
const vscode = require('vscode');
const shared = require('../shared');
const featureUtils = require('./featureUtils');

/**
 * Main addComments function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function addComments(context) {
    return featureUtils.executeFeature(
        context.executionStates.OPERATIONS.COMMENTS,
        async () => {
            // Validate editor and selection
            const validation = featureUtils.validateEditorAndSelection(
                context.t,
                'messages.noEditor',
                'messages.selectCodeToComment'
            );
            if (!validation) return;
            
            const { editor, selection, selectedText } = validation;
            
            // Get custom comment instructions
            const customInstructions = await featureUtils.getAndSaveCustomInstructions(
                context.globalContext,
                'aiduino.commentInstructions',
                'commentInstructions',
                'placeholders.commentInstructions',
                context
            );
            
            if (customInstructions === undefined) {
                return; // User cancelled
            }
            
            // Build prompt with board context
            let prompt = context.promptManager.getPrompt('addComments', selectedText) + shared.getBoardContext();
            
            // Add custom instructions if provided
            if (customInstructions && customInstructions.trim()) {
                const instructions = customInstructions.split(',').map(s => s.trim()).join('\n- ');
                prompt += '\n\n' + context.promptManager.getPrompt('additionalInstructions', instructions);
            }
            
            prompt += '\n\n' + context.promptManager.getPrompt('addCommentsSuffix');
            
            // Call AI with progress
            const response = await featureUtils.callAIWithProgress(
                prompt,
                'progress.addingComments',
                context
            );
            
            // Extract code from response
            const { extractedCode } = featureUtils.extractCodeFromResponse(response);
            
            // Build content with footer (custom instructions + board info)
            const boardInfo = shared.detectArduinoBoard();
            const displayContent = featureUtils.buildContentWithFooter(extractedCode, {
                customInstructions,
                boardInfo,
                t: context.t
            });
            
            // Create and show document
            await featureUtils.createAndShowDocument(
                displayContent,
                'cpp',
                context.t('commands.addComments')
            );
            
            // Show choice dialog
            const choice = await featureUtils.showReplaceKeepChoice(
                context.t('messages.commentsAdded'),
                context.t
            );
            
            if (choice === context.t('buttons.replaceOriginal')) {
                await featureUtils.replaceSelectedText(
                    editor,
                    selection,
                    extractedCode,
                    context.t('messages.codeReplaced')
                );
            }
        },
        context
    );
}

module.exports = {
    addComments
};
