/*
 * AI.duino - Ask AI Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const featureUtils = require('./featureUtils');

/**
 * Main askAI function with follow-up support
 * @param {Object} context - Extension context with dependencies
 * @param {boolean} isFollowUp - Whether this is a follow-up question
 */
async function askAI(context, isFollowUp = false) {
    return featureUtils.executeFeature(
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

            // Show response with follow-up formatting
            await showAIResponseWithFollowUp(question, response, isFollowUp, newContext, context);
        },
        context
    );
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
    const promptText = isFollowUp ? context.promptManager.getPrompt('askFollowUp') : context.promptManager.getPrompt('askAI');
    const placeholderText = isFollowUp ? context.t('placeholders.askFollowUp') : context.t('placeholders.askAI');

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
            hasCodeContext: false  // wird später aktualisiert wenn Code-Context hinzugefügt wird
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
 * Show AI response with follow-up formatting
 * @param {string} question - User's question
 * @param {string} response - AI's response
 * @param {boolean} isFollowUp - Whether this was a follow-up
 * @param {Object} conversationContext - Conversation context
 * @param {Object} extensionContext - Extension context
 */
async function showAIResponseWithFollowUp(question, response, isFollowUp, conversationContext, extensionContext) {
    const { minimalModelManager, currentModel } = extensionContext;
    const model = minimalModelManager.providers[currentModel];
    const modelName = model.name || model;
    
    const lines = [
        `🤖 ${extensionContext.t('output.responseFrom', modelName.toUpperCase ? modelName.toUpperCase() : modelName)}`,
        '='.repeat(50),
        ''
    ];
    
    // Show follow-up context
    if (isFollowUp && conversationContext.lastQuestion) {
        lines.push(`🔗 ${extensionContext.t('output.followUpTo')}:`);
        const wrappedPrevQuestion = shared.wrapText(conversationContext.lastQuestion, 80);
        wrappedPrevQuestion.split('\n').forEach(line => {
            lines.push(`   ${line}`);
        });
        lines.push('');
    }
    
    // Show code context info
    if (conversationContext.lastCode) {
        const lineCount = conversationContext.lastCode.split('\n').length;
        lines.push(`📄 ${extensionContext.t('output.codeContextYes', lineCount)}`);
        lines.push('');
    }
    
    // Show board info
    const board = shared.detectArduinoBoard();
    if (board) {
        lines.push(`🎯 ${extensionContext.t('output.boardDetected', board)}`);
        lines.push('');
    }
    
    // Show question and answer
    lines.push(`❓ ${extensionContext.t('output.yourQuestion')}:`);
    const wrappedQuestion = shared.wrapText(question, 80);
    wrappedQuestion.split('\n').forEach(line => {
        lines.push(`   ${line}`);
    });
    lines.push('');
    
    lines.push(`💡 ${extensionContext.t('output.aiAnswer')}:`);
    lines.push('');
    
    // Wrap response
    const wrappedResponse = response.split('\n').map(line => 
        line.length > 80 ? shared.wrapText(line, 80) : line
    ).join('\n');
    
    lines.push(wrappedResponse);
    lines.push('');
    lines.push('='.repeat(50));
    lines.push(`💬 ${extensionContext.t('output.followUpHint')}`);
    lines.push(`   • ${extensionContext.t('shortcuts.askFollowUp')}: Ctrl+Shift+F`);
    lines.push(`   • ${extensionContext.t('shortcuts.askAI')}: Ctrl+Shift+A`);
    
    const formattedContent = lines.join('\n');
    
    // Create and show document
    await featureUtils.createAndShowDocument(
        formattedContent,
        'markdown',
        extensionContext.t('commands.askAI')
    );
}

module.exports = {
    askAI
};
