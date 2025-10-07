/*
 * AI.duino - Context Manager Module
 * Shared functions for multi-file context handling across all features
 * 
 * Copyright 2025 Monster Maker
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Let user select context level for AI analysis
 * Reusable across all features: ExplainCode, ImproveCode, AddComments, etc.
 * 
 * @param {vscode.TextEditor} editor - Active editor
 * @param {string} selectedText - Selected code (can be empty for some features)
 * @param {Function} t - Translation function
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object|null>} Context data or null if cancelled
 */
async function selectContextLevel(editor, selectedText, t, options = {}) {
    const {
        showSelectionOption = true,
        showNoContextOption = false 
    } = options;

    const currentFile = editor.document.uri.fsPath;
    const currentFileName = path.basename(currentFile);
    const sketchDir = path.dirname(currentFile);
    
    // Get all Arduino files in sketch directory
    const sketchFiles = getSketchFiles(sketchDir);
    
    // Count lines
    const selectionLines = selectedText ? selectedText.split('\n').length : 0;
    const currentFileText = editor.document.getText();
    const currentFileLines = currentFileText.split('\n').length;
    const totalLines = calculateTotalLines(sketchFiles);
    
    // Build context options
    const contextOptions = [];

    // Option 0: No context (optional, for askAI)
    if (showNoContextOption) {
        contextOptions.push({
            label: '❌ ' + t('context.noContext'),
            description: t('context.noContextDesc'),
            detail: t('context.noContextDetail'),
            value: 'none',
            icon: '❌'
        });
    }
    
    // Check for real selection (not just cursor position)
    const hasRealSelection = selectedText && selectedText.trim().length > 0;
    
    // Option 1: Only selection (if applicable)
    if (showSelectionOption && hasRealSelection) {
        // Check if custom label is provided (for special cases like explainError)
        const useCustomLabel = options.customSelectionLabel || false;
    
        contextOptions.push({
            label: '📝 ' + (useCustomLabel ? t('context.minimalContext') : t('context.selection')),
            description: `${selectionLines} ${t('context.lines')}`,
            detail: useCustomLabel ? t('context.minimalContextDetail') : t('context.selectionDetail'),
            value: 'selection',
            icon: '📝'
        });
    }
    
    // Option 2: Current file (detail depends on whether there's a selection)
    contextOptions.push({
        label: '📄 ' + t('context.currentFile'),
        description: `${currentFileName}, ${currentFileLines} ${t('context.lines')}`,
        detail: (hasRealSelection && !options.customSelectionLabel)
            ? t('context.currentFileDetailWithSelection')
            : t('context.currentFileDetailNoSelection'),
        value: 'currentFile',
        icon: '📄'
    });

    // Option 3: Full sketch (detail depends on whether there's a selection)
    if (sketchFiles.length > 1) {
        const fileNames = sketchFiles.map(f => path.basename(f)).join(', ');
        contextOptions.push({
            label: '📂 ' + t('context.fullSketch'),
            description: `${sketchFiles.length} ${t('context.files')}, ~${totalLines} ${t('context.lines')}`,
            detail: (hasRealSelection && !options.customSelectionLabel)
                ? t('context.fullSketchDetailWithSelection')
                : t('context.fullSketchDetailNoSelection'),
            value: 'fullSketch',
            icon: '📂'
        });
    }
    
    const choice = await vscode.window.showQuickPick(contextOptions, {
        placeHolder: t('context.selectLevel'),
        ignoreFocusOut: true
    });
    
    if (!choice) return null;
    
    // Build context data based on selection
    return buildContextData(choice.value, editor, sketchFiles, selectedText);
}

/**
 * Build context data structure based on user choice
 * 
 * @param {string} contextLevel - 'selection' | 'currentFile' | 'fullSketch'
 * @param {vscode.TextEditor} editor - Active editor
 * @param {Array<string>} sketchFiles - List of sketch file paths
 * @param {string} selectedText - Selected code (can be empty)
 * @returns {Object} Context data structure
 */
function buildContextData(contextLevel, editor, sketchFiles, selectedText = '') {
    const currentFile = editor.document.uri.fsPath;
    const currentFileName = path.basename(currentFile);
    const currentFileText = editor.document.getText();
    
    const data = {
        level: contextLevel,
        focusCode: selectedText || currentFileText,
        focusFile: currentFileName,
        contextFiles: [],
        sketchDirectory: path.dirname(currentFile)
    };

    // Handle 'none' level
    if (contextLevel === 'none') {
        return data;
    }
    
    if (contextLevel === 'selection') {
        // No additional context - just the selection
        return data;
    }
    
    if (contextLevel === 'currentFile') {
        // Add complete current file as context
        data.contextFiles.push({
            name: currentFileName,
            content: currentFileText,
            isCurrent: true
        });
        return data;
    }
    
    if (contextLevel === 'fullSketch') {
        // Add all sketch files as context
        for (const filePath of sketchFiles) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const fileName = path.basename(filePath);
                data.contextFiles.push({
                    name: fileName,
                    content: content,
                    isCurrent: (filePath === currentFile)
                });
            } catch (err) {
                // Skip files that can't be read
                continue;
            }
        }
        return data;
    }
    
    return data;
}

