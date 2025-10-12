/*
 * AI.duino - Process Provider Handler
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 * 
 * Central handler for all process-based local providers (Claude Code, Codex CLI, etc.)
 */

const { spawn } = require('child_process');

/**
 * Execute a process-based provider command
 * Uses provider configuration from providerConfigs.js
 * @param {string} toolPath - Path to executable
 * @param {string} prompt - User prompt
 * @param {Object} context - Extension context
 * @param {Object} provider - Provider configuration from providerConfigs.js
 * @param {string|null} sessionId - Optional session ID (for persistent providers)
 * @returns {Promise<string|Object>} Provider response (string or {response, sessionId})
 */
async function executeCommand(toolPath, prompt, context, provider, sessionId = null) {
    const { t } = context;
    const { processConfig } = provider;
    
    if (!processConfig) {
        throw new Error(`No processConfig found for provider: ${provider.name}`);
    }
    
    // Build arguments using provider config
    let args;
    if (typeof processConfig.buildArgs === 'function') {
        args = processConfig.buildArgs(prompt, context, sessionId);
    } else {
        args = [prompt];
    }
    
    // Execute process
    const output = await executeProcessProvider(
        toolPath, 
        args, 
        provider.name, 
        t, 
        processConfig.timeout || 300000
    );
    
    // Extract response using provider config
    if (processConfig.extractResponse && typeof processConfig.extractResponse === 'function') {
        return processConfig.extractResponse(output);
    }
    
    // Default: return raw output
    return output;
}

/**
 * Execute a process-based provider with standard error handling
 * @param {string} toolPath - Path to executable
 * @param {Array} args - Command arguments
 * @param {string} providerName - Provider name for error messages
 * @param {Function} t - Translation function
 * @param {number} timeout - Timeout in milliseconds (default: 300000 = 5 min)
 * @returns {Promise<string>} stdout output
 */
async function executeProcessProvider(toolPath, args, providerName, t, timeout = 300000) {
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
        
        // Collect output
        childProcess.stdout.on('data', (data) => stdout += data.toString());
        childProcess.stderr.on('data', (data) => stderr += data.toString());
        
        // Handle process close
        childProcess.on('close', (code) => {
            const result = handleProcessClose(code, stdout, stderr, providerName, t);
            if (result.success) {
                resolve(result.data);
            } else {
                reject(result.error);
            }
        });
        
        // Handle process errors
        childProcess.on('error', (error) => {
            if (error.code === 'ENOENT') {
                reject(new Error(t('errors.localProviderNotFound', providerName, toolPath)));
            } else {
                reject(new Error(t('errors.processError', error.message)));
            }
        });
        
        // Setup timeout
        setTimeout(() => {
            childProcess.kill();
            reject(new Error(t('errors.localProviderTimeout')));
        }, timeout);
    });
}

/**
 * Handle process close event with error detection
 * @param {number} code - Exit code
 * @param {string} stdout - Standard output
 * @param {string} stderr - Standard error
 * @param {string} providerName - Provider name for error messages
 * @param {Function} t - Translation function
 * @returns {Object} {success: boolean, data?: string, error?: Error}
 */
function handleProcessClose(code, stdout, stderr, providerName, t) {
    if (code === 0 && stdout.trim()) {
        return { success: true, data: stdout.trim() };
    }
    
    const errorMessage = stderr.trim();
    
    if (errorMessage) {
        // Check for rate limit errors
        if (errorMessage.toLowerCase().includes('rate limit') || 
            errorMessage.toLowerCase().includes('too many requests') ||
            errorMessage.toLowerCase().includes('429')) {
            const error = new Error(t('errors.rateLimit', providerName));
            error.type = 'RATE_LIMIT_ERROR';
            return { success: false, error };
        }
        
        // Check for quota errors
        if (errorMessage.toLowerCase().includes('quota')) {
            const error = new Error(t('errors.quotaExceeded'));
            error.type = 'QUOTA_ERROR';
            return { success: false, error };
        }
        
        // Generic error from stderr
        return { success: false, error: new Error(errorMessage) };
    } else if (stdout.trim()) {
        // No stderr error, but we have stdout - treat as success even if code !== 0
        return { success: true, data: stdout.trim() };
    } else {
        // No stderr, no stdout - generic failure
        const error = new Error(t('errors.processFailedWithCode', code));
        return { success: false, error };
    }
}

/**
 * Clean ANSI codes and control characters from output
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanProcessOutput(text) {
    return text
        .replace(/\x1b\[[0-9;]*m/g, '')  // Remove ANSI color codes
        .replace(/\r\n/g, '\n')          // Normalize line endings
        .trim();
}

module.exports = {
    executeCommand,
    executeProcessProvider,
    cleanProcessOutput
};
