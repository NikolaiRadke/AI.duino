/**
 * utils/configUpdater.js - Provider Configuration Auto-Updater
 * Automatic updates for provider configs using HOME directory override system
 */

const vscode = require('vscode');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const USER_CONFIG_FILE = path.join(os.homedir(), '.aiduino-provider-configs.js');
const BACKUP_SUFFIX = '.backup';

/**
 * Load provider configs with HOME directory override
 * @returns {Object} Provider configurations with version info
 */
function loadProviderConfigs() {
    // Priority: HOME directory override, then plugin fallback
    const configPaths = [
        USER_CONFIG_FILE,                                              // User override
        path.join(__dirname, '..', 'config', 'providerConfigs.js')   // Plugin fallback
    ];
    
    for (const configPath of configPaths) {
        try {
            if (fs.existsSync(configPath)) {
                // Clear require cache for dynamic loading
                delete require.cache[require.resolve(configPath)];
                
                const config = require(configPath);
                return {
                    providers: config.PROVIDER_CONFIGS || config,
                    version: config.CONFIG_VERSION || '010125',
                    source: configPath.includes('homedir') ? 'user' : 'plugin',
                    path: configPath
                };
            }
        } catch (error) {
            continue; // Try next path
        }
    }
    
    // Fallback if no config found
    return {
        providers: {},
        version: '010125',
        source: 'none',
        path: null
    };
}

/**
 * Get current config version (with HOME override support)
 * @returns {string} Current config version (date format: DDMMYY)
 */
function getCurrentConfigVersion() {
    const config = loadProviderConfigs();
    return config.version;
}

/**
 * Check for config updates (silent background check)
 * @param {Object} context - Extension context with dependencies
 */
async function checkConfigUpdates(context) {
    const config = vscode.workspace.getConfiguration('aiduino');
    
    // Skip if auto-update is disabled
    if (!config.get('autoUpdateConfigs', true)) {
        return;
    }
    
    try {
        const currentVersion = getCurrentConfigVersion();
        const remoteVersion = await getRemoteConfigVersion(context);
        
        if (remoteVersion && isNewerVersion(remoteVersion, currentVersion)) {
            await showUpdateNotification(currentVersion, remoteVersion, context);
        }
    } catch (error) {
        // Silent fail for background checks - auto-update will retry on next startup
    }
}

/**
 * Get remote config version by downloading complete file
 * @param {Object} context - Extension context with URL
 * @returns {Promise<string|null>} Remote config version or null if failed
 */
async function getRemoteConfigVersion(context) {
    try {
        const remoteConfig = await fetchRemoteConfig(context);
        return extractVersionFromConfig(remoteConfig);
    } catch (error) {
        return null;
    }
}

/**
 * Download complete remote config
 * @param {Object} context - Extension context with URL
 * @returns {Promise<string>} Remote config content
 */
