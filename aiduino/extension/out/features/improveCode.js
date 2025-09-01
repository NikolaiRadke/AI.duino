/**
 * features/improveCode.js - Code Improvement Feature
 * Improves and optimizes selected Arduino code using AI
 */

const vscode = require('vscode');
const shared = require('../shared');

/**
 * Main improveCode function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function improveCode(context) {
    const { t, callAI, executionStates, minimalModelManager, currentModel, handleApiError, globalContext } = context;
    
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.IMPROVE)) {
        vscode.window.showInformationMessage("Code Improvement is already running! Please wait...");
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
            vscode.window.showWarningMessage(t('messages.selectCodeToImprove'));
            return;
        }
        
        const savedInstructions = globalContext.globalState.get('aiduino.customInstructions', '');
        
        const customInstructions = await vscode.window.showInputBox({
            prompt: t('prompts.customInstructions'),
            placeHolder: t('placeholders.customInstructions'),
            value: savedInstructions,
            ignoreFocusOut: true
        });
        
        if (customInstructions === undefined) {
            return;
        }
        
        globalContext.globalState.update('aiduino.customInstructions', customInstructions);
        
        let prompt = t('prompts.improveCode', selectedText) + shared.getBoardContext();
        
        if (customInstructions && customInstructions.trim()) {
            const instructions = customInstructions.split(',').map(s => s.trim()).join('\n- ');
            prompt += '\n\n' + t('prompts.additionalInstructions', instructions);
        }
        
        prompt += '\n\n' + t('prompts.improveCodeSuffix');
        
        const model = minimalModelManager.providers[currentModel];
        
        const response = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: t('progress.optimizing', model.name),
            cancellable: false
        }, async () => {
            return await callAI(prompt);
        });
        
        // Extract code
        let cleanedResponse = response;
        let extractedCode = '';
        let aiComments = '';
        
        const codeBlockMatch = cleanedResponse.match(/```(?:cpp|c\+\+|arduino)?\s*\n([\s\S]*?)\n```([\s\S]*)?/);
        if (codeBlockMatch) {
            extractedCode = codeBlockMatch[1].trim();
            aiComments = codeBlockMatch[2] ? codeBlockMatch[2].trim() : '';
        } else {
            extractedCode = cleanedResponse;
            extractedCode = extractedCode.replace(/^```(?:cpp|c\+\+|arduino)?\s*\n?/i, '');
            const endIndex = extractedCode.indexOf('```');
            if (endIndex !== -1) {
                extractedCode = extractedCode.substring(0, endIndex);
            }
            extractedCode = extractedCode.trim();
        }
        
        let displayContent = extractedCode;
        let footer = [];
        
        if (customInstructions && customInstructions.trim()) {
            footer.push('/* ========== Custom Instructions ==========');
            const wrappedInstructions = shared.wrapText(customInstructions, 80);
            wrappedInstructions.split('\n').forEach(line => {
                footer.push(`   ${line}`);
            });
            footer.push('   ======================================== */');
        }
        
        if (aiComments) {
            footer.push('/* ========== ' + t('labels.aiHints') + ' ==========');
            const wrappedComments = shared.wrapText(aiComments, 80);
            wrappedComments.split('\n').forEach(line => {
                footer.push(`   ${line}`);
            });
            footer.push('   ================================= */');
        }
        
        if (footer.length > 0) {
            displayContent += '\n\n' + footer.join('\n');
        }
        
        // Create document
        try {
            const doc = await vscode.workspace.openTextDocument({
                content: displayContent,
                language: 'cpp'
            });
            
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        } catch (docError) {
            vscode.window.showErrorMessage('Failed to display document: ' + (docError.message || docError));
            // Continue to show choice dialog even if document creation fails
        }
        
        // Show choice dialog outside try-catch so it always appears
        const choice = await vscode.window.showInformationMessage(
            t('messages.codeImproved'),
            t('buttons.replaceOriginal'),
            t('buttons.keepBoth')
        );
        
        if (choice === t('buttons.replaceOriginal')) {
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, extractedCode);
            });
            vscode.window.showInformationMessage(t('messages.codeReplaced'));
        }
        
    } catch (error) {
        handleApiError(error);
    } finally {
        executionStates.stop(executionStates.OPERATIONS.IMPROVE);
    }
}

module.exports = {
    improveCode
};
