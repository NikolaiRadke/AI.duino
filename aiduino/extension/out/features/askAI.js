/*
 * AI.duino - Ask AI Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const featureUtils = require('./featureUtils');
const { getSharedCSS, getPrismScripts } = require('../utils/panels/sharedStyles');

/**
 * Main askAI function with follow-up support
 * @param {Object} context - Extension context with dependencies
 * @param {boolean} isFollowUp - Whether this is a follow-up question
 */
async function askAI(context, isFollowUp = false) {
    const panel = await featureUtils.executeFeature(
        context.executionStates.OPERATIONS.ASK,
        async () => {
            const { apiKeys, currentModel, minimalModelManager, aiConversationContext, setAiConversationContext } = context;
            
            // Check if follow-up is possible
            if (isFollowUp && !shared.hasValidContext(aiConversationContext)) {
                vscode.window.showWarningMessage(context.t('messages.noValidContext'));
                return;
            }
           
            // Get user question
            const { question, finalPrompt, currentCode } = await buildQuestionPrompt(context, isFollowUp);
            if (!question) return;

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
                lastCode: currentCode,
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

            panel.webview.html = createAskAIHtml(
                question,
                response,
                isFollowUp,
                newContext,
                currentCode,
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
 * Build question prompt based on follow-up status and code context
 * @param {Object} context - Extension context
 * @param {boolean} isFollowUp - Whether this is a follow-up
 * @returns {Object} {question, finalPrompt, currentCode}
 */
async function buildQuestionPrompt(context, isFollowUp) {
    const { aiConversationContext } = context;

    // Show context info for follow-ups
    if (isFollowUp) {
        const contextAge = Math.round((Date.now() - aiConversationContext.timestamp) / 60000);
        vscode.window.showInformationMessage(
            context.t('messages.followUpContext', aiConversationContext.lastQuestion, contextAge)
        );
    }

    // Get question from user
    const question = await featureUtils.showInputWithCreateQuickPickHistory(
        context,
        isFollowUp ? 'askFollowUp' : 'askAI',
        isFollowUp ? 'placeholders.askFollowUp' : 'placeholders.askAI', 
        'askAI'
    );

    if (!question || !question.trim()) {
        return { question: null };
    }

    // Save to history (only for new questions, not follow-ups)
    if (!isFollowUp) {
        featureUtils.saveToHistory(context, 'askAI', question, {
            board: shared.detectArduinoBoard() || 'unknown',
            hasCodeContext: false
        });
    }

    let finalPrompt;
    let currentCode = null;

    if (isFollowUp) {
        // Build context-aware follow-up prompt
        finalPrompt = buildFollowUpPrompt(question, aiConversationContext, context.t, context.promptManager);
        currentCode = aiConversationContext.lastCode;
    } else {
        // Handle new question with optional code context
        finalPrompt = question;
        currentCode = await getCodeContextForNewQuestion(context, question);
        
        if (currentCode) {
            finalPrompt = context.promptManager.getPrompt('askAIWithContext', question, currentCode) + shared.getBoardContext();
        }
    }

    return { question, finalPrompt, currentCode };
}

/**
 * Get code context for new questions
 * @param {Object} context - Extension context
 * @param {string} question - User question
 * @returns {string|null} Selected code or null
 */
async function getCodeContextForNewQuestion(context, question) {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor || editor.selection.isEmpty) {
        return null;
    }

    const includeCode = await vscode.window.showQuickPick([
        {
            label: context.t('chat.includeSelectedCode'),
            description: context.t('chat.includeSelectedCodeDesc'),
            value: true
        },
        {
            label: context.t('chat.questionOnly'), 
            description: context.t('chat.questionOnlyDesc'),
            value: false
        }
    ], {
        placeHolder: context.t('chat.selectContext'),
        ignoreFocusOut: true
    });

    if (includeCode === undefined) return null;

    return includeCode.value ? editor.document.getText(editor.selection) : null;
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
 * Create HTML content for askAI panel with Prism highlighting
 * @param {string} question - User's question
 * @param {string} response - AI's response
 * @param {boolean} isFollowUp - Whether this was a follow-up
 * @param {Object} conversationContext - Conversation context
 * @param {string} currentCode - Associated code (if any)
 * @param {string} modelId - Current AI model
 * @param {Object} minimalModelManager - Model manager instance
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createAskAIHtml(question, response, isFollowUp, conversationContext, currentCode, modelId, minimalModelManager, t) {
    const model = minimalModelManager.providers[modelId];
    const modelBadge = `<span style="background: ${model.color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${model.icon} ${model.name}</span>`;
    
    // Process response with event-delegation code blocks
    const { processedHtml: processedResponse, codeBlocks } = featureUtils.processAiCodeBlocksWithEventDelegation(
        response,
        `💡 ${t('askAI.codeSuggestionTitle')}`,
        ['copy', 'insert'],
        t
    );

    // Board and context info
    const board = shared.detectArduinoBoard();
    const boardDisplay = board ? shared.getBoardDisplayName(board) : t('output.boardUnknown');
    const contextAge = isFollowUp ? Math.round((Date.now() - conversationContext.timestamp) / 60000) : null;
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('commands.askAI')} - AI.duino</title>
            ${getSharedCSS()}
        </head>
        <body>
            ${featureUtils.generateActionToolbar(['copy', 'insert', 'followUp', 'close'], t)}
            
            <div class="header">
                <h1>💬 ${t('commands.askAI')}</h1>
                ${modelBadge}
            </div>
            
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
            
            <div class="board-info">
                🎯 ${t('output.boardDetected', boardDisplay)}
            </div>
            
            <div class="panel-section">
                <h3>🤖 ${t('output.aiAnswer')}:</h3>
                ${processedResponse}
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
            
            ${featureUtils.generateToolbarScript(['copyCode', 'insertCode'], ['copy', 'insert', 'followUp', 'close'])}
            ${getPrismScripts()}
        </body>
        </html>
    `;
}

module.exports = {
    askAI
};
