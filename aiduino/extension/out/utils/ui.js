/*
 * AI.duino - UI Display Functions Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */


const vscode = require('vscode');
const shared = require('../shared');
const { buildMenuItems, formatQuestionPreview } = require('./menuBuilder');
const { showAbout } = require('./panels/aboutPanel');
const { showTokenStats, calculateTotalCost } = require('./panels/tokenStatsPanel');
const { showOfflineHelp } = require('./panels/offlineHelpPanel');
const { forEachProvider } = require('../shared');

// ===== ACTIVITY BAR TREE VIEW PROVIDER =====

/**
 * Tree Data Provider for AI.duino Activity Bar Quick Menu
 */
class QuickMenuTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.context = null;
    }
    
    initialize(context) {
        this.context = context;
    }
    
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    
    getTreeItem(element) {
        return element;
    }
    
    getChildren(element) {
        if (!element && this.context) {
            return Promise.resolve(this.buildTreeItems());
        }
        return Promise.resolve([]);
    }
    
    buildTreeItems() {
        if (!this.context) return [];

        const menuItems = buildMenuItems(this.context);
        const treeItems = [];

        // Block 1: Code Actions
        const codeActions = menuItems.filter(item => 
            item.command && [
                'improveCode', 'explainCode', 'addComments', 
                'explainError', 'debugHelp', 'askAI', 
                'askFollowUp', 'openChatPanel'
            ].some(cmd => item.command.includes(cmd))
        );
        codeActions.forEach(item => treeItems.push(this.createTreeItem(item)));
    
        if (codeActions.length > 0) {
            treeItems.push(this.createSeparator());
        }
    
        // Block 2: Settings (including toggleInlineCompletion)
        const settings = menuItems.filter(item => 
            item.command && [
                'switchLanguage', 'switchModel', 'setApiKey', 
                'editPrompts', 'toggleInlineCompletion'
            ].some(cmd => item.command.includes(cmd))
        );
        settings.forEach(item => treeItems.push(this.createTreeItem(item)));
    
        if (settings.length > 0) {
            treeItems.push(this.createSeparator());
        }
    
        // Block 3: Info items (Stats, About - NO Board)
        const infoItems = menuItems.filter(item => 
            item.command && ['showTokenStats', 'about'].some(cmd => 
                item.command.includes(cmd)
            )
        );
        infoItems.forEach(item => treeItems.push(this.createTreeItem(item)));
    
        return treeItems;
    }
    
    createSeparator() {
        const separator = new vscode.TreeItem('────────────', vscode.TreeItemCollapsibleState.None);
        separator.contextValue = 'separator';
        separator.command = undefined;
        return separator;
    }
    
    createTreeItem(menuItem) {
    // Extract icon from label (format: "$(icon) Text")
    const iconMatch = menuItem.label.match(/\$\(([^)]+)\)/);
    const icon = iconMatch ? iconMatch[1] : 'circle-outline';
    let cleanLabel = menuItem.label.replace(/\$\([^)]+\)\s*/, '');
    
    // Shorten label for tree view using translation
    if (menuItem.command?.includes('toggleInlineCompletion') && this.context?.t) {
        cleanLabel = this.context.t('commands.toggleInlineCompletionShort');
    }
    
    // Add description for settings with status
    if (menuItem.description && menuItem.command?.includes('toggle')) {
        cleanLabel = `${cleanLabel}: ${menuItem.description}`;
    }
    
    const item = new QuickMenuTreeItem(cleanLabel, menuItem.command, icon);
    
    // Add full name as tooltip for inline completion
    if (menuItem.command?.includes('toggleInlineCompletion') && this.context?.t) {
        item.tooltip = this.context.t('commands.toggleInlineCompletion');
    }
    
    return item;
    } 
}

/**
 * Tree item for Quick Menu entries
 */
class QuickMenuTreeItem extends vscode.TreeItem {
    constructor(label, command, iconName) {
        super(label, vscode.TreeItemCollapsibleState.None);
        
        this.command = {
            command: command,
            title: label,
            arguments: []
        };
        
        this.iconPath = new vscode.ThemeIcon(iconName);
        this.contextValue = 'quickMenuItem';
    }
}

// ===== WELCOME FUNCTIONS =====

/**
 * Check if welcome message should be shown
 * @param {Object} context - Extension context with dependencies
 * @returns {boolean} True if no API keys are configured
 */
function shouldShowWelcome(context) {
    const { minimalModelManager, apiKeys } = context;
    return Object.keys(minimalModelManager.providers).every(modelId => !apiKeys[modelId]);
}

/**
 * Show welcome message for new users
 * @param {Object} context - Extension context with dependencies
 */
async function showWelcomeMessage(context) {
    const { t, minimalModelManager, switchModel } = context;
    
    const modelList = Object.values(minimalModelManager.providers)
        .map(provider => provider.name)
        .join(', ');
    
    const message = t('messages.welcome', modelList);
    const choice = await vscode.window.showInformationMessage(
        message,
        t('buttons.chooseModel'),
        t('buttons.later')
    );
    
    if (choice === t('buttons.chooseModel')) {
        await switchModel();
    }
}

/**
 * Show progress with localized cancel button
 * @param {string} message - Progress message
 * @param {Promise} operation - The async operation to perform
 * @param {Function} t - Translation function
 * @returns {Promise} Operation result
 */
async function showProgressWithCancel(message, operation, t) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: message,
        cancellable: true
    }, async (progress, token) => {
        const cancellationPromise = new Promise((_, reject) => {
            token.onCancellationRequested(() => {
                reject(new Error(t('errors.operationCancelled')));
            });
        });
        
        return Promise.race([operation, cancellationPromise]);
    });
}

module.exports = {
    // Activity Bar TreeView
    QuickMenuTreeProvider,
    QuickMenuTreeItem,
    
    // UI functions
    showAbout,
    showTokenStats,
    showOfflineHelp,
    showProgressWithCancel,
        
    // Welcome functions
    shouldShowWelcome,
    showWelcomeMessage
};
