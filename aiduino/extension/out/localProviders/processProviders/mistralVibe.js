/**
 * Mistral Vibe Process Provider
 * Provider-specific logic for Mistral Vibe CLI
 */

const { executeProcessProvider } = require('./processProvider');

/**
 * Build command arguments with session support
 * @param {string} prompt - User prompt
 * @param {string|null} sessionId - Session ID for persistent conversations
 * @param {boolean} agenticMode - If true, allow file editing (always true for Vibe)
 * @param {string|null} modelId - Selected model ID (e.g. 'mistral-large-latest')
 * @returns {Array<string>} Command arguments
 */
function buildArgs(prompt, sessionId = null, agenticMode = false, modelId = null) {
    const args = [
        '--auto-approve',
        '--output', 'json'
    ];
    
    // Note: Mistral Vibe doesn't support --model flag
    // Model must be configured in Vibe's own config
    
    if (sessionId) {
        args.push('--resume', sessionId);
    }
    
    args.push('-p', prompt);
    return args;
}

/**
 * Extract response and session ID from output
 * @param {string} stdout - Raw output from CLI
 * @returns {Object} { response, sessionId }
 */
function extractResponse(stdout) {
    try {
        const jsonResponse = JSON.parse(stdout);
        
        // Vibe returns an array of messages, find the last assistant response
        if (Array.isArray(jsonResponse)) {
            const assistantMessages = jsonResponse.filter(msg => msg.role === 'assistant');
            if (assistantMessages.length > 0) {
                const lastAssistant = assistantMessages[assistantMessages.length - 1];
                return { 
                    response: lastAssistant.content || '', 
                    sessionId: null  // Vibe handles sessions differently
                };
            }
        }
        
        // Fallback for other formats
        const response = jsonResponse.result || jsonResponse.content || stdout;
        const sessionId = jsonResponse.session_id || null;
        return { response, sessionId };
    } catch (e) {
        return { response: stdout, sessionId: null };
    }
}

/**
 * Execute Mistral Vibe command with project awareness
 * @param {string} toolPath - Path to Mistral Vibe CLI
 * @param {string} prompt - User prompt
 * @param {Object} context - Extension context
 * @param {string|null} sessionId - Session ID for persistent conversations
 * @param {string|null} workspacePath - Project directory (used as cwd)
 * @param {boolean} agenticMode - If true, allow file editing
 * @param {string|null} modelId - Selected model ID
 * @returns {Promise<string>} Raw output from Mistral Vibe
 */
async function executeCommand(toolPath, prompt, context, sessionId = null, workspacePath = null, agenticMode = false, modelId = null) {
    const { t } = context;
    const args = buildArgs(prompt, sessionId, agenticMode, modelId);
    
    // Pass workspacePath as cwd so Vibe can access sketch files
    const options = workspacePath ? { cwd: workspacePath } : {};
    
    return executeProcessProvider(toolPath, args, 'Mistral Vibe', t, 300000, options);
}

module.exports = {
    executeCommand,
    extractResponse
};
