/*
 * AI.duino - Uninstaller Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Uninstall AI.duino with double confirmation
 * Removes all files, directories and settings
 * @param {Object} context - Extension context with dependencies
 */
async function uninstallAiduino(context) {
    const { t, globalContext } = context;
    
    // First confirmation - show what will be deleted
    const pathsToDelete = getPathsToDelete();
    const fileList = pathsToDelete.map(p => `  • ${p.path}`).join('\n');
    
    const firstChoice = await vscode.window.showWarningMessage(
        `${t('uninstall.warning')}\n\n${t('uninstall.willDelete')}:\n\n${fileList}\n\n${t('uninstall.cannotUndo')}`,
        { modal: true },
        t('uninstall.uninstall'),
    );
    
    if (firstChoice !== t('uninstall.uninstall')) {
        return; // User cancelled
    }
    
    // Second confirmation - final warning
    const secondChoice = await vscode.window.showWarningMessage(
        t('uninstall.finalWarning'),
        { modal: true },
        t('uninstall.yesDelete')
    );
    
    if (secondChoice !== t('uninstall.yesDelete')) {
        return; // User cancelled
    }
    
    // Execute uninstall
    await performUninstall(pathsToDelete, globalContext, t);
}

/**
 * Get all paths that will be deleted (platform-specific)
 * @returns {Array} Array of {path, exists} objects
 */
function getPathsToDelete() {
    const homeDir = os.homedir();
    const platform = process.platform;
    
    // Platform-specific Arduino IDE directory
    let arduinoIdeDir;
    if (platform === 'win32') {
        // Windows: %APPDATA%\Arduino IDE
        arduinoIdeDir = path.join(homeDir, 'AppData', 'Roaming', 'Arduino IDE');
    } else if (platform === 'darwin') {
        // macOS: ~/Library/Application Support/Arduino IDE
        arduinoIdeDir = path.join(homeDir, 'Library', 'Application Support', 'Arduino IDE');
    } else {
        // Linux: ~/.arduinoIDE
        arduinoIdeDir = path.join(homeDir, '.arduinoIDE');
    }
    
    const paths = [
        {
            path: path.join(homeDir, '.aiduino'),
            description: 'API Keys, Settings, Chats, Token Stats'
        },
        {
            path: path.join(arduinoIdeDir, 'extensions', 'aiduino.vsix'),
            description: 'Extension Package'
        },
        {
            path: path.join(arduinoIdeDir, 'deployedPlugins', 'aiduino'),
            description: 'Deployed Plugin Files'
        }
    ];
    
    // Check which paths exist
    return paths.map(p => ({
        ...p,
        exists: fs.existsSync(p.path)
    }));
}

/**
 * Perform the actual uninstall
 * @param {Array} paths - Paths to delete
 * @param {Object} globalContext - VS Code context
 * @param {Function} t - Translation function
 */
async function performUninstall(paths, globalContext, t) {
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
        
        // Delete directories and files
        for (const item of paths) {
            progress.report({ message: `${t('uninstall.deleting')}: ${path.basename(item.path)}` });
            
            if (!item.exists) {
                results.notFound.push(item.path);
                continue;
            }
            
            try {
                if (fs.statSync(item.path).isDirectory()) {
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
        progress.report({ message: t('uninstall.clearingSettings') });
        await clearGlobalState(globalContext);
        
        // Show results
        showUninstallResults(results, t);
    });
}

/**
 * Clear all GlobalState settings from global-state.json
 * @param {Object} globalContext - VS Code context
 */
async function clearGlobalState(globalContext) {
    const platform = process.platform;
    const homeDir = os.homedir();
    
    let arduinoIdeDir;
    if (platform === 'win32') {
        arduinoIdeDir = path.join(homeDir, 'AppData', 'Roaming', 'Arduino IDE');
    } else if (platform === 'darwin') {
        arduinoIdeDir = path.join(homeDir, 'Library', 'Application Support', 'Arduino IDE');
    } else {
        arduinoIdeDir = path.join(homeDir, '.arduinoIDE');
    }
    
    const globalStateFile = path.join(arduinoIdeDir, 'plugin-storage', 'global-state.json');
    
    try {
        if (fs.existsSync(globalStateFile)) {
            const data = JSON.parse(fs.readFileSync(globalStateFile, 'utf8'));
            delete data['monstermaker.aiduino'];
            fs.writeFileSync(globalStateFile, JSON.stringify(data), 'utf8');
        }
    } catch (error) {
        // Silent fail - can't do anything if file doesn't exist or is locked
    }

    // Also clear VS Code workspace configuration settings
    await clearVSCodeSettings();
}


/**
 * Clear all aiduino.* settings from VS Code workspace configuration
 */
async function clearVSCodeSettings() {
    const config = vscode.workspace.getConfiguration('aiduino');
    
    // List of all VS Code configuration keys used by aiduino
    const configKeys = [
        'language',
        'autoDetectErrors', 
        'defaultModel',
        'maxTokensPerRequest',
        'temperature',
        'customInstructionsEnabled',
        'inlineCompletionEnabled',
        'maxCustomAgents',
        // Token
        'tokenEstimationMultiplier',
        'tokenEstimationCodeBlock',
        'tokenEstimationSpecialChars',
        // Performance
        'apiTimeout',
        'apiMaxRetries',
        // Chat
        'maxChats',
        'maxMessagesPerChat',
        // Inline Completion Details
        'inlineCompletionDelay',
        'inlineCompletionContextLines',
        'inlineCompletionMinCommentLength',
        'inlineCompletionMaxLinesComment',
        'inlineCompletionMaxLinesSimple'
    ];
    
    // Remove all settings from both User and Workspace
    for (const key of configKeys) {
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
    const homeDir = os.homedir();
    const testPath = path.join(homeDir, '.aiduino');
    
    if (!fs.existsSync(testPath)) {
        return true; // Nothing to delete
    }
    
    try {
        // Try to access the directory
        fs.accessSync(testPath, fs.constants.W_OK);
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = { uninstallAiduino, getPathsToDelete, checkPermissions };
