/**
 * Local Providers Router
 * Routes to appropriate HTTP or Process provider handlers
 */

const claudeCode = require('./processProviders/claudeCode');
const codexCli = require('./processProviders/codexCli'); 
const ollama = require('./httpProviders/ollama');
const lmstudio = require('./httpProviders/lmstudio');  

/**
 * Get HTTP provider handler
 * @param {string} providerName - Provider name (e.g., 'Ollama')
 * @returns {Object|null} Provider handler or null if not found
 */
function getHttpProvider(providerName) {
    const providers = {
        'Ollama': ollama,
        'LM Studio': lmstudio,
    };
    
    return providers[providerName] || null;
}

/**
 * Get Process provider handler
 * @param {string} providerName - Provider name (e.g., 'Claude Code') 
 * @returns {Object|null} Provider handler or null if not found
 */
function getProcessProvider(providerName) {
    const providers = {
        'Claude Code': claudeCode,
        'Codex CLI': codexCli,
    };
    
    return providers[providerName] || null;
}

module.exports = {
    getHttpProvider,
    getProcessProvider
};
