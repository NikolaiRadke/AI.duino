/*
 * AI.duino - Code Feature Base Module
 * Shared logic for code manipulation features (improveCode, addComments)
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const shared = require('../shared');                    
const featureUtils = require('./featureUtils');         
const contextManager = require('../utils/contextManager'); 
const { getSharedCSS, getPrismScripts } = require('../utils/panels/sharedStyles');

/**
 * Execute a code manipulation feature with standardized flow
 * @param {Object} context - Extension context with dependencies
 * @param {Object} config - Feature configuration
 * @returns {Promise<vscode.WebviewPanel|undefined>} The created panel or undefined
 */
async function executeCodeFeature(context, config) {
    const {
        operation,          // OPERATIONS enum value (e.g., IMPROVE, COMMENTING)
        promptKeys,         // { selection, file, sketch, suffix }
        commandKey,         // For translation (e.g., 'improveCode', 'addComments')
        panelId,           // WebviewPanel ID (e.g., 'aiImproveCode')
        icon,              // Emoji icon for UI (e.g., '🔧', '💬')
        instructionsKey,   // GlobalState key for custom instructions
        instructionsPrompt, // Prompt key for instructions input
        instructionsPlaceholder, // Placeholder key for instructions input
        historyCategory,   // History category for saving prompts
        progressKey,       // Progress message key
        skipInstructions = false
    } = config;
    
    const panel = await featureUtils.executeFeature(
        operation,
        async () => {
            // 1. Validate editor and Arduino file
            const editor = featureUtils.validateEditorAndFile(context);
            if (!editor) return;

            // 2. Get selection info
            const { selection, hasSelection, selectedText } = featureUtils.getSelectionInfo(editor);

            // 4. Get custom instructions with history (optional)
            let customInstructions = '';
            
            if (!skipInstructions) {
                customInstructions = await featureUtils.showInputWithCreateQuickPickHistory(
                    context,
                    instructionsPrompt,
                    instructionsPlaceholder,
                    historyCategory,
                    context.globalContext.globalState.get(instructionsKey, '')
                );

                // User cancelled
                if (customInstructions === null) return;

                const instructions = customInstructions.trim();
                context.globalContext.globalState.update(instructionsKey, customInstructions);

                // 5. Save to history
                featureUtils.saveToHistory(context, historyCategory, customInstructions);
            }

            // 6. Context Selection
            const contextData = await contextManager.selectContextLevel(
                editor,
                selectedText,
                context.t,
                { showSelectionOption: hasSelection }
            );
            if (!contextData) return; // User cancelled

            // 7. Build prompt with selected context
            const prompt = contextManager.buildContextAwarePrompt(
                selectedText,
                contextData,
                promptKeys,
                context,
                customInstructions  // custom instructions
            );

            // 8. Call AI with progress
            const response = await featureUtils.callAIWithProgress(
                prompt,
                progressKey,
                context,
                { useCodeTemperature: config.useCodeTemperature || false }
            );

            // 9. Create WebviewPanel
            const panel = featureUtils.createStandardPanel(
                panelId,
                context.t(`commands.${commandKey}`)
            );

            panel.webview.html = createCodeFeatureHtml({
                selectedText,
                aiResponse: response,
                customInstructions,
                contextData,
                currentModel: context.currentModel,
                t: context.t,
                icon,
                commandKey,
                context
            });

            // Store data for "Continue in Chat" feature
            panel.userPrompt = prompt;
            panel.aiResponse = response;

            // 10. Store original selection for replacement
            panel.originalEditor = editor;
            panel.originalSelection = selection;

            return panel;
        },
        context
    );
    
    // 11. Setup message handler
    if (panel) {
        featureUtils.setupStandardMessageHandler(panel, context, {
            continueInChat: async (message) => {
                const chatPanel = require('./chatPanel');
                await chatPanel.continueInChat(panel.userPrompt, panel.aiResponse, context);
            }
        });
    }
    
    return panel;
}

/**
 * Create HTML for code feature webview panel
 * @param {Object} options - HTML generation options
 * @returns {string} HTML content
 */
function createCodeFeatureHtml(options) {
    const {
        selectedText,
        aiResponse,
        customInstructions,
        contextData,
        currentModel,
        t,
        icon,
        commandKey,
        context
    } = options;
    
    // Process AI response with code blocks
    const processedHtml = featureUtils.processMessageWithCodeBlocks(
        aiResponse,
        commandKey,
        t,
        ['copy']
    );
    const codeBlocks = processedHtml.codeBlocks;
    
    // Get context badge
    const contextBadge = contextManager.getContextBadgeHtml(contextData, t);
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${t(`commands.${commandKey}`)}</title>
            ${getSharedCSS(context.settings.get('cardStyle'))}
        </head>
<body>
            ${featureUtils.generateContextMenu(t).html}
            
            <h1>${icon} ${t(`commands.${commandKey}`)}</h1>
            
            <div class="context-badge">${contextBadge}</div>
            
            ${customInstructions ? `
            <div class="instructions-box">
                <h3>🎯 ${t(`${commandKey}.customInstructions`)}:</h3>
                <p>${shared.escapeHtml(customInstructions)}</p>
            </div>
            ` : ''}
            
            <div class="info-section">
                <h3>🤖 ${t(`${commandKey}.aiAnalysis`)}:</h3>
                ${processedHtml.html}
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center;">
                <button 
                    class="action-btn" 
                    onclick="continueInChat()" 
                    style="padding: 10px 20px; font-size: 14px;"
                    title="${t('chat.continueInChat')}">
                    💬 ${t('chat.continueInChat')}
                </button>
            </div>
            
            ${featureUtils.getBoardInfoHTML(t)}
            
            <script>
                function continueInChat() {
                    vscode.postMessage({ command: 'continueInChat' });
                }
            </script>
            
            ${featureUtils.generateCodeBlockHandlers(codeBlocks, t, { includeBackButton: false })}
            
            ${getPrismScripts()}
        </body>
        </html>
    `;
}

module.exports = {
    executeCodeFeature
};
