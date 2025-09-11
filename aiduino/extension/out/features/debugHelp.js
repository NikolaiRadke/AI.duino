/**
 * features/debugHelp.js - Debug Help Feature
 * Provides various debugging assistance for Arduino projects
 */

const vscode = require('vscode');
const shared = require('../shared');
const { showProgressWithCancel } = require('../utils/ui');

/**
 * Main debugHelp function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function debugHelp(context) {
    const { t, callAI, executionStates, minimalModelManager, currentModel, handleApiError } = context;
    
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.DEBUG)) {
        vscode.window.showInformationMessage("Debug Help is already running! Please wait...");
        return;
    }
    
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        
        const options = [
            {
                label: '$(search) ' + t('debug.analyzeSerial'),
                description: t('debug.analyzeSerialDesc'),
                value: 'serial'
            },
            {
                label: '$(circuit-board) ' + t('debug.hardwareProblem'),
                description: t('debug.hardwareProblemDesc'),
                value: 'hardware'
            },
            {
                label: '$(watch) ' + t('debug.addDebugCode'),
                description: t('debug.addDebugCodeDesc'),
                value: 'debug'
            },
            {
                label: '$(pulse) ' + t('debug.timingProblems'),
                description: t('debug.timingProblemsDesc'),
                value: 'timing'
            }
        ];
        
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: t('debug.selectHelp')
        });
        
        if (!selected) return;
        
        let prompt = '';
        let needsCode = true;
        
        switch (selected.value) {
            case 'serial':
                const serialOutput = await vscode.window.showInputBox({
                    prompt: context.promptManager.getPrompt('pasteSerial'),
                    placeHolder: t('placeholders.serialExample'),
                    ignoreFocusOut: true
                });
                if (!serialOutput) return;
                
                const codeForSerial = editor.selection.isEmpty ? '' : editor.document.getText(editor.selection);
                prompt = context.promptManager.getPrompt('analyzeSerial', serialOutput, codeForSerial);
                needsCode = false;
                break;
                
            case 'hardware':
                const hardwareCode = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
                prompt = context.promptManager.getPrompt('hardwareDebug', hardwareCode) + shared.getBoardContext();  
                break;
                
            case 'debug':
                const debugCode = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
                prompt = context.promptManager.getPrompt('addDebugStatements', debugCode); 
                break;
                
            case 'timing':
                const timingCode = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
                prompt = context.promptManager.getPrompt('analyzeTiming', timingCode) + shared.getBoardContext();  
                break;
        }
        
        if (needsCode && editor.selection.isEmpty) {
            vscode.window.showWarningMessage(
                t('messages.selectRelevantCode')
            );
            return;
        }
        
        try {
            const model = minimalModelManager.providers[currentModel];
            
            let response;
            try {
                response = await showProgressWithCancel(
                    t('progress.analyzingProblem', model.name),
                    callAI(prompt),
                    t
                );
            } catch (progressError) {
                throw progressError;
            }
            
            const panel = vscode.window.createWebviewPanel(
                'aiDebug',
                t('panels.debugHelp'),
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );
            panel.webview.html = createDebugHelpHtml(selected.label, response, currentModel, t);
        } catch (error) {
            // Silent catch - VS Code internal timing issue
        }
    } finally {
        // Always cleanup
        executionStates.stop(executionStates.OPERATIONS.DEBUG);
    }
}

/**
 * Create HTML content for debug help panel
 * @param {string} title - Debug help title/type
 * @param {string} content - AI response content
 * @param {string} modelId - Current AI model ID
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createDebugHelpHtml(title, content, modelId, t) {
    const modelBadge = `<span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Debug Assistant</span>`;
    
    const htmlContent = shared.escapeHtml(content).replace(/\n/g, '<br>');
    
    return `
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
                }
                button:hover {
                    background: #45a049;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${shared.escapeHtml(title)}</h1>
                ${modelBadge}
            </div>
            <div class="content">${htmlContent}</div>
            
            <button onclick="copyToClipboard()">📋 ${t('buttons.copy')}</button>
            
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
}

module.exports = {
    debugHelp
};