function fetchRemoteConfig(context) {
    return new Promise((resolve, reject) => {
        if (!context || !context.REMOTE_CONFIG_URL) {
            reject(new Error('No REMOTE_CONFIG_URL in context'));
            return;
        }
        
        const configUrl = context.REMOTE_CONFIG_URL;
        const url = new URL(configUrl);
        
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            headers: {
                'User-Agent': 'AI.duino-ConfigUpdater/1.0'
            },
            timeout: 15000
        };
        
        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${configUrl}`));
                return;
            }
            
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });
        
        req.on('error', (err) => reject(new Error(`Network error: ${err.message}`)));
        req.on('timeout', () => reject(new Error(`Timeout accessing ${configUrl}`)));
        req.end();
    });
}

/**
 * Update provider config in HOME directory
 * @param {string} remoteConfig - New config content
 * @param {Object} context - Extension context
 */
async function updateProviderConfig(remoteConfig, context) {
    const { t } = context;
    const backupPath = USER_CONFIG_FILE + BACKUP_SUFFIX;
    
    try {
        // Create backup of existing user config if it exists
        if (fs.existsSync(USER_CONFIG_FILE)) {
            fs.copyFileSync(USER_CONFIG_FILE, backupPath);
        }
        
        // Validate remote config before writing
        if (!validateConfigContent(remoteConfig)) {
            throw new Error('Invalid remote config format');
        }
        
        // Write to HOME directory (always writable)
        fs.writeFileSync(USER_CONFIG_FILE, remoteConfig, { mode: 0o600 });
        
        // Show restart notification
        const choice = await vscode.window.showInformationMessage(
            t('config.restartRequired'),
            t('config.restartExtension'),
            t('config.updateLater')
        );
        
        if (choice === t('config.restartExtension')) {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
        
    } catch (error) {
        // Restore backup on error
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, USER_CONFIG_FILE);
        }
        throw error;
    }
}

/**
 * Show update notification to user
 * @param {string} currentVersion - Current version
 * @param {string} remoteVersion - Available version
 * @param {Object} context - Extension context
 */
async function showUpdateNotification(currentVersion, remoteVersion, context) {
    const { t } = context;
    
    const choice = await vscode.window.showInformationMessage(
        t('config.updateAvailable', currentVersion, remoteVersion),
        t('config.updateNow'),
        t('config.updateLater')
    );
    
    if (choice === t('config.updateNow')) {
        const remoteConfig = await fetchRemoteConfig(context);
        await updateProviderConfig(remoteConfig, context);
    }
}

/**
 * Extract version from config content
 * @param {string} configContent - Config file content
 * @returns {string} Version string (DDMMYY format)
 */
function extractVersionFromConfig(configContent) {
    const match = configContent.match(/CONFIG_VERSION\s*=\s*['"]([\d]{6})['"];?/);
    return match ? match[1] : '010125';
}

/**
 * Check if remote version is newer than current
 * @param {string} remoteVersion - Remote version (DDMMYY)
 * @param {string} currentVersion - Current version (DDMMYY)
 * @returns {boolean} True if remote is newer
 */
function isNewerVersion(remoteVersion, currentVersion) {
    try {
        const parseVersionDate = (version) => {
            if (!version || version.length !== 6) {
                return new Date(0);
            }
            
            const dd = parseInt(version.substr(0, 2), 10);
            const mm = parseInt(version.substr(2, 2), 10);
            const yy = parseInt(version.substr(4, 2), 10);
            const fullYear = 2000 + yy;
            
            return new Date(fullYear, mm - 1, dd);
        };
        
        return parseVersionDate(remoteVersion) > parseVersionDate(currentVersion);
    } catch (error) {
        return remoteVersion > currentVersion;
    }
}

/**
 * Basic validation of config content
 * @param {string} configContent - Config content to validate
 * @returns {boolean} True if valid
 */
function validateConfigContent(configContent) {
    try {
        const hasConfigVersion = configContent.includes('CONFIG_VERSION');
        const hasProviderConfigs = configContent.includes('PROVIDER_CONFIGS');
        const hasModuleExports = configContent.includes('module.exports');
        const hasValidSyntax = configContent.includes('{') && configContent.includes('}');
        
        return hasConfigVersion && hasProviderConfigs && hasModuleExports && hasValidSyntax;
    } catch (error) {
        return false;
    }
}

/**
 * Setup automatic config update checks
 * @param {Object} context - Extension context
 */
function setupAutoUpdates(context) {
    // Initial check after extension startup (like Arduino IDE)
    setTimeout(async () => {
        await checkConfigUpdates(context);
    }, 3000);
    
    // Periodic checks (daily)
    const interval = setInterval(async () => {
        await checkConfigUpdates(context);
    }, UPDATE_CHECK_INTERVAL);
    
    // Store interval for cleanup
    if (context.globalContext && context.globalContext.subscriptions) {
        context.globalContext.subscriptions.push({
            dispose: () => {
                if (interval) {
                    clearInterval(interval);
                }
            }
        });
    }
}

/**
 * Handle API errors that might indicate outdated configs
 * @param {Error} error - API error
 * @param {Object} context - Extension context
 */
async function handleDeprecationError(error, context) {
    const { t } = context;
    const deprecationKeywords = [
        'decommissioned',
        'deprecated', 
        'no longer supported',
        'has been removed',
        'discontinued'
    ];
    
    const isDeprecationError = deprecationKeywords.some(keyword => 
        error.message.toLowerCase().includes(keyword)
    );
    
    if (isDeprecationError) {
        const choice = await vscode.window.showWarningMessage(
            t('config.modelOutdated'),
            t('config.updateNow'),
            t('config.notNow')
        );
        
        if (choice === t('config.updateNow')) {
            return await forceConfigUpdate(context);
        }
    }
    
    return false;
}

/**
 * Force immediate config update (user-triggered)
 * @param {Object} context - Extension context with dependencies
 */
async function forceConfigUpdate(context) {
    const { t } = context;
    
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: t('config.updatingConfigs'),
        cancellable: false
    }, async () => {
        try {
            const remoteConfig = await fetchRemoteConfig(context);
            const remoteVersion = extractVersionFromConfig(remoteConfig);
            
            await updateProviderConfig(remoteConfig, context);
            
            vscode.window.showInformationMessage(
                t('config.updateSuccess', remoteVersion)
            );
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(
                t('config.updateFailed', error.message)
            );
            return false;
        }
    });
}

module.exports = {
    loadProviderConfigs,
    checkConfigUpdates,
    setupAutoUpdates,
    handleDeprecationError,
    getCurrentConfigVersion,
    isNewerVersion
};
