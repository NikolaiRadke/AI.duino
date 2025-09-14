/*
 * AI.duino - UI Display Functions Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */


const vscode = require('vscode');
const shared = require('../shared');

// ===== UTILITY FUNCTIONS =====

/**
 * Calculate total cost across all providers
 * @param {Object} tokenUsage - Token usage data
 * @param {Object} providers - Provider configurations
 * @returns {number} Total cost today
 */
function calculateTotalCost(tokenUsage, providers) {
    let total = 0;
    Object.keys(providers).forEach(modelId => {
        if (tokenUsage[modelId]) {
            total += tokenUsage[modelId].cost;
        }
    });
    return total;
}

/**
 * Iterate over providers with callback
 * @param {Object} providers - Provider configurations
 * @param {Function} callback - Callback function (modelId, provider)
 */
function forEachProvider(providers, callback) {
    Object.entries(providers).forEach(([modelId, provider]) => {
        callback(modelId, provider);
    });
}

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
        
        return menuItems
            .filter(item => item.command)
            .map(item => this.createTreeItem(item));
    }
    
    createTreeItem(menuItem) {
        // Extract icon from label (format: "$(icon) Text")
        const iconMatch = menuItem.label.match(/\$\(([^)]+)\)/);
        const icon = iconMatch ? iconMatch[1] : 'circle-outline';
        const cleanLabel = menuItem.label.replace(/\$\([^)]+\)\s*/, '');

        return new QuickMenuTreeItem(cleanLabel, menuItem.command, icon);
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

