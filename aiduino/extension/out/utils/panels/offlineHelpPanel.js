/*
 * AI.duino - Offline Help Panel Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const { getSharedCSS } = require('./sharedStyles');

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
</head>
<body>
    <h1>🔡 ${t('offline.title')}</h1>
    
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

module.exports = { showOfflineHelp };
