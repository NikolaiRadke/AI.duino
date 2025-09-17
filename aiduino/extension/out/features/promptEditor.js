/*
 * AI.duino - Prompt Editor Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */
const vscode = require('vscode');
const { escapeHtml } = require('../shared');

/**
 * Show prompt editor with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function showPromptEditor(context) {
    try {
        const { t, promptManager } = context;
        
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
            resetText: t('buttons.reset'),
            saveText: t('buttons.save'),
            title: t('commands.editPrompts')
        };
        
        const panel = vscode.window.createWebviewPanel(
            'aiduinoPromptEditor',
            strings.title,
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

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
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
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
                        font-style: italic;
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
                <div class="header">
                    <h1>${strings.title}</h1>
                </div>
                
                <div class="prompts-container">
                    ${promptsHtml}
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    const strings = ${JSON.stringify(strings)};
                    
                    // Store original values for real-time change detection
                    const originalValues = {};
                    document.querySelectorAll('.prompt-textarea').forEach(textarea => {
                        const key = textarea.id.replace('prompt-', '');
                        originalValues[key] = textarea.value;
                    });
    
                    function doSave(key) {
                        const textarea = document.getElementById('prompt-' + key);
                        const status = document.getElementById('status-' + key);
                        
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
                        status.textContent = 'Resetting...';
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
                        
                        if (isModified) {
                            card.classList.add('modified');
                            statusBadge.textContent = strings.custom;
                            statusBadge.className = 'status-badge custom';
                            
                            if (saveButton) {
                                saveButton.className = 'btn-save active';
                            }
                            if (resetButton) {
                                resetButton.className = 'btn-reset active';
                            }
                            
                            if (!modifiedBadge) {
                                modifiedBadge = document.createElement('span');
                                modifiedBadge.className = 'modified-badge';
                                modifiedBadge.textContent = strings.modified;
                                statusBadge.parentNode.insertBefore(modifiedBadge, statusBadge.nextSibling);
                            }
                        } else {
                            card.classList.remove('modified');
                            statusBadge.textContent = strings.standard;
                            statusBadge.className = 'status-badge default';
                            
                            if (saveButton) {
                                saveButton.className = 'btn-save inactive';
                            }
                            if (resetButton) {
                                resetButton.className = 'btn-reset inactive';
                            }
                            
                            if (modifiedBadge) {
                                modifiedBadge.remove();
                            }
                        }
                    }
                    
                    // Real-time change detection
                    document.querySelectorAll('.prompt-textarea').forEach(textarea => {
                        textarea.addEventListener('input', function() {
                            const key = this.id.replace('prompt-', '');
                            const isModified = this.value !== originalValues[key];
                            updateCardStatus(key, isModified);
                        });
                    });
                    
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
                    });
                </script>
            </body>
            </html>
        `;

        // Backend message handler
        panel.webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message.command) {
                    case 'savePrompt':
                        promptManager.updatePrompt(message.key, message.value);
                        panel.webview.postMessage({
                            command: 'saveConfirmed',
                            key: message.key
                        });
                        break;
                
                    case 'resetPrompt':
                        const defaultValue = promptManager.defaultPrompts?.[message.key] || '';
                        if (defaultValue) {
                            if (promptManager.customPrompts && promptManager.customPrompts[message.key]) {
                                delete promptManager.customPrompts[message.key];
                                promptManager.saveCustomPrompts();
                            }
                            
                            panel.webview.postMessage({
                                command: 'promptReset',
                                key: message.key,
                                value: defaultValue
                            });
                        }
                        break;
                }
            } catch (error) {
                panel.webview.postMessage({
                    command: 'error',
                    key: message.key || 'unknown',
                    text: error.message
                });
            }
        });
    } catch (error) {
        const { t } = context;
        vscode.window.showErrorMessage(`${t('errors.saveFailed', error.message) || 'Error'}: ${error.message}`);
    }
}

/**
 * Get fresh localized strings for current language
 * @param {Function} t - Translation function
 * @returns {Object} Localized strings object
 */
function getLocalizedStrings(t) {
    return {
        custom: t('promptEditor.custom') || 'Custom',
        standard: t('promptEditor.standard') || 'Standard',
        modified: t('promptEditor.modified') || 'Modified',
        saving: t('promptEditor.saving') || 'Saving',
        saved: t('promptEditor.saved') || 'Saved',
        resetSuccess: t('promptEditor.resetSuccess') || 'Reset successful',
        resetText: t('buttons.reset') || 'Reset',
        saveText: t('buttons.save') || 'Save',
        title: t('commands.editPrompts') || 'Edit Prompts'
    };
}

module.exports = {
    showPromptEditor
};
