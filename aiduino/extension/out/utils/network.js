/**
 * utils/network.js - Network-related Functions
 * Network error handling, connectivity testing, and external URL management
 */

const vscode = require('vscode');

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
    return new Error(message);
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
            try {
                // Simple DNS lookup test
                const dns = require('dns');
                await new Promise((resolve, reject) => {
                    dns.lookup(testUrl, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                connectionWorks = true;
                break;
            } catch (error) {
                continue;
            }
        }
        
        if (connectionWorks) {
            vscode.window.showInformationMessage(
                t('messages.connectionOk'),
                t('buttons.checkFirewall')
            ).then(selection => {
                if (selection === t('buttons.checkFirewall')) {
                    showFirewallHelp(context);
                }
            });
        } else {
            vscode.window.showErrorMessage(
                t('messages.noConnection'),
                t('buttons.checkRouter'),
                t('buttons.offlineHelp')
            ).then(selection => {
                if (selection === t('buttons.offlineHelp')) {
                    const uiTools = require('./ui');
                    uiTools.showOfflineHelp(context);
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
        vscode.window.showWarningMessage(`No API key URL configured for ${modelId}`);
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

/**
 * Show firewall help information
 * @param {Object} context - Extension context with dependencies
 */
function showFirewallHelp(context) {
    const { t } = context;
    
    vscode.window.showInformationMessage(
        `${t('offline.firewallSettings')}: ${t('offline.ensureNotBlocked')} api.anthropic.com, api.openai.com, generativelanguage.googleapis.com`,
        t('buttons.offlineHelp')
    ).then(selection => {
        if (selection === t('buttons.offlineHelp')) {
            const uiTools = require('./ui');
            uiTools.showOfflineHelp(context);
        }
    });
}

module.exports = {
    handleNetworkError,
    testNetworkConnectivity,
    openApiKeyUrl,
    openServiceStatusUrl
};
