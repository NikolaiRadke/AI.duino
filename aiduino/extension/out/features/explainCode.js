/*
 * AI.duino - Explain Code Feature Module (Enhanced with Context Support)
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const featureUtils = require('./featureUtils');
const contextManager = require('../utils/contextManager');

/**
 * Main explainCode function with multi-context support
 * @param {Object} context - Extension context with dependencies
 */
async function explainCode(context) {
    return featureUtils.executeFeature(
        context.executionStates.OPERATIONS.EXPLAIN,
        async () => {
            // Validate editor (selection optional for context)
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage(context.t('messages.noEditor'));
                return;
            }
            
            // Check if Arduino file
            if (!context.validation.validateArduinoFile(editor.document.fileName)) {
                vscode.window.showWarningMessage(context.t('messages.openInoFile'));
                return;
            }
            
            const selection = editor.selection;
            const hasSelection = !selection.start.isEqual(selection.end);
            const selectedText = hasSelection ? editor.document.getText(selection) : '';
            
            // Context Selection
            const contextData = await contextManager.selectContextLevel(
                editor, 
                selectedText, 
                context.t,
                { showSelectionOption: hasSelection }
            );
            if (!contextData) return; // User cancelled
            
            // Build prompt with selected context
            const prompt = contextManager.buildContextAwarePrompt(
                selectedText,
                contextData,
                {
                    selection: 'explainCode',
                    file: 'explainCodeFile',
                    sketch: 'explainCodeSketch',
                    suffix: null
                },
                context
            );
            
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
            
            // Context info as simple text
            let contextInfo = '';
            if (contextData.level === 'selection') {
                contextInfo = `📝 ${context.t('context.selection')}`;
            } else if (contextData.level === 'currentFile') {
                contextInfo = `📄 ${context.t('context.currentFile')}`;
            } else if (contextData.level === 'fullSketch') {
                const fileCount = contextData.contextFiles.length;
                contextInfo = `📂 ${context.t('context.fullSketch')} (${fileCount} ${context.t('context.files')})`;
            }
            
            // Create formatted content with header
            const model = context.minimalModelManager.providers[context.currentModel];
            const formattedContent = [
                `🤖 ${context.t('output.explanationFrom', model.name.toUpperCase())}`,
                contextInfo,
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
