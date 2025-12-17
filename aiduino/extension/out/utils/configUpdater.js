/*
 * AI.duino - Provider Config Updater Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const AIDUINO_DIR = path.join(os.homedir(), '.aiduino');
const USER_CONFIG_FILE = path.join(AIDUINO_DIR, '.aiduino-provider-configs.js');
const BACKUP_SUFFIX = '.backup';

/**
 * Load provider configs with HOME directory override
 * @returns {Object} Provider configurations with version info
 */
function loadProviderConfigs() {
    const userConfigPath = USER_CONFIG_FILE;
    const pluginConfigPath = path.join(__dirname, '..', 'config', 'providerConfigs.js');
    
    // Load both configs to compare versions
    let userConfig = null;
    let pluginConfig = null;
    
    if (fs.existsSync(userConfigPath)) {
        delete require.cache[require.resolve(userConfigPath)];
        userConfig = require(userConfigPath);
    }
    
    if (fs.existsSync(pluginConfigPath)) {
        delete require.cache[require.resolve(pluginConfigPath)];
        pluginConfig = require(pluginConfigPath);
    }
    
    // Compare versions and use newer one
    const userVersion = userConfig?.CONFIG_VERSION || '000000';
    const pluginVersion = pluginConfig?.CONFIG_VERSION || '000000';
    
    if (isNewerVersion(pluginVersion, userVersion)) {
        console.log(`✓ Using plugin config (${pluginVersion}) - newer than user config (${userVersion})`);
        return {
            providers: pluginConfig.PROVIDER_CONFIGS || {},
            version: pluginVersion,
            source: 'plugin',
            path: pluginConfigPath
        };
    } else if (userConfig) {
        console.log(`✓ Using user config (${userVersion})`);
        return {
            providers: userConfig.PROVIDER_CONFIGS || {},
            version: userVersion,
            source: 'user',
            path: userConfigPath
        };
    } else if (pluginConfig) {
        console.log(`✓ Using plugin config (${pluginVersion}) - no user config found`);
        return {
            providers: pluginConfig.PROVIDER_CONFIGS || {},
            version: pluginVersion,
            source: 'plugin',
            path: pluginConfigPath
        };
    }
    
    // Fallback if no config found
    return {
        providers: {},
        version: '000000',
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
    
    const currentVersion = getCurrentConfigVersion();
    const remoteVersion = await getRemoteConfigVersion(context);
    
    if (remoteVersion && isNewerVersion(remoteVersion, currentVersion)) {
        await showUpdateNotification(currentVersion, remoteVersion, context);
    }
}

/**
 * Get remote config version by downloading complete file
 * @param {Object} context - Extension context with URL
 * @returns {Promise<string|null>} Remote config version or null if failed
 */
async function getRemoteConfigVersion(context) {
    const remoteConfig = await fetchRemoteConfig(context);
    return remoteConfig ? extractVersionFromConfig(remoteConfig) : null;
}

/**
 * Download complete remote config
 * @param {Object} context - Extension context with URL
 * @returns {Promise<string|null>} Remote config content or null if failed
 */
function fetchRemoteConfig(context) {
    return new Promise((resolve) => {
        if (!context || !context.REMOTE_CONFIG_URL) {
            resolve(null);
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
                resolve(null);
                return;
            }
            
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });
        
        req.on('error', () => resolve(null));
        req.on('timeout', () => resolve(null));
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
        if (remoteConfig) {
            await updateProviderConfig(remoteConfig, context);
        }
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
}

/**
 * Basic validation of config content
 * @param {string} configContent - Config content to validate
 * @returns {boolean} True if valid
 */
function validateConfigContent(configContent) {
    if (!configContent || typeof configContent !== 'string') return false;
    
    const hasConfigVersion = configContent.includes('CONFIG_VERSION');
    const hasProviderConfigs = configContent.includes('PROVIDER_CONFIGS');
    const hasModuleExports = configContent.includes('module.exports');
    const hasValidSyntax = configContent.includes('{') && configContent.includes('}');
    
    return hasConfigVersion && hasProviderConfigs && hasModuleExports && hasValidSyntax;
}

/**
 * Setup automatic config update checks
 * @param {Object} context - Extension context
 */
function setupAutoUpdates(context) {
    const { settings } = context; 
    const updateCheckDelay = settings?.get('updateCheckDelay') ?? 3000;
    const updateCheckInterval = settings?.get('updateCheckInterval') ?? 86400000;
    
    // Initial check after extension startup
    setTimeout(async () => {
        await checkConfigUpdates(context);
    }, updateCheckDelay);  
    
    // Periodic checks
    const interval = setInterval(async () => {
        await checkConfigUpdates(context);
    }, updateCheckInterval);  
    
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
        const remoteConfig = await fetchRemoteConfig(context);
        if (!remoteConfig) {
            vscode.window.showErrorMessage(t('config.updateFailed', 'Network error'));
            return false;
        }
        
        const remoteVersion = extractVersionFromConfig(remoteConfig);
        await updateProviderConfig(remoteConfig, context);
        
        vscode.window.showInformationMessage(t('config.updateSuccess', remoteVersion));
        return true;
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
