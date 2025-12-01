/*
 * AI.duino - Explain Error Feature Module (Enhanced with Context Support)
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
 * Main explainError function with multi-context support
 * @param {Object} context - Extension context with dependencies
 * @param {string|null} preProvidedText - Optional: Pre-provided error text from clipboard
 */
async function explainError(context, preProvidedText = null) {
    const panel = await featureUtils.executeFeature(
        context.executionStates.OPERATIONS.ERROR,
        async () => {
            // Validate Arduino file
            const editorValidation = await featureUtils.validateArduinoFile(context);
            if (!editorValidation) return;
            
            const { editor } = editorValidation;
            
            // Get error input - either from parameter or from user input
            let errorInput;
            if (preProvidedText) {
                errorInput = preProvidedText;
            } else {
                errorInput = await featureUtils.showInputWithCreateQuickPickHistory(
                    context, 'pasteError', 'placeholders.errorExample', 'explainError'
                );
                if (!errorInput) return;
            }
            
            // Parse compiler output to extract relevant info
            const parsedError = featureUtils.parseArduinoCompilerOutput(errorInput);
            
            // Use cleaned output if parsing was successful
            const processedErrorText = parsedError.cleanOutput || errorInput;
            
            // Save to history (with parsed text)
            featureUtils.saveToHistory(context, 'explainError', processedErrorText, {
                board: parsedError.board || shared.detectArduinoBoard() || 'unknown'
            });
                
            // Get current cursor position for error context
            const line = editor.selection.active.line;
            
            // Get minimal code context (5 lines around cursor) for default context
            const startLine = Math.max(0, line - 5);
            const endLine = Math.min(editor.document.lineCount - 1, line + 5);
            const minimalCodeContext = editor.document.getText(
                new vscode.Range(startLine, 0, endLine, Number.MAX_VALUE)
            );
            
            // Context Selection with custom "minimal context" option
            const contextData = await contextManager.selectContextLevel(
                editor, 
                minimalCodeContext,
                context.t,
                { 
                    showSelectionOption: true,
                    customSelectionLabel: true
                }
            );
            if (!contextData) return; // User cancelled
            
            // Build prompt with error and context
            const prompt = buildErrorPromptWithContext(
                processedErrorText,
                line + 1,
                minimalCodeContext,
                contextData,
                context
            );
            
            // Call AI with progress
            const response = await featureUtils.callAIWithProgress(
                prompt,
                'progress.analyzingError',
                context
            );
            
            // Process response with code blocks
            const { processedHtml, codeBlocks } = featureUtils.processAiCodeBlocksWithEventDelegation(
                response,
                `ðŸ”§ ${context.t('explainError.correctedCodeTitle')}`,
                ['copy'],
                context.t
            );
            
            // Create WebviewPanel for error explanation
            const panel = vscode.window.createWebviewPanel(
                'aiError',
                context.t('commands.explainError'),
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );
            
            // Store data for "Continue in Chat" feature
            panel.userPrompt = prompt;
            panel.aiResponse = response;
            
            // Create context badge before HTML generation
            const contextBadge = contextManager.getContextBadgeHtml(contextData, context.t);
            
            panel.webview.html = createErrorExplanationHtml(
                processedErrorText,
                line + 1,
                processedHtml,
                codeBlocks,
                contextBadge,
                context.currentModel,
                context.t,
                context
            );;
            
            return panel;
        },
        context
    );
    
    // Message Handler
    if (panel) {
        featureUtils.setupStandardMessageHandler(panel, context, {
            continueInChat: async (message) => {
                const chatPanel = require('./chatPanel');
                await chatPanel.continueInChat(panel.userPrompt, panel.aiResponse, context);
            }
        });
    }
}

/**
 * Build error explanation prompt with context awareness
 * @param {string} errorText - The error message
 * @param {number} lineNumber - Line number where error occurred
 * @param {string} minimalContext - 5 lines around cursor
 * @param {Object} contextData - Context data structure
 * @param {Object} context - Extension context
 * @returns {string} Complete AI prompt
 */
function buildErrorPromptWithContext(errorText, lineNumber, minimalContext, contextData, context) {
    let prompt = '';
    
    if (contextData.level === 'selection') {
        // Use only minimal context (5 lines around cursor)
        prompt += context.promptManager.getPrompt('explainError', errorText, lineNumber, minimalContext);
    } else if (contextData.level === 'currentFile') {
        // Use entire current file as context
        const currentFileContent = contextData.contextFiles.find(f => f.isCurrent)?.content || '';
        prompt += context.promptManager.getPrompt('explainErrorFile', errorText, lineNumber, contextData.focusFile, currentFileContent);
    } else if (contextData.level === 'fullSketch') {
        // Use entire sketch as context
        let allFilesContent = '';
        for (const file of contextData.contextFiles) {
            allFilesContent += `// ========== ${file.name} ==========\n`;
            allFilesContent += `\`\`\`cpp\n${file.content}\n\`\`\`\n\n`;
        }
        prompt += context.promptManager.getPrompt('explainErrorSketch', errorText, lineNumber, allFilesContent);
    }
    
    prompt += shared.getBoardContext();
    return prompt;
}

/**
 * Create HTML content for error explanation panel
 * @param {string} error - The error message
 * @param {number} line - Line number where error occurred
 * @param {string} processedExplanation - Already processed HTML with code blocks
 * @param {Array} codeBlocks - Array of code strings
 * @param {string} contextBadge - Pre-rendered context badge HTML
 * @param {string} modelId - Current AI model ID
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createErrorExplanationHtml(error, line, processedExplanation, codeBlocks, contextBadge, modelId, t, context) {
    const modelBadge = `<span style="background: #6B46C1; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${t('explainError.errorBadge')}</span>`;
    
    const mainContent = `
        <div class="error-box">
            <div class="error-title">${t('html.errorInLine', line)}:</div>
            <pre><code>${shared.escapeHtml(error)}</code></pre>
        </div>
        
        <div class="explanation">
            ${processedExplanation}
        </div>
    `;
    
    return featureUtils.buildQuestionFeatureHtml({
        title: t('commands.explainError'),
        icon: 'ðŸ”§',
        badge: modelBadge,
        contextBadge,
        mainContent,
        codeBlocks,
        t,
        showFollowUp: false,
        context,
        showContinueInChat: true
    });
}

/**
 * Explain error from clipboard
 * @param {Object} context - Extension context with dependencies
 */
async function explainCopiedError(context) {
    // Read clipboard
    const clipboardText = await vscode.env.clipboard.readText();
    
    if (!clipboardText || clipboardText.trim().length === 0) {
        vscode.window.showWarningMessage(context.t('messages.noErrorInClipboard'));
        return;
    }
    
    // Call main explainError with clipboard text
    return explainError(context, clipboardText);
}

module.exports = {
    explainError,
    explainCopiedError
};
