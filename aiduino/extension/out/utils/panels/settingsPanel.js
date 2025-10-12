/*
 * AI.duino - Settings Panel Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const { getSharedCSS } = require('./sharedStyles');
const { uninstallAiduino } = require('../uninstaller');

/**
 * Show settings panel with all configurable options
 * @param {Object} context - Extension context with dependencies
 */
function showSettings(context, openCategory = null) {
    const { t, settings } = context;
    
    const panel = vscode.window.createWebviewPanel(
        'aiduinoSettings',
        `⚙️ ${t('settings.title')}`,
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    
    // Get all current settings
    const currentSettings = settings.getAll();
    
    panel.webview.html = generateSettingsHTML(currentSettings, t, context, openCategory);
    
    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'updateSetting':
                // Special handling for inline completion settings - save to VS Code Config
                if (message.key === 'inlineCompletionEnabled' || message.key === 'inlineCompletionProvider') {
                    const config = vscode.workspace.getConfiguration('aiduino');
        
                    // Warn about costs when changing provider with inline completion enabled
                    if (message.key === 'inlineCompletionProvider') {
                        const isEnabled = config.get('inlineCompletionEnabled', false);
    
                        if (isEnabled) {
                            const { minimalModelManager } = context;
                            const newProvider = minimalModelManager.providers[message.value];
        
                            if (newProvider) {
                                // Check if new provider has costs
                                const hasCosts = newProvider.prices && (newProvider.prices.input > 0 || newProvider.prices.output > 0);
            
                                if (hasCosts) {
                                    const choice = await vscode.window.showWarningMessage(
                                        t('messages.inlineCompletionWarningCosts', newProvider.name),
                                        t('buttons.yes'),
                                        t('buttons.no')
                                    );
                
                                    if (choice !== t('buttons.yes')) {
                                        // User cancelled - reset dropdown to current value
                                        const currentProvider = config.get('inlineCompletionProvider', 'groq');
                                        panel.webview.postMessage({
                                            command: 'settingReset',
                                            key: message.key,
                                            value: currentProvider
                                        });
                                        return;
                                    }
                                }
                            }
                        }
                    }
        
                    await config.update(message.key, message.value, vscode.ConfigurationTarget.Global);
        
                    // Force tree refresh for inline completion toggle
                    if (message.key === 'inlineCompletionEnabled' && context.quickMenuTreeProvider) {
                        // Small delay to ensure config is persisted
                        setTimeout(() => {
                            context.quickMenuTreeProvider.refresh();
                        }, 200);
                    }
                } else {
                    await settings.set(message.key, message.value);
                }
                vscode.window.showInformationMessage(t('messages.settingsSaved'));
                break;
                
                case 'resetSetting':
                    await settings.reset(message.key);
                    const newValue = settings.get(message.key);
                    panel.webview.postMessage({
                        command: 'settingReset',
                        key: message.key,
                        value: newValue
                    });
                    break;
                
                case 'resetAll':
                    await settings.resetAll();
                    vscode.window.showInformationMessage(t('messages.settingsReset'));
                    // Refresh panel
                    const updatedSettings = settings.getAll();
                    panel.webview.html = generateSettingsHTML(updatedSettings, t, context, openCategory);
                    break;

                case 'uninstall':
                    await uninstallAiduino(context);
                    break;
            }
        },
        undefined,
        context.globalContext.subscriptions
    );
}

/**
 * Generate HTML for settings panel
 */
