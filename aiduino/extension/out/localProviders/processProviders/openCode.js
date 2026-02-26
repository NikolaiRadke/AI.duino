/**
 * OpenCode Process Provider
 * Provider-specific logic for OpenCode CLI
 */

const { executeProcessProvider } = require('./processProvider');

/**
 * Build command arguments with session support
 * @param {string} prompt - User prompt
 * @param {string|null} sessionId - Session ID for persistent conversations
 * @param {boolean} agenticMode - If true, allow file editing (always true for run mode)
 * @param {string|null} modelId - Selected model ID (e.g. 'gpt-4o')
 * @returns {Array<string>} Command arguments
 */
function buildArgs(prompt, sessionId = null, agenticMode = false, modelId = null) {
    const args = ['run', prompt];  // Prompt MUST come directly after 'run'
    
    // Add model selection if specified (after prompt)
    if (modelId) {
        args.push('--model', modelId);
    }
    
    if (sessionId) {
        args.push('-s', sessionId);
    }
    
    return args;
}

/**
 * Extract response and session ID from output
 * @param {string} stdout - Raw output from CLI (NDJSON format)
 * @returns {Object} { response, sessionId }
 */
function extractResponse(stdout) {
    try {
        const lines = stdout.trim().split('\n');
        let response = '';
        let sessionId = null;
        
        for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
                const event = JSON.parse(line);
                
                // Extract session ID from any event
                if (event.sessionID && !sessionId) {
                    sessionId = event.sessionID;
                }
                
                // Extract text content
                if (event.type === 'text' && event.part?.text) {
                    response += event.part.text;
                }
            } catch (e) {
                // Skip invalid JSON lines
            }
        }
        
        return { 
            response: response.trim() || stdout, 
            sessionId 
        };
    } catch (e) {
        return { response: stdout, sessionId: null };
    }
}

/**
 * Execute OpenCode command with project awareness
 * @param {string} toolPath - Path to OpenCode CLI
 * @param {string} prompt - User prompt
 * @param {Object} context - Extension context
 * @param {string|null} sessionId - Session ID for persistent conversations
 * @param {string|null} workspacePath - Project directory (used as cwd)
 * @param {boolean} agenticMode - If true, allow file editing
 * @param {string|null} modelId - Selected model ID
 * @returns {Promise<string>} Raw output from OpenCode
 */
async function executeCommand(toolPath, prompt, context, sessionId = null, workspacePath = null, agenticMode = false, modelId = null) {
    const { t } = context;
    const args = buildArgs(prompt, sessionId, agenticMode, modelId);
    const options = workspacePath ? { cwd: workspacePath } : {};
    return executeProcessProvider(toolPath, args, 'OpenCode', t, 300000, options);
}

module.exports = {
    executeCommand,
    extractResponse
};
