/*
 * AI.duino - Prompt Editor Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */
const vscode = require('vscode');
const { escapeHtml } = require('../shared');
const { getSharedCSS } = require('../utils/panels/sharedStyles');
const featureUtils = require('./featureUtils');
const panelManager = require('../utils/panelManager');

/**
 * Show prompt editor with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function showPromptEditor(context) {
    try {
        const { t, promptManager } = context;
        
        // Variables for close protection
        let hasUnsavedChanges = false;
        let isForceClosing = false;
        let pendingChanges = {};
        
        const promptData = promptManager.getAllPrompts();
        const allowedPrompts = ['improveCode', 'explainCode', 'addComments', 'explainError', 'hardwareDebug' ];
        
        // Centralized localized strings to avoid repeated t() calls
        const strings = {
            custom: t('promptEditor.custom'),
            standard: t('promptEditor.standard'), 
            modified: t('promptEditor.modified'),
            saving: t('promptEditor.saving'),
            saved: t('promptEditor.saved'),
            resetSuccess: t('promptEditor.resetSuccess'),
            resetting: t('promptEditor.resetting'),
            resetText: t('buttons.reset'),
            saveText: t('buttons.save'),
            title: t('commands.editPrompts'),
            missingPlaceholder: t('promptEditor.missingPlaceholder'),
            missingPlaceholderMultiple: t('promptEditor.missingPlaceholderMultiple'),
            resetConfirm: t('promptEditor.resetConfirm')
        };
        
        // Create or reveal panel using PanelManager
        const panel = panelManager.getOrCreatePanel({
            id: 'aiduinoPromptEditor',
            title: strings.title,
            viewColumn: vscode.ViewColumn.One,
            webviewOptions: { enableScripts: true },
            onDispose: () => {
                if (!isForceClosing && hasUnsavedChanges && context.onPromptEditorClosed) {
                    context.onPromptEditorClosed();
                }
            },
            onReveal: () => {
                // Panel already exists, just return
                return;
            }
        });
        
        // If panel was just revealed (not newly created), return early
        if (panel.webview.html) {
            return;
        }

        // Generate HTML content for all prompt cards
        let promptsHtml = '';
        allowedPrompts.forEach(key => {
            if (promptData.prompts[key]) {
                const commandKey = key === 'hardwareDebug' ? 'debugHelp' : key;
                const title = t(`commands.${commandKey}`) || key;
                const content = escapeHtml(promptData.prompts[key] || '');
                const isModified = promptData.isCustom && 
                    promptData.prompts[key] !== (promptData.defaults[key] || '');

                const cardClass = isModified ? 'prompt-card modified' : 'prompt-card';
                const statusBadgeClass = isModified ? 'status-badge custom' : 'status-badge default';
                const saveButtonClass = isModified ? 'btn-save active' : 'btn-save inactive';
                const resetButtonClass = isModified ? 'btn-reset active' : 'btn-reset inactive';
                const statusText = isModified ? strings.custom : strings.standard;
                const modifiedBadgeHtml = isModified ? `<span class="modified-badge">${strings.modified}</span>` : '';

                promptsHtml += `
                    <div class="${cardClass}">
                        <div class="prompt-header">
                            <h3>${title}</h3>
                            <div class="prompt-actions">
                                <span class="${statusBadgeClass}">${statusText}</span>
                                ${modifiedBadgeHtml}
                                <button class="${resetButtonClass}" onclick="doReset('${key}')">${strings.resetText}</button>
                            </div>
                        </div>
                        <textarea id="prompt-${key}" class="prompt-textarea" rows="8">${content}</textarea>
                        <div class="prompt-footer">
                            <button class="${saveButtonClass}" onclick="doSave('${key}')">${strings.saveText}</button>
                            <span id="status-${key}" class="save-status"></span>
                        </div>
                    </div>
                `;
            }
        });

panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${strings.title}</title>
                ${getSharedCSS()}
                <style>
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }
                    
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        line-height: 1.6;
                        color: var(--vscode-foreground);
                        background: var(--vscode-editor-background);
                        padding: 20px;
                    }
                    
                    .header {
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    
                    .header h1 {
                        color: var(--vscode-textLink-foreground);
                        margin-bottom: 10px;
                        font-size: 28px;
                    }
                    
                    .prompt-card {
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 8px;
                        padding: 20px;
                        margin-bottom: 20px;
                        transition: border-color 0.2s, box-shadow 0.2s;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    
                    .prompt-card:hover {
                        border-color: var(--vscode-textLink-foreground);
                        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                    }
                    
                    .prompt-card.modified {
                        border-left: 4px solid var(--vscode-gitDecoration-modifiedResourceForeground);
                    }
                    
                    .prompt-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 15px;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    
                    .prompt-header h3 {
                        color: var(--vscode-textLink-foreground);
                        font-size: 18px;
                        font-weight: 600;
                        flex: 1;
                        min-width: 200px;
                    }
                    
                    .prompt-actions {
                        display: flex;
                        gap: 8px;
                        align-items: center;
                        flex-wrap: wrap;
                    }
                    
                    .status-badge {
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: bold;
                        text-transform: uppercase;
                    }
                    
                    .status-badge.default {
                        background: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                    }
                    
                    .status-badge.custom {
                        background: var(--vscode-textLink-foreground);
                        color: var(--vscode-editor-background);
                    }
                    
                    .modified-badge {
                        background: var(--vscode-gitDecoration-modifiedResourceForeground);
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: bold;
                    }
                    
                    .prompt-textarea {
                        width: 100%;
                        min-height: 150px;
                        padding: 12px;
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 6px;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                        font-size: 13px;
                        line-height: 1.4;
                        resize: vertical;
                        transition: border-color 0.2s;
                    }
                    
                    .prompt-textarea:focus {
                        outline: none;
                        border-color: var(--vscode-focusBorder);
                        box-shadow: 0 0 0 1px var(--vscode-focusBorder);
                    }
                    
                    .prompt-footer {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 15px;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    
                    .btn-save, .btn-reset {
                        /* Extends .btn-secondary from shared */
                        padding: 8px 16px;
                        font-size: 13px;
                        transition: all 0.2s;
                        white-space: nowrap;
                    }
                    
                    .btn-save.active {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    
                    .btn-save.active:hover {
                        background: var(--vscode-button-hoverBackground);
                        transform: translateY(-1px);
                    }
                    
                    .btn-save.inactive {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-panel-border);
                        opacity: 0.7;
                    }
                    
                    .btn-save.inactive:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                        opacity: 1;
                    }
                    
                    .btn-reset.active {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    
                    .btn-reset.active:hover {
                        background: var(--vscode-button-hoverBackground);
                        transform: translateY(-1px);
                    }
                    
                    .btn-reset.inactive {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-panel-border);
                        opacity: 0.7;
                        cursor: not-allowed;
                    }
                    
                    .btn-reset.inactive:hover {
                        background: var(--vscode-button-secondaryBackground);
                        transform: none;
                        opacity: 0.7;
                    }
                    
                    .save-status {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        font-weight: bold;
                        flex: 1;
                        text-align: right;
                    }
                    
                    .save-status.success {
                        color: var(--vscode-gitDecoration-addedResourceForeground);
                    }
                    
                    .save-status.error {
                        color: var(--vscode-errorForeground);
                    }
                    
                    @media (max-width: 768px) {
                        .prompt-header {
                            flex-direction: column;
                            align-items: flex-start;
                        }
                        
                        .prompt-header h3 {
                            min-width: unset;
                        }
                        
                        .prompt-actions {
                            justify-content: flex-start;
                            width: 100%;
                        }
                        
                        .prompt-footer {
                            flex-direction: column;
                            align-items: flex-start;
                        }
                        
                        .save-status {
                            text-align: left;
                        }
                    }
                </style>
            </head>
            <body>
                ${featureUtils.generateContextMenu(t, { showPaste: true }).html}
                
                <div class="header">
                    <h1>${strings.title}</h1>
                    ${t('promptEditor.placeholderWarning')}
                </div>
                
                <div class="prompts-container">
                    ${promptsHtml}
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    const strings = ${JSON.stringify(strings)};
                    
                    // Context menu
                    ${featureUtils.generateContextMenu(t, { showPaste: true }).script}
                    
                    // === PROMPT EDITOR LOGIC ===
                    // Store original values for real-time change detection
                    const originalValues = {};
                    document.querySelectorAll('.prompt-textarea').forEach(textarea => {
                        const key = textarea.id.replace('prompt-', '');
                        originalValues[key] = textarea.value;
                    });

                    // Real-time change detection
                    document.querySelectorAll('.prompt-textarea').forEach(textarea => {
                        textarea.addEventListener('input', function() {
                            const key = this.id.replace('prompt-', '');
                            const isModified = this.value !== originalValues[key];
                            updateCardStatus(key, isModified);

                            // Store change in backend
                            vscode.postMessage({
                                command: 'storeChange',
                                key: key,
                                value: this.value
                            });
                        });
                    });
    
                    function doSave(key) {
                        const textarea = document.getElementById('prompt-' + key);
                        const status = document.getElementById('status-' + key);
    
                        if (key === 'explainError') {
                            if (!textarea.value.includes('{0}') || !textarea.value.includes('{1}') || !textarea.value.includes('{2}')) {
                                status.textContent = strings.missingPlaceholderMultiple;
                                status.className = 'save-status error';
                                return;
                            }
                        } else {
                            if (!textarea.value.includes('{0}')) {
                                status.textContent = strings.missingPlaceholder;
                                status.className = 'save-status error';
                                return;
                            }
                        }
    
                        status.textContent = strings.saving + '...';
                        status.className = 'save-status';
    
                        vscode.postMessage({
                            command: 'savePrompt',
                            key: key,
                            value: textarea.value
                        });
                    }
    
                    function doReset(key) {
                        const resetButton = document.querySelector('.btn-reset[onclick*="' + key + '"]');
                        if (resetButton && resetButton.classList.contains('inactive')) {
                            return;
                        }
                        
                        const status = document.getElementById('status-' + key);
                        status.textContent = strings.resetting + '...';
                        status.className = 'save-status';
                        
                        vscode.postMessage({
                            command: 'resetPrompt',
                            key: key
                        });
                    }
                    
                    function updateCardStatus(key, isModified) {
                        const textarea = document.getElementById('prompt-' + key);
                        if (!textarea) return;
    
                        const card = textarea.closest('.prompt-card');
                        const statusBadge = card.querySelector('.status-badge');            
                        const saveButton = card.querySelector('.btn-save');
                        const resetButton = card.querySelector('.btn-reset');
                        let modifiedBadge = card.querySelector('.modified-badge');
    
                        // Toggle modified state
                        card.classList.toggle('modified', isModified);
    
                        // Update status badge
                        statusBadge.textContent = isModified ? strings.custom : strings.standard;
                        statusBadge.className = isModified ? 'status-badge custom' : 'status-badge default';
    
                        // Update buttons
                        if (saveButton) {
                            saveButton.className = isModified ? 'btn-save active' : 'btn-save inactive';
                        }
                        if (resetButton) {
                            resetButton.className = isModified ? 'btn-reset active' : 'btn-reset inactive';
                        }
    
                        // Handle modified badge
                        if (isModified && !modifiedBadge) {
                            modifiedBadge = document.createElement('span');
                            modifiedBadge.className = 'modified-badge';
                            modifiedBadge.textContent = strings.modified;
                            statusBadge.parentNode.insertBefore(modifiedBadge, statusBadge.nextSibling);
                        } else if (!isModified && modifiedBadge) {
                            modifiedBadge.remove();
                        }                   
                    }
                    
                    // Handle backend messages
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        if (message.command === 'saveConfirmed') {
                            const status = document.getElementById('status-' + message.key);
                            const textarea = document.getElementById('prompt-' + message.key);
                            
                            if (status) {
                                status.textContent = strings.saved;
                                status.className = 'save-status success';
                                setTimeout(() => {
                                    status.textContent = '';
                                }, 3000);
                            }
                            
                            if (textarea) {
                                const key = message.key;
                                const isModified = textarea.value !== originalValues[key];
                                updateCardStatus(key, isModified);
                            }
                        }
                        
                        if (message.command === 'promptReset') {
                            const textarea = document.getElementById('prompt-' + message.key);
                            const status = document.getElementById('status-' + message.key);
                            
                            if (textarea && message.value !== undefined) {
                                textarea.value = message.value;
                                originalValues[message.key] = message.value;
                                updateCardStatus(message.key, false);
                            }
                            
                            if (status) {
                                status.textContent = strings.resetSuccess;
                                status.className = 'save-status success';
                                setTimeout(() => {
                                    status.textContent = '';
                                }, 3000);
                            }
                        }
                        // Handle paste with change detection
                        if (message.command === 'pasteText' && message.triggerInput) {
                            // Wait for paste to complete, then trigger input event
                            setTimeout(() => {
                                const activeElement = document.activeElement;
                                if (activeElement && activeElement.classList.contains('prompt-textarea')) {
                                    const inputEvent = new Event('input', { bubbles: true });
                                    activeElement.dispatchEvent(inputEvent);
                                }
                            }, 10);
                        }
                    });
                </script>
              </body>
            </html>
        `;
        // Backend message handler with custom close logic
        featureUtils.setupStandardMessageHandler(panel, context, {
            savePrompt: async (message) => {
                try {
                    promptManager.updatePrompt(message.key, message.value);

                    // Only remove from pending changes if save was successful
                    delete pendingChanges[message.key];
                    hasUnsavedChanges = Object.keys(pendingChanges).length > 0;
        
                    panel.webview.postMessage({
                        command: 'saveConfirmed',
                        key: message.key
                    });

                    if (context.setPromptEditorChanges) {
                        context.setPromptEditorChanges(hasUnsavedChanges);
                    }
                } catch (error) {
                    // Keep in pendingChanges if save failed
                    panel.webview.postMessage({
                        command: 'error',
                        key: message.key,
                        text: error.message
                    });
                }
            },
            resetPrompt: async (message) => {
                // Remove from pending changes when reset
                delete pendingChanges[message.key];
                hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

                const promptDefaultValue = promptManager.defaultPrompts?.[message.key] || '';
                if (promptDefaultValue) {
                    if (promptManager.customPrompts && promptManager.customPrompts[message.key]) {
                        delete promptManager.customPrompts[message.key];
                        promptManager.saveCustomPrompts();
                        promptManager.cleanupIfUnchanged();
                    }   

                    panel.webview.postMessage({
                        command: 'promptReset',
                        key: message.key,
                        value: promptDefaultValue
                    });
                }

                // Use actual state instead of hardcoded false
                if (context.setPromptEditorChanges) {
                    context.setPromptEditorChanges(hasUnsavedChanges);
                }
            },      
            hasUnsavedChanges: async (message) => {
                hasUnsavedChanges = message.hasChanges;
                if (context.setPromptEditorChanges) {
                    context.setPromptEditorChanges(message.hasChanges);
                }
            },      
            storeChange: async (message) => {
                // Store pending changes for close protection
                pendingChanges[message.key] = message.value;
                hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

                if (context.setPromptEditorChanges) {
                    context.setPromptEditorChanges(hasUnsavedChanges);
                }
            },  
            pasteFromClipboard: async (message) => {        
                const clipboardText = await vscode.env.clipboard.readText();
                panel.webview.postMessage({
                    command: 'pasteText',
                    text: clipboardText,
                    triggerInput: true
                });
            },  
            closePanel: async (message) => {
                if (hasUnsavedChanges && !isForceClosing) {
                    const choice = await vscode.window.showWarningMessage(
                        context.t('promptEditor.changesLostDialog'),
                        context.t('buttons.saveChanges'),
                        context.t('buttons.discard')
                    );
                
                    if (choice === context.t('buttons.saveChanges')) {
                        Object.entries(pendingChanges).forEach(([key, value]) => {
                            promptManager.updatePrompt(key, value);
                        });
                        vscode.window.showInformationMessage(context.t('promptEditor.changesSaved'));
                    }
                }
                
                isForceClosing = true;
                panel.dispose();
            }   
        });
    } catch (error) {
        const { t } = context;
        vscode.window.showErrorMessage(`${t('errors.saveFailed', error.message) || 'Error'}: ${error.message}`);
    }
}

/**
 * Edit prompts with proper setup (wrapper for command)
 * @param {Object} context - Extension context with dependencies
 */
function editPrompts(context) {
    // Set editor open flag
    if (context.setPromptEditorOpen) {
        context.setPromptEditorOpen(true);
    }

    // Create extended context with close callback
    const extendedContext = {
        ...context,
        onPromptEditorClosed: () => {
            if (context.setPromptEditorOpen) {
                context.setPromptEditorOpen(false);
            }
        }
    };

    return showPromptEditor(extendedContext);
}

module.exports = {
    showPromptEditor,
    editPrompts
};