function generateSettingsHTML(currentSettings, t, context, openCategory = null) {
    const categories = [
        {
            id: 'aiBehavior',
            icon: '🤖',
            settings: [
                { key: 'temperature', type: 'number', min: 0, max: 1, step: 0.1 },
                { key: 'maxTokensPerRequest', type: 'number', min: 500, max: 4000, step: 100 }
            ]
        },
        {
            id: 'performance',
            icon: '⚡',
            settings: [
                { key: 'apiTimeout', type: 'number', min: 5000, max: 120000, step: 1000 },
                { key: 'apiMaxRetries', type: 'number', min: 0, max: 10, step: 1 }
            ]
        },
        {
            id: 'updates',
            icon: '🔄',
            settings: [
                { key: 'autoUpdateConfigs', type: 'boolean' },
                { key: 'autoCheckExtensionUpdates', type: 'boolean' }
            ]
        },
        {
            id: 'chat',
            icon: '💬',
            settings: [
                { key: 'maxChats', type: 'number', min: 1, max: 50, step: 1 },
                { key: 'maxMessagesPerChat', type: 'number', min: 10, max: 1000, step: 10 }
            ]
        },
        {
            id: 'inlineCompletion',
            icon: '⚡',
            settings: [
                { key: 'inlineCompletionEnabled', type: 'boolean' },
                { key: 'inlineCompletionProvider', type: 'dropdown', providers: true },
                { key: 'inlineCompletionDelay', type: 'number', min: 100, max: 2000, step: 100 },
                { key: 'inlineCompletionContextLines', type: 'number', min: 5, max: 50, step: 1 },
                { key: 'inlineCompletionMinCommentLength', type: 'number', min: 2, max: 20, step: 1 },
                { key: 'inlineCompletionMaxLinesComment', type: 'number', min: 5, max: 50, step: 1 },
                { key: 'inlineCompletionMaxLinesSimple', type: 'number', min: 1, max: 10, step: 1 }
            ]
        },
        {
            id: 'advanced',
            icon: '🔧',
            settings: [
                { key: 'tokenEstimationMultiplier', type: 'number', min: 0.1, max: 2, step: 0.05 },
                { key: 'tokenEstimationCodeBlock', type: 'number', min: 1, max: 50, step: 1 },
                { key: 'tokenEstimationSpecialChars', type: 'number', min: 0.1, max: 1, step: 0.05 }
            ]
        }
    ];
    
    let categoriesHTML = '';
    
    categories.forEach((category, index) => {
        const categoryData = getCategoryData(category.id, currentSettings);
        const isOpen = openCategory === category.id;
        
        categoriesHTML += `
            <div class="category">
                <div class="category-header" onclick="toggleCategory('${category.id}')">
                    <span class="category-icon">${category.icon}</span>
                    <span class="category-title">${t(`settings.categories.${category.id}`)}</span>
                    <span class="category-count">(${category.settings.length})</span>
                    <span class="category-arrow ${isOpen ? 'open' : ''}">▼</span>
                </div>
                <div class="category-content" id="category-${category.id}" style="display: ${isOpen ? 'block' : 'none'}">
                    ${generateSettingsForCategory(category, categoryData, t, context)}
                </div>
            </div>
        `;
    });
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    ${getSharedCSS()}
    <style>
        body {
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        
        .header {
            margin-bottom: 30px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 20px;
        }
        
        .header h1 {
            margin: 0 0 10px 0;
            color: var(--vscode-foreground);
        }
        
        .category {
            margin-bottom: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            overflow: hidden;
        }
        
        .category-header {
            padding: 15px;
            background: var(--vscode-editor-background);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            user-select: none;
        }
        
        .category-header:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .category-icon {
            font-size: 20px;
        }
        
        .category-title {
            flex: 1;
            font-weight: bold;
            font-size: 14px;
        }
        
        .category-count {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
        
        .category-arrow {
            transition: transform 0.2s;
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }
        
        .category-arrow.open {
            transform: rotate(180deg);
        }
        
        .category-content {
            padding: 15px;
            background: var(--vscode-editor-background);
        }
        
        .setting-item {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .setting-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        
        .setting-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .setting-label {
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        
        .setting-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        
        .setting-control {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .setting-input {
            flex: 1;
            padding: 6px 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 13px;
        }
        
        .setting-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        
        .setting-checkbox {
            width: 20px;
            height: 20px;
            cursor: pointer;
        }
        
        .reset-button {
            padding: 6px 12px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .reset-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            text-align: right;
        }
        
        .reset-all-button {
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: bold;
        }
        
        .reset-all-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .uninstall-section {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid var(--vscode-panel-border);
        }

        .uninstall-button {
            padding: 10px 20px;
            background: var(--vscode-errorForeground);
            color: var(--vscode-editor-background);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: bold;
        }

        .uninstall-button:hover {
            opacity: 0.8;
            transform: scale(1.02);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚙️ ${t('settings.title')}</h1>
    </div>
    
    ${categoriesHTML}
    
    <div class="footer">
        <button class="reset-all-button" onclick="resetAll()">
            ${t('buttons.resetAll')}
        </button>
    
        <div class="uninstall-section">
            <button class="uninstall-button" onclick="uninstall()">
                ⚠️ ${t('uninstall.button')}
            </button>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function toggleCategory(categoryId) {
            const content = document.getElementById('category-' + categoryId);
            const arrow = content.previousElementSibling.querySelector('.category-arrow');
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                arrow.classList.add('open');
            } else {
                content.style.display = 'none';
                arrow.classList.remove('open');
            }
        }
        
        function updateSetting(key, value, type) {
            let parsedValue = value;
            
            if (type === 'number') {
                parsedValue = parseFloat(value);
            } else if (type === 'boolean') {
                parsedValue = value === 'true' || value === true;
            }
            
            vscode.postMessage({
                command: 'updateSetting',
                key: key,
                value: parsedValue
            });
        }
        
        function resetSetting(key) {
            vscode.postMessage({
                command: 'resetSetting',
                key: key
            });
        }
        
        function resetAll() {
            if (confirm('${t('messages.settingsReset')}?')) {
                vscode.postMessage({
                    command: 'resetAll'
                });
            }
        }

        function uninstall() {
            vscode.postMessage({
                command: 'uninstall'
            });
        }
        
        // Listen for reset responses
        window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.command === 'settingReset') {   
                const input = document.getElementById('input-' + message.key);
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = message.value;
                    } else if (input.tagName === 'SELECT') {
                        input.value = message.value;
                        // Also update data attribute
                        input.setAttribute('data-original-value', message.value);
                    } else {
                        input.value = message.value;
                    }
                }   
            }
        });

        // Auto-scroll to opened category on load
        window.addEventListener('DOMContentLoaded', () => {
            const openCategory = '${openCategory || ''}';
            if (openCategory) {
                const categoryElement = document.getElementById('category-' + openCategory);
                if (categoryElement) {
                    // Scroll to category with smooth animation
                    setTimeout(() => {
                        categoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                }
            }
        });
    </script>
</body>
</html>`;
}

/**
 * Get category data from current settings
 */
function getCategoryData(categoryId, currentSettings) {
    const mapping = {
        aiBehavior: currentSettings.aiBehavior,
        performance: currentSettings.performance,
        updates: currentSettings.updates,
        chat: currentSettings.chatPanel,
        inlineCompletion: currentSettings.inlineCompletion,
        advanced: currentSettings.advanced
    };
    return mapping[categoryId] || {};
}

/**
 * Generate settings HTML for a category
 */
function generateSettingsForCategory(category, categoryData, t, context) {
    return category.settings.map(setting => {
        const key = setting.key;
        const value = categoryData[key];
        
        // Special handling for provider dropdown
        if (setting.type === 'dropdown' && setting.providers) {
            const currentProvider = categoryData['inlineCompletionProvider'] || 'groq';
            const { minimalModelManager } = context;
            
            let options = '';
            Object.keys(minimalModelManager.providers).forEach(modelId => {
                const provider = minimalModelManager.providers[modelId];
                const selected = modelId === currentProvider ? 'selected' : '';
                options += `<option value="${modelId}" ${selected}>${provider.icon} ${provider.name}</option>`;
            });
            
            const inputHTML = `
                <select id="input-${key}" 
                        class="setting-input"
                        onchange="updateSetting('${key}', this.value, 'string')">
                    ${options}
                </select>
            `;
            
            return `
                <div class="setting-item">
                    <div class="setting-header">
                        <span class="setting-label">${t('commands.switchModel').replace('Modell wechseln', 'Modell')}</span>
                    </div>
                    <div class="setting-description">${t('descriptions.currentModel', '').replace('Aktuell: ', 'Provider für Inline Completion')}</div>
                    <div class="setting-control">
                        ${inputHTML}
                        <button class="reset-button" onclick="resetSetting('${key}')">
                            ${t('buttons.reset')}
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Special label for inlineCompletionEnabled
        let label = t(`settings.labels.${key}`);
        if (key === 'inlineCompletionEnabled') {
            label = t('labels.active');
        }
        
        const description = t(`settings.descriptions.${key}`);
        
        let inputHTML;
        
        if (setting.type === 'boolean') {
            inputHTML = `
                <input type="checkbox" 
                       id="input-${key}" 
                       class="setting-checkbox"
                       ${value ? 'checked' : ''}
                       onchange="updateSetting('${key}', this.checked, 'boolean')">
            `;
        } else {
            inputHTML = `
                <input type="number" 
                       id="input-${key}" 
                       class="setting-input"
                       value="${value}"
                       min="${setting.min}"
                       max="${setting.max}"
                       step="${setting.step}"
                       onchange="updateSetting('${key}', this.value, 'number')">
            `;
        }
        
        return `
            <div class="setting-item">
                <div class="setting-header">
                    <span class="setting-label">${label}</span>
                </div>
                <div class="setting-description">${description}</div>
                <div class="setting-control">
                    ${inputHTML}
                    <button class="reset-button" onclick="resetSetting('${key}')">
                        ${t('buttons.reset')}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

module.exports = { showSettings };
