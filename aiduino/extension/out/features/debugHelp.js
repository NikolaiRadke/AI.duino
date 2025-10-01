/*
 * AI.duino - Debug Help Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const featureUtils = require('./featureUtils');
const { getSharedCSS, getPrismScripts } = require('../utils/panels/sharedStyles');

/**
 * Main debugHelp function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function debugHelp(context) {
    const panel = await featureUtils.executeFeature(
        context.executionStates.OPERATIONS.DEBUG,
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            
            // Show debug options to user
            const selectedOption = await showDebugOptions(context.t);
            if (!selectedOption) return;
            
            // Build prompt based on selected option
            const { prompt, needsCode } = await buildDebugPrompt(selectedOption, editor, context);
            if (!prompt) return;
            
            // Validate code selection if needed
            if (needsCode && editor.selection.isEmpty) {
                vscode.window.showWarningMessage(context.t('messages.selectRelevantCode'));
                return;
            }
            
            // Call AI with progress
            const response = await featureUtils.callAIWithProgress(
                prompt,
                'progress.analyzingProblem',
                context
            );
            
            // Process response with event-delegation code blocks
            const { processedHtml, codeBlocks } = featureUtils.processAiCodeBlocksWithEventDelegation(
                response,
                `🔧 ${context.t('debugHelp.debugSolutionTitle')}`,
                ['copy', 'insert'],
                context.t
            );
            
            // Create WebviewPanel for debug help
            const panel = vscode.window.createWebviewPanel(
                'aiDebugHelp',
                context.t('panels.debugHelp'),
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );
            
            panel.webview.html = createDebugHelpHtml(
                selectedOption.label,
                processedHtml,
                codeBlocks,
                context.currentModel,
                context.minimalModelManager,
                context.t
            );
            
            return panel;
        },
        context
    );
    
    // Message Handler
    if (panel) {
        featureUtils.setupStandardMessageHandler(panel, context);
    }
}

/**
 * Show debug options to user
 * @param {Function} t - Translation function
 * @returns {Object|null} Selected debug option or null if cancelled
 */
async function showDebugOptions(t) {
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
    
    return await vscode.window.showQuickPick(options, {
        placeHolder: t('debug.selectHelp')
    });
}

/**
 * Build debug prompt based on selected option
 * @param {Object} selectedOption - Selected debug option
 * @param {vscode.TextEditor} editor - Active text editor
 * @param {Object} context - Extension context
 * @returns {Object} {prompt, needsCode} or {prompt: null} if cancelled
 */
async function buildDebugPrompt(selectedOption, editor, context) {
    const { t } = context;
    let prompt = '';
    let needsCode = true;
    
    switch (selectedOption.value) {
        case 'serial':
            const serialOutput = await vscode.window.showInputBox({
                prompt: context.promptManager.getPrompt('pasteSerial'),
                placeHolder: t('placeholders.serialExample'),
                ignoreFocusOut: true
            });
            if (!serialOutput) return { prompt: null };
            
            const codeForSerial = editor.selection.isEmpty ? '' : editor.document.getText(editor.selection);
            prompt = context.promptManager.getPrompt('analyzeSerial', serialOutput, codeForSerial);
            needsCode = false;
            break;
            
        case 'hardware':
            const hardwareCode = getSelectedOrFullCode(editor);
            prompt = context.promptManager.getPrompt('hardwareDebug', hardwareCode) + shared.getBoardContext();
            break;
            
        case 'debug':
            const debugCode = getSelectedOrFullCode(editor);
            prompt = context.promptManager.getPrompt('addDebugStatements', debugCode);
            break;
            
        case 'timing':
            const timingCode = getSelectedOrFullCode(editor);
            prompt = context.promptManager.getPrompt('analyzeTiming', timingCode) + shared.getBoardContext();
            break;
            
        default:
            return { prompt: null };
    }
    
    return { prompt, needsCode };
}

/**
 * Get selected code or full document content
 * @param {vscode.TextEditor} editor - Active text editor
 * @returns {string} Selected text or full document content
 */
function getSelectedOrFullCode(editor) {
    return editor.selection.isEmpty ? 
        editor.document.getText() : 
        editor.document.getText(editor.selection);
}

/**
 * Create HTML content for debug help panel with Prism code blocks
 * @param {string} debugType - Type of debug help requested
 * @param {string} processedResponse - Already processed HTML with code blocks
 * @param {Array} codeBlocks - Array of code strings for event delegation
 * @param {string} modelId - Current AI model ID
 * @param {Object} minimalModelManager - Model manager instance
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createDebugHelpHtml(debugType, processedResponse, codeBlocks, modelId, minimalModelManager, t) {
    const model = minimalModelManager.providers[modelId];
    const modelBadge = `<span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${t('debugHelp.debugBadge')}</span>`;
    
    // Clean debug type label (remove VS Code icons)
    const cleanDebugType = debugType.replace(/\$\([^)]+\)\s*/, '');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('panels.debugHelp')} - AI.duino</title>
            ${getSharedCSS()}
        </head>
        <body>
            ${featureUtils.generateActionToolbar(['copy', 'insert', 'close'], t)}
            
            <div class="header">
                <h1>🔍 ${shared.escapeHtml(cleanDebugType)}</h1>
                ${modelBadge}
            </div>
            
            <div class="info-section">
                <h3>🤖 AI Debug Analysis:</h3>
                ${processedResponse}
            </div>
            
            <script>
                // Code blocks data for button handlers
                const codeBlocksData = ${JSON.stringify(codeBlocks)};
                
                // Code block button handler
                document.addEventListener('click', (e) => {
                    const button = e.target.closest('[data-action]');
                    if (!button) return;
                    
                    const action = button.dataset.action;
                    const index = parseInt(button.dataset.index);
                    const code = codeBlocksData[index];
                    
                    if (action === 'copy') {
                        vscode.postMessage({ command: 'copyCode', code: code });
                    } else if (action === 'insert') {
                        vscode.postMessage({ command: 'insertCode', code: code });
                    }
                });
            </script>
            
            ${featureUtils.generateToolbarScript(['copyCode', 'insertCode'], ['copy', 'insert', 'close'])}
            ${getPrismScripts()}
        </body>
        </html>
    `;
}

module.exports = {
    debugHelp
};
