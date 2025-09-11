/**
 * features/explainError.js - Error Explanation Feature
 * Explains Arduino compilation errors using AI with HTML panel display
 */

const vscode = require('vscode');
const shared = require('../shared');
const { showProgressWithCancel } = require('../utils/ui');

/**
 * Main explainError function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function explainError(context) {
    const { t, callAI, executionStates, minimalModelManager, currentModel, handleApiError } = context;
    
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.ERROR)) {
        vscode.window.showInformationMessage("Error Explanation is already running! Please wait...");
        return;
    }
    
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('.ino')) {
            vscode.window.showWarningMessage(t('messages.openInoFile'));
            return;
        }
        
        // For Arduino files, directly ask for error
        const errorInput = await vscode.window.showInputBox({
            prompt: context.promptManager.getPrompt('pasteError'),
            placeHolder: t('placeholders.errorExample'),
            ignoreFocusOut: true
        });
        
        if (!errorInput) return;
        
        // Get code context around current cursor position
        const line = editor.selection.active.line;
        const startLine = Math.max(0, line - 5);
        const endLine = Math.min(editor.document.lineCount - 1, line + 5);
        const codeContext = editor.document.getText(
            new vscode.Range(startLine, 0, endLine, Number.MAX_VALUE)
        );
        
        const prompt = context.promptManager.getPrompt('explainError', errorInput, line + 1, codeContext) + shared.getBoardContext();
        
        try {
            const model = minimalModelManager.providers[currentModel];
            
            // Use vscode.window.withProgress like askAI
            response = await showProgressWithCancel(
                    t('progress.analyzingError', model.name),
                    callAI(prompt),
                    t
            );
            // Create WebviewPanel for error explanation
            const panel = vscode.window.createWebviewPanel(
                'aiError',
                t('panels.errorExplanation'),
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );
            
            panel.webview.html = createErrorExplanationHtml(
                errorInput,
                line + 1,
                response,
                currentModel,
                t
            );
            
        } catch (error) {
            // Silent catch - VS Code internal timing issue
        }
    } finally {
        // Always cleanup
        executionStates.stop(executionStates.OPERATIONS.ERROR);
    }
}

/**
 * Create HTML content for error explanation panel
 * @param {string} error - The error message
 * @param {number} line - Line number where error occurred
 * @param {string} explanation - AI explanation of the error
 * @param {string} modelId - Current AI model ID
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createErrorExplanationHtml(error, line, explanation, modelId, t) {
    // Get model info for badge
    const modelBadge = `<span style="background: #6B46C1; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">AI Error Analysis</span>`;
    
    // Escape HTML and replace newlines with <br> for HTML display
    const htmlExplanation = shared.escapeHtml(explanation).replace(/\n/g, '<br>');
    
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
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
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
                .section {
                    margin: 20px 0;
                    padding: 15px;
                    background: #f5f5f5;
                    border-radius: 8px;
                }
                pre {
                    background: #1e1e1e;
                    color: #d4d4d4;
                    padding: 15px;
                    border-radius: 4px;
                    overflow-x: auto;
                }
                .solution {
                    background: #e8f5e9;
                    border-left: 4px solid #4caf50;
                    padding: 15px;
                    margin: 15px 0;
                }
                button {
                    background: #2196F3;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                button:hover {
                    background: #1976D2;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🔧 ${t('html.errorExplanation')}</h1>
                ${modelBadge}
            </div>
            
            <div class="error-box">
                <div class="error-title">${t('html.errorInLine', line)}:</div>
                <code>${shared.escapeHtml(error)}</code>
            </div>
            
            <div class="explanation">
                ${htmlExplanation}
            </div>
            
            <br>
            <button onclick="copyToClipboard()">📋 ${t('buttons.copySolution')}</button>
            
            <script>
                function copyToClipboard() {
                    const text = document.querySelector('.explanation').innerText;
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
    explainError
};
