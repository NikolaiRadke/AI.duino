/**
 * Claude Code Process Provider
 * Provider-specific logic for Claude Code CLI
 */

const { executeProcessProvider } = require('./processProvider');

/**
 * Build command arguments with session support
 * @param {string} prompt - User prompt
 * @param {string|null} sessionId - Session ID for persistent conversations
 * @param {boolean} agenticMode - If true, don't use --print (allow file editing)
 * @param {string|null} modelId - Selected model ID (e.g. 'claude-sonnet-4-5')
 * @returns {Array<string>} Command arguments
 */
function buildArgs(prompt, sessionId = null, agenticMode = false, modelId = null) {
    const args = [
        '--dangerously-skip-permissions', 
        '--output-format', 'json'
    ];
    
    // Only use --print in non-agentic mode (Claude Code won't edit files with --print)
    if (!agenticMode) {
        args.unshift('--print');
    }
    
    // Add model selection if specified
    if (modelId && modelId !== 'default') {
        args.push('--model', modelId);
    }
    
    if (sessionId) {
        args.push('--resume', sessionId);
    }
    
    args.push(prompt);
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
        const response = jsonResponse.result || jsonResponse.content || stdout;
        const sessionId = jsonResponse.session_id || null;
        return { response, sessionId };
    } catch (e) {
        return { response: stdout, sessionId: null };
    }
}

/**
 * Execute Claude Code command with project awareness
 * @param {string} toolPath - Path to Claude Code CLI
 * @param {string} prompt - User prompt
 * @param {Object} context - Extension context
 * @param {string|null} sessionId - Session ID for persistent conversations
 * @param {string|null} workspacePath - Project directory (used as cwd)
 * @param {boolean} agenticMode - If true, allow file editing
 * @param {string|null} modelId - Selected model ID
 * @returns {Promise<string>} Raw output from Claude Code
 */
async function executeCommand(toolPath, prompt, context, sessionId = null, workspacePath = null, agenticMode = false, modelId = null) {
    const { t } = context;
    const args = buildArgs(prompt, sessionId, agenticMode, modelId);
    
    // Pass workspacePath as cwd so Claude Code can access sketch files
    const options = workspacePath ? { cwd: workspacePath } : {};
    
    return executeProcessProvider(toolPath, args, 'Claude Code', t, 300000, options);
}

module.exports = {
    executeCommand,
    extractResponse
};
