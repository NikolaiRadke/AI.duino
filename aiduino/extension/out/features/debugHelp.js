/*
 * AI.duino - Debug Help Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const featureUtils = require('./featureUtils');

/**
 * Main debugHelp function with dependency injection
 * @param {Object} context - Extension context with dependencies
 */
async function debugHelp(context) {
    return featureUtils.executeFeature(
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
            
            // Create HTML panel for debug help
            const panel = featureUtils.createHtmlPanel(
                context.t('panels.debugHelp'),
                response,
                context.currentModel,
                context.t,
                context.t('buttons.copy'),
                'Debug Assistant',
                '#4CAF50'
            );
            
            // Add the selected option title to the panel
            enhanceDebugPanelWithTitle(panel, selectedOption.label);
        },
        context
    );
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
 * Enhance debug panel with option title
 * @param {vscode.WebviewPanel} panel - The webview panel
 * @param {string} title - Selected option title
 */
function enhanceDebugPanelWithTitle(panel, title) {
    // Clean the title by removing VS Code icons
    const cleanTitle = title.replace(/\$\([^)]+\)\s*/, '');
    
    // Get current HTML and update the title
    const originalHtml = panel.webview.html;
    const enhancedHtml = originalHtml.replace(
        /<h1>([^<]+)<\/h1>/,
        `<h1>${shared.escapeHtml(cleanTitle)}</h1>`
    );
    
    panel.webview.html = enhancedHtml;
}

module.exports = {
    debugHelp
};