// ===== MENU BUILDER FUNCTIONS =====

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
        EXTENSION_VERSION 
    } = context;
    
    const editor = vscode.window.activeTextEditor;
    const hasSelection = editor && !editor.selection.isEmpty;
    const board = shared.detectArduinoBoard();
    const boardDisplay = shared.getBoardDisplayName(board);
    const model = minimalModelManager.providers[currentModel];
    
    // Core action items
    const coreItems = [
        createMenuItem('$(symbol-method)', 'improveCode', hasSelection, t),
        createMenuItem('$(comment-discussion)', 'explainCode', hasSelection, t),
        createMenuItem('$(edit)', 'addComments', hasSelection, t),
        createMenuItem('$(error)', 'explainError', false, t, 'descriptions.noErrors'),
        createMenuItem('$(bug)', 'debugHelp', false, t, 'descriptions.debugHelp'),
        createMenuItem('$(comment-discussion)', 'askAI', false, t, 'descriptions.askAI')
    ];
    
    // Conditional items
    const conditionalItems = getConditionalItems(context, hasSelection, boardDisplay, model, EXTENSION_VERSION);
    
    return [...coreItems, ...conditionalItems];
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
            label: `$(circuit-board) Board`,
            description: boardDisplay,
            command: null
        },
        {
            label: `$(key) ${t('commands.changeApiKey')}`,
            description: `${model.name} Key`,
            command: 'aiduino.setApiKey'
        },
        {
            label: `$(graph) ${t('commands.tokenStats')}`,
            description: t('descriptions.todayUsage', `$${totalCostToday.toFixed(3)}`),
            command: 'aiduino.showTokenStats'
        },
        {
            label: `$(edit) ${t('commands.editPrompts')}`,
            description: t('descriptions.editPrompts'),
            command: 'aiduino.editPrompts'
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

// ===== UI PANEL FUNCTIONS =====

/**
 * Show About dialog with extension information
 * @param {Object} context - Extension context with dependencies
 */
function showAbout(context) {
    const logoData = require('../../icons/aiduino-logo');
    const { t, minimalModelManager, EXTENSION_VERSION } = context;
    
    const panel = vscode.window.createWebviewPanel(
        'aiduinoAbout',
        t('panels.about'),
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    
    // Generate model badges and features
    let modelBadges = '';
    let modelFeatures = '';
    forEachProvider(minimalModelManager.providers, (modelId, provider) => {
        modelBadges += `<span class="model-badge" style="background: ${provider.color}; margin: 0 5px;">${provider.icon} ${provider.name}</span>`;
        modelFeatures += `<div class="feature">${provider.icon} ${provider.name} ${t('about.integration')}</div>`;
    });
    
    // Generate API keys list
    const apiKeysList = Object.entries(minimalModelManager.providers)
        .map(([id, provider]) => {
            const url = provider.apiKeyUrl || '#';
            const domain = url !== '#' ? url.replace('https://', '').split('/')[0] : 'N/A';
            return `<p>${provider.icon} <strong>${provider.name}:</strong> <a href="${url}">${domain}</a></p>`;
        })
        .join('');
    
    panel.webview.html = generateAboutHTML(logoData.logoDataUrl, modelBadges, modelFeatures, apiKeysList, EXTENSION_VERSION, t);
}

/**
 * Generate HTML for About panel
 */
function generateAboutHTML(logoDataUrl, modelBadges, modelFeatures, apiKeysList, version, t) {
    return `<!DOCTYPE html>
<html>
<head>
    ${getSharedCSS()}
</head>
<body>
    <div class="logo">
        <img src="${logoDataUrl}" width="96" height="96" alt="AI.duino Logo" />
    </div>
    <h1>AI.duino</h1>
    <div class="version">Version ${version}</div>
    
    <p><strong>${t('about.tagline')}</strong></p>
    <div>${modelBadges}</div>
    
    <div class="info-box">
        <h3>${t('about.features')}:</h3>
        ${modelFeatures}
        <div class="feature">${t('about.feature1')}</div>
        <div class="feature">${t('about.feature2')}</div>
        <div class="feature">${t('about.feature3')}</div>
        <div class="feature">${t('about.feature4')}</div>
        <div class="feature">${t('about.feature5')}</div>
        <div class="feature">${t('about.feature6')}</div>
        <div class="feature">${t('about.feature7')}</div>
        <div class="feature">${t('about.feature8')}</div>
    </div>
    
    <div class="tutorial">
        <h3>${t('about.quickstart')}:</h3>
        <p>1. ${t('about.step1')}</p>
        <p>2. ${t('about.step2')} <span class="shortcut">Ctrl+Shift+C</span></p>
        <p>3. ${t('about.step3')}</p>
    </div>
    
    <div class="license">
        <strong>${t('about.license')}:</strong> Apache License 2.0<br>
        Copyright © 2025 Monster Maker
    </div>
    
    <div class="info-box">
        <h3>${t('about.getApiKeys')}:</h3>
        ${apiKeysList}
    </div>
    
    <div class="credits">
        <p><strong>${t('about.publisher')}:</strong> Monster Maker</p>
        <p><strong>${t('about.repository')}:</strong> <a href="https://github.com/NikolaiRadke/AI.duino">GitHub</a></p>
        <p><strong>${t('about.reportBugs')}:</strong> <a href="https://github.com/NikolaiRadke/AI.duino/issues">Issue Tracker</a></p>
        <br>
        <p><em>${t('about.madeWith')}</em></p>
    </div>
</body>
</html>`;
}

/**
 * Show token usage statistics
 * @param {Object} context - Extension context with dependencies
 */
function showTokenStats(context) {
    const { t, minimalModelManager, tokenUsage, currentLocale } = context;
    
    const totalCostToday = calculateTotalCost(tokenUsage, minimalModelManager.providers);
    
    const panel = vscode.window.createWebviewPanel(
        'tokenStats',
        t('panels.tokenStats'),
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    
    // Generate statistics cards
    let modelCards = '';
    forEachProvider(minimalModelManager.providers, (modelId, provider) => {
        modelCards += `
            <div class="stat-card">
                <div class="model-name" style="color: ${provider.color};">${provider.icon} ${provider.name}</div>
                <div class="stat-row">
                    <span>${t('stats.inputTokens')}:</span>
                    <span>${tokenUsage[modelId].input.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span>${t('stats.outputTokens')}:</span>
                    <span>${tokenUsage[modelId].output.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span>${t('stats.cost')}:</span>
                    <span class="cost">$${tokenUsage[modelId].cost.toFixed(3)}</span>
                </div>
            </div>
        `;
    });
    
    const currentDate = new Date().toLocaleDateString(currentLocale === 'de' ? 'de-DE' : 'en-US');
    
    panel.webview.html = generateTokenStatsHTML(modelCards, totalCostToday, currentDate, t);
}

/**
 * Generate HTML for Token Stats panel
 */
function generateTokenStatsHTML(modelCards, totalCostToday, currentDate, t) {
    return `<!DOCTYPE html>
<html>
<head>
    ${getSharedCSS()}
    <style>
        .stat-card {
            background: #f5f5f5;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .model-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .stat-row:last-child {
            border-bottom: none;
            font-weight: bold;
        }
        .cost {
            color: #f44336;
            font-weight: bold;
        }
        .total {
            background: #e3f2fd;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <h1>📊 ${t('stats.tokenUsageFor', currentDate)}</h1>
    
    <div class="total">
        <h2>${t('stats.totalCostToday')}: <span class="cost">$${totalCostToday.toFixed(3)}</span></h2>
    </div>
    
    ${modelCards}
    
    <div class="tip">
        💡 <strong>${t('stats.tip')}:</strong> ${t('stats.tipDescription')}
    </div>
</body>
</html>`;
}

/**
 * Show offline help panel
 * @param {Object} context - Extension context with dependencies
 */
function showOfflineHelp(context) {
    const { t, minimalModelManager } = context;
    
    // Generate dynamic hostname list from all providers  
    const firewallList = Object.entries(minimalModelManager.providers)
        .map(([id, provider]) => `<li><code>${provider.hostname}</code> (${provider.name})</li>`)
        .join('');
    
    const panel = vscode.window.createWebviewPanel(
        'aiOfflineHelp',
        t('panels.offlineHelp'),
        vscode.ViewColumn.One,
        {}
    );
    
    panel.webview.html = generateOfflineHelpHTML(firewallList, t);
}

/**
 * Generate HTML for Offline Help panel
 */
function generateOfflineHelpHTML(firewallList, t) {
    return `<!DOCTYPE html>
<html>
<head>
    ${getSharedCSS()}
    <style>
        .warning {
            background: #fff3cd;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #ffc107;
        }
    </style>
</head>
<body>
    <h1>📡 ${t('offline.title')}</h1>
    
    <div class="warning">
        <strong>${t('offline.requiresInternet')}</strong>
    </div>
    
    <h2>🔧 ${t('offline.solutions')}:</h2>
    
    <div class="tip">
        <h3>1. ${t('offline.checkInternet')}</h3>
        <ul>
            <li>${t('offline.checkWifi')}</li>
            <li>${t('offline.restartRouter')}</li>
            <li>${t('offline.testOtherSites')}</li>
        </ul>
    </div>
    
    <div class="tip">
        <h3>2. ${t('offline.firewallSettings')}</h3>
        <p>${t('offline.ensureNotBlocked')}:</p>
        <ul>${firewallList}</ul>
    </div>
    
    <div class="tip">
        <h3>3. ${t('offline.disableVpn')}</h3>
        <p>${t('offline.vpnMayBlock')}</p>
    </div>
    
    <h2>💡 ${t('offline.commonProblems')}:</h2>
    
    <h3>⚠ "was not declared in this scope"</h3>
    <pre>
// ${t('offline.solution')}: ${t('offline.declareVariable')}
int sensorPin = A0;  // ${t('offline.missingDeclaration')}
int sensorValue = analogRead(sensorPin);
    </pre>
    
    <h3>⚠ "expected ';' before..."</h3>
    <pre>
// ${t('offline.solution')}: ${t('offline.addSemicolon')}
digitalWrite(13, HIGH);  // ${t('offline.dontForgetSemicolon')}
    </pre>
    
    <h3>⚠ Non-blocking delay</h3>
    <pre>
// ${t('offline.insteadOfDelay')}:
unsigned long previousMillis = 0;
const long interval = 1000;

void loop() {
    unsigned long currentMillis = millis();
    if (currentMillis - previousMillis >= interval) {
        previousMillis = currentMillis;
        // ${t('offline.executeCodeHere')}
    }
}
    </pre>
    
    <div class="tip">
        <strong>${t('offline.tip')}:</strong> ${t('offline.onlineAgain')}
    </div>
</body>
</html>`;
}

/**
 * Shared CSS for all webview panels
 */
function getSharedCSS() {
    return `
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 20px;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        .logo {
            font-size: 72px;
            margin: 20px 0;
        }
        h1 { color: #2196F3; }
        .version {
            font-size: 24px;
            color: #666;
            margin-bottom: 30px;
        }
        .info-box {
            background: #f5f5f5;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .feature {
            margin: 10px 0;
            padding-left: 25px;
            position: relative;
        }
        .feature:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #4CAF50;
            font-weight: bold;
        }
        .credits {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
        a {
            color: #2196F3;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .license {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            font-family: monospace;
            font-size: 14px;
        }
        .model-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            color: white;
        }
        .tutorial {
            background: #e8f5e9;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: left;
        }
        .shortcut {
            background: #f0f0f0;
            padding: 3px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        .tip {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        code {
            background: #f5f5f5;
            padding: 2px 5px;
            border-radius: 3px;
        }
        pre {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
        }
    </style>`;
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
    
    // Menu builder functions
    buildMenuItems,
    createMenuItem,
    getConditionalItems,
    formatQuestionPreview,
    
    // Welcome functions
    shouldShowWelcome,
    showWelcomeMessage
};
