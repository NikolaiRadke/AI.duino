/**
 * Show token usage statistics with TokenManager integration
 * @param {Object} context - Extension context with dependencies
 */
function showTokenStats(context) {
    const { t, minimalModelManager, tokenManager, currentLocale } = context;
    
    // Get usage summary from TokenManager instead of direct tokenUsage access
    const usageSummary = tokenManager ? tokenManager.getUsageSummary() : null;
    
    if (!usageSummary) {
        vscode.window.showErrorMessage('TokenManager nicht verfügbar');
        return;
    }
    
    const panel = vscode.window.createWebviewPanel(
        'tokenStats',
        t('panels.tokenStats'),
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    
    // Generate statistics cards for all models
    let modelCards = '';
    Object.entries(usageSummary.models).forEach(([modelId, usage]) => {
        const provider = minimalModelManager.providers[modelId];
        if (!provider) return;
        
        modelCards += `
            <div class="stat-card">
                <div class="model-name" style="color: ${provider.color};">${provider.icon} ${provider.name}</div>
                <div class="stat-row">
                    <span>${t('stats.inputTokens')}:</span>
                    <span>${usage.input.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span>${t('stats.outputTokens')}:</span>
                    <span>${usage.output.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span>Requests:</span>
                    <span>${(usage.requests || 0).toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span>${t('stats.cost')}:</span>
                    <span class="cost">$${usage.cost.toFixed(4)}</span>
                </div>
                ${usage.lastUsed ? `
                <div class="stat-row">
                    <span>Last used:</span>
                    <span>${new Date(usage.lastUsed).toLocaleTimeString()}</span>
                </div>` : ''}
            </div>
        `;
    });
    
    const currentDate = new Date().toLocaleDateString(currentLocale === 'de' ? 'de-DE' : 'en-US');
    
    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 { color: #2196F3; }
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
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                .summary-card {
                    background: #f0f7ff;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                }
                .summary-number {
                    font-size: 24px;
                    font-weight: bold;
                    color: #2196F3;
                }
                .summary-label {
                    font-size: 14px;
                    color: #666;
                    margin-top: 5px;
                }
                .tip {
                    background: #fff3cd;
                    padding: 15px;
                    border-radius: 4px;
                    margin: 20px 0;
                }
                .reset-button {
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-top: 20px;
                }
                .reset-button:hover {
                    background: #d32f2f;
                }
            </style>
        </head>
        <body>
            <h1>📊 ${t('stats.tokenUsageFor', currentDate)}</h1>
            
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-number">$${usageSummary.totalCost.toFixed(4)}</div>
                    <div class="summary-label">${t('stats.totalCostToday')}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${usageSummary.totalTokens.toLocaleString()}</div>
                    <div class="summary-label">Total Tokens</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${usageSummary.totalRequests.toLocaleString()}</div>
                    <div class="summary-label">Total Requests</div>
                </div>
            </div>
            
            <h2>📈 Per Model Usage</h2>
            ${modelCards}
            
            <div class="tip">
                💡 <strong>${t('stats.tip')}:</strong> ${t('stats.tipDescription')}
            </div>
            
            <button class="reset-button" onclick="resetStats()">
                🗑️ ${t('buttons.resetStats')}
            </button>
            
            <script>
                function resetStats() {
                    if (confirm('${t('stats.confirmReset')}')) {
                        // Send message to extension to reset stats
                        window.parent.postMessage({ command: 'resetTokenStats' }, '*');
                    }
                }
            </script>
        </body>
        </html>
    `;
    
    // Handle messages from webview (optional reset functionality)
    panel.webview.onDidReceiveMessage(message => {
        if (message.command === 'resetTokenStats' && tokenManager) {
            tokenManager.resetDaily();
            vscode.window.showInformationMessage(t('messages.statsReset'));
            // Refresh the panel
            showTokenStats(context);
        }
    });
}

/**
 * Enhanced buildMenuItems with TokenManager integration
 * @param {Object} context - Extension context with dependencies
 * @returns {Array} Menu items array
 */
function buildMenuItems(context) {
    const { 
        t, 
        minimalModelManager, 
        currentModel, 
        aiConversationContext, 
        EXTENSION_VERSION,
        tokenManager  // NEW: TokenManager access
    } = context;
    
    const editor = vscode.window.activeTextEditor;
    const hasSelection = editor && !editor.selection.isEmpty;
    const board = shared.detectArduinoBoard();
    const boardDisplay = shared.getBoardDisplayName(board);
    const model = minimalModelManager.providers[currentModel];
    
    // Core action items (unchanged)
    const coreItems = [
        createMenuItem('$(symbol-method)', 'improveCode', hasSelection, t),
        createMenuItem('$(comment-discussion)', 'explainCode', hasSelection, t),
        createMenuItem('$(edit)', 'addComments', hasSelection, t),
        createMenuItem('$(error)', 'explainError', false, t, 'descriptions.noErrors'),
        createMenuItem('$(bug)', 'debugHelp', false, t, 'descriptions.debugHelp'),
        createMenuItem('$(comment-discussion)', 'askAI', false, t, 'descriptions.askAI')
    ];
    
    // Enhanced conditional items with token info
    const conditionalItems = getConditionalItemsWithTokens(context, hasSelection, boardDisplay, model, EXTENSION_VERSION);
    
    return [...coreItems, ...conditionalItems];
}

/**
 * Enhanced conditional items with token usage display
 * @param {Object} context - Extension context
 * @param {boolean} hasSelection - Whether code is selected
 * @param {string} boardDisplay - Board display name
 * @param {Object} model - Current model info
 * @param {string} version - Extension version
 * @returns {Array} Enhanced conditional menu items
 */
function getConditionalItemsWithTokens(context, hasSelection, boardDisplay, model, version) {
    const { t, aiConversationContext, localeUtils, currentLocale, tokenManager } = context;
    const items = [];
    
    // Follow-up option if context exists
    if (shared.hasValidContext(aiConversationContext)) {
        items.push({
            label: `$(arrow-right) ${t('commands.askFollowUp')}`,
            description: t('descriptions.askFollowUp', 
                formatQuestionPreview(aiConversationContext.lastQuestion, aiConversationContext.timestamp)),
            command: 'aiduino.askFollowUp'
        });
    }
    
    // Enhanced token stats item with current usage
    let tokenStatsDescription = 'Token-Statistik';
    if (tokenManager) {
        const usage = tokenManager.getModelUsage(model.name.toLowerCase());
        const todayCost = usage.cost;
        if (todayCost > 0) {
            tokenStatsDescription = `Heute: $${todayCost.toFixed(3)} (${(usage.input + usage.output)} tokens)`;
        }
    }
    
    // Settings and info items with enhanced descriptions
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
            command: null  // Info only, not clickable
        },
        {
            label: `$(key) ${t('commands.changeApiKey')}`,
            description: `${model.name} Key`,
            command: 'aiduino.setApiKey'
        },
        {
            label: `$(graph) ${t('commands.tokenStats')}`,
            description: tokenStatsDescription,
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
