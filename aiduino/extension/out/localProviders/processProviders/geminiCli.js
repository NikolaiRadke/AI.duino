/**
 * Gemini CLI Process Provider
 * Provider-specific logic for Gemini CLI
 * 
 * NOTE: Hardcoded for Node.js v22 path - requires generalization for release
 */

const { executeProcessProvider } = require('./processProvider');
const { fileExists, loadNodePath } = require('../../utils/fileManager');

/**
 * Build command arguments
 * @param {string} prompt - User prompt
 * @param {string|null} sessionId - Not used (Gemini CLI handles sessions internally)
 * @param {boolean} agenticMode - If true, use auto-approve mode
 * @param {string|null} modelId - Selected model ID (e.g. 'gemini-2.5-flash')
 * @returns {Array<string>} Command arguments
 */
function buildArgs(prompt, sessionId = null, agenticMode = false, modelId = null) {
    const args = [];
    
    // Add model selection if specified (must come before -p)
    if (modelId) {
        args.push('--model', modelId);
    }
    
    args.push('-p', prompt, '--output-format', 'json');
    
    // In agentic mode, auto-approve all tool calls (file edits, etc.)
    if (agenticMode) {
        args.push('--approval-mode', 'yolo');
    }
    
    return args;
}

/**
 * Extract response from JSON output
 * @param {string} stdout - Raw output from CLI (JSON format)
 * @returns {Object} { response, sessionId }
 */
function extractResponse(stdout) {
    try {
        const jsonResponse = JSON.parse(stdout);
        
        // Extract the response text
        const response = jsonResponse.response || stdout;
        
        // Extract session_id (note: Gemini CLI uses underscore, not camelCase)
        const sessionId = jsonResponse.session_id || null;
        
        return { response, sessionId };
    } catch (e) {
        // Fallback if JSON parsing fails
        return { response: stdout, sessionId: null };
    }
}

/**
 * Execute Gemini CLI command with project awareness
 * @param {string} toolPath - Path to Gemini CLI binary
 * @param {string} prompt - User prompt
 * @param {Object} context - Extension context
 * @param {string|null} sessionId - Session ID (Gemini CLI handles internally)
 * @param {string|null} workspacePath - Project directory (used as cwd)
 * @param {boolean} agenticMode - If true, allow file editing
 * @param {string|null} modelId - Selected model ID
 * @returns {Promise<string>} Raw output from Gemini CLI
 */
async function executeCommand(toolPath, prompt, context, sessionId = null, workspacePath = null, agenticMode = false, modelId = null) {
    const { t } = context;
    const args = buildArgs(prompt, sessionId, agenticMode, modelId);
    
    // Get Node.js v20+ path from fileManager
    // WICHTIG: providers muss von wo anders kommen!
    const { PROVIDER_CONFIGS } = require('../../config/providerConfigs');
    const nodePath = loadNodePath();
    
    if (!nodePath || !fileExists(nodePath)) {
        // Show friendly error with instructions
        const vscode = require('vscode');
    
        vscode.window.showErrorMessage(
            t('errors.geminiNeedsNode20'), 
            t('buttons.configureNodePath')
        ).then(choice => {
            if (choice === t('buttons.configureNodePath')) {
                vscode.commands.executeCommand('aiduino.setNodePath');
            }
        });
    
        throw new Error(t('errors.nodePathNotConfigured'));
    }
    
    const geminiPath = toolPath;
    const finalArgs = [geminiPath, ...args];
    
    const options = workspacePath ? { cwd: workspacePath } : {};
    
    return executeProcessProvider(nodePath, finalArgs, 'Gemini CLI', t, 300000, options);
}

module.exports = {
    executeCommand,
    extractResponse
};
