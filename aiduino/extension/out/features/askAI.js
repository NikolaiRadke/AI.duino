/*
 * AI.duino - Ask AI Feature Module (Enhanced with Context Support)
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const path = require('path');
const featureUtils = require('./featureUtils');
const contextManager = require('../utils/contextManager');
const { getSharedCSS, getPrismScripts } = require('../utils/panels/sharedStyles');

/**
 * Main askAI function with follow-up support and context
 * @param {Object} context - Extension context with dependencies
 * @param {boolean} isFollowUp - Whether this is a follow-up question
 */
async function askAI(context, isFollowUp = false) {
    const panel = await featureUtils.executeFeature(
        context.executionStates.OPERATIONS.ASK,
        async () => {
            const { aiConversationContext, setAiConversationContext } = context;
            
            // Check if follow-up is possible
            if (isFollowUp && !shared.hasValidContext(aiConversationContext)) {
                vscode.window.showWarningMessage(context.t('messages.noValidContext'));
                return;
            }
           
            // Get user question
            const question = await featureUtils.showInputWithCreateQuickPickHistory(
                context,
                isFollowUp ? 'askFollowUp' : 'askAI',
                isFollowUp ? 'placeholders.askFollowUp' : 'placeholders.askAI', 
                'askAI'
            );

            if (!question || !question.trim()) {
                return;
            }

            // Save to history (only for new questions, not follow-ups)
            if (!isFollowUp) {
                featureUtils.saveToHistory(context, 'askAI', question, {
                    board: shared.detectArduinoBoard() || 'unknown'
                });
            }

            let finalPrompt;
            let contextData;
            let selectedText = '';

            // Build prompt
            if (isFollowUp) {
                // Get editor state for follow-up
                const editor = vscode.window.activeTextEditor;
    
                if (editor && context.validation.validateArduinoFile(editor.document.fileName)) {
                    const selection = editor.selection;
                    const hasSelection = !selection.start.isEqual(selection.end);
                    selectedText = hasSelection ? editor.document.getText(selection) : '';
            
                    // Standard Context Selection
                    contextData = await contextManager.selectContextLevel(
                        editor, 
                        selectedText, 
                        context.t,
                        { 
                            showSelectionOption: hasSelection,
                            showNoContextOption: true
                        }
                    );
                    if (!contextData) return;
                    if (contextData.level === 'none') {
                        selectedText = '';
                    }
                } else {
                    contextData = { level: 'none' };
                }
                
                finalPrompt = buildFollowUpPromptWithContext(
                    question, 
                    aiConversationContext, 
                    selectedText, 
                    contextData, 
                    context
                );
            } else {
                // Get editor state for new question
                const editor = vscode.window.activeTextEditor;
                
                if (editor && context.validation.validateArduinoFile(editor.document.fileName)) {
                    const selection = editor.selection;
                    const hasSelection = !selection.start.isEqual(selection.end);
                    selectedText = hasSelection ? editor.document.getText(selection) : '';
            
                    // Standard Context Selection
                    contextData = await contextManager.selectContextLevel(
                        editor, 
                        selectedText, 
                        context.t,
                        { 
                            showSelectionOption: hasSelection,
                            showNoContextOption: true
                        }
                    );
                    if (!contextData) return;
                    if (contextData.level === 'none') {
                        selectedText = '';
                    }
                } else {
                    contextData = { level: 'none' };
                }
                
                finalPrompt = buildAskAIPrompt(question, selectedText, contextData, context);
            }
            
            // Call AI with progress
            const progressKey = isFollowUp ? 'progress.askingFollowUp' : 'progress.askingAI';
            const response = await featureUtils.callAIWithProgress(
                finalPrompt,
                progressKey,
                context
            );

            // Store context for potential follow-ups
            const newContext = {
                lastQuestion: question,
                lastAnswer: response,
                lastCode: selectedText || null,
                timestamp: Date.now()
            };
            setAiConversationContext(newContext);

            // Refresh quick menu tree to show follow-up option
            if (context.quickMenuTreeProvider) {
                context.quickMenuTreeProvider.refresh();
            }

            // Create interactive WebView Panel
            const panel = vscode.window.createWebviewPanel(
                'aiAskAI',
                context.t('commands.askAI'),
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            // Create context badge
            const contextBadge = contextData.level !== 'none' 
                ? contextManager.getContextBadgeHtml(contextData, context.t)
                : '';

            panel.webview.html = createAskAIHtml(
                question,
                response,
                isFollowUp,
                newContext,
                selectedText,
                contextBadge,
                context.currentModel,
                context.minimalModelManager,
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
 * Build askAI prompt with context
 * @param {string} question - User question
 * @param {string} selectedText - Selected code
 * @param {Object} contextData - Context data structure
 * @param {Object} context - Extension context
 * @returns {string} Complete AI prompt
 */
function buildAskAIPrompt(question, selectedText, contextData, context) {
    // No context - just the question
    if (contextData.level === 'none') {
        return context.promptManager.getPrompt('askAIGeneral', question);
    }

    // Use buildContextAwarePrompt with question as prefix parameter!
    return contextManager.buildContextAwarePrompt(
        selectedText,
        contextData,
        {
            selection: 'askAIWithContext',
            file: 'askAIFile',
            sketch: 'askAISketch',
            suffix: null
        },
        context,
        null,      // no additional instructions
        [question] // question comes first in all prompts!
    );
}

/**
 * Build follow-up prompt with previous context
 * @param {string} followUpQuestion - The follow-up question
 * @param {Object} aiConversationContext - Previous conversation context
 * @param {Function} t - Translation function
 * @param {Object} promptManager - Prompt manager instance
 * @returns {string} Complete follow-up prompt
 */
function buildFollowUpPrompt(followUpQuestion, aiConversationContext, t, promptManager) {
    let contextPrompt = promptManager.getPrompt('followUpContext');
    
    contextPrompt += `\n\n${t('chat.previousQuestion')}: ${aiConversationContext.lastQuestion}`;
    contextPrompt += `\n\n${t('chat.previousAnswer')}: ${aiConversationContext.lastAnswer}`;
    
    if (aiConversationContext.lastCode) {
        contextPrompt += `\n\n${t('chat.relatedCode')}:\n\`\`\`cpp\n${aiConversationContext.lastCode}\n\`\`\``;
    }
    
    contextPrompt += `\n\n${t('chat.followUpQuestion')}: ${followUpQuestion}`;
    contextPrompt += `\n\n${promptManager.getPrompt('followUpInstruction')}`;
    
    return contextPrompt;
}

/**
 * Create HTML content for askAI panel
 * @param {string} question - User's question
 * @param {string} response - AI's response
 * @param {boolean} isFollowUp - Whether this was a follow-up
 * @param {Object} conversationContext - Conversation context
 * @param {string} currentCode - Associated code (if any)
 * @param {string} contextBadge - Pre-rendered context badge HTML
 * @param {string} modelId - Current AI model
 * @param {Object} minimalModelManager - Model manager instance
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createAskAIHtml(question, response, isFollowUp, conversationContext, currentCode, contextBadge, modelId, minimalModelManager, t) {
    const model = minimalModelManager.providers[modelId];
    const modelBadge = `<span style="background: ${model.color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${model.icon} ${model.name}</span>`;
    
    // Process response with code blocks
    const { processedHtml: processedResponse, codeBlocks } = featureUtils.processAiCodeBlocksWithEventDelegation(
        response,
        `💡 ${t('askAI.codeSuggestionTitle')}`,
        ['copy', 'insert'],
        t
    );

    const contextAge = isFollowUp ? Math.round((Date.now() - conversationContext.timestamp) / 60000) : null;
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('commands.askAI')} - AI.duino</title>
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
            ${featureUtils.generateContextMenu(t, { showFollowUp: true }).html}
            
            <div class="header">
                <h1>💬 ${t('commands.askAI')}</h1>
                ${modelBadge}
            </div>
            
            ${contextBadge}
            
            ${isFollowUp ? `
            <div class="info-badge">
                🔗 ${t('output.followUpTo')}: "${conversationContext.lastQuestion}" (${contextAge} min ago)
            </div>
            ` : ''}
            
            <div class="question-box">
                <h3>❓ ${t('output.yourQuestion')}:</h3>
                <p>${shared.escapeHtml(question)}</p>
            </div>
            
            ${currentCode ? `
            <div class="code-context">
                <h3>📄 ${t('output.codeContextYes', currentCode.split('\n').length)}:</h3>
                <pre><code class="language-cpp">${shared.escapeHtml(currentCode)}</code></pre>
            </div>
            ` : ''}
            
            ${featureUtils.getBoardInfoHTML(t)}
            
            <div class="panel-section">
                <h3>🤖 ${t('output.aiAnswer')}:</h3>
                ${processedResponse}
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const codeBlocksData = ${JSON.stringify(codeBlocks)};
                
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

                // Context menu
                ${featureUtils.generateContextMenu(t, { showFollowUp: true }).script}
            </script>
            
            ${getPrismScripts()}
        </body>
        </html>
    `;
}

/**
 * Build follow-up prompt with previous conversation context
 * Then add new code context using existing logic
 */
function buildFollowUpPromptWithContext(followUpQuestion, aiConversationContext, selectedText, contextData, context) {
    // Start with conversation context
    let prompt = context.promptManager.getPrompt('followUpContext');
    
    prompt += `\n\n${context.t('chat.previousQuestion')}: ${aiConversationContext.lastQuestion}`;
    prompt += `\n\n${context.t('chat.previousAnswer')}: ${aiConversationContext.lastAnswer}`;
    
    if (aiConversationContext.lastCode) {
        prompt += `\n\n${context.t('chat.relatedCode')}:\n\`\`\`cpp\n${aiConversationContext.lastCode}\n\`\`\``;
    }
    
    prompt += `\n\n${context.t('chat.followUpQuestion')}: ${followUpQuestion}`;
    
    // Add new code context if provided (no context means question-only)
    if (contextData.level === 'none') {
        // Just add instruction and return
        prompt += `\n\n${context.promptManager.getPrompt('followUpInstruction')}`;
        return prompt;
    }
    
    // Add new code context marker
    prompt += `\n\n${context.t('askAI.newCodeContext')}:`;
    
    // Use existing buildAskAIPrompt logic for the code context part
    // But we need to extract just the code context part, not the question
    const codeContextPrompt = buildCodeContextPart(selectedText, contextData, context);
    prompt += codeContextPrompt;
    
    prompt += `\n\n${context.promptManager.getPrompt('followUpInstruction')}`;
    return prompt;
}

/**
 * Extract just the code context part (reusable)
 */
function buildCodeContextPart(selectedText, contextData, context) {
    const hasSelection = selectedText && selectedText.trim().length > 0;
    let contextPart = '';
    
    if (hasSelection) {
        contextPart += `\n\`\`\`cpp\n${selectedText}\n\`\`\``;
        contextPart += shared.getBoardContext();
        
        // Add additional context
        if (contextData.level === 'currentFile' && contextData.contextFiles.length > 0) {
            contextPart += '\n\n' + context.t('context.additionalContext');
            const currentFile = contextData.contextFiles.find(f => f.isCurrent);
            if (currentFile) {
                contextPart += `\n// ========== ${currentFile.name} ==========\n`;
                contextPart += `\`\`\`cpp\n${currentFile.content}\n\`\`\``;
            }
        } else if (contextData.level === 'fullSketch' && contextData.contextFiles.length > 0) {
            contextPart += '\n\n' + context.t('context.additionalContext');
            for (const file of contextData.contextFiles) {
                contextPart += `\n// ========== ${file.name} ==========\n`;
                contextPart += `\`\`\`cpp\n${file.content}\n\`\`\``;
            }
        }
    } else {
        // No selection - full file(s)
        if (contextData.level === 'currentFile') {
            const currentFileContent = contextData.contextFiles.find(f => f.isCurrent)?.content || '';
            contextPart += `\n(${contextData.focusFile}):\n\`\`\`cpp\n${currentFileContent}\n\`\`\``;
        } else if (contextData.level === 'fullSketch') {
            for (const file of contextData.contextFiles) {
                contextPart += `\n// ========== ${file.name} ==========\n`;
                contextPart += `\`\`\`cpp\n${file.content}\n\`\`\``;
            }
        }
        contextPart += shared.getBoardContext();
    }
    
    return contextPart;
}

module.exports = {
    askAI
};