/**
 * Get all Arduino-related files in sketch directory
 * 
 * @param {string} sketchDir - Sketch directory path
 * @returns {Array<string>} List of file paths (sorted: .ino first, then alphabetical)
 */
function getSketchFiles(sketchDir) {
    try {
        const files = fs.readdirSync(sketchDir);
        const arduinoFiles = files
            .filter(f => f.match(/\.(ino|cpp|h|c)$/i))
            .map(f => path.join(sketchDir, f));
        
        // Sort: .ino files first, then alphabetical
        return arduinoFiles.sort((a, b) => {
            const aIsIno = a.endsWith('.ino');
            const bIsIno = b.endsWith('.ino');
            
            if (aIsIno && !bIsIno) return -1;
            if (!aIsIno && bIsIno) return 1;
            return a.localeCompare(b);
        });
    } catch (err) {
        return [];
    }
}

/**
 * Calculate total lines across all files
 * 
 * @param {Array<string>} filePaths - List of file paths
 * @returns {number} Total line count
 */
function calculateTotalLines(filePaths) {
    let total = 0;
    for (const filePath of filePaths) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            total += content.split('\n').length;
        } catch (err) {
            continue;
        }
    }
    return total;
}

/**
 * Get context badge HTML for display in result panels
 * 
 * @param {Object} contextData - Context data structure
 * @param {Function} t - Translation function
 * @returns {string} HTML string for context badge
 */
function getContextBadgeHtml(contextData, t) {
    let label = '';
    
    if (contextData.level === 'selection') {
        label = '📝 ' + t('context.selection');
    } else if (contextData.level === 'currentFile') {
        label = '📄 ' + t('context.currentFile');
    } else if (contextData.level === 'fullSketch') {
        const fileCount = contextData.contextFiles.length;
        label = `📁 ${t('context.fullSketch')} (${fileCount} ${t('context.files')})`;
    }
    
    return `<div class="context-badge">${label}</div>`;
}

/**
 * Get context info for settings/preferences
 * 
 * @param {Object} contextData - Context data structure
 * @returns {Object} Context metadata
 */
function getContextMetadata(contextData) {
    return {
        level: contextData.level,
        fileCount: contextData.contextFiles.length,
        focusLines: contextData.focusCode.split('\n').length,
        totalLines: contextData.contextFiles.reduce((sum, file) => {
            return sum + file.content.split('\n').length;
        }, 0),
        files: contextData.contextFiles.map(f => f.name)
    };
}

/**
 * Build AI prompt with context awareness (generic for all features)
 * @param {string} selectedText - Selected code (can be empty)
 * @param {Object} contextData - Context data structure
 * @param {Object} promptKeys - Prompt keys: { selection, file, sketch, suffix }
 * @param {Object} context - Extension context
 * @returns {string} Complete AI prompt
 */
function buildContextAwarePrompt(selectedText, contextData, promptKeys, context, additionalInstructions = null, prefixParams = []) {
    let prompt = '';
    const hasSelection = selectedText && selectedText.trim().length > 0;
    
    if (hasSelection) {
        // Selection mode
        prompt += context.promptManager.getPrompt(promptKeys.selection, ...prefixParams, selectedText);
        prompt += require('../shared').getBoardContext();
        
        // Add context based on level
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

        // Additional instructions
        if (additionalInstructions && additionalInstructions.trim()) {
            const instructionsList = additionalInstructions.split(',').map(s => s.trim()).join('\n- ');
            prompt += '\n\n' + context.promptManager.getPrompt('additionalInstructions', instructionsList);
        }
        
        if (promptKeys.suffix) {
            prompt += '\n\n' + context.promptManager.getPrompt(promptKeys.suffix);
        }
    } else {
        // No selection - full file(s)
        if (contextData.level === 'currentFile') {
            const currentFileContent = contextData.contextFiles.find(f => f.isCurrent)?.content || '';
            prompt += context.promptManager.getPrompt(promptKeys.file, contextData.focusFile, ...prefixParams, currentFileContent);
            prompt += require('../shared').getBoardContext();
        } else if (contextData.level === 'fullSketch') {
            let allFilesContent = '';
            for (const file of contextData.contextFiles) {
                allFilesContent += `// ========== ${file.name} ==========\n`;
                allFilesContent += `\`\`\`cpp\n${file.content}\n\`\`\`\n\n`;
            }
            prompt += context.promptManager.getPrompt(promptKeys.sketch, ...prefixParams, allFilesContent);
            prompt += require('../shared').getBoardContext();
        }

        // Additional instructions
        if (additionalInstructions && additionalInstructions.trim()) {
            const instructionsList = additionalInstructions.split(',').map(s => s.trim()).join('\n- ');
            prompt += '\n\n' + context.promptManager.getPrompt('additionalInstructions', instructionsList);
        }
        
        if (promptKeys.suffix) {
            prompt += '\n\n' + context.promptManager.getPrompt(promptKeys.suffix);
        }
    }
    
    return prompt;
}

module.exports = {
    selectContextLevel,
    buildContextData,
    buildContextAwarePrompt,
    getSketchFiles,
    calculateTotalLines,
    getContextBadgeHtml,
    getContextMetadata
};
