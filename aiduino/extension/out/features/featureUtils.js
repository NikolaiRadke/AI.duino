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
async function callAIWithProgress(prompt, progressKey, context, options = {}) {
    const { t, minimalModelManager, currentModel } = context;
    const model = minimalModelManager.providers[currentModel];
    
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: t(progressKey, model.name),  
        cancellable: false
    }, async () => {
        try {
            // Override temperature for code features if requested
            let effectiveContext = context;
            if (options.useCodeTemperature && context.settings.get('codeTemperature') !== undefined) {
                const codeTemp = context.settings.get('codeTemperature');
                console.log(`❄️ Using codeTemperature: ${codeTemp}`);
                effectiveContext = {
                    ...context,
                    settings: {
                        ...context.settings,
                        get: (key) => {
                            if (key === 'temperature') {
                                return codeTemp;  // ← Nutze die Variable
                            }
                            return context.settings.get(key);
                        }
                    }
                };
                effectiveContext = {
                    ...context,
                    settings: {
                        ...context.settings,
                        get: (key) => {
                            if (key === 'temperature') {
                                return context.settings.codeTemperature;
                            }
                            return context.settings.get(key);
                        }
                    }
                };
            } else {
                console.log(`💡 Using normal temperature: ${context.settings.get('temperature')}`);  // ← NEU
            }
            
            const result = await effectiveContext.callAI(prompt, effectiveContext);
            
            // Handle both string responses and object responses (e.g., from Claude Code with sessionId)
            if (typeof result === 'string') {
                return result;
            } else if (result && typeof result === 'object' && result.text) {
                // Store sessionId in context if present (for persistent sessions)
                if (result.sessionId) {
                    context.sessionId = result.sessionId;
                }
                return result.text;
            }
            
            // Fallback: return result as-is
            return result;
        } catch (error) {
            context.handleApiError(error);
            throw error;
        }
    });
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

    const limit = context.settings ? context.settings.get('promptHistoryLength') : 5;   
    const recentItems = context.promptHistory.getRecentPrompts(historyCategory, limit, context.t, context.currentLocale);

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
            userSelectedHistoryItem = false; // User typed â†’ reset history selection flag
            isInitialSelection = false; // User interaction â†’ no longer initial
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

/**
 * Generate action buttons for code blocks (unified approach)
 * Supports both event delegation (for chatPanel) and direct onclick handlers (for other features)
 * Uses event delegation when index is provided, otherwise generates inline onclick handlers
 * @param {Array} actions - Button actions to generate: Only 'copy' is provided
 * @param {number|null} index - Code block index for event delegation, or null for direct onclick
 * @param {string} code - Code content for inline onclick handlers (ignored if using event delegation)
 * @param {Function} t - Translation function
 * @returns {string} HTML string with action buttons
 */
function generateCodeBlockButtons(actions, index, code, t) {
    // Only copy button supported now
    const useEventDelegation = index !== null;
    
    const attrs = useEventDelegation 
        ? `data-action="copy" data-index="${index}"`
        : `onclick="copyCode(\`${(code || '').replace(/`/g, '\\`')}\`)"`; 
    
    return `<button class="code-btn" ${attrs}>📋 ${t('buttons.copy')}</button>`;
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
                await vscode.env.clipboard.writeText(shared.cleanHtmlCode(message.code));
                vscode.window.showInformationMessage(context.t('messages.copiedToClipboard'));
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
 * Process AI response with event-delegation-based code blocks
 * Returns HTML + codeBlocks array for event handling
 * @param {string} response - AI response text
 * @param {string} codeBlockTitle - Title for code blocks
 * @param {Array} buttonActions - Button actions ['copy']
 * @param {Function} t - Translation function
 * @returns {Object} {processedHtml, codeBlocks}
 */
