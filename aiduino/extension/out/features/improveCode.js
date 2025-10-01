/*
 * AI.duino - Improve Code Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const featureUtils = require('./featureUtils');
const { getSharedCSS, getPrismScripts } = require('../utils/panels/sharedStyles');

/**
 * Main improveCode function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function improveCode(context) {
    const panel = await featureUtils.executeFeature(
        context.executionStates.OPERATIONS.IMPROVE,
        async () => {
            // Validate editor and selection
            const validation = featureUtils.validateEditorAndSelection(
                context.t, 'messages.noEditor', 'messages.selectCodeToImprove'
            );
            if (!validation) return;

            const { editor, selection, selectedText } = validation;

            // Get custom instructions with history 
            const customInstructions = await featureUtils.showInputWithCreateQuickPickHistory(
                context, 'commentInstructions', 'placeholders.customInstructions', 'improveCode',
                context.globalContext.globalState.get('aiduino.customInstructions', '')
            );            

            // User cancelled (pressed Escape) - abort
            if (customInstructions === null) return;

            // Empty string is OK - means "no special instructions"
            const instructions = customInstructions.trim();

            context.globalContext.globalState.update('aiduino.customInstructions', customInstructions);

            // Save to history
            featureUtils.saveToHistory(context, 'improveCode', customInstructions);
            
            // Build prompt with board context
            let prompt = context.promptManager.getPrompt('improveCode', selectedText) + shared.getBoardContext();
            
            if (instructions) {
                const instructionsList = instructions.split(',').map(s => s.trim()).join('\n- ');
                prompt += '\n\n' + context.promptManager.getPrompt('additionalInstructions', instructionsList);
            }
            
            prompt += '\n\n' + context.promptManager.getPrompt('improveCodeSuffix');
            
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
        featureUtils.setupStandardMessageHandler(panel, context, {
            'replaceOriginal': async (message, panelRef) => {
                if (panelRef.originalEditor && panelRef.originalSelection) {
                    await panelRef.originalEditor.edit(editBuilder => {
                        editBuilder.replace(panelRef.originalSelection, featureUtils.cleanHtmlCode(message.code));
                    });
                    
                    vscode.window.showInformationMessage(context.t('messages.codeReplaced'));
                    panelRef.dispose();
                } else {
                    vscode.window.showWarningMessage(context.t('messages.noEditor'));
                }
            }
        });
    }
}

/**
 * Create HTML content for code improvement panel
 * @param {string} originalCode - The original code that was improved
 * @param {string} improvement - AI improvement response
 * @param {string} customInstructions - User's custom instructions
 * @param {string} modelId - Current AI model ID
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createImproveCodeHtml(originalCode, improvement, customInstructions, modelId, t) {
    const modelBadge = `<span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${t('improveCode.codeBadge')}</span>`;
    
    // Process improvement with event-delegation code blocks
    const { processedHtml, codeBlocks } = featureUtils.processAiCodeBlocksWithEventDelegation(
        improvement,
        `⚡ ${t('improveCode.improvedCodeTitle')}`,
        ['replace', 'copy', 'insert'],
        t
    );
    
    // Board info
    const boardInfo = shared.detectArduinoBoard();
    const boardDisplay = boardInfo ? shared.getBoardDisplayName(boardInfo) : t('output.boardUnknown');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('commands.improveCode')} - AI.duino</title>
            ${getSharedCSS()}
        </head>
        <body>
            ${featureUtils.generateActionToolbar(['copy', 'insert', 'close'], t)}
            
            <div class="header">
                <h1>⚡ ${t('commands.improveCode')}</h1>
                ${modelBadge}
            </div>
            
            <div class="original-code">
                <h3>📄 ${t('improveCode.originalCode')}:</h3>
                <pre><code class="language-cpp">${shared.escapeHtml(originalCode)}</code></pre>
            </div>
            
            ${customInstructions ? `
            <div class="instructions-box">
                <h3>🎯 ${t('improveCode.customInstructions')}:</h3>
                <p>${shared.escapeHtml(customInstructions)}</p>
            </div>
            ` : ''}
            
            <div class="info-section">
                <h3>🤖 ${t('improveCode.aiAnalysis')}:</h3>
                ${processedHtml}
            </div>
            
            <div class="board-info">
                🎯 ${t('improveCode.targetBoard')}: ${boardDisplay}
            </div>
            
            ${featureUtils.generateToolbarScript(['copyCode', 'insertCode', 'replaceOriginal'], ['copy', 'insert', 'close'])}
            
            <script>
                // Code blocks data for button handlers
                const codeBlocksData = ${JSON.stringify(codeBlocks)};
                
                // Code block button handler (event delegation)
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
            </script>
            
            ${getPrismScripts()}
        </body>
        </html>
    `;
}

module.exports = {
    improveCode
};
