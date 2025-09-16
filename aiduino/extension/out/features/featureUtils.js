/*
 * AI.duino - Feature Functions Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */
const vscode = require('vscode');
const shared = require('../shared');
const validation = require('../utils/validation');
const { showProgressWithCancel } = require('../utils/ui');

/**
 * Execute feature with complete error handling and state management
 * @param {string} operation - Operation key from executionStates.OPERATIONS
 * @param {Function} featureLogic - The actual feature implementation
 * @param {Object} context - Extension context with dependencies
 * @returns {Promise} Feature execution result
 */
async function executeFeature(operation, featureLogic, context) {
    const { executionStates, handleApiError, t } = context;
    
    if (!executionStates.start(operation)) {
        vscode.window.showInformationMessage(t('messages.operationAlreadyRunning'));
        return;
    }
    
    try {
        return await featureLogic();
    } catch (error) {
        handleApiError(error);
    } finally {
        executionStates.stop(operation);
    }
}

/**
 * Create and show a VS Code document with standardized error handling
 * @param {string} content - Document content
 * @param {string} language - Document language (cpp, markdown, etc.)
 * @param {string} title - Document title for URI
 * @param {vscode.ViewColumn} column - Column to show document in
 * @returns {Promise<boolean>} True if successful
 */
async function createAndShowDocument(content, language, title, column = vscode.ViewColumn.Beside) {
    try {
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: language,
            uri: vscode.Uri.parse(`untitled:${title}.${getFileExtension(language)}`)
        });
        
        await vscode.window.showTextDocument(doc, column);
        return true;
    } catch (docError) {
        // Silent catch - VS Code internal timing issue
        return false;
    }
}

/**
 * Get file extension for language
 * @param {string} language - Programming language
 * @returns {string} File extension
 */
function getFileExtension(language) {
    const extensions = {
        'cpp': 'cpp',
        'c': 'c', 
        'markdown': 'md',
        'javascript': 'js',
        'html': 'html'
    };
    return extensions[language] || 'txt';
}

/**
 * Extract code from AI response, handling various markdown formats
 * @param {string} response - AI response text
 * @param {boolean} fallbackToFullResponse - Use full response if no code block found
 * @returns {Object} {extractedCode: string, additionalContent: string}
 */
