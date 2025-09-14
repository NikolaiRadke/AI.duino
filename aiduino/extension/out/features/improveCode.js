/*
 * AI.duino - Improve Code Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const featureUtils = require('./featureUtils');

/**
 * Main improveCode function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
/**
 * Main improveCode function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function improveCode(context) {
    return featureUtils.executeFeature(
        context.executionStates.OPERATIONS.IMPROVE,
        async () => {
            // Validate editor and selection
            const validation = featureUtils.validateEditorAndSelection(
                context.t,
                'messages.noEditor',
                'messages.selectCodeToImprove'
            );
            if (!validation) return;
            
            const { editor, selection, selectedText } = validation;
            
            // Get custom instructions
            const customInstructions = await featureUtils.getAndSaveCustomInstructions(
                context.globalContext,
                'aiduino.customInstructions',
                'customInstructions',
                'placeholders.customInstructions',
                context
            );
            
            if (customInstructions === undefined) {
                return; // User cancelled
            }
            
            // Build prompt with board context
            let prompt = context.promptManager.getPrompt('improveCode', selectedText) + shared.getBoardContext();
            
            // Add custom instructions if provided
            if (customInstructions && customInstructions.trim()) {
                const instructions = customInstructions.split(',').map(s => s.trim()).join('\n- ');
                prompt += '\n\n' + context.promptManager.getPrompt('additionalInstructions', instructions);
            }
            
            prompt += '\n\n' + context.promptManager.getPrompt('improveCodeSuffix');
            
            // Call AI with progress
            const response = await featureUtils.callAIWithProgress(
                prompt,
                'progress.optimizing',
                context
            );
            
            // Extract code from response
            const { extractedCode, additionalContent } = featureUtils.extractCodeFromResponse(response);
            
            // Build content with footer (custom instructions + AI hints + board info)
            const boardInfo = shared.detectArduinoBoard();
            const displayContent = featureUtils.buildContentWithFooter(extractedCode, {
                customInstructions,
                aiHints: additionalContent,
                boardInfo,
                t: context.t
            });
            
            // Create and show document
            await featureUtils.createAndShowDocument(
                displayContent,
                'cpp',
                context.t('commands.improveCode')
            );
            
            // Show choice dialog
            const choice = await featureUtils.showReplaceKeepChoice(
                context.t('messages.codeImproved'),
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
    improveCode
};
