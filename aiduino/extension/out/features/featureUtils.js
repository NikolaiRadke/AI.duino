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

    const recentItems = context.promptHistory.getRecentPrompts(historyCategory, 5, context.t, context.currentLocale);

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
        let userSelectedHistoryItem = false;
        let isInitialSelection = true; // NEW: Track initial auto-selection
        
        // Handle typing new values
        quickPick.onDidChangeValue((value) => {
            currentValue = value;
            userSelectedHistoryItem = false; // User typed → reset history selection flag
            isInitialSelection = false; // User interaction → no longer initial
        });
        
        // Handle selection from history
        quickPick.onDidChangeSelection((items) => {
            if (items.length > 0 && items[0].value) {
                // Ignore the automatic initial selection when QuickPick opens
                if (isInitialSelection) {
                    isInitialSelection = false;
                    currentValue = items[0].value; // Store value but don't mark as selected
                    return;
                }
                
                // User actively navigated/selected
                quickPick.value = items[0].value;
                currentValue = items[0].value;
                userSelectedHistoryItem = true; // User actively selected history item
            }
        });
        
        // Handle accept (Return key)
        quickPick.onDidAccept(() => {
            const finalValue = currentValue.trim();
        
            // Check if placeholder was selected
            if (finalValue === '__PLACEHOLDER__') {
                quickPick.hide();
                resolve('');
                return;
            }
    
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

function generateActionToolbar(actions = ['copy', 'insert', 'close'], t) {
    const buttons = actions.map(action => {
        switch(action) {
            case 'copy':
                return `<button class="toolbar-btn" onclick="toolbarCopy()">
                    📋 ${t('buttons.copy')}
                </button>`;
            case 'insert':
                return `<button class="toolbar-btn" onclick="toolbarInsertSelected()">
                    📝 ${t('chat.insertCode')}
                </button>`;
            case 'followUp':
                return `<button class="toolbar-btn" onclick="askFollowUp()">
                    ↩️ ${t('shortcuts.askFollowUp')}
                </button>`;
            case 'close':
                return `<button class="toolbar-btn" onclick="closePanel()">
                    ✖ ${t('buttons.close')}
                </button>`;
            default:
                return '';
        }
    }).join('');
    
    return `
        <div class="action-toolbar">
            ${buttons}
        </div>
    `;
}

/**
 * Generate complete toolbar JavaScript with all functions
 * @param {Array} codeBlockActions - Actions for code blocks ['copyCode', 'insertCode', 'replaceOriginal']
 * @param {Array} toolbarActions - Actions for toolbar ['copy', 'insert', 'followUp', 'close']
 * @returns {string} Complete JavaScript code
 */
function generateToolbarScript(codeBlockActions = ['copyCode', 'insertCode'], toolbarActions = ['copy', 'insert', 'close']) {
    let script = `
        <script>
            const vscode = acquireVsCodeApi();
            
            // === CODE BLOCK FUNCTIONS ===
    `;
    
    if (codeBlockActions.includes('copyCode')) {
        script += `
            function copyCode(code) {
                vscode.postMessage({
                    command: 'copyCode',
                    code: code
                });
            }
        `;
    }
    
    if (codeBlockActions.includes('insertCode')) {
        script += `
            function insertCode(code) {
                vscode.postMessage({
                    command: 'insertCode',
                    code: code
                });
            }
        `;
    }
    
    if (codeBlockActions.includes('replaceOriginal')) {
        script += `
            function replaceOriginal(code) {
                vscode.postMessage({
                    command: 'replaceOriginal',
                    code: code
                });
            }
        `;
    }
    
    script += `
            
            // === TOOLBAR FUNCTIONS ===
    `;
    
    if (toolbarActions.includes('copy')) {
        script += `
            function toolbarCopy() {
                const selection = window.getSelection().toString();
                if (selection && selection.trim()) {
                    vscode.postMessage({
                        command: 'copyCode',
                        code: selection.trim()
                    });
                }
            }
        `;
    }
    
    if (toolbarActions.includes('insert')) {
        script += `
            function toolbarInsertSelected() {
                const selection = window.getSelection().toString();
                if (selection && selection.trim()) {
                    vscode.postMessage({
                        command: 'insertCode',
                        code: selection.trim()
                    });
                }
            }
        `;
    }
    
    if (toolbarActions.includes('followUp')) {
        script += `
            function askFollowUp() {
                vscode.postMessage({
                    command: 'askFollowUp'
                });
            }
        `;
    }
    
    if (toolbarActions.includes('close')) {
        script += `
            function closePanel() {
                vscode.postMessage({ command: 'closePanel' });
            }
        `;
    }
    
    script += `
            
            // === KEYBOARD SHORTCUTS ===
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                    const selection = window.getSelection().toString();
                    if (selection && selection.trim()) {
                        e.preventDefault();
                        vscode.postMessage({
                            command: 'copyCode',
                            code: selection.trim()
                        });
                    }
                }
            });
        </script>
    `;
    
    return script;
}

/**
 * Generate action buttons for code blocks (unified approach)
 * Supports both event delegation (for chatPanel) and direct onclick handlers (for other features)
 * Uses event delegation when index is provided, otherwise generates inline onclick handlers
 * @param {Array} actions - Button actions to generate ['copy', 'insert', 'replace']
 * @param {number|null} index - Code block index for event delegation, or null for direct onclick
 * @param {string} code - Code content for inline onclick handlers (ignored if using event delegation)
 * @param {Function} t - Translation function
 * @returns {string} HTML string with action buttons
 */
function generateCodeBlockButtons(actions, index, code, t) {
    return actions.map(action => {
        const useEventDelegation = index !== null;
        
        const attrs = useEventDelegation 
            ? `data-action="${action}" data-index="${index}"`
            : `onclick="${action}Code(\`${(code || '').replace(/`/g, '\\`')}\`)"`; 
        
        const btnClass = action === 'replace' ? 'code-btn primary' : 'code-btn';
        
        const labels = {
            copy: `📋 ${t('buttons.copy')}`,
            insert: `📝 ${t('chat.insertCode')}`,
            replace: `🔄 ${t('buttons.replaceOriginal')}`
        };
        
        return `<button class="${btnClass}" ${attrs}>${labels[action] || ''}</button>`;
    }).join('');
}