function processAiCodeBlocksWithEventDelegation(response, codeBlockTitle, buttonActions = ['copy'], t) {
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
function processMessageWithCodeBlocks(text, messageId, t, buttonActions = ['copy']) {
    const codeBlocks = [];
    
    let processed = text.replace(/```(?:cpp|c|arduino)?\s*\n([\s\S]*?)```/g, (match, codeContent) => {
        codeBlocks.push(codeContent.trim());
        return `[[CODEBLOCK_${codeBlocks.length - 1}]]`;
    });
    
    processed = shared.escapeHtml(processed);
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/\n/g, '<br>');
    
    codeBlocks.forEach((code, index) => {
        const buttons = `<button class="code-btn" data-action="copy" data-message-id="${messageId}" data-index="${index}">
            📋 ${t('buttons.copy')}
        </button>`;
        
        const html = `<div class="code-block" data-message-id="${messageId}" data-code-index="${index}">
            <div class="code-header">
                <span>📄 ${t('chat.suggestedCode')}</span>
                <div class="code-actions">
                    ${buttons}
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

/**
 * Parse Arduino compiler output - extract only the essentials
 * @param {string} compilerOutput - Full compiler output
 * @returns {Object} Parsed error with cleanOutput
 */
function parseArduinoCompilerOutput(compilerOutput) {
    const lines = compilerOutput.split(/\r?\n/);
    let board = null;
    let errorLines = [];
    
    for (const line of lines) {
        // Extract board
        if (line.includes('FQBN:')) {
            const match = line.match(/FQBN:\s*([^\s]+)/);
            if (match) board = match[1];
        }
        
        // Keep lines with error: or note: that aren't indented
        if ((line.includes(': error:') || line.includes(': note:')) && 
            !line.startsWith(' ') && !line.startsWith('\t')) {
            
            // Extract just the relevant part - split at the marker and take first meaningful chunk
            let cleaned = line;
            if (line.includes(': error:')) {
                cleaned = line.split(': error:')[1] || line;
            } else if (line.includes(': note:')) {
                cleaned = line.split(': note:')[1] || line;
            }
            
            // Remove code snippets (lines with lots of spaces or special chars)
            cleaned = cleaned.split(/\s{4,}/)[0].split('\t')[0].trim();
            
            if (cleaned && cleaned.length > 5) {
                errorLines.push(cleaned);
            }
        }
    }
    
    // Build compact output
    let output = '';
    if (board) output += `Board: ${board}\n\n`;
    if (errorLines.length > 0) {
        output += errorLines.join('\n');
    }
    
    return {
        board: board,
        cleanOutput: output.trim() || compilerOutput // Fallback to original if nothing found
    };
}

/**
 * Generate context menu HTML and JavaScript
 * @param {Function} t - Translation function
 * @param {Object} options - Configuration options
 * @returns {object} Object with html and script properties
 */
function generateContextMenu(t, options = {}) {
    const showPaste = options.showPaste || false;
    const showClose = options.showClose !== false;
    const showFollowUp = options.showFollowUp || false;
    
    const html = `
        <div id="ctxMenuOverlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; z-index:9998;"></div>
        <div id="ctxMenu" class="context-menu" style="display:none;">
            <div class="context-menu-item" data-action="copy" id="ctxMenuCopy">📋 ${t('buttons.copy')}</div>
            ${showPaste ? `<div class="context-menu-item" data-action="paste" id="ctxMenuPaste">📝 ${t('chat.insertCode')}</div>` : ''}
            ${showFollowUp ? `<div class="context-menu-item" data-action="followup">↩️ ${t('shortcuts.askFollowUp')}</div>` : ''}
            ${showClose ? `<div class="context-menu-item" data-action="close">✖ ${t('buttons.close')}</div>` : ''}
        </div>
    `;
    
    const script = `
        let ctxSavedSelection = '';
        let ctxLastFocusedInput = null;
        let ctxRightClickedElement = null;
        
        // Track focused input/textarea elements
        document.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                ctxLastFocusedInput = e.target;
            }
        });
        
        // Allow native keyboard shortcuts in input fields
        document.addEventListener('keydown', (e) => {
            const target = e.target;
            const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
            
            if (isInputField && (e.ctrlKey || e.metaKey)) {
                const allowedKeys = ['c', 'v', 'x', 'a', 'z', 'y'];
                if (allowedKeys.includes(e.key.toLowerCase())) {
                    return;
                }
            }
        });
        
        document.getElementById('ctxMenuOverlay').addEventListener('click', () => {
            document.getElementById('ctxMenu').style.display = 'none';
            document.getElementById('ctxMenuOverlay').style.display = 'none';
        });
        
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            
            const menu = document.getElementById('ctxMenu');
            const overlay = document.getElementById('ctxMenuOverlay');
            const copyItem = document.getElementById('ctxMenuCopy');
            const pasteItem = document.getElementById('ctxMenuPaste');
            
            ctxRightClickedElement = e.target;
            
            const isInputField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            
            if (isInputField) {
                ctxLastFocusedInput = e.target;
                const hasSelection = e.target.selectionStart !== e.target.selectionEnd;
                if (hasSelection) {
                    copyItem.classList.remove('disabled');
                } else {
                    copyItem.classList.add('disabled');
                }
                
                if (pasteItem) {
                    pasteItem.classList.remove('disabled');
                }
            } else {
                ctxSavedSelection = window.getSelection().toString().trim();
                
                if (ctxSavedSelection) {
                    copyItem.classList.remove('disabled');
                } else {
                    copyItem.classList.add('disabled');
                }
                
                if (pasteItem) {
                    pasteItem.classList.add('disabled');
                }
            }
            
            let x = e.clientX;
            let y = e.clientY;
            
            overlay.style.display = 'block';
            menu.style.display = 'block';
            
            const menuRect = menu.getBoundingClientRect();
            if (y + menuRect.height > window.innerHeight) {
                y = window.innerHeight - menuRect.height - 10;
            }
            if (x + menuRect.width > window.innerWidth) {
                x = window.innerWidth - menuRect.width - 10;
            }
            
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
        });
        
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('ctxMenu');
            const overlay = document.getElementById('ctxMenuOverlay');
            const menuItem = e.target.closest('.context-menu-item');
            
            if (menuItem && menu.style.display === 'block' && !menuItem.classList.contains('disabled')) {
                const action = menuItem.getAttribute('data-action');
                
                if (action === 'copy') {
                    if (ctxRightClickedElement && (ctxRightClickedElement.tagName === 'INPUT' || ctxRightClickedElement.tagName === 'TEXTAREA')) {
                        const start = ctxRightClickedElement.selectionStart;
                        const end = ctxRightClickedElement.selectionEnd;
                        const selectedText = ctxRightClickedElement.value.substring(start, end);
                        if (selectedText) {
                            vscode.postMessage({ command: 'copyCode', code: selectedText });
                        }
                    } else if (ctxSavedSelection) {
                        vscode.postMessage({ command: 'copyCode', code: ctxSavedSelection });
                    }
                } else if (action === 'paste') {
                    vscode.postMessage({ command: 'pasteFromClipboard' });
                } else if (action === 'followup') {
                    vscode.postMessage({ command: 'askFollowUp' });
                } else if (action === 'close') {
                    vscode.postMessage({ command: 'closePanel' });
                }
                
                menu.style.display = 'none';
                overlay.style.display = 'none';
            }
        });
    ` + (showPaste ? `
        
        // Handle paste from backend
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.command === 'pasteText') {
                const target = ctxLastFocusedInput || document.activeElement;
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                    // Save scroll position
                    const scrollTop = target.scrollTop;
                    
                    const cursorPos = target.selectionStart;
                    const textBefore = target.value.substring(0, cursorPos);
                    const textAfter = target.value.substring(target.selectionEnd);
                    target.value = textBefore + message.text + textAfter;
                    target.focus();
                    target.selectionStart = target.selectionEnd = cursorPos + message.text.length;
                    
                    // Restore scroll position
                    target.scrollTop = scrollTop;
                }
            }
        });
    ` : '');
    
    return { html, script };
}

/**
 * Get board information HTML
 * @param {Function} t - Translation function
 * @returns {string} HTML string with board info
 */
function getBoardInfoHTML(t) {
    const shared = require('../shared');
    const boardFqbn = shared.detectArduinoBoard();
    const boardDisplay = boardFqbn ? 
        shared.getBoardDisplayName(boardFqbn) : 
        t('output.boardUnknown');
    
    return `<div class="board-info">
        🎯 ${t('output.boardDetected', boardDisplay)}
    </div>`;
}

/**
 * Generate standard webview script for code block handling
 * @param {Array} codeBlocks - Array of code blocks
 * @param {Function} t - Translation function
 * @param {Object} options - Additional options
 * @returns {string} Complete script tag with code
 */
function generateCodeBlockHandlers(codeBlocks, t, options = {}) {
    const { includeBackButton = false } = options;
    
    return `
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
                }
            });
            
            ${includeBackButton ? `
            function backToOverview() {
                vscode.postMessage({ command: 'backToOverview' });
            }
            ` : ''}
            
            // Context menu
            ${generateContextMenu(t).script}
        </script>
    `;
}

/**
 * Build standard HTML for question-based features (askAI, debugHelp, explainError)
 * @param {Object} options - HTML building options
 * @returns {string} Complete HTML
 */
function buildQuestionFeatureHtml(options) {
    const { getSharedCSS, getPrismScripts } = require('../utils/panels/sharedStyles');
    const { 
        title,              // Page title
        icon,               // Emoji icon
        badge,              // Model/feature badge HTML
        contextBadge,       // Context info badge HTML
        mainContent,        // Main content HTML
        codeBlocks,         // Array of code blocks
        t,                  // Translation function
        showFollowUp = false, // Show follow-up in context menu
        context             // Extension context for settings
    } = options;
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${title} - AI.duino</title>
            ${getSharedCSS()}
        </head>
        <body>
            ${getSharedCSS(context?.settings?.get('cardStyle') || 'arduino-green')}
            
            <div class="header">
                <h1>${icon} ${title}</h1>
                ${badge}
            </div>
            
            ${contextBadge}           
            ${mainContent}
            ${generateCodeBlockHandlers(codeBlocks, t, { includeBackButton: false })}
            ${getPrismScripts()}
        </body>
        </html>
    `;
}

