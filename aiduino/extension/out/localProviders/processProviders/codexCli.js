/**
 * Codex CLI Process Provider
 * Provider-specific logic for OpenAI Codex CLI
 */

const { executeProcessProvider, cleanProcessOutput } = require('./processProvider');

/**
 * Build command arguments
 */
function buildArgs(prompt) {
    return ['--suggest', '--non-interactive', prompt];
}

/**
 * Extract response from output
 */
function extractResponse(stdout) {
    try {
        const jsonResponse = JSON.parse(stdout);
        return jsonResponse.response || jsonResponse.output || jsonResponse.text || JSON.stringify(jsonResponse, null, 2);
    } catch {
        return cleanProcessOutput(stdout);
    }
}

/**
 * Execute Codex CLI command
 */
async function executeCommand(toolPath, prompt, context) {
    const { t } = context;
    const args = buildArgs(prompt);
    return executeProcessProvider(toolPath, args, 'Codex CLI', t);
}

module.exports = {
    executeCommand,
    extractResponse
};
