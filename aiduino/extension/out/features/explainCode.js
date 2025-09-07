/**
 * features/explainCode.js - Code Explanation Feature
 * Extracts and explains selected Arduino code using AI
 */

const vscode = require('vscode');
const shared = require('../shared');
const { showProgressWithCancel } = require('../utils/ui');

/**
 * Main explainCode function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function explainCode(context) {
    const { t, callAI, executionStates, minimalModelManager, currentModel, handleApiError } = context;
    
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.EXPLAIN)) {
        vscode.window.showInformationMessage("Code Explanation is already running! Please wait...");
        return;
    }
    
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage(t('messages.noEditor'));
            return;
        }
        
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (!selectedText.trim()) {
            vscode.window.showWarningMessage(t('messages.selectCodeToExplain'));
            return;
        }
        
        const prompt = t('prompts.explainCode', selectedText) + shared.getBoardContext();
        const model = minimalModelManager.providers[currentModel];
        
        let response;
        try {
            response = await showProgressWithCancel(
                t('progress.explaining', model.name),
                callAI(prompt),
                t
            );
        } catch (progressError) {
            throw progressError;
        }
        
        // Wrap long lines
        const wrappedResponse = response.split('\n').map(line => 
            line.length > 80 ? shared.wrapText(line, 80) : line
        ).join('\n');
        
        // Create formatted content
        const formattedContent = [
            `🤖 ${t('output.explanationFrom', model.name.toUpperCase())}`,
            '='.repeat(50),
            '',
            wrappedResponse
        ].join('\n');
        
        // Create and show document with improved error handling
        let documentShown = false;
        
        try {
            const doc = await vscode.workspace.openTextDocument({
                content: formattedContent,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            
       } catch (docError) {
         // Silent catch - VS Code internal timing issue
        }
        
    } catch (error) {
        handleApiError(error);
    } finally {
        executionStates.stop(executionStates.OPERATIONS.EXPLAIN);
    }
}

module.exports = {
    explainCode
};
