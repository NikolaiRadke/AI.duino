/*
 * AI.duino - Token Stats Panel Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const { getSharedCSS } = require('./sharedStyles');
const { forEachProvider, calculateTotalCost } = require('../../shared');

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

module.exports = { 
    showTokenStats
 };
