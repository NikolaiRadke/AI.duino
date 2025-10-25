/**
 * Codex CLI Process Provider
 * Provider-specific logic for OpenAI Codex CLI
 */

const { executeProcessProvider, cleanProcessOutput } = require('./processProvider');

/**
 * Build command arguments with session support
 * @param {string} prompt - User prompt
 * @param {string|null} sessionId - Optional session ID for continuation
 * @returns {Array} Command arguments
 */
function buildArgs(prompt, sessionId = null) {
    if (sessionId) {
        // Continue existing session
        return ['--continue', '--non-interactive', prompt];
    } else {
        // Start new session
        return ['--suggest', '--non-interactive', prompt];
    }
}

/**
 * Extract response and session ID from output
 * @param {string} stdout - Command output
 * @returns {Object} {response: string, sessionId: string|null}
 */
function extractResponse(stdout) {
    try {
        const jsonResponse = JSON.parse(stdout);
        
        // Try to extract session ID from response
        // Codex CLI saves sessions to ~/.codex/sessions/[session-id].jsonl
        // The session ID might be in the response metadata
        const response = jsonResponse.response || jsonResponse.output || jsonResponse.text || JSON.stringify(jsonResponse, null, 2);
        const sessionId = jsonResponse.session_id || jsonResponse.sessionId || null;
        
        return { response, sessionId };
    } catch {
        // Fallback: clean text output, no session ID
        return { 
            response: cleanProcessOutput(stdout), 
            sessionId: null 
        };
    }
}

/**
 * Execute Codex CLI command with optional session continuation
 * @param {string} toolPath - Path to codex binary
 * @param {string} prompt - User prompt
 * @param {Object} context - Extension context
 * @param {string|null} sessionId - Optional session ID
 * @returns {Promise<string>} Command output
 */
async function executeCommand(toolPath, prompt, context, sessionId = null) {
    const { t } = context;
    const args = buildArgs(prompt, sessionId);
    return executeProcessProvider(toolPath, args, 'Codex CLI', t);
}

module.exports = {
    executeCommand,
    extractResponse
};
