/*
 * AI.duino - Add Comments Feature Module (Enhanced with Context Support)
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const featureUtils = require('./featureUtils');
const contextManager = require('../utils/contextManager');
const { getSharedCSS, getPrismScripts } = require('../utils/panels/sharedStyles');

/**
 * Main addComments function with multi-context support
 * @param {Object} context - Extension context with dependencies
 */
async function addComments(context) {
    const panel = await featureUtils.executeFeature(
        context.executionStates.OPERATIONS.COMMENTS,
        async () => {
            // Validate editor (selection optional)
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
            
            // Proper selection detection
            const hasSelection = !selection.start.isEqual(selection.end);
            const selectedText = hasSelection ? editor.document.getText(selection) : '';

            // Get custom comment instructions with history (optional)
            const customInstructions = await featureUtils.showInputWithCreateQuickPickHistory(
                context, 
                'commentInstructions', 
                'placeholders.commentInstructions', 
                'addComments',
                context.globalContext.globalState.get('aiduino.commentInstructions', '')
            );            

            // User cancelled
            if (customInstructions === null) return;
    
            const instructions = customInstructions.trim();
            context.globalContext.globalState.update('aiduino.commentInstructions', customInstructions);

            // Save to history
            featureUtils.saveToHistory(context, 'addComments', customInstructions);

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
                    selection: 'addCommentsSelected',
                    file: 'addCommentsFile',
                    sketch: 'addCommentsSketch',
                    suffix: 'addCommentsSuffix'
                },
                context,
                instructions 
            );
            
            // Call AI with progress
            const response = await featureUtils.callAIWithProgress(
                prompt,
                'progress.addingComments',
                context
            );
            
            // Create WebviewPanel
            const panel = vscode.window.createWebviewPanel(
                'aiAddComments',
                context.t('commands.addComments'),
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );
            
            panel.webview.html = createAddCommentsHtml(
                selectedText,
                response,
                customInstructions,
                contextData,
                context.currentModel,
                context.t
            );
            
            // Store original selection for replacement
            panel.originalEditor = editor;
            panel.originalSelection = selection;
            
            return panel;
        },
        context
    );
    
    // Message Handler
    if (panel) {
        featureUtils.setupStandardMessageHandler(panel, context, {});
    }
}

/**
 * Create HTML for add comments webview panel
 * @param {string} originalCode - Original selected code
 * @param {string} aiResponse - AI response
 * @param {Object} contextData - Context data structure
 * @param {string} currentModel - Current AI model
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createAddCommentsHtml(originalCode, aiResponse, customInstructions, contextData, currentModel, t) {
    const codeBlocks = {};
    const processedHtml = featureUtils.processMessageWithCodeBlocks(aiResponse, 'addComments', t);
    Object.assign(codeBlocks, processedHtml.codeBlocks);
    
    const boardFqbn = shared.detectArduinoBoard();
    const boardDisplay = boardFqbn ? 
        shared.getBoardDisplayName(boardFqbn) : t('output.boardUnknown');
    
    const contextBadge = contextManager.getContextBadgeHtml(contextData, t);
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${t('commands.addComments')}</title>
            ${getSharedCSS()}
            <style>
                .context-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    border-radius: 12px;
                    font-size: 0.9em;
                    margin: 8px 0;
                }
            </style>
        </head>
        <body>
        <body>
            ${featureUtils.generateContextMenu(t).html}
            <h1>💬 ${t('commands.addComments')}</h1>
            
            ${contextBadge}
            
            ${customInstructions ? `
            <div class="instructions-box">
                <h3>🎯 ${t('addComments.customInstructions')}:</h3>
                <p>${shared.escapeHtml(customInstructions)}</p>
            </div>
            ` : ''}
            
            <div class="info-section">
                <h3>🤖 ${t('addComments.commentedCode')}:</h3>
                ${processedHtml.html}
            </div>
            
            <div class="board-info">
                🎯 ${t('improveCode.targetBoard')}: ${boardDisplay}
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                const codeBlocksData = ${JSON.stringify(codeBlocks)};
                
                // Code block buttons
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
                    } else if (action === 'replace') {
                        vscode.postMessage({ command: 'replaceOriginal', code: code });
                    }
                });
                
                // Context menu
                ${featureUtils.generateContextMenu(t).script}
            </script>
            
            ${getPrismScripts()}
        </body>
        </html>
    `;
}
module.exports = {
    addComments
};
