/**
 * Groq Code CLI Process Provider
 * Provider-specific logic for Groq Code CLI
 * 
 * NOTE: Requires Node.js v20+ to run (same as Gemini CLI)
 */

const { executeProcessProvider } = require('./processProvider');
const { fileExists, loadNodePath } = require('../../utils/fileManager');

/**
 * Build command arguments
 * @param {string} prompt - User prompt
 * @param {string|null} sessionId - Session ID (CLI manages internally)
 * @param {boolean} agenticMode - If true, allow file editing
 * @returns {Array<string>} Command arguments
 */
function buildArgs(prompt, sessionId = null, agenticMode = false) {
    const args = [];
    
    if (!agenticMode) {
        // Non-agentic mode: Can READ files but NOT EDIT them
        args.push(
            '--system',
            'You are a helpful coding assistant for Arduino projects. Answer questions directly and concisely in German. If you need additional context, you CAN use tools to READ files from the workspace. However, you MUST NOT edit, modify, create, or write any files. Focus on providing clear explanations based on the information available to you.'
        );
    }
    
    args.push('--non-interactive', prompt);
    
    return args;
}

/**
 * Extract response from output
 * @param {string} stdout - Raw output from CLI
 * @returns {Object} { response, sessionId }
 */
function extractResponse(stdout) {
    // Groq Code CLI outputs plain text
    return { 
        response: stdout.trim(), 
        sessionId: null
    };
}

/**
 * Execute Groq Code CLI command with project awareness
 * @param {string} toolPath - Path to Groq Code CLI binary (e.g. 'groq' or full path)
 * @param {string} prompt - User prompt
 * @param {Object} context - Extension context
 * @param {string|null} sessionId - Session ID (not used)
 * @param {string|null} workspacePath - Project directory (used as cwd)
 * @param {boolean} agenticMode - If true, allow file editing
 * @returns {Promise<string>} Raw output from Groq Code CLI
 */
async function executeCommand(toolPath, prompt, context, sessionId = null, workspacePath = null, agenticMode = false) {
    const { t } = context;
    const args = buildArgs(prompt, sessionId, agenticMode);
    
    // Get Node.js v20+ path from fileManager
    const nodePath = loadNodePath();
    
    if (!nodePath || !fileExists(nodePath)) {
        // Show friendly error with instructions
        const vscode = require('vscode');
    
        vscode.window.showErrorMessage(
            t('errors.groqNeedsNode20'),
            t('buttons.configureNodePath')
        ).then(choice => {
            if (choice === t('buttons.configureNodePath')) {
                vscode.commands.executeCommand('aiduino.setNodePath');
            }
        });
    
        throw new Error(t('errors.nodePathNotConfigured'));
    }
    
    // Run: node /path/to/groq [args]
    const groqPath = toolPath;
    const finalArgs = [groqPath, ...args];
    
    const options = workspacePath ? { cwd: workspacePath } : {};
    
    return executeProcessProvider(nodePath, finalArgs, 'Groq Code CLI', t, 300000, options);
}

module.exports = {
    executeCommand,
    extractResponse
};
