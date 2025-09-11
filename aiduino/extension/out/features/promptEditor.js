/**
 * features/promptEditor.js - Finale Version mit Lokalisierung
 */

const vscode = require('vscode');

async function showPromptEditor(context) {
    try {
        const { t, promptManager } = context;
        
        const promptData = promptManager.getAllPrompts();
        const allowedPrompts = ['addComments', 'improveCode', 'hardwareDebug', 'explainCode'];
        
        const panel = vscode.window.createWebviewPanel(
            'aiduinoPromptEditor',
            t('commands.editPrompts') || 'Edit Prompts',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        // HTML-Generierung mit Status-Badges und Button-Zuständen
        let promptsHtml = '';
        allowedPrompts.forEach(key => {
            if (promptData.prompts[key]) {
                const commandKey = key === 'hardwareDebug' ? 'debugHelp' : key;
                const title = t(`commands.${commandKey}`) || key;
                const content = escapeHtml(promptData.prompts[key] || '');
                const isModified = promptData.isCustom && 
                    promptData.prompts[key] !== (promptData.defaults[key] || '');

                // Lokalisierte Strings
                const statusText = isModified ? 
                    (t('promptEditor.custom') || 'Custom') : 
                    (t('promptEditor.standard') || 'Standard');
                const modifiedText = t('promptEditor.modified') || 'Modified';
                const resetText = t('buttons.reset') || 'Reset';
                const saveText = t('buttons.save') || 'Save';

                // CSS-Klassen basierend auf Zustand
                const cardClass = isModified ? 'prompt-card modified' : 'prompt-card';
                const statusBadgeClass = isModified ? 'status-badge custom' : 'status-badge default';
                const saveButtonClass = isModified ? 'btn-save active' : 'btn-save inactive';
                const resetButtonClass = isModified ? 'btn-reset active' : 'btn-reset inactive';
                const modifiedBadgeHtml = isModified ? '<span class="modified-badge">' + modifiedText + '</span>' : '';

                promptsHtml += '<div class="' + cardClass + '">';
                promptsHtml += '<div class="prompt-header">';
                promptsHtml += '<h3>' + title + '</h3>';
                promptsHtml += '<div class="prompt-actions">';
                promptsHtml += '<span class="' + statusBadgeClass + '">' + statusText + '</span>';
                promptsHtml += modifiedBadgeHtml;
                promptsHtml += '<button class="' + resetButtonClass + '" onclick="doReset(\'' + key + '\')">' + resetText + '</button>';
                promptsHtml += '</div>';
                promptsHtml += '</div>';
                promptsHtml += '<textarea id="prompt-' + key + '" class="prompt-textarea" rows="8">' + content + '</textarea>';
                promptsHtml += '<div class="prompt-footer">';
                promptsHtml += '<button class="' + saveButtonClass + '" onclick="doSave(\'' + key + '\')">' + saveText + '</button>';
                promptsHtml += '<span id="status-' + key + '" class="save-status"></span>';
                promptsHtml += '</div>';
                promptsHtml += '</div>';
            }
        });

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${t('commands.editPrompts') || 'Edit Prompts'}</title>
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
                    
                    /* Save Button States */
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
                    
                    /* Reset Button States */
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
                    <h1>${t('commands.editPrompts') || 'Edit Prompts'}</h1>
                </div>
                
                <div class="prompts-container">
                    ${promptsHtml}
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    // Store original values for real-time change detection
                    const originalValues = {};
                    document.querySelectorAll('.prompt-textarea').forEach(textarea => {
                        const key = textarea.id.replace('prompt-', '');
                        originalValues[key] = textarea.value;
                    });
    
                    function doSave(key) {
                        const textarea = document.getElementById('prompt-' + key);
                        const status = document.getElementById('status-' + key);
                        
                        status.textContent = '${t('promptEditor.saving') || 'Saving'}...';
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
                            return; // Don't reset if already at default
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
                            // Modified state
                            card.classList.add('modified');
                            statusBadge.textContent = 'Custom';
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
                                modifiedBadge.textContent = '${t('promptEditor.modified') || 'Modified'}';
                                statusBadge.parentNode.insertBefore(modifiedBadge, statusBadge.nextSibling);
                            }
                        } else {
                            // Default state
                            card.classList.remove('modified');
                            statusBadge.textContent = 'Standard';
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
                                status.textContent = '${t('promptEditor.saved') || 'Saved'}';
                                status.className = 'save-status success';
                                setTimeout(() => {
                                    status.textContent = '';
                                }, 3000);
                            }
                            
                            // Update button states after save
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
                                status.textContent = '${t('promptEditor.resetSuccess') || 'Reset successful'}';
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
        vscode.window.showErrorMessage(`${t('errors.saveFailed', error.message) || 'Error'}: ${error.message}`);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

module.exports = {
    showPromptEditor
};
