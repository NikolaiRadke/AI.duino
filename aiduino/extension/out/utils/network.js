/*
 * AI.duino - Network Related Utilities Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const dns = require('dns');
const errorHandling = require('./errorHandling');
const { showOfflineHelp } = require('./panels/offlineHelpPanel');

/**
 * Handle network errors with appropriate error messages
 * @param {Error} error - The network error
 * @param {Function} t - Translation function
 * @returns {Error} Enhanced error with localized message
 */
function handleNetworkError(error, t) {
    const errorMessages = {
        'ENOTFOUND': t('errors.network.dns'),
        'ETIMEDOUT': t('errors.network.timeout'),
        'ECONNREFUSED': t('errors.network.refused'),
        'ECONNRESET': t('errors.network.reset'),
        'EHOSTUNREACH': t('errors.network.hostUnreachable'),
        'ENETUNREACH': t('errors.network.netUnreachable'),
        'ECONNABORTED': t('errors.network.aborted')
    };
    
    const message = errorMessages[error.code] || t('errors.network.general', error.message);
    
    // NEU: Error-Objekt mit Type erstellen
    const enhancedError = new Error(message);
    enhancedError.type = 'NETWORK_ERROR';  // Type setzen
    enhancedError.code = error.code;       // Original-Code behalten
    
    return enhancedError;
}

/**
 * Test basic network connectivity
 * @param {Object} context - Extension context with dependencies
 */
async function testNetworkConnectivity(context) {
    const { t } = context;
    
    const testUrls = [
        'google.com',
        'github.com',
        'cloudflare.com'
    ];
    
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: t('progress.testingConnection'),
        cancellable: false
    }, async () => {
        let connectionWorks = false;
        
        for (const testUrl of testUrls) {
            // Simple DNS lookup test without try-catch - let it fail naturally
            const result = await new Promise((resolve) => {
                dns.lookup(testUrl, (err) => {
                    resolve(!err); // true if no error
                });
            });
            
            if (result) {
                connectionWorks = true;
                break;
            }
        }
        
        if (connectionWorks) {
            vscode.window.showInformationMessage(
                t('messages.connectionOk'),
                t('buttons.checkFirewall')
            ).then(selection => {
                if (selection === t('buttons.checkFirewall')) {
                    errorHandling.showFirewallHelp(context);
                }
            });
        } else {
            vscode.window.showErrorMessage(
                t('messages.noConnection'),
                t('buttons.checkRouter'),
                t('buttons.offlineHelp')
            ).then(selection => {
                if (selection === t('buttons.offlineHelp')) {
                    showOfflineHelp(context);
                }
            });
        }
    });
}

/**
 * Open API key URL for the specified model
 * @param {string} modelId - Model identifier
 */
function openApiKeyUrl(modelId) {
    const urls = {
        claude: 'https://console.anthropic.com/api-keys',
        chatgpt: 'https://platform.openai.com/api-keys',
        gemini: 'https://makersuite.google.com/app/apikey',
        mistral: 'https://console.mistral.ai/',
        groq: 'https://console.groq.com/keys',
        perplexity: 'https://www.perplexity.ai/settings/api',
        cohere: 'https://dashboard.cohere.ai/api-keys'
    };
    
    const url = urls[modelId];
    if (url) {
        vscode.env.openExternal(vscode.Uri.parse(url));
    } else {
        vscode.window.showWarningMessage(t('errors.noApiKeyUrl', modelId));
    }
}

/**
 * Open service status page for the current model
 * @param {string} modelId - Model identifier
 * @param {Object} minimalModelManager - Model manager instance
 * @param {Function} t - Translation function
 */
function openServiceStatusUrl(modelId, minimalModelManager, t) {
    const urls = {
        claude: 'https://status.anthropic.com/',
        chatgpt: 'https://status.openai.com/',
        gemini: 'https://status.cloud.google.com/',
        mistral: 'https://status.mistral.ai/',
        groq: 'https://status.groq.com/',
        perplexity: 'https://status.perplexity.ai/',
        cohere: 'https://status.cohere.ai/'
    };
    
    const url = urls[modelId];
    if (url) {
        vscode.env.openExternal(vscode.Uri.parse(url));
    } else {
        const providerName = minimalModelManager.providers[modelId]?.name || 'Unknown Provider';
        vscode.window.showInformationMessage(t('messages.noStatusPage', providerName));
    }
}

module.exports = {
    handleNetworkError,
    testNetworkConnectivity,
    openApiKeyUrl,
    openServiceStatusUrl
};