/**
 * Validate editor and Arduino file in one call
 * @param {Object} context - Extension context
 * @returns {Object|null} Editor object or null if validation fails
 */
function validateEditorAndFile(context) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage(context.t('messages.noEditor'));
        return null;
    }
    
    if (!context.validation.validateArduinoFile(editor.document.fileName)) {
        vscode.window.showWarningMessage(context.t('messages.openInoFile'));
        return null;
    }
    
    return editor;
}

/**
 * Get selection information from editor
 * @param {vscode.TextEditor} editor - VS Code text editor
 * @returns {Object} Selection info with selection, hasSelection, selectedText
 */
function getSelectionInfo(editor) {
    const selection = editor.selection;
    const hasSelection = !selection.start.isEqual(selection.end);
    const selectedText = hasSelection ? editor.document.getText(selection) : '';
    
    return { selection, hasSelection, selectedText };
}

/**
 * Create a standard webview panel with common settings
 * @param {string} panelId - Panel identifier
 * @param {string} title - Panel title
 * @returns {vscode.WebviewPanel} Created panel
 */
function createStandardPanel(panelId, title) {
    return vscode.window.createWebviewPanel(
        panelId,
        title,
        vscode.ViewColumn.Two,
        { enableScripts: true }
    );
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
    setupStandardMessageHandler,
    generateCodeBlockButtons,
    processAiCodeBlocksWithEventDelegation,
    processMessageWithCodeBlocks,
    parseArduinoCompilerOutput,
    generateContextMenu,
    getBoardInfoHTML,
    generateCodeBlockHandlers,
    validateEditorAndFile,
    getSelectionInfo,
    createStandardPanel,
    buildQuestionFeatureHtml
};
