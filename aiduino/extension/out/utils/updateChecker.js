/**
 * Extension Update Checker
 * Checks for new extension versions and notifies users
 */

const vscode = require('vscode');
const https = require('https');

async function checkExtensionUpdate(currentVersion, t) {
    try {
        const latestVersion = await fetchLatestVersion();
        
        if (isNewerVersion(latestVersion, currentVersion)) {
            const choice = await vscode.window.showInformationMessage(
                t('extensionUpdate.available', currentVersion, latestVersion),
                t('extensionUpdate.download'),
                t('config.updateLater') 
            );
            
            if (choice === t('extensionUpdate.download')) {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/NikolaiRadke/AI.duino/releases/latest'));
            }
        }
    } catch (error) {
        // Silent error
    }
}

function fetchLatestVersion() {
    return new Promise((resolve, reject) => {
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
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const packageJson = JSON.parse(data);
                    resolve(packageJson.version);
                } catch (e) { 
                    reject(new Error('Invalid JSON'));
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        
        req.end();
    });
}

function isNewerVersion(latest, current) {
    const l = latest.split('.').map(n => parseInt(n));
    const c = current.split('.').map(n => parseInt(n));
    
    for (let i = 0; i < 3; i++) {
        if ((l[i] || 0) > (c[i] || 0)) return true;
        if ((l[i] || 0) < (c[i] || 0)) return false;
    }
    return false;
}

module.exports = { checkExtensionUpdate };
