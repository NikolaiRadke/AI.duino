/**
 * features/askAI.js - Ask AI Feature
 * Direct AI questions with follow-up conversation support
 */

const vscode = require('vscode');
const shared = require('../shared');
const { showProgressWithCancel } = require('../utils/ui');

/**
 * Main askAI function with follow-up support
 * @param {Object} context - Extension context with dependencies
 * @param {boolean} isFollowUp - Whether this is a follow-up question
 */
async function askAI(context, isFollowUp = false) {
    const { t, callAI, executionStates, minimalModelManager, currentModel, handleApiError, 
            apiKeys, aiConversationContext, setAiConversationContext } = context;
    
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.ASK)) {
        vscode.window.showInformationMessage("AI question is already running! Please wait...");
        return;
    }
    
    try {
        // Check if follow-up is possible
        if (isFollowUp && !shared.hasValidContext(aiConversationContext)) {
            vscode.window.showWarningMessage(t('messages.noValidContext'));
            return;
        }

        // Check if API key is available
        if (!apiKeys[currentModel]) {
            const model = minimalModelManager.providers[currentModel];
            const choice = await vscode.window.showWarningMessage(
                t('messages.noApiKey', model.name),
                t('buttons.setupNow'),
                t('buttons.switchModel'),
                t('buttons.cancel')
            );
            if (choice === t('buttons.setupNow')) {
                // Note: setApiKey would need to be passed in context or called differently
                // For now, we'll skip this complex dependency
                vscode.window.showInformationMessage("Please use Quick Menu to set API key");
                return;
            } else if (choice === t('buttons.switchModel')) {
                vscode.window.showInformationMessage("Please use Quick Menu to switch model");
                return;
            } else {
                return;
            }
        }

        // Different prompts for follow-up vs new question
        const promptText = isFollowUp ? context.promptManager.getPrompt('askFollowUp') : context.promptManager.getPrompt('askAI');
        const placeholderText = isFollowUp ? t('placeholders.askFollowUp') : t('placeholders.askAI');

        // Show context info for follow-ups
        if (isFollowUp) {
            const contextAge = Math.round((Date.now() - aiConversationContext.timestamp) / 60000);
            vscode.window.showInformationMessage(
                t('messages.followUpContext', aiConversationContext.lastQuestion, contextAge)
            );
        }

        // Input dialog
        const question = await vscode.window.showInputBox({
            prompt: promptText,
            placeHolder: placeholderText,
            ignoreFocusOut: true
        });

        if (!question || !question.trim()) {
            return;
        }

        // Build final prompt
        let finalPrompt;
        let currentCode = null;

        if (isFollowUp) {
            // Build context-aware follow-up prompt
            finalPrompt = buildFollowUpPrompt(question, aiConversationContext, t);
            currentCode = aiConversationContext.lastCode;
        } else {
            // Handle new question with optional code context
            const editor = vscode.window.activeTextEditor;
           
            finalPrompt = question; 

            if (editor && !editor.selection.isEmpty) {
                const includeCode = await vscode.window.showQuickPick([
                    {
                        label: t('chat.includeSelectedCode'),
                        description: t('chat.includeSelectedCodeDesc'),
                        value: true
                    },
                    {
                        label: t('chat.questionOnly'), 
                        description: t('chat.questionOnlyDesc'),
                        value: false
                    }
                ], {
                    placeHolder: t('chat.selectContext'),
                    ignoreFocusOut: true
                });
        
                if (includeCode === undefined) return;
        
                if (includeCode.value) {
                    currentCode = editor.document.getText(editor.selection);
                    // Add board info only when code is included
                    finalPrompt = context.promptManager.getPrompt('askAIWithContext', question, currentCode) + shared.getBoardContext();
                }
            }
        }   

        // Call AI
        const model = minimalModelManager.providers[currentModel];
        
        let response;
        try {
            response = await showProgressWithCancel(
                t('progress.askingAI', model.name),
                callAI(finalPrompt),
                t
            );
        } catch (progressError) {
            throw progressError; 
        }

        // Store context for potential follow-ups
        const newContext = {
            lastQuestion: question,
            lastAnswer: response,
            lastCode: currentCode,
            timestamp: Date.now()
        };
        setAiConversationContext(newContext);

        // Show response
        try {
            await showAIResponseWithFollowUp(model, question, response, isFollowUp, newContext, t);
        } catch (displayError) {
            // Silent fail
        }

    } catch (error) {
        handleApiError(error);
    } finally {
        // Always cleanup
        executionStates.stop(executionStates.OPERATIONS.ASK);
    }
}

