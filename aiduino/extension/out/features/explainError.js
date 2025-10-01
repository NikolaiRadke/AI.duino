/*
 * AI.duino - Explain Error Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const validation = require('../utils/validation');
const featureUtils = require('./featureUtils');
const { getSharedCSS, getPrismScripts } = require('../utils/panels/sharedStyles');

/**
 * Main explainError function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function explainError(context) {
    const panel = await featureUtils.executeFeature(
        context.executionStates.OPERATIONS.ERROR,
        async () => {
            // Unified validation
            const editorValidation = await featureUtils.validateArduinoFile(context);
            if (!editorValidation) return;
            
            const { editor } = editorValidation;
            
            // Get error input with history
            const errorInput = await featureUtils.showInputWithCreateQuickPickHistory(
                context, 'pasteError', 'placeholders.errorExample', 'explainError'
            );
            if (!errorInput) return;
            
            // Unified history saving
            featureUtils.saveToHistory(context, 'explainError', errorInput, {
                board: shared.detectArduinoBoard() || 'unknown'
            });
                
            // Get code context around current cursor position
            const line = editor.selection.active.line;
            const startLine = Math.max(0, line - 5);
            const endLine = Math.min(editor.document.lineCount - 1, line + 5);
            const codeContext = editor.document.getText(
                new vscode.Range(startLine, 0, endLine, Number.MAX_VALUE)
            );
            
            // Build prompt with context
            const prompt = context.promptManager.getPrompt('explainError', errorInput, line + 1, codeContext) + shared.getBoardContext();
            
            // Call AI with progress
            const response = await featureUtils.callAIWithProgress(
                prompt,
                'progress.analyzingError',
                context
            );
            
            // Process response with event-delegation code blocks
            const { processedHtml, codeBlocks } = featureUtils.processAiCodeBlocksWithEventDelegation(
                response,
                `🔧 ${context.t('explainError.correctedCodeTitle')}`,
                ['copy', 'insert'],
                context.t
            );
            
            // Create WebviewPanel for error explanation
            const panel = vscode.window.createWebviewPanel(
                'aiError',
                context.t('commands.explainError'),
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );
            
            panel.webview.html = createErrorExplanationHtml(
                errorInput,
                line + 1,
                processedHtml,
                codeBlocks,
                context.currentModel,
                context.t
            );
            
            return panel;
        },
        context
    );
    
    // Message Handler
    if (panel) {
        featureUtils.setupStandardMessageHandler(panel, context, {
            'askFollowUp': async () => {
                askAI(context, true);
            }
        });
    }
}

/**
 * Create HTML content for error explanation panel with Prism code blocks
 * @param {string} error - The error message
 * @param {number} line - Line number where error occurred
 * @param {string} processedExplanation - Already processed HTML with code blocks
 * @param {Array} codeBlocks - Array of code strings for event delegation
 * @param {string} modelId - Current AI model ID
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createErrorExplanationHtml(error, line, processedExplanation, codeBlocks, modelId, t) {
    const modelBadge = `<span style="background: #6B46C1; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${t('explainError.errorBadge')}</span>`;
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('commands.explainError')} - AI.duino</title>
            ${getSharedCSS()}
        </head>
        <body>
            ${featureUtils.generateActionToolbar(['copy', 'insert', 'close'], t)}
            
            <div class="header">
                <h1>🔧 ${t('html.errorExplanation')}</h1>
                ${modelBadge}
            </div>
            
            <div class="error-box">
                <div class="error-title">${t('html.errorInLine', line)}:</div>
                <code>${shared.escapeHtml(error)}</code>
            </div>
            
            <div class="explanation">
                ${processedExplanation}
            </div>

            <script>
                // Code blocks data for button handlers
                const codeBlocksData = ${JSON.stringify(codeBlocks)};
                
                // Code block button handler
                document.addEventListener('click', (e) => {
                    const button = e.target.closest('[data-action]');
                    if (!button) return;
                    
                    const action = button.dataset.action;
                    const index = parseInt(button.dataset.index);
                    const code = codeBlocksData[index];
                    
                    if (action === 'copy') {
                        vscode.postMessage({ command: 'copyCode', code: code });
                    } else if (action === 'insert') {
                        vscode.postMessage({ command: 'insertCode', code: code });
                    }
                });
            </script>

            ${featureUtils.generateToolbarScript(['copyCode', 'insertCode'], ['copy', 'insert', 'close'])}
            ${getPrismScripts()}
            
        </body>
        </html>
    `;
}

module.exports = {
    explainError
};
