/**
 * features/promptEditor.js - Clean Final Version
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

        // Generate prompt cards with modern styling
        let promptsHtml = '';
        allowedPrompts.forEach(key => {
            if (promptData.prompts[key]) {
                const commandKey = key === 'hardwareDebug' ? 'debugHelp' : key;
                const title = t(`commands.${commandKey}`) || key;
                const content = escapeHtml(promptData.prompts[key] || '');
                const isModified = promptData.isCustom && 
                    promptData.prompts[key] !== (promptData.defaults[key] || '');
                
                promptsHtml += `
    <div class="prompt-card ${isModified ? 'modified' : ''}">
        <div class="prompt-header">
            <h3>${title}</h3>
            <div class="prompt-actions">
                ${isModified ? `<span class="modified-badge">${t('prompts.modified') || 'Modified'}</span>` : ''}
                <button class="btn-secondary" data-action="reset" data-key="${key}">
                    ${t('buttons.reset') || 'Reset'}
                </button>

            </div>
        </div>
        <textarea 
            id="prompt-` + key + `" 
            class="prompt-textarea"
            rows="8"
        >${content}</textarea>
        <div class="prompt-footer">
            <button class="btn-primary" data-action="save" data-key="${key}">
                ${t('buttons.save') || 'Save'}
            </button>
            <span id="status-` + key + `" class="save-status"></span>
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
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                    
                    .header-info {
                        background: var(--vscode-textBlockQuote-background);
                        padding: 15px;
                        border-radius: 8px;
                        margin-top: 15px;
                        border-left: 4px solid var(--vscode-textLink-foreground);
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
                    }
                    
                    .prompt-header h3 {
                        color: var(--vscode-textLink-foreground);
                        font-size: 18px;
                        font-weight: 600;
                    }
                    
                    .prompt-actions {
                        display: flex;
                        gap: 10px;
                        align-items: center;
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
                    }
                    
                    .btn-primary, .btn-secondary {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                        transition: all 0.2s;
                    }
                    
                    .btn-primary {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    
                    .btn-primary:hover {
                        background: var(--vscode-button-hoverBackground);
                        transform: translateY(-1px);
                    }
                    
                    .btn-secondary {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-panel-border);
                    }
                    
                    .btn-secondary:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                        transform: translateY(-1px);
                    }
                    
                    .save-status {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        font-style: italic;
                    }
                    
                    .save-status.success {
                        color: var(--vscode-gitDecoration-addedResourceForeground);
                    }
                    
                    @media (max-width: 768px) {
                        .prompt-header {
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 10px;
                        }
                        
                        .prompt-footer {
                            flex-direction: column;
                            gap: 10px;
                            align-items: flex-start;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${t('commands.editPrompts') || 'Edit Prompts'}</h1>
                    <div class="header-info">
                        <strong>${t('promptEditor.status') || 'Status'}:</strong> 
                        ${promptData.isCustom ? 
                            (t('promptEditor.usingCustom') || 'Using Custom Prompts') : 
                            (t('promptEditor.usingDefaults') || 'Using Default Prompts')
                        }
                    </div>
                </div>
                
                <div class="prompts-container">
                    ${promptsHtml}
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    function savePrompt(key) {
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
                    
                    function resetPrompt(key) {
        if (confirm('${t('promptEditor.confirmReset') || 'Reset prompt to default?'}')) {
            vscode.postMessage({
                command: 'resetPrompt',
                key: key
            });
        }
    }
                    
                    // Handle messages from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        switch (message.command) {
                            case 'saveConfirmed':
                                const status = document.getElementById('status-' + message.key);
                                status.textContent = '${t('promptEditor.saved') || 'Saved'}';
                                status.className = 'save-status success';
                                setTimeout(() => {
                                    status.textContent = '';
                                }, 3000);
                                break;

                            case 'promptReset':
                                const textarea = document.getElementById('prompt-' + message.key);
                                if (textarea) {
                                    textarea.value = message.value;
                                }
                                break;
                        }
                    });
                    document.addEventListener('click', function(event) {
                        const action = event.target.dataset.action;
                        const key = event.target.dataset.key;
    
                        if (action === 'reset' && key) {
                            vscode.postMessage({
                                command: 'resetPrompt',
                                key: key
                            });
                        }
                    });
                </script>
            </body>
            </html>
        `;

        // Enhanced message handler
        panel.webview.onDidReceiveMessage(async (message) => {
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
                        promptManager.updatePrompt(message.key, defaultValue);
                        panel.webview.postMessage({
                            command: 'promptReset',
                            key: message.key,
                            value: defaultValue
                        });
                    }
                    break;
            }
        });
    } catch (error) {
        const vscode = require('vscode');
        vscode.window.showErrorMessage('Error: ' + error.message);
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
