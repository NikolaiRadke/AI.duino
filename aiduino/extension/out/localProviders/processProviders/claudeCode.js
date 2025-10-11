/*
 * Claude Code Process Provider mit Session Management
 * Nutzt Claude Code's native --continue für echte Persistenz
 */

/**
 * Execute Claude Code CLI with session support
 * @param {string} toolPath - Path to claude executable
 * @param {string} prompt - User prompt
 * @param {Object} context - Extension context
 * @param {string|null} sessionId - Optional session ID to continue
 * @returns {Promise<Object>} {response, sessionId}
 */
async function executeCommand(toolPath, prompt, context, sessionId = null) {
    const { spawn } = require('child_process');
    const { t } = context;
    const args = buildArgs(prompt, sessionId);
    
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
                const errorMessage = stderr || t('errors.processFailedWithCode', code);
                
                // Check for rate limit errors
                if (errorMessage.toLowerCase().includes('rate limit') || 
                    errorMessage.toLowerCase().includes('too many requests') ||
                    errorMessage.toLowerCase().includes('429')) {
                    const rateLimitError = new Error(t('errors.rateLimit', 'Claude Code'));
                    rateLimitError.type = 'RATE_LIMIT_ERROR';
                    reject(rateLimitError);
                    return;
                }
                
                // Check for quota errors
                if (errorMessage.toLowerCase().includes('quota')) {
                    const quotaError = new Error(t('errors.quotaExceeded'));
                    quotaError.type = 'QUOTA_ERROR';
                    reject(quotaError);
                    return;
                }
                
                reject(new Error(errorMessage));
            }
        });
        
        childProcess.on('error', (error) => {
            if (error.code === 'ENOENT') {
                reject(new Error(t('errors.localProviderNotFound', 'Claude Code', toolPath)));
            } else {
                reject(new Error(t('errors.processError', error.message)));
            }
        });
        
        // 5 minute timeout (länger für Sessions)
        setTimeout(() => {
            childProcess.kill();
            reject(new Error(t('errors.localProviderTimeout')));
        }, 300000);
    });
}

/**
 * Build command arguments with session support
 * @param {string} prompt - User prompt
 * @param {string|null} sessionId - Session ID to continue (or null for new session)
 * @returns {Array} Command arguments
 */
function buildArgs(prompt, sessionId = null) {
    if (sessionId) {
        // Continue existing session
        return [
            '--continue',
            '--print',
            '--dangerously-skip-permissions',
            '--output-format', 'json',
            prompt
        ];
    } else {
        // Start new session
        return [
            '--print',
            '--dangerously-skip-permissions',
            '--output-format', 'json',
            prompt
        ];
    }
}

/**
 * Extract response and session ID from Claude Code output
 * @param {string} stdout - Command stdout
 * @returns {Object} {response: string, sessionId: string|null}
 */
function extractResponse(stdout) {
    try {
        const jsonResponse = JSON.parse(stdout);
        
        // Extract response text
        const response = jsonResponse.result || jsonResponse.content || stdout;
        
        // Extract session ID if present
        // Claude Code might return session info in metadata
        const sessionId = jsonResponse.session_id || 
                         jsonResponse.sessionId || 
                         jsonResponse.metadata?.session_id ||
                         null;
        
        return { response, sessionId };
        
    } catch {
        // Not JSON, return as-is without session ID
        return { response: stdout, sessionId: null };
    }
}

module.exports = {
    executeCommand,
    extractResponse
};

