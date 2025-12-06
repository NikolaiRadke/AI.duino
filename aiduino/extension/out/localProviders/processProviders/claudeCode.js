/**
 * Claude Code Process Provider
 * Provider-specific logic for Claude Code CLI
 */

const { executeProcessProvider } = require('./processProvider');
const vscode = require('vscode');

/**
 * Build command arguments with session support
 */
function buildArgs(prompt, sessionId = null) {
    if (sessionId) {
        // Use --resume with session ID (like in terminal test)
        return ['--print', '--resume', sessionId, '--dangerously-skip-permissions', '--output-format', 'json', prompt];
    } else {
        return ['--print', '--dangerously-skip-permissions', '--output-format', 'json', prompt];
    }
}

/**
 * Extract response and session ID from output
 */
function extractResponse(stdout) {
    const vscode = require('vscode');
    try {
        const jsonResponse = JSON.parse(stdout);
        const response = jsonResponse.result || jsonResponse.content || stdout;
        const sessionId = jsonResponse.session_id || null;
        return { response, sessionId };
    } catch (e) {
        return { response: stdout, sessionId: null };
    }
}

/**
 * Execute Claude Code command
 */
async function executeCommand(toolPath, prompt, context, sessionId = null) {
    const { t } = context;
    const args = buildArgs(prompt, sessionId);
    return executeProcessProvider(toolPath, args, 'Claude Code', t);
}

module.exports = {
    executeCommand,
    extractResponse
};
