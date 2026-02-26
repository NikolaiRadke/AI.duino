/*
 * AI.duino - Uninstaller Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 * 
 * Reads uninstall.json for declarative uninstall configuration
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Load uninstall configuration from uninstall.json
 * @returns {Object} Uninstall configuration
 */
function loadUninstallConfig() {
    const configPath = path.join(__dirname, '..', '..', 'uninstall.json');
    
    if (!fs.existsSync(configPath)) {
        throw new Error('uninstall.json not found');
    }
    
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/**
 * Resolve platform-specific Arduino IDE directory
 * @returns {string} Arduino IDE directory path
 */
function getArduinoIDEDir() {
    const homeDir = os.homedir();
    const platform = process.platform;
    
    if (platform === 'win32') {
        return path.join(homeDir, 'AppData', 'Roaming', 'Arduino IDE');
    } else if (platform === 'darwin') {
        return path.join(homeDir, 'Library', 'Application Support', 'Arduino IDE');
    } else {
        return path.join(homeDir, '.arduinoIDE');
    }
}

/**
 * Resolve path placeholders
 * @param {string} pathStr - Path with placeholders
 * @returns {string} Resolved path
 */
function resolvePath(pathStr) {
    const homeDir = os.homedir();
    const arduinoIDE = getArduinoIDEDir();
    
    return pathStr
        .replace(/^~/, homeDir)
        .replace(/\{arduinoIDE\}/g, arduinoIDE)
        .replace(/\{home\}/g, homeDir);
}

/**
 * Get all paths that will be deleted from uninstall.json
 * @returns {Array} Array of {path, type, exists} objects
 */
function getPathsToDelete() {
    const config = loadUninstallConfig();
    const paths = [];
    
    // Add directories
    if (config.directories) {
        for (const dir of config.directories) {
            const resolved = resolvePath(dir);
            paths.push({
                path: resolved,
                type: 'directory',
                exists: fs.existsSync(resolved)
            });
        }
    }
    
    // Add files
    if (config.files) {
        for (const file of config.files) {
            const resolved = resolvePath(file);
            paths.push({
                path: resolved,
                type: 'file',
                exists: fs.existsSync(resolved)
            });
        }
    }
    
    return paths;
}

/**
 * Uninstall AI.duino using configuration from uninstall.json
 * @param {Object} context - Extension context with dependencies
 */
async function uninstallAiduino(context) {
    const { t, globalContext } = context;
    const config = loadUninstallConfig();
    
    // Check if confirmation is required
    const confirmEnabled = config.confirm?.enabled !== false;
    const doubleConfirm = config.confirm?.double === true;
    
    if (!confirmEnabled) {
        await performUninstall(config, globalContext, t);
        return;
    }
    
    // First confirmation - show what will be deleted
    const pathsToDelete = getPathsToDelete();
    const fileList = pathsToDelete
        .filter(p => p.exists)
        .map(p => `  • ${p.path}`)
        .join('\n');
    
    const firstChoice = await vscode.window.showWarningMessage(
        `${t('uninstall.warning')}\n\n${t('uninstall.willDelete')}:\n\n${fileList}\n\n${t('uninstall.cannotUndo')}`,
        { modal: true },
        t('uninstall.uninstall')
    );
    
    if (firstChoice !== t('uninstall.uninstall')) {
        return; // User cancelled
    }
    
    // Second confirmation if enabled
    if (doubleConfirm) {
        const secondChoice = await vscode.window.showWarningMessage(
            t('uninstall.finalWarning'),
            { modal: true },
            t('uninstall.yesDelete')
        );
        
        if (secondChoice !== t('uninstall.yesDelete')) {
            return; // User cancelled
        }
    }
    
    // Execute uninstall
    await performUninstall(config, globalContext, t);
}

/**
 * Perform the actual uninstall based on configuration
 * @param {Object} config - Uninstall configuration from JSON
 * @param {Object} globalContext - VS Code context
 * @param {Function} t - Translation function
 */
async function performUninstall(config, globalContext, t) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: t('uninstall.removing'),
        cancellable: false
    }, async (progress) => {
        const results = {
            deleted: [],
            failed: [],
            notFound: []
        };
        
        const pathsToDelete = getPathsToDelete();
        
        // Delete directories and files
        for (const item of pathsToDelete) {
            progress.report({ 
                message: `${t('uninstall.deleting')}: ${path.basename(item.path)}` 
            });
            
            if (!item.exists) {
                results.notFound.push(item.path);
                continue;
            }
            
            try {
                if (item.type === 'directory' || fs.statSync(item.path).isDirectory()) {
                    fs.rmSync(item.path, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(item.path);
                }
                results.deleted.push(item.path);
            } catch (error) {
                results.failed.push({ path: item.path, error: error.message });
            }
        }
        
        // Clear GlobalState
        if (config.globalState && config.globalState.length > 0) {
            progress.report({ message: t('uninstall.clearingSettings') });
            await clearGlobalState(config.globalState, globalContext);
        }
        
        // Clear VS Code Settings
        if (config.settings && config.settings.length > 0) {
            progress.report({ message: t('uninstall.clearingSettings') });
            await clearVSCodeSettings(config.settings);
        }
        
        // Show results
        showUninstallResults(results, t);
    });
}

