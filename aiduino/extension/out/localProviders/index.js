/**
 * Local Providers Router
 * Routes to appropriate HTTP or Process provider handlers
 */

const claudeCode = require('./processProviders/claudeCode');
const ollama = require('./httpProviders/ollama');

/**
 * Get HTTP provider handler
 * @param {string} providerName - Provider name (e.g., 'Ollama')
 * @returns {Object|null} Provider handler or null if not found
 */
function getHttpProvider(providerName) {
    const providers = {
        'Ollama': ollama,
        // Future HTTP providers go here
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
    };
    
    return providers[providerName] || null;
}

module.exports = {
    getHttpProvider,
    getProcessProvider
};
