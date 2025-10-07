/*
 * AI.duino - Debug Help Feature Module (Enhanced with Context Support)
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const featureUtils = require('./featureUtils');
const contextManager = require('../utils/contextManager');
const { getSharedCSS, getPrismScripts } = require('../utils/panels/sharedStyles');

/**
 * Main debugHelp function with multi-context support
 * @param {Object} context - Extension context with dependencies
 */
async function debugHelp(context) {
    const panel = await featureUtils.executeFeature(
        context.executionStates.OPERATIONS.DEBUG,
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage(context.t('messages.noEditor'));
                return;
            }
            
            // Check if Arduino file
            if (!context.validation.validateArduinoFile(editor.document.fileName)) {
                vscode.window.showWarningMessage(context.t('messages.openInoFile'));
                return;
            }
            
            // Show debug options to user
            const selectedOption = await showDebugOptions(context.t);
            if (!selectedOption) return;
            
            // For serial mode, get serial output first
            let serialOutput = null;
            if (selectedOption.value === 'serial') {
                serialOutput = await vscode.window.showInputBox({
                    prompt: context.promptManager.getPrompt('pasteSerial'),
                    placeHolder: context.t('placeholders.serialExample'),
                    ignoreFocusOut: true
                });
                if (!serialOutput) return;
            }
            
            // Get selection state
            const selection = editor.selection;
            const hasSelection = !selection.start.isEqual(selection.end);
            const selectedText = hasSelection ? editor.document.getText(selection) : '';
            
            // Context Selection
            const contextData = await contextManager.selectContextLevel(
                editor, 
                selectedText, 
                context.t,
                { showSelectionOption: hasSelection }
            );
            if (!contextData) return; // User cancelled
            
            // Build prompt with context
            const prompt = buildDebugPromptWithContext(
                selectedOption,
                selectedText,
                contextData,
                serialOutput,
                context
            );
            
            if (!prompt) return;
            
            // Call AI with progress
            const response = await featureUtils.callAIWithProgress(
                prompt,
                'progress.analyzingProblem',
                context
            );
            
            // Process response with code blocks
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
            
            // Create context badge before HTML generation
            const contextBadge = contextManager.getContextBadgeHtml(contextData, context.t);
            
            panel.webview.html = createDebugHelpHtml(
                selectedOption.label,
                processedHtml,
                codeBlocks,
                contextBadge,
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
 * Build debug prompt with context awareness
 * @param {Object} selectedOption - Selected debug option
 * @param {string} selectedText - Selected code (can be empty)
 * @param {Object} contextData - Context data structure
 * @param {string|null} serialOutput - Serial output for serial mode
 * @param {Object} context - Extension context
 * @returns {string} Complete AI prompt
 */
function buildDebugPromptWithContext(selectedOption, selectedText, contextData, serialOutput, context) {
    switch (selectedOption.value) {
        case 'serial':
            return buildSerialPrompt(serialOutput, selectedText, contextData, context);
            
        case 'hardware':
            return buildHardwarePrompt(selectedText, contextData, context);
            
        case 'debug':
            return buildDebugStatementsPrompt(selectedText, contextData, context);
            
        case 'timing':
            return buildTimingPrompt(selectedText, contextData, context);
            
        default:
            return '';
    }
}

/**
 * Build serial analysis prompt with context
 */
function buildSerialPrompt(serialOutput, selectedText, contextData, context) {
    let prompt = '';
    const hasSelection = selectedText && selectedText.trim().length > 0;
    
    if (hasSelection) {
        // Analyze serial with selected code as focus
        prompt += context.promptManager.getPrompt('analyzeSerial', serialOutput, selectedText);
        
        // Add additional context
        if (contextData.level === 'currentFile' && contextData.contextFiles.length > 0) {
            prompt += '\n\n' + context.t('context.additionalContext');
            prompt += '\n' + context.t('context.explanation') + '\n';
            
            const currentFile = contextData.contextFiles.find(f => f.isCurrent);
            if (currentFile) {
                prompt += `\n// ========== ${currentFile.name} ${context.t('context.fullFileAsContext')} ==========\n`;
                prompt += `\`\`\`cpp\n${currentFile.content}\n\`\`\`\n`;
            }
            prompt += '\n' + context.t('context.focusReminder');
        } else if (contextData.level === 'fullSketch' && contextData.contextFiles.length > 0) {
            prompt += '\n\n' + context.t('context.additionalContext');
            prompt += '\n' + context.t('context.explanation') + '\n';
            
            for (const file of contextData.contextFiles) {
                prompt += `\n// ========== ${file.name} ==========\n`;
                prompt += `\`\`\`cpp\n${file.content}\n\`\`\`\n`;
            }
            prompt += '\n' + context.t('context.focusReminder');
        }
    } else {
        // Analyze serial with file/sketch context
        if (contextData.level === 'currentFile') {
            const currentFileContent = contextData.contextFiles.find(f => f.isCurrent)?.content || '';
            prompt += context.promptManager.getPrompt('analyzeSerialFile', serialOutput, contextData.focusFile, currentFileContent);
        } else if (contextData.level === 'fullSketch') {
            let allFilesContent = '';
            for (const file of contextData.contextFiles) {
                allFilesContent += `// ========== ${file.name} ==========\n`;
                allFilesContent += `\`\`\`cpp\n${file.content}\n\`\`\`\n\n`;
            }
            prompt += context.promptManager.getPrompt('analyzeSerialSketch', serialOutput, allFilesContent);
        }
    }
    
    return prompt;
}

/**
 * Build hardware debug prompt with context
 */
function buildHardwarePrompt(selectedText, contextData, context) {
    const prompt = contextManager.buildContextAwarePrompt(
        selectedText,
        contextData,
        {
            selection: 'hardwareDebug',
            file: 'hardwareDebugFile',
            sketch: 'hardwareDebugSketch',
            suffix: null
        },
        context
    );
    
    return prompt + shared.getBoardContext();
}

/**
 * Build debug statements prompt with context
 */
function buildDebugStatementsPrompt(selectedText, contextData, context) {
    return contextManager.buildContextAwarePrompt(
        selectedText,
        contextData,
        {
            selection: 'addDebugStatements',
            file: 'addDebugStatementsFile',
            sketch: 'addDebugStatementsSketch',
            suffix: null
        },
        context
    );
}

/**
 * Build timing analysis prompt with context
 */
function buildTimingPrompt(selectedText, contextData, context) {
    const prompt = contextManager.buildContextAwarePrompt(
        selectedText,
        contextData,
        {
            selection: 'analyzeTiming',
            file: 'analyzeTimingFile',
            sketch: 'analyzeTimingSketch',
            suffix: null
        },
        context
    );
    
    return prompt + shared.getBoardContext();
}

/**
 * Create HTML content for debug help panel
 * @param {string} debugType - Type of debug help requested
 * @param {string} processedResponse - Already processed HTML with code blocks
 * @param {Array} codeBlocks - Array of code strings for event delegation
 * @param {string} contextBadge - Pre-rendered context badge HTML
 * @param {string} modelId - Current AI model ID
 * @param {Object} minimalModelManager - Model manager instance
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createDebugHelpHtml(debugType, processedResponse, codeBlocks, contextBadge, modelId, minimalModelManager, t) {
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
            <style>
                .context-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    border-radius: 12px;
                    font-size: 0.9em;
                    margin: 8px 0;
                }
            </style>
        </head>
        <body>
            ${featureUtils.generateActionToolbar(['copy', 'insert', 'close'], t)}
            
            <div class="header">
                <h1>🔍 ${shared.escapeHtml(cleanDebugType)}</h1>
                ${modelBadge}
            </div>
            
            ${contextBadge}
            
            <div class="info-section">
                <h3>🤖 AI Debug Analysis:</h3>
                ${processedResponse}
            </div>
            
            <script>
                const codeBlocksData = ${JSON.stringify(codeBlocks)};
                
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