/**
 * Clear GlobalState settings from global-state.json
 * @param {Array} stateKeys - Keys to remove from global state
 * @param {Object} globalContext - VS Code context
 */
async function clearGlobalState(stateKeys, globalContext) {
    const arduinoIdeDir = getArduinoIDEDir();
    const globalStateFile = path.join(arduinoIdeDir, 'plugin-storage', 'global-state.json');
    
    try {
        if (fs.existsSync(globalStateFile)) {
            const data = JSON.parse(fs.readFileSync(globalStateFile, 'utf8'));
            
            for (const key of stateKeys) {
                delete data[key];
            }
            
            fs.writeFileSync(globalStateFile, JSON.stringify(data), 'utf8');
        }
    } catch (error) {
        // Silent fail - can't do anything if file doesn't exist or is locked
    }
}

/**
 * Clear VS Code workspace configuration settings
 * @param {Array} settingKeys - Setting keys to remove
 */
async function clearVSCodeSettings(settingKeys) {
    // Extract prefix from first key (e.g., "aiduino" from "aiduino.language")
    const prefix = settingKeys[0]?.split('.')[0];
    if (!prefix) return;
    
    const config = vscode.workspace.getConfiguration(prefix);
    
    // Remove all settings from both User and Workspace
    for (const fullKey of settingKeys) {
        // Extract just the setting name without prefix
        const key = fullKey.replace(`${prefix}.`, '');
        
        try {
            await config.update(key, undefined, vscode.ConfigurationTarget.Global);
            await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
        } catch (error) {
            // Silent fail - setting might not exist
        }
    }
}

/**
 * Show uninstall results to user
 * @param {Object} results - Results from uninstall operation
 * @param {Function} t - Translation function
 */
function showUninstallResults(results, t) {
    const deletedCount = results.deleted.length;
    const failedCount = results.failed.length;
    
    if (failedCount === 0) {
        vscode.window.showInformationMessage(
            `${t('uninstall.success')} (${deletedCount} ${t('uninstall.itemsDeleted')})`,
            t('buttons.close')
        ).then(() => {
            // Auto-restart after successful uninstall
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        });
    } else {
        const failedList = results.failed.map(f => `  • ${f.path}: ${f.error}`).join('\n');
        vscode.window.showWarningMessage(
            `${t('uninstall.partialSuccess')}\n\n${t('uninstall.deleted')}: ${deletedCount}\n${t('uninstall.failed')}: ${failedCount}\n\n${failedList}`,
            t('buttons.close')
        ).then(() => {
            // Also restart on partial success
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        });
    }
}

/**
 * Check if user has permission to delete paths
 * @returns {boolean} True if likely has permissions
 */
function checkPermissions() {
    try {
        const config = loadUninstallConfig();
        if (!config.directories || config.directories.length === 0) {
            return true;
        }
        
        const firstDir = resolvePath(config.directories[0]);
        
        if (!fs.existsSync(firstDir)) {
            return true; // Nothing to delete
        }
        
        // Try to access the directory
        fs.accessSync(firstDir, fs.constants.W_OK);
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = { 
    uninstallAiduino, 
    getPathsToDelete, 
    checkPermissions,
    loadUninstallConfig 
};
