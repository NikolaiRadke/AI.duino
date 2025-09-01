/**
 * utils/statusBar.js - Status Bar Management
 * Handles status bar display, tooltips, and state management
 */

const vscode = require('vscode');

/**
 * Update status bar with current model info and token usage
 * @param {Object} context - Extension context with dependencies
 */
function updateStatusBar(context) {
    const { statusBarItem, minimalModelManager, currentModel, tokenUsage, apiKeys } = context;
    
    if (!statusBarItem) return;
    
    const providerInfo = minimalModelManager.getProviderInfo(currentModel);
    const hasApiKey = providerInfo.hasApiKey;
    
    // Token cost display (existing logic)
    const todayCost = tokenUsage[currentModel]?.cost.toFixed(3) || '0.000';
    const costDisplay = todayCost > 0 ? ` (${todayCost})` : '';
    
    if (hasApiKey) {
        statusBarItem.text = `${providerInfo.icon} AI.duino${costDisplay}`;
        
        // Model status without t() function calls
        const modelStatus = providerInfo.isLatest ? 
            `Latest: ${providerInfo.modelName}` :
            `Fallback: ${providerInfo.modelName}`;
            
        statusBarItem.tooltip = 
            `${providerInfo.name} - ${modelStatus}\n` +
            `Tokens: ${(tokenUsage[currentModel]?.input || 0) + (tokenUsage[currentModel]?.output || 0)}${costDisplay}\n` +
            `Input: ${tokenUsage[currentModel]?.input || 0} | Output: ${tokenUsage[currentModel]?.output || 0}`;
            
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = `${providerInfo.icon} AI.duino $(warning)`;
        statusBarItem.tooltip = `No API key for ${providerInfo.name}`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

/**
 * Create and initialize status bar item
 * @returns {vscode.StatusBarItem} Created status bar item
 */
function createStatusBarItem() {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "aiduino.quickMenu";
    statusBarItem.show();
    return statusBarItem;
}

/**
 * Show error state in status bar
 * @param {Object} context - Extension context with dependencies
 * @param {number} errorCount - Number of errors found
 */
function showErrorState(context, errorCount) {
    const { statusBarItem, minimalModelManager, currentModel } = context;
    
    if (!statusBarItem) return;
    
    const model = minimalModelManager.providers[currentModel];
    statusBarItem.text = `${model.icon} AI.duino $(error)`;
    statusBarItem.tooltip = `${errorCount} errors found - Click for help`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    
    // Reset after 5 seconds
    setTimeout(() => {
        const currentDiagnostics = vscode.languages.getDiagnostics();
        const hasCurrentErrors = Array.from(currentDiagnostics.values())
            .some(diagnostics => diagnostics.some(d => d.severity === vscode.DiagnosticSeverity.Error));
        
        if (!hasCurrentErrors) {
            updateStatusBar(context);
        }
    }, 5000);
}

module.exports = {
    updateStatusBar,
    createStatusBarItem,
    showErrorState
};