/**
 * Clean HTML-encoded code back to plain text
 * @param {string} html - HTML-encoded code
 * @returns {string} Plain text code
 */
function cleanHtmlCode(html) {
    if (!html) return '';
    
    return html
        .replace(/<br>/g, '\n')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
}

/**
 * Setup standard message handler for panels
 * @param {vscode.WebviewPanel} panel - The webview panel
 * @param {Object} context - Extension context with dependencies
 * @param {Object} customHandlers - Optional custom message handlers
 */
function setupStandardMessageHandler(panel, context, customHandlers = {}) {
    panel.webview.onDidReceiveMessage(async (message) => {
        try {
            // Standard: Copy code
            if (message.command === 'copyCode') {
                await vscode.env.clipboard.writeText(cleanHtmlCode(message.code));
                vscode.window.showInformationMessage(context.t('messages.copiedToClipboard'));
                return;
            }
            
            // Standard: Insert code
            if (message.command === 'insertCode') {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showWarningMessage(context.t('messages.noEditor'));
                    return;
                }
                
                await editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, cleanHtmlCode(message.code));
                });
                
                vscode.window.showInformationMessage(context.t('messages.codeUpdated'));
                return;
            }

            // Standard: Replace original code
            if (message.command === 'replaceOriginal') {
                if (!panel.originalEditor) {
                    vscode.window.showWarningMessage(context.t('messages.noEditor'));
                    return;
                }
    
                await panel.originalEditor.edit(editBuilder => {
                    if (panel.originalSelection && !panel.originalSelection.isEmpty) {
                        // Replace selection
                        editBuilder.replace(panel.originalSelection, cleanHtmlCode(message.code));
                    } else {
                        // Insert at cursor if no selection
                        editBuilder.insert(panel.originalEditor.selection.active, cleanHtmlCode(message.code));
                    }
                });
    
                vscode.window.showInformationMessage(context.t('messages.codeUpdated'));
                return;
            }
            
            // Standard: Close panel
            if (message.command === 'closePanel') {
                panel.dispose();
                return;
            }
            
            // Custom handlers
            if (customHandlers[message.command]) {
                await customHandlers[message.command](message, panel);
            }
            
        } catch (error) {
            context.handleApiError(error);
        }
    });
}

/**
 * Clean code from HTML encoding
 * @param {string} codeContent - HTML-encoded code
 * @returns {string} Clean code
 */
function cleanCodeContent(codeContent) {
    return codeContent
        .replace(/<br>/g, '\n')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
}

