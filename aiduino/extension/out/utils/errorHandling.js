/*
 * AI.duino - Error Handling Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */


const vscode = require('vscode');
const networkUtils = require('./network');
const { showOfflineHelp } = require('./panels/offlineHelpPanel');

/**
 * Handle API errors with appropriate user feedback and recovery options
 * @param {Error} error - The error to handle
 * @param {Object} context - Extension context with dependencies
 */
function handleApiError(error, context) {
    const { t, minimalModelManager, currentModel } = context;
    const model = minimalModelManager.providers[currentModel];

    // DNS/Network Errors - Handle FIRST before adding model context
    if (error.message.includes('DNS resolution failed') || 
        error.message.includes('ENOTFOUND') || 
        error.message.includes('ETIMEDOUT') || 
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('ECONNRESET') ||
        error.message.includes('EHOSTUNREACH') || 
        error.message.includes('ENETUNREACH') ||
        error.message.includes('ECONNABORTED')) {
        
        vscode.window.showErrorMessage(
            error.message,
            t('buttons.retry'),
            t('buttons.offlineHelp'),
            t('buttons.checkConnection')
        ).then(selection => {
            if (selection === t('buttons.retry')) {
                vscode.window.showInformationMessage(t('messages.retryLater'));
            } else if (selection === t('buttons.offlineHelp')) {
                showOfflineHelp(context);
            } else if (selection === t('buttons.checkConnection')) {
                networkUtils.testNetworkConnectivity(context);
            }
        });
        return;
    }

    // Add model context to all other errors
    if (!error.message.includes(model.name)) {
        error.message = `${model.name}: ${error.message}`;
    }
    
    // Use error types for enhanced errors (from enhanceError function)
    if (error.type === 'API_KEY_ERROR') {
        vscode.window.showErrorMessage(
            error.message,  // Already translated by enhanceError()
            t('buttons.enterApiKey'),
            t('buttons.getApiKey'),
            t('buttons.switchModel')
        ).then(selection => {
            if (selection === t('buttons.enterApiKey')) {
                vscode.commands.executeCommand('aiduino.setApiKey');
            } else if (selection === t('buttons.getApiKey')) {
                networkUtils.openApiKeyUrl(currentModel);
            } else if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            }
        });
        return;
    }
    
    // Rate Limiting with token stats
    if (error.type === 'RATE_LIMIT_ERROR') {
        vscode.window.showErrorMessage(
            error.message,  // Already translated
            t('buttons.switchModel'),
            t('buttons.tryLater'),
            t('buttons.showTokenStats')
        ).then(selection => {
            if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            } else if (selection === t('buttons.showTokenStats')) {
                vscode.commands.executeCommand('aiduino.showTokenStats');
            }
        });
        return;
    }

    // Quota Error
    if (error.type === 'QUOTA_ERROR' || error.message.includes('quota')) {
        vscode.window.showErrorMessage(
            t('errors.quotaExceededDetail', model.name),
            t('buttons.switchModel'),
            t('buttons.tryLater')
        ).then(selection => {
            if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            }
        });
        return;
    }   
    
    // Server Errors with status page links
    if (error.type === 'SERVER_ERROR') {
        vscode.window.showErrorMessage(
            error.message,  // Already translated
            t('buttons.tryAgain'),
            t('buttons.switchModel'),
            t('buttons.checkStatus')
        ).then(selection => {
            if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            } else if (selection === t('buttons.checkStatus')) {
                networkUtils.openServiceStatusUrl(currentModel, minimalModelManager, t);
            }
        });
        return;
    }
    
    // Fallback for original API errors that weren't enhanced
    if (error.message.includes('Invalid API Key') || error.message.includes('401') || 
        error.message.includes('403') || error.message.includes('Unauthorized')) {
        
        vscode.window.showErrorMessage(
            `🔒 ${t('errors.invalidApiKey', model.name)}`,
            t('buttons.enterApiKey'),
            t('buttons.getApiKey'),
            t('buttons.switchModel')
        ).then(selection => {
            if (selection === t('buttons.enterApiKey')) {
                vscode.commands.executeCommand('aiduino.setApiKey');
            } else if (selection === t('buttons.getApiKey')) {
                networkUtils.openApiKeyUrl(currentModel);
            } else if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            }
        });
        return;
    }
    
    // Fallback for original rate limit errors
    if (error.message.includes('Rate Limit') || error.message.includes('429')) {
        vscode.window.showErrorMessage(
            t('errors.rateLimit', model.name),
            t('buttons.switchModel'),
            t('buttons.tryLater'),
            t('buttons.showTokenStats')
        ).then(selection => {
            if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            } else if (selection === t('buttons.showTokenStats')) {
                vscode.commands.executeCommand('aiduino.showTokenStats');
            }
        });
        return;
    }
    
    // Fallback for original server errors
    if (error.message.includes('500') || error.message.includes('502') || 
        error.message.includes('503') || error.message.includes('504') ||
        error.message.includes('Server Error') || error.message.includes('Service Unavailable')) {
        
        vscode.window.showErrorMessage(
            t('errors.serverUnavailable', model.name),
            t('buttons.tryAgain'),
            t('buttons.switchModel'),
            t('buttons.checkStatus')
        ).then(selection => {
            if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            } else if (selection === t('buttons.checkStatus')) {
                networkUtils.openServiceStatusUrl(currentModel, minimalModelManager, t);
            }
        });
        return;
    }
    
    // Generic error fallback
    vscode.window.showErrorMessage(
        `${model.name}: ${error.message}`,
        t('buttons.retry'),
        t('buttons.switchModel')
    ).then(selection => {
        if (selection === t('buttons.switchModel')) {
            vscode.commands.executeCommand('aiduino.switchModel');
        }
    });
}

/**
 * Show firewall help information
 * 
 * NOTE: This function was moved from network.js to errorHandling.js to break
 * a circular dependency:
 * - network.js imported errorHandling.js (for error handling)
 * - errorHandling.js imported network.js (for showFirewallHelp)
 * 
 * Solution: Move showFirewallHelp here since it's primarily used in error
 * handling scenarios (API connection failures).
 * 
 * @param {Object} context - Extension context with dependencies
 */
function showFirewallHelp(context) {
    const { t } = context;
    
    vscode.window.showInformationMessage(
        `${t('offline.firewallSettings')}: ${t('offline.ensureNotBlocked')} api.anthropic.com, api.openai.com, generativelanguage.googleapis.com`,
        t('buttons.offlineHelp')
    ).then(selection => {
        if (selection === t('buttons.offlineHelp')) {
            showOfflineHelp({ t });
        }
    });
}

module.exports = {
    handleApiError,
    showFirewallHelp
};
