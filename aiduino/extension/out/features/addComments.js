/**
 * features/addComments.js - Add Comments Feature
 * Adds helpful comments to selected Arduino code using AI
 */

const vscode = require('vscode');
const shared = require('../shared');

/**
 * Main addComments function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function addComments(context) {
    const { t, callAI, executionStates, minimalModelManager, currentModel, handleApiError, globalContext } = context;
    
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.COMMENTS)) {
        vscode.window.showInformationMessage("Add Comments is already running! Please wait...");
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
            vscode.window.showWarningMessage(t('messages.selectCodeToComment'));
            return;
        }
        
        // Load saved custom instructions for comments
        const savedInstructions = globalContext.globalState.get('aiduino.commentInstructions', '');
        
        // Dialog for custom instructions
        const customInstructions = await vscode.window.showInputBox({
            prompt: t('prompts.commentInstructions'),
            placeHolder: t('placeholders.commentInstructions'),
            value: savedInstructions,
            ignoreFocusOut: true
        });
        
        // Cancel if user pressed Cancel
        if (customInstructions === undefined) {
            return;
        }
        
        // Save instructions for next time
        globalContext.globalState.update('aiduino.commentInstructions', customInstructions);
        
        // Build prompt
        let prompt = t('prompts.addComments', selectedText) + shared.getBoardContext();
    
        // Add custom instructions if provided
        if (customInstructions && customInstructions.trim()) {
            const instructions = customInstructions.split(',').map(s => s.trim()).join('\n- ');
            prompt += '\n\n' + t('prompts.additionalInstructions', instructions);
        }
    
        prompt += '\n\n' + t('prompts.addCommentsSuffix');
        
        const model = minimalModelManager.providers[currentModel];
        
        let response;
        try {
            response = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: t('progress.addingComments', model.name),
                cancellable: false
            }, async () => {
                const result = await callAI(prompt);
                return result;
            });
        } catch (progressError) {
            throw progressError;
        }
        
        // Remove markdown code block markers
        let cleanedResponse = response;
        let extractedCode = '';
        
        // Search for pattern ```cpp...``` and extract only the code
        const codeBlockMatch = cleanedResponse.match(/```(?:cpp|c\+\+|arduino)?\s*\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
            extractedCode = codeBlockMatch[1].trim();
        } else {
            // Fallback
            extractedCode = cleanedResponse;
            extractedCode = extractedCode.replace(/^```(?:cpp|c\+\+|arduino)?\s*\n?/i, '');
            const endIndex = extractedCode.indexOf('```');
            if (endIndex !== -1) {
                extractedCode = extractedCode.substring(0, endIndex);
            }
            extractedCode = extractedCode.trim();
        }
        
        // Create display content with custom instructions info
        let displayContent = extractedCode;
        
        // Add custom instructions footer if present
        if (customInstructions && customInstructions.trim()) {
            displayContent += '\n\n';
            displayContent += '/* ========================================\n';
            displayContent += '   COMMENT INSTRUCTIONS USED:\n';
            
            const wrappedInstructions = shared.wrapText(customInstructions, 80);
            wrappedInstructions.split('\n').forEach(line => {
                displayContent += `   ${line}\n`;
            });
            
            displayContent += '   ======================================== */';
        }
        
        // Add board info if detected
        const board = shared.detectArduinoBoard();
        if (board) {
            displayContent += '\n';
            displayContent += `// Board: ${board}`;
        }
        
        // Create and show document
        try {
            const doc = await vscode.workspace.openTextDocument({
                content: displayContent,
                language: 'cpp'
            });
            
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        } catch (docError) {
            vscode.window.showErrorMessage('Failed to display document: ' + (docError.message || docError));
        }
        
        // Choice dialog
        const choice = await vscode.window.showInformationMessage(
            t('messages.commentsAdded'),
            t('buttons.replaceOriginal'),
            t('buttons.keepBoth')
        );
        
        if (choice === t('buttons.replaceOriginal')) {
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, extractedCode);  // Only code without footer
            });
            vscode.window.showInformationMessage(t('messages.codeReplaced'));
        }
        
    } catch (error) {
        errorHandling.handleApiError(error, getDependencies());
    } finally {
        // Always cleanup
        executionStates.stop(executionStates.OPERATIONS.COMMENTS);
    }
}

module.exports = {
    addComments
};
