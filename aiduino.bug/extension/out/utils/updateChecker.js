/*
 * AI.duino - Extension Update Checker Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */


const vscode = require('vscode');
const https = require('https');

async function checkExtensionUpdate(currentVersion, t) {
    const latestVersion = await fetchLatestVersion();
    
    if (latestVersion && isNewerVersion(latestVersion, currentVersion)) {
        const choice = await vscode.window.showInformationMessage(
            t('extensionUpdate.available', currentVersion, latestVersion),
            t('extensionUpdate.download'),
            t('config.updateLater') 
        );
        
        if (choice === t('extensionUpdate.download')) {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/NikolaiRadke/AI.duino/releases/latest'));
        }
    }
}

function fetchLatestVersion() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'raw.githubusercontent.com',
            path: '/NikolaiRadke/AI.duino/refs/heads/main/aiduino/extension/package.json',
            headers: {
                'User-Agent': 'AI.duino-Extension'
            },
            timeout: 10000
        };
        
        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                resolve(null);
                return;
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const packageJson = JSON.parse(data);
                resolve(packageJson.version);
            });
        });
        
        req.on('error', () => resolve(null));
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
        
        req.end();
    });
}

function isNewerVersion(latest, current) {
    if (!latest || !current) return false;
    
    const l = latest.split('.').map(n => parseInt(n));
    const c = current.split('.').map(n => parseInt(n));
    
    for (let i = 0; i < 3; i++) {
        if ((l[i] || 0) > (c[i] || 0)) return true;
        if ((l[i] || 0) < (c[i] || 0)) return false;
    }
    return false;
}

module.exports = { checkExtensionUpdate };