/**
 * Process AI response with event-delegation-based code blocks
 * Returns HTML + codeBlocks array for event handling
 * NEU: Für askAI.js und improveCode.js
 * @param {string} response - AI response text
 * @param {string} codeBlockTitle - Title for code blocks
 * @param {Array} buttonActions - Button actions ['copy', 'insert', 'replace']
 * @param {Function} t - Translation function
 * @returns {Object} {processedHtml, codeBlocks}
 */
function processAiCodeBlocksWithEventDelegation(response, codeBlockTitle, buttonActions = ['copy', 'insert'], t) {
    const codeBlocks = [];
    
    let processed = response.replace(/```(?:cpp|c|arduino)?\s*\n([\s\S]*?)\n```/g, (match, codeContent) => {
        codeBlocks.push(codeContent.trim());
        return `[[CODEBLOCK_${codeBlocks.length - 1}]]`;
    });
    
    processed = shared.escapeHtml(processed);
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/\n/g, '<br>');
    
    codeBlocks.forEach((code, index) => {
        const buttonsHtml = generateCodeBlockButtons(buttonActions, index, null, t);
        
        const html = `<div class="code-block" data-code-index="${index}">
            <div class="code-header">
                <span>${codeBlockTitle}</span>
                <div class="code-actions">
                    ${buttonsHtml}
                </div>
            </div>
            <div class="code-content">
                <pre><code class="language-cpp">${shared.escapeHtml(code)}</code></pre>
            </div>
        </div>`;
        
        processed = processed.replace(`[[CODEBLOCK_${index}]]`, html);
    });
    
    return { processedHtml: processed, codeBlocks: codeBlocks };
}

/**
 * Process single message with code blocks for chat display
 * Extracts code blocks, escapes text, formats markdown, and returns HTML with code blocks
 * Used by chatPanel for message-specific code block handling
 * @param {string} text - Message text with potential code blocks
 * @param {string|number} messageId - Unique message identifier for event delegation
 * @param {Function} t - Translation function
 * @returns {Object} {html: string, codeBlocks: Array} - Processed HTML and extracted code blocks array
 */
function processMessageWithCodeBlocks(text, messageId, t) {
    const codeBlocks = [];
    
    // Extract code blocks BEFORE escaping
    let processed = text.replace(/```(?:cpp|c|arduino)?\s*\n([\s\S]*?)\n```/g, (match, codeContent) => {
        codeBlocks.push(codeContent.trim());
        return `[[CODEBLOCK_${codeBlocks.length - 1}]]`;
    });
    
    // Escape the TEXT (not code blocks)
    processed = shared.escapeHtml(processed);
    
    // Format bold text
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Convert line breaks
    processed = processed.replace(/\n/g, '<br>');
    
    // Insert code blocks with message-specific IDs
    codeBlocks.forEach((code, index) => {
        const html = `<div class="code-block" data-message-id="${messageId}" data-code-index="${index}">
            <div class="code-header">
                <span>📄 ${t('chat.suggestedCode')}</span>
                <div class="code-actions">
                    <button class="code-btn" data-action="copy" data-message-id="${messageId}" data-index="${index}">
                        📋 ${t('buttons.copy')}
                    </button>
                    <button class="code-btn" data-action="insert" data-message-id="${messageId}" data-index="${index}">
                        📄 ${t('chat.insertCode')}
                    </button>
                    <button class="code-btn primary" data-action="replace" data-message-id="${messageId}" data-index="${index}">
                        🔄 ${t('buttons.replaceOriginal')}
                    </button>
                </div>
            </div>
            <div class="code-content">
                <pre><code class="language-cpp">${shared.escapeHtml(code)}</code></pre>
            </div>
        </div>`;
    
        processed = processed.replace(`[[CODEBLOCK_${index}]]`, html);
    });

    return { html: processed, codeBlocks };
}   

module.exports = {
    executeFeature,
    createAndShowDocument,
    extractCodeFromResponse,
    callAIWithProgress,
    buildContentWithFooter,
    showReplaceKeepChoice,
    replaceSelectedText,
    validateEditorAndSelection,
    getFileExtension,
    showInputWithCreateQuickPickHistory, 
    validateArduinoFile,
    saveToHistory,
    generateActionToolbar,
    generateToolbarScript,
    cleanHtmlCode,
    setupStandardMessageHandler,
    cleanCodeContent,
    generateCodeBlockButtons,
    processAiCodeBlocksWithEventDelegation,
    processMessageWithCodeBlocks
};
