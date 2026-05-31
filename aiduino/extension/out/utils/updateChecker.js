/*
 * AI.duino - Extension Update Checker Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */


const vscode = require('vscode');
const https = require('https');

async function checkExtensionUpdate(currentVersion, t, globalContext) {
    const latestVersion = await fetchLatestVersion();

    if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) return;

    // Read skip version from persistent config
    const config = vscode.workspace.getConfiguration('aiduino');
    const skipVersion = config.get('_skipUpdateVersion');
    if (skipVersion === latestVersion) return;

    const choice = await vscode.window.showInformationMessage(
        t('extensionUpdate.available', currentVersion, latestVersion),
        t('extensionUpdate.download'),
        t('config.updateLater'),
        t('support.noThanks')
    );

    if (choice === t('extensionUpdate.download')) {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/NikolaiRadke/AI.duino/releases/latest'));
    } else if (choice === t('support.noThanks')) {
        await vscode.workspace.getConfiguration('aiduino').update('_skipUpdateVersion', latestVersion, vscode.ConfigurationTarget.Global);
    }
}

function fetchLatestVersion() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            path: '/repos/NikolaiRadke/AI.duino/releases/latest',
            headers: {
                'User-Agent': 'AI.duino-Extension',
                'Accept': 'application/vnd.github+json'
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
                try {
                    const release = JSON.parse(data);
                    // Tags look like "V2.6.8", "V2.6.0_1" or "V2.5.0-Make" - extract clean semver
                    const match = (release.tag_name || '').match(/(\d+\.\d+\.\d+)/);
                    resolve(match ? match[1] : null);
                } catch {
                    resolve(null);
                }
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
