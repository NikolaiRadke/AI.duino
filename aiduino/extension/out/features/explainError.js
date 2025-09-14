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

/**
 * Main explainError function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function explainError(context) {
    return featureUtils.executeFeature(
        context.executionStates.OPERATIONS.ERROR,
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || !validation.validateArduinoFile(editor.document.fileName)) {
                vscode.window.showWarningMessage(context.t('messages.openInoFile'));
                return;
            }
            
            // Get error input from user
            const errorInput = await vscode.window.showInputBox({
                prompt: context.promptManager.getPrompt('pasteError'),
                placeHolder: context.t('placeholders.errorExample'),
                ignoreFocusOut: true
            });
            
            if (!errorInput) return;
            
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
                response,
                context.currentModel,
                context.t
            );
        },
        context
    );
}

/**
 * Create HTML content for error explanation panel
 * @param {string} error - The error message
 * @param {number} line - Line number where error occurred
 * @param {string} explanation - AI explanation of the error
 * @param {string} modelId - Current AI model ID
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createErrorExplanationHtml(error, line, explanation, modelId, t) {
    const modelBadge = `<span style="background: #6B46C1; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">AI Error Analysis</span>`;
    const htmlExplanation = shared.escapeHtml(explanation).replace(/\n/g, '<br>');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                    color: #333;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .error-box {
                    background: #ffebee;
                    border: 1px solid #ef5350;
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 20px;
                }
                .error-title {
                    color: #c62828;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .section {
                    margin: 20px 0;
                    padding: 15px;
                    background: #f5f5f5;
                    border-radius: 8px;
                }
                pre {
                    background: #1e1e1e;
                    color: #d4d4d4;
                    padding: 15px;
                    border-radius: 4px;
                    overflow-x: auto;
                }
                .solution {
                    background: #e8f5e9;
                    border-left: 4px solid #4caf50;
                    padding: 15px;
                    margin: 15px 0;
                }
                button {
                    background: #2196F3;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                button:hover {
                    background: #1976D2;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🔧 ${t('html.errorExplanation')}</h1>
                ${modelBadge}
            </div>
            
            <div class="error-box">
                <div class="error-title">${t('html.errorInLine', line)}:</div>
                <code>${shared.escapeHtml(error)}</code>
            </div>
            
            <div class="explanation">
                ${htmlExplanation}
            </div>
            
            <br>
            <button onclick="copyToClipboard()">📋 ${t('buttons.copySolution')}</button>
            
            <script>
                function copyToClipboard() {
                    const text = document.querySelector('.explanation').innerText;
                    navigator.clipboard.writeText(text).then(() => {
                        alert('${t('messages.copiedToClipboard')}');
                    });
                }
            </script>
        </body>
        </html>
    `;
}

module.exports = {
    explainError
};
