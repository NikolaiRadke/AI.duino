/*
 * AI.duino - Improve Code Feature Module (Enhanced with Context Support)
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
 * Main improveCode function with multi-context support
 * @param {Object} context - Extension context with dependencies
 */
async function improveCode(context) {
    const panel = await featureUtils.executeFeature(
        context.executionStates.OPERATIONS.IMPROVE,
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
            
            // CRITICAL: Proper selection detection
            // A selection is only valid if start and end positions are different
            const hasSelection = !selection.start.isEqual(selection.end);
            const selectedText = hasSelection ? editor.document.getText(selection) : '';

            // Get custom instructions with history 
            const customInstructions = await featureUtils.showInputWithCreateQuickPickHistory(
                context, 'commentInstructions', 'placeholders.customInstructions', 'improveCode',
                context.globalContext.globalState.get('aiduino.customInstructions', '')
            );            

            // User cancelled
            if (customInstructions === null) return;

            const instructions = customInstructions.trim();
            context.globalContext.globalState.update('aiduino.customInstructions', customInstructions);

            // Save to history
            featureUtils.saveToHistory(context, 'improveCode', customInstructions);
            
            // ===== Context Selection (angepasst an Selektion) =====
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
                    selection: 'improveCode',
                    file: 'improveCodeFile',
                    sketch: 'improveCodeSketch',
                    suffix: 'improveCodeSuffix'
                },
                context,
                instructions  // custom instructions
            );
            
            // Call AI with progress
            const response = await featureUtils.callAIWithProgress(
                prompt,
                'progress.optimizing',
                context
            );
            
            // Create WebviewPanel for code improvement
            const panel = vscode.window.createWebviewPanel(
                'aiImproveCode',
                context.t('commands.improveCode'),
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );
            
            panel.webview.html = createImproveCodeHtml(
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
 * Create HTML for improve code webview panel
 * @param {string} originalCode - Original selected code
 * @param {string} aiResponse - AI response
 * @param {string} customInstructions - User's custom instructions
 * @param {Object} contextData - Context data structure
 * @param {string} currentModel - Current AI model
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createImproveCodeHtml(originalCode, aiResponse, customInstructions, contextData, currentModel, t) {
    const processedHtml = featureUtils.processMessageWithCodeBlocks(aiResponse, 'improve', t, ['copy', 'insert', 'replace']);
    const codeBlocks = processedHtml.codeBlocks;
    
    // Context info badge (using shared function)
    const contextBadge = contextManager.getContextBadgeHtml(contextData, t);
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${t('commands.improveCode')}</title>
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
            ${featureUtils.generateContextMenu(t).html}
            
            <h1>🔧 ${t('commands.improveCode')}</h1>
            
            <div class="context-badge">${contextBadge}</div>
            
            ${customInstructions ? `
            <div class="instructions-box">
                <h3>🎯 ${t('improveCode.customInstructions')}:</h3>
                <p>${shared.escapeHtml(customInstructions)}</p>
            </div>
            ` : ''}
            
            <div class="info-section">
                <h3>🤖 ${t('improveCode.aiAnalysis')}:</h3>
                ${processedHtml.html}
            </div>
            
            ${featureUtils.getBoardInfoHTML(t)}
            
            ${featureUtils.generateCodeBlockHandlers(codeBlocks, t, { includeBackButton: false })}
            
            ${getPrismScripts()}
        </body>
        </html>
    `;
}

module.exports = {
    improveCode
};