/**
 * Build follow-up prompt with previous context
 * @param {string} followUpQuestion - The follow-up question
 * @param {Object} aiConversationContext - Previous conversation context
 * @param {Function} t - Translation function
 * @returns {string} Complete follow-up prompt
 */
function buildFollowUpPrompt(followUpQuestion, aiConversationContext, t, promptManager) {
    let contextPrompt = promptManager.getPrompt('followUpContext');
    
    // Add previous conversation
    contextPrompt += `\n\n${t('chat.previousQuestion')}: ${aiConversationContext.lastQuestion}`;
    contextPrompt += `\n\n${t('chat.previousAnswer')}: ${aiConversationContext.lastAnswer}`;
    
    // Add code context if available
    if (aiConversationContext.lastCode) {
        contextPrompt += `\n\n${t('chat.relatedCode')}:\n\`\`\`cpp\n${aiConversationContext.lastCode}\n\`\`\``;
    }
    
    // Add current follow-up question
    contextPrompt += `\n\n${t('chat.followUpQuestion')}: ${followUpQuestion}`;
    contextPrompt += `\n\n${promptManager.getPrompt('followUpInstruction')}`;
    
    return contextPrompt;
}

/**
 * Show AI response with follow-up formatting
 * @param {Object} model - AI model information
 * @param {string} question - User's question
 * @param {string} response - AI's response
 * @param {boolean} isFollowUp - Whether this was a follow-up
 * @param {Object} aiConversationContext - Current context
 * @param {Function} t - Translation function
 */
async function showAIResponseWithFollowUp(model, question, response, isFollowUp, aiConversationContext, t) {
    const modelName = model.name || model;
    
    const lines = [
        `🤖 ${t('output.responseFrom', modelName.toUpperCase ? modelName.toUpperCase() : modelName)}`,
        '='.repeat(50),
        ''
    ];
    
    // Show follow-up context
    if (isFollowUp && aiConversationContext.lastQuestion) {
        lines.push(`🔗 ${t('output.followUpTo')}:`);
        const wrappedPrevQuestion = shared.wrapText(aiConversationContext.lastQuestion, 80);
        wrappedPrevQuestion.split('\n').forEach(line => {
            lines.push(`   ${line}`);
        });
        lines.push('');
    }
    
    // Show if code was included
    if (aiConversationContext.lastCode) {
        const lineCount = aiConversationContext.lastCode.split('\n').length;
        lines.push(`📄 ${t('output.codeContextYes', lineCount)}`);
        lines.push('');
    }
    
    // Show board if detected
    const board = shared.detectArduinoBoard();
    if (board) {
        lines.push(`🎯 ${t('output.boardDetected', board)}`);
        lines.push('');
    }
    
    // Show question
    lines.push(`❓ ${t('output.yourQuestion')}:`);
    const wrappedQuestion = shared.wrapText(question, 80);
    wrappedQuestion.split('\n').forEach(line => {
        lines.push(`   ${line}`);
    });
    lines.push('');
    
    lines.push(`💡 ${t('output.aiAnswer')}:`);
    lines.push('');
    
    // Wrap response at 80 characters
    const wrappedResponse = response.split('\n').map(line => 
        line.length > 80 ? shared.wrapText(line, 80) : line
    ).join('\n');
    
    lines.push(wrappedResponse);
    lines.push('');
    lines.push('='.repeat(50));
    lines.push(`💬 ${t('output.followUpHint')}`);
    lines.push(`   • ${t('shortcuts.askFollowUp')}: Ctrl+Shift+F`);
    lines.push(`   • ${t('shortcuts.askAI')}: Ctrl+Shift+A`);
    
    const formattedContent = lines.join('\n');
    
    try {
        const doc = await vscode.workspace.openTextDocument({
            content: formattedContent,
            language: 'markdown'
        });
    
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    
    } catch (docError) {
        // Silent catch - VS Code internal timing issue
    }
}

module.exports = {
    askAI
};
