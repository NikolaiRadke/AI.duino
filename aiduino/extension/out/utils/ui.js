/**
 * utils/ui.js - UI Display Functions
 * About dialog, token statistics, and offline help panels
 */

const vscode = require('vscode');
const shared = require('../shared');

/**
 * Show About dialog with extension information
 * @param {Object} context - Extension context with dependencies
 */
function showAbout(context) {
    const { t, minimalModelManager, EXTENSION_VERSION } = context;
    
    const panel = vscode.window.createWebviewPanel(
        'aiduinoAbout',
        t('panels.about'),
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    
    // Generate model badges
    let modelBadges = '';
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        const model = minimalModelManager.providers[modelId];
        if (!model) return;
        modelBadges += `
            <span class="model-badge" style="background: ${model.color}; margin: 0 5px;">
                ${model.icon} ${model.name}
            </span>
        `;
    });
    
    // Generate feature list for all models
    let modelFeatures = '';
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        const model = minimalModelManager.providers[modelId];
        if (!model) return;
        modelFeatures += `<div class="feature">${model.icon} ${model.name} ${t('about.integration')}</div>`;
    });
    
    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    padding: 40px;
                    line-height: 1.6;
                    max-width: 600px;
                    margin: 0 auto;
                    text-align: center;
                }
                .logo {
                    font-size: 72px;
                    margin: 20px 0;
                }
                h1 {
                    color: #2196F3;
                    margin-bottom: 10px;
                }
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
            </style>
        </head>
        <body>
            <div class="logo">🤖</div>
            <h1>AI.duino</h1>
            <div class="version">Version ${EXTENSION_VERSION}</div>
            
            <p><strong>${t('about.tagline')}</strong></p>
            
            <div>
                ${modelBadges}
            </div>
            
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
                <br>
                <p><strong>${t('about.tip')}:</strong> ${t('about.tipText')}</p>
            </div>
            
            <div class="license">
                <strong>${t('about.license')}:</strong> Apache License 2.0<br>
                Copyright © 2025 Monster Maker
            </div>
            
            <div class="info-box">
                <h3>${t('about.getApiKeys')}:</h3>
                <p>🤖 <strong>Claude:</strong> <a href="https://console.anthropic.com/api-keys">console.anthropic.com</a></p>
                <p>🧠 <strong>ChatGPT:</strong> <a href="https://platform.openai.com/api-keys">platform.openai.com</a></p>
                <p>💎 <strong>Gemini:</strong> <a href="https://makersuite.google.com/app/apikey">makersuite.google.com</a></p>
                <p>🌟 <strong>Mistral:</strong> <a href="https://console.mistral.ai/">console.mistral.ai</a></p>
            </div>
            
            <div class="credits">
                <p><strong>${t('about.publisher')}:</strong> Monster Maker</p>
                <p><strong>${t('about.repository')}:</strong> <a href="https://github.com/NikolaiRadke/AI.duino">GitHub</a></p>
                <p><strong>${t('about.reportBugs')}:</strong> <a href="https://github.com/NikolaiRadke/AI.duino/issues">Issue Tracker</a></p>
                <br>
                <p><em>${t('about.madeWith')}</em></p>
            </div>
        </body>
        </html>
    `;
}

/**
 * Show token usage statistics
 * @param {Object} context - Extension context with dependencies
 */
function showTokenStats(context) {
    const { t, minimalModelManager, tokenUsage, currentLocale } = context;
    
    let totalCostToday = 0;
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        totalCostToday += tokenUsage[modelId].cost;
    });
    
    const panel = vscode.window.createWebviewPanel(
        'tokenStats',
        t('panels.tokenStats'),
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    
    // Generate statistics cards for all models
    let modelCards = '';
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        const model = minimalModelManager.providers[modelId];
        if (!model) return;
        modelCards += `
            <div class="stat-card">
                <div class="model-name" style="color: ${model.color};">${model.icon} ${model.name}</div>
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
                .tip {
                    background: #fff3cd;
                    padding: 15px;
                    border-radius: 4px;
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
        </html>
    `;
}

/**
 * Show offline help panel
 * @param {Object} context - Extension context with dependencies
 */
function showOfflineHelp(context) {
    const { t } = context;
    
    const panel = vscode.window.createWebviewPanel(
        'aiOfflineHelp',
        t('panels.offlineHelp'),
        vscode.ViewColumn.One,
        {}
    );
    
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
                .tip {
                    background: #e3f2fd;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .warning {
                    background: #fff3cd;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #ffc107;
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
                <ul>
                    <li><code>api.anthropic.com</code> (Claude)</li>
                    <li><code>api.openai.com</code> (ChatGPT)</li>
                    <li><code>generativelanguage.googleapis.com</code> (Gemini)</li>
                    <li><code>api.mistral.ai</code> (Mistral)</li>
                </ul>
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
        </html>
    `;
}

module.exports = {
    showAbout,
    showTokenStats,
    showOfflineHelp
};
