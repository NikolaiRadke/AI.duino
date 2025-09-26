/**
 * Claude Code Process Provider
 * Handles Claude Code CLI tool execution and response processing
 */

/**
 * Execute Claude Code CLI with prompt and context
 * @param {string} toolPath - Path to claude executable
 * @param {string} prompt - User prompt
 * @param {Object} context - Extension context
 * @returns {Promise<string>} Command output
 */
async function executeCommand(toolPath, prompt, context) {
    const { spawn } = require('child_process');
    const { t } = context;
    const args = buildArgs(prompt);
    
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
                reject(new Error(stderr || t('errors.processFailedWithCode', code)));
            }
        });
        
        childProcess.on('error', (error) => {
            if (error.code === 'ENOENT') {
                reject(new Error(t('errors.localProviderNotFound', 'Claude Code', toolPath)));
            } else {
                reject(new Error(t('errors.processError', error.message)));
            }
        });
        
        // 3 minute timeout
        setTimeout(() => {
            childProcess.kill();
            reject(new Error(t('errors.localProviderTimeout')));
        }, 180000);
    });
}

/**
 * Build command arguments for Claude Code CLI
 * @param {string} prompt - Enhanced prompt
 * @param {Object} localContext - Local context
 * @returns {Array} Command arguments
 */
function buildArgs(prompt) {
    return [
        '--print', 
        '--dangerously-skip-permissions',
        '--output-format', 'json',
        prompt
    ];
}

/**
 * Extract response from Claude Code output
 * @param {string} stdout - Command stdout
 * @returns {string} Extracted response
 */
function extractResponse(stdout) {
    try {
        const jsonResponse = JSON.parse(stdout);
        return jsonResponse.result || stdout;
    } catch {
        return stdout; // Fallback to raw text
    }
}

module.exports = {
    executeCommand,
    extractResponse
};
