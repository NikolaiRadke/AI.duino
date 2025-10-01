/*
 * AI.duino - About Panel Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const { getSharedCSS } = require('./sharedStyles');
const { forEachProvider } = require('../../shared');

/**
 * Show About dialog with extension information
 * @param {Object} context - Extension context with dependencies
 */
function showAbout(context) {
    const logoData = require('../../../icons/aiduino-logo');
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
<body class="centered-panel">
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

module.exports = { showAbout };
