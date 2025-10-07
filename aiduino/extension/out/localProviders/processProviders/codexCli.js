/**
 * Codex CLI Process Provider
 * Handles OpenAI Codex CLI tool execution and response processing
 */

/**
 * Execute Codex CLI with prompt and context
 * @param {string} toolPath - Path to codex executable (or 'codex' if in PATH)
 * @param {string} prompt - User prompt
 * @param {Object} context - Extension context
 * @returns {Promise<string>} Command output
 */
async function executeCommand(toolPath, prompt, context) {
    const { spawn } = require('child_process');
    const { t } = context;
    const args = buildArgs(prompt);
    
    // Note: User must authenticate via 'codex' CLI first (Sign in with ChatGPT)
    // Auth is stored in ~/.codex/auth.json, no API key needed here
    
    return new Promise((resolve, reject) => {
        const childProcess = spawn(toolPath, args, {
            cwd: '/tmp',
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
            windowsHide: true
        });
        
        childProcess.unref();
        
        let stdout = '';
        let stderr = '';
        
        childProcess.stdout.on('data', (data) => stdout += data.toString());
        childProcess.stderr.on('data', (data) => stderr += data.toString());
        
        childProcess.on('close', (code) => {
            if (code === 0 && stdout.trim()) {
                resolve(stdout.trim());
            } else {
                // Codex CLI might output to stderr for non-errors
                const output = stdout.trim() || stderr.trim();
                if (output) {
                    resolve(output);
                } else {
                    reject(new Error(t('errors.processFailedWithCode', code)));
                }
            }
        });
        
        childProcess.on('error', (error) => {
            if (error.code === 'ENOENT') {
                reject(new Error(t('errors.localProviderNotFound', 'Codex CLI', toolPath)));
            } else {
                reject(new Error(t('errors.processError', error.message)));
            }
        });
        
        // 5 minute timeout (Codex CLI can take longer for complex tasks)
        setTimeout(() => {
            childProcess.kill();
            reject(new Error(t('errors.localProviderTimeout')));
        }, 300000);
    });
}

/**
 * Build command arguments for Codex CLI
 * @param {string} prompt - User prompt
 * @returns {Array} Command arguments
 */
function buildArgs(prompt) {
    return [
        '--suggest',  // Safe mode: shows changes before applying
        '--non-interactive',  // Don't prompt for user input
        prompt
    ];
}

/**
 * Extract response from Codex CLI output
 * @param {string} stdout - Command stdout
 * @returns {string} Extracted response
 */
function extractResponse(stdout) {
    try {
        // Try to parse as JSON first
        const jsonResponse = JSON.parse(stdout);
        
        // Handle different JSON response formats
        if (jsonResponse.response) {
            return jsonResponse.response;
        }
        if (jsonResponse.output) {
            return jsonResponse.output;
        }
        if (jsonResponse.text) {
            return jsonResponse.text;
        }
        
        // If JSON but no recognized field, stringify it
        return JSON.stringify(jsonResponse, null, 2);
    } catch {
        // Not JSON, return as-is
        // Clean up ANSI codes and control characters
        return stdout
            .replace(/\x1b\[[0-9;]*m/g, '')  // Remove ANSI color codes
            .replace(/\r\n/g, '\n')  // Normalize line endings
            .trim();
    }
}

module.exports = {
    executeCommand,
    extractResponse
};
