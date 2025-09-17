/*
 * AI.duino - Menu Builder Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const { calculateTotalCost } = require('../shared');

/**
 * Build all menu items for the quick menu
 * @param {Object} context - Extension context with dependencies
 * @returns {Array} Menu items array
 */
function buildMenuItems(context) {
    const { 
        t, 
        minimalModelManager, 
        currentModel, 
        aiConversationContext, 
        localeUtils,
        currentLocale,
        tokenUsage,
        EXTENSION_VERSION 
    } = context;
    
    const editor = vscode.window.activeTextEditor;
    const hasSelection = editor && !editor.selection.isEmpty;
    const board = shared.detectArduinoBoard();
    const boardDisplay = shared.getBoardDisplayName(board);
    const model = minimalModelManager.providers[currentModel];
    const totalCostToday = calculateTotalCost(tokenUsage, minimalModelManager.providers);
    
    // Block 1: Core action items
    const coreItems = [
        createMenuItem('$(symbol-method)', 'improveCode', hasSelection, t),
        createMenuItem('$(comment-discussion)', 'explainCode', hasSelection, t),
        createMenuItem('$(edit)', 'addComments', hasSelection, t),
        createMenuItem('$(error)', 'explainError', false, t, 'descriptions.noErrors'),
        createMenuItem('$(bug)', 'debugHelp', false, t, 'descriptions.debugHelp'),
        createMenuItem('$(comment-discussion)', 'askAI', false, t, 'descriptions.askAI')
    ];
    
    // Separator 1
    const separator1 = { 
        label: '', 
        kind: vscode.QuickPickItemKind.Separator 
    };
    
    // Block 2: Settings items
    const settingsItems = [
        {
            label: `$(globe) ${t('commands.switchLanguage')}`,
            description: t('descriptions.currentLanguage', 
                localeUtils.getCurrentLanguageName(currentLocale, 
                    vscode.workspace.getConfiguration('aiduino').get('language', 'auto'))),
            command: 'aiduino.switchLanguage'
        },
        {
            label: `$(sync) ${t('commands.switchModel')}`,
            description: t('descriptions.currentModel', model.name),
            command: 'aiduino.switchModel'
        },
        {
            label: `$(key) ${t('commands.changeApiKey')}`,
            description: `${model.name} Key`,
            command: 'aiduino.setApiKey'
        },
        {
            label: `$(edit) ${t('commands.editPrompts')}`,
            description: t('descriptions.editPrompts'),
            command: 'aiduino.editPrompts'
        }
    ];
    
    // Separator 2
    const separator2 = { 
        label: '', 
        kind: vscode.QuickPickItemKind.Separator 
    };
    
    // Block 3: Info items
    const infoItems = [];
    
    // Follow-up option if context exists
    if (shared.hasValidContext(aiConversationContext)) {
        infoItems.push({
            label: `$(arrow-right) ${t('commands.askFollowUp')}`,
            description: t('descriptions.askFollowUp', 
                formatQuestionPreview(aiConversationContext.lastQuestion, aiConversationContext.timestamp)),
            command: 'aiduino.askFollowUp'
        });
    }
    
    // Board info
    infoItems.push({
        label: `$(circuit-board) Board`,
        description: boardDisplay,
        command: null
    });
    
    // Token statistics
    infoItems.push({
        label: `$(graph) ${t('commands.tokenStats')}`,
        description: t('descriptions.todayUsage', `$${totalCostToday.toFixed(3)}`),
        command: 'aiduino.showTokenStats'
    });
    
    // About
    infoItems.push({
        label: `$(info) ${t('commands.about')}`,
        description: `Version ${EXTENSION_VERSION}`,
        command: 'aiduino.about'
    });
    
    return [...coreItems, separator1, ...settingsItems, separator2, ...infoItems];
}

/**
 * Create a menu item with consistent formatting
 * @param {string} icon - VS Code icon
 * @param {string} command - Command suffix (without 'aiduino.')
 * @param {boolean} hasSelection - Whether code is selected
 * @param {function} t - Translation function
 * @param {string} overrideDesc - Override description key
 * @returns {Object} Menu item object
 */
function createMenuItem(icon, command, hasSelection, t, overrideDesc = null) {
    const descKey = overrideDesc || (hasSelection ? 
        `descriptions.${command}Selected` : 
        'descriptions.selectFirst'
    );
    
    return {
        label: `${icon} ${t(`commands.${command}`)}`,
        description: t(descKey),
        command: `aiduino.${command}`
    };
}

/**
 * Get conditional menu items (follow-up, settings, info)
 * @param {Object} context - Extension context
 * @param {boolean} hasSelection - Whether code is selected
 * @param {string} boardDisplay - Board display name
 * @param {Object} model - Current model info
 * @param {string} version - Extension version
 * @returns {Array} Conditional menu items
 */
function getConditionalItems(context, hasSelection, boardDisplay, model, version) {
    const { t, aiConversationContext, localeUtils, currentLocale, tokenUsage, minimalModelManager } = context;
    const items = [];
    
    // Calculate total cost for token usage display
    const totalCostToday = calculateTotalCost(tokenUsage, minimalModelManager.providers);
    
    // Follow-up option if context exists
    if (shared.hasValidContext(aiConversationContext)) {
        items.push({
            label: `$(arrow-right) ${t('commands.askFollowUp')}`,
            description: t('descriptions.askFollowUp', 
                formatQuestionPreview(aiConversationContext.lastQuestion, aiConversationContext.timestamp)),
            command: 'aiduino.askFollowUp'
        });
    }
    
    // Settings and info items
    const settingsItems = [
        {
            label: `$(globe) ${t('commands.switchLanguage')}`,
            description: t('descriptions.currentLanguage', 
                localeUtils.getCurrentLanguageName(currentLocale, 
                    vscode.workspace.getConfiguration('aiduino').get('language', 'auto'))),
            command: 'aiduino.switchLanguage'
        },
        {
            label: `$(sync) ${t('commands.switchModel')}`,
            description: t('descriptions.currentModel', model.name),
            command: 'aiduino.switchModel'
        },
        {
            label: `$(key) ${t('commands.changeApiKey')}`,
            description: `${model.name} Key`,
            command: 'aiduino.setApiKey'
        },
        {
            label: `$(edit) ${t('commands.editPrompts')}`,
            description: t('descriptions.editPrompts'),
            command: 'aiduino.editPrompts'
        },
        {
            label: `$(circuit-board) Board`,
            description: boardDisplay,
            command: null
        },
        {
            label: `$(graph) ${t('commands.tokenStats')}`,
            description: t('descriptions.todayUsage', `$${totalCostToday.toFixed(3)}`),
            command: 'aiduino.showTokenStats'
        },
        {
            label: `$(info) ${t('commands.about')}`,
            description: `Version ${version}`,
            command: 'aiduino.about'
        }
    ];
    
    return [...items, ...settingsItems];
}

/**
 * Format question preview for menu display
 * @param {string} question - The question to format
 * @param {number} timestamp - Question timestamp
 * @returns {string} Formatted preview string
 */
function formatQuestionPreview(question, timestamp) {
    if (!question) return '';
    const preview = question.length > 40 ? question.substring(0, 40) + '...' : question;
    const contextAge = Math.round((Date.now() - timestamp) / 60000);
    return `"${preview}" (${contextAge}min ago)`;
}

module.exports = {
    buildMenuItems,
    getConditionalItems,
    formatQuestionPreview,
};