function extractCodeFromResponse(response, fallbackToFullResponse = true) {
    let extractedCode = '';
    let additionalContent = '';
    
    // Search for pattern ```cpp...``` or similar
    const codeBlockMatch = response.match(/```(?:cpp|c\+\+|arduino|c)?\s*\n([\s\S]*?)\n```([\s\S]*)?/);
    
    if (codeBlockMatch) {
        extractedCode = codeBlockMatch[1].trim();
        additionalContent = codeBlockMatch[2] ? codeBlockMatch[2].trim() : '';
    } else if (fallbackToFullResponse) {
        // Fallback: try to clean up response
        extractedCode = response;
        extractedCode = extractedCode.replace(/^```(?:cpp|c\+\+|arduino|c)?\s*\n?/i, '');
        const endIndex = extractedCode.indexOf('```');
        if (endIndex !== -1) {
            additionalContent = extractedCode.substring(endIndex + 3).trim();
            extractedCode = extractedCode.substring(0, endIndex);
        }
        extractedCode = extractedCode.trim();
    }
    
    return { extractedCode, additionalContent };
}

/**
 * Call AI with progress display and standardized error handling
 * @param {string} prompt - Prompt to send to AI
 * @param {string} progressKey - Translation key for progress message
 * @param {Object} context - Extension context with dependencies
 * @returns {Promise<string>} AI response
 */
async function callAIWithProgress(prompt, progressKey, context) {
    const { t, callAI, minimalModelManager, currentModel } = context;
    const model = minimalModelManager.providers[currentModel];
    
    return await showProgressWithCancel(
        t(progressKey, model.name),
        callAI(prompt),
        t
    );
}

/**
 * Create HTML panel with standardized styling and copy functionality
 * @param {string} title - Panel title
 * @param {string} content - Main content (will be HTML-escaped)
 * @param {string} modelId - Current model ID for badge
 * @param {Function} t - Translation function
 * @param {string} copyButtonText - Text for copy button
 * @param {string} badgeText - Text for model badge
 * @param {string} badgeColor - Color for model badge
 * @returns {vscode.WebviewPanel} Created panel
 */
function createHtmlPanel(title, content, modelId, t, copyButtonText, badgeText = 'AI Assistant', badgeColor = '#4CAF50') {
    const panel = vscode.window.createWebviewPanel(
        'aiFeaturePanel',
        title,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );
    
    const modelBadge = `<span style="background: ${badgeColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${badgeText}</span>`;
    const htmlContent = shared.escapeHtml(content).replace(/\n/g, '<br>');
    
    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                    color: #333;
                    max-width: 900px;
                    margin: 0 auto;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #e0e0e0;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                h1 {
                    color: #2196F3;
                    margin: 0;
                }
                .content {
                    margin: 20px 0;
                    white-space: pre-wrap;
                }
                pre {
                    background: #f4f4f4;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 15px;
                    overflow-x: auto;
                }
                .tip {
                    background: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 15px;
                    margin: 15px 0;
                }
                button {
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 10px;
                    font-size: 14px;
                }
                button:hover {
                    background: #45a049;
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
                .solution {
                    background: #e8f5e9;
                    border-left: 4px solid #4caf50;
                    padding: 15px;
                    margin: 15px 0;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${shared.escapeHtml(title)}</h1>
                ${modelBadge}
            </div>
            <div class="content">${htmlContent}</div>
            
            <button onclick="copyToClipboard()">${copyButtonText}</button>
            
            <script>
                function copyToClipboard() {
                    const text = document.querySelector('.content').innerText;
                    navigator.clipboard.writeText(text).then(() => {
                        alert('${t('messages.copiedToClipboard')}');
                    });
                }
            </script>
        </body>
        </html>
    `;
    
    return panel;
}

/**
 * Build content with footer information (custom instructions, AI hints, board info)
 * @param {string} mainContent - Main content (code or text)
 * @param {Object} options - Options object
 * @param {string} options.customInstructions - Custom instructions text
 * @param {string} options.aiHints - AI hints/comments
 * @param {string} options.boardInfo - Board information
 * @param {Function} options.t - Translation function
 * @returns {string} Content with footer
 */
function buildContentWithFooter(mainContent, options = {}) {
    const { customInstructions, aiHints, boardInfo, t } = options;
    let content = mainContent;
    let footer = [];
    
    // Add custom instructions footer
    if (customInstructions && customInstructions.trim()) {
        footer.push('/* ========== Custom Instructions ==========');
        const wrappedInstructions = shared.wrapText(customInstructions, 80);
        wrappedInstructions.split('\n').forEach(line => {
            footer.push(`   ${line}`);
        });
        footer.push('   ======================================== */');
    }
    
    // Add AI hints footer
    if (aiHints && aiHints.trim()) {
        const hintsLabel = t ? t('labels.aiHints') : 'AI Hints';
        footer.push('/* ========== ' + hintsLabel + ' ==========');
        const wrappedHints = shared.wrapText(aiHints, 80);
        wrappedHints.split('\n').forEach(line => {
            footer.push(`   ${line}`);
        });
        footer.push('   ================================= */');
    }
    
    // Add board info
    if (boardInfo) {
        footer.push(`// Board: ${boardInfo}`);
    }
    
    if (footer.length > 0) {
        content += '\n\n' + footer.join('\n');
    }
    
    return content;
}

/**
 * Standard choice dialog for replace/keep pattern
 * @param {string} successMessage - Message to show before choice
 * @param {Function} t - Translation function
 * @returns {Promise<string>} User choice
 */
async function showReplaceKeepChoice(successMessage, t) {
    return await vscode.window.showInformationMessage(
        successMessage,
        t('buttons.replaceOriginal'),
        t('buttons.keepBoth')
    );
}

/**
 * Replace selected text in editor
 * @param {vscode.TextEditor} editor - VS Code editor
 * @param {vscode.Selection} selection - Text selection
 * @param {string} newText - Replacement text
 * @param {string} successMessage - Success message to show
 */
async function replaceSelectedText(editor, selection, newText, successMessage) {
    await editor.edit(editBuilder => {
        editBuilder.replace(selection, newText);
    });
    if (successMessage) {
        vscode.window.showInformationMessage(successMessage);
    }
}

/**
 * Validate editor and selection for code operations
 * @param {Function} t - Translation function
 * @param {string} noEditorKey - Translation key for no editor message
 * @param {string} noSelectionKey - Translation key for no selection message
 * @returns {Object|null} {editor, selection, selectedText} or null if invalid
 */
function validateEditorAndSelection(t, noEditorKey, noSelectionKey) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage(t(noEditorKey));
        return null;
    }
    
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    
    if (!selectedText.trim()) {
        vscode.window.showWarningMessage(t(noSelectionKey));
        return null;
    }
    
    return { editor, selection, selectedText };
}

/**
 * Show input with createQuickPick-based history support
 * Proven to work in Arduino IDE (unlike showQuickPick)
 * @param {Object} context - Extension context
 * @param {string} promptKey - Prompt manager key (e.g. 'commentInstructions', 'askAI')
 * @param {string} placeholderKey - Translation key for placeholder
 * @param {string} historyCategory - History category for storage
 * @param {string} savedValue - Pre-filled value (optional, for custom instructions)
 * @returns {Promise<string|null>} User input or null if cancelled
 */
async function showInputWithCreateQuickPickHistory(context, promptKey, placeholderKey, historyCategory, savedValue = '') {
    // Fallback to simple input if no history available
    if (!context.promptHistory) {
        return showSimpleInputBox(context, promptKey, placeholderKey, savedValue);
    }

    const recentItems = context.promptHistory.getRecentPrompts(historyCategory, 5);
    
    // If no history exists, use simple input
    if (recentItems.length === 0) {
        return showSimpleInputBox(context, promptKey, placeholderKey, savedValue);
    }

    // Create QuickPick with history (Arduino IDE compatible pattern)
    const quickPick = vscode.window.createQuickPick();
    quickPick.title = context.promptManager.getPrompt(promptKey);
    quickPick.placeholder = context.t(placeholderKey);
    quickPick.ignoreFocusOut = true;
    quickPick.items = recentItems;
    
    return new Promise((resolve) => {
        let currentValue = savedValue || '';
        
        // Handle typing new values
        quickPick.onDidChangeValue((value) => {
            currentValue = value;
        });
        
        // Handle selection from history
        quickPick.onDidChangeSelection((items) => {
            if (items.length > 0 && items[0].value) {
                quickPick.value = items[0].value;
                currentValue = items[0].value;
            }
        });
        
        // Handle accept (Return key)
        quickPick.onDidAccept(() => {
            const finalValue = currentValue.trim();
            quickPick.hide();
            resolve(finalValue || null);
        });
        
        // Handle hide/cancel (Escape key)
        quickPick.onDidHide(() => {
            resolve(null);
        });
        
        quickPick.show();
    });
}

/**
 * Simple input box helper
 * @param {Object} context - Extension context
 * @param {string} promptKey - Prompt manager key
 * @param {string} placeholderKey - Translation key for placeholder
 * @param {string} savedValue - Pre-filled value
 * @returns {Promise<string|undefined>} User input
 */
async function showSimpleInputBox(context, promptKey, placeholderKey, savedValue = '') {
    return await vscode.window.showInputBox({
        prompt: context.promptManager.getPrompt(promptKey),
        placeHolder: context.t(placeholderKey),
        value: savedValue,
        ignoreFocusOut: true
    });
}

/**
 * Validate Arduino file is open (no code selection needed)
 * @param {Object} context - Extension context with t function
 * @returns {Object|null} {editor} or null if validation failed
 */
async function validateArduinoFile(context) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage(context.t('messages.noEditor'));
        return null;
    }
    if (!validation.validateArduinoFile(editor.document.fileName)) {
        vscode.window.showWarningMessage(context.t('messages.openInoFile'));
        return null;
    }
    return { editor };
}

/**
 * Save input to history with optional metadata
 * @param {Object} context - Extension context
 * @param {string} category - History category
 * @param {string} input - User input to save
 * @param {Object} metadata - Optional metadata (board, etc.)
 */
function saveToHistory(context, category, input, metadata = {}) {
    if (context.promptHistory && input && input.trim()) {
        context.promptHistory.addPrompt(category, input.trim(), metadata);
    }
}

module.exports = {
    executeFeature,
    createAndShowDocument,
    extractCodeFromResponse,
    callAIWithProgress,
    createHtmlPanel,
    buildContentWithFooter,
    showReplaceKeepChoice,
    replaceSelectedText,
    validateEditorAndSelection,
    getFileExtension,
    showInputWithCreateQuickPickHistory, 
    validateArduinoFile,
    saveToHistory
};
