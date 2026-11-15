/**
 * OpenCode Process Provider
 * Provider-specific logic for OpenCode CLI
 */

const { executeProcessProvider, cleanProcessOutput } = require('./processProvider');

/**
 * Build command arguments with session support
 * Checked against OpenCode 1.18.32: the prompt is read from stdin, so long prompts
 * and quotes are no problem on Windows.
 * @param {string} prompt - User prompt (sent via stdin, not as argument)
 * @param {string|null} sessionId - Session ID for persistent conversations
 * @param {boolean} agenticMode - If true, allow file editing (always true for run mode)
 * @param {string|null} modelId - Selected model ID in OpenCode notation (e.g. 'anthropic/claude-sonnet-4-5', 'ollama/qwen3')
 * @returns {Array<string>} Command arguments
 */
function buildArgs(prompt, sessionId = null, agenticMode = false, modelId = null) {
    const args = ['run', '--format', 'json'];

    // --model provider/model works, local models too (e.g. ollama/<model>)
    if (modelId && modelId !== 'default') {
        args.push('--model', modelId);
    }

    if (sessionId) {
        args.push('--session', sessionId);
    }

    return args;
}

/**
 * Text of an OpenCode error event
 * @param {Object} event - {error: {name, data: {message}}} or {message}
 * @returns {string} Message
 */
function errorText(event) {
    if (typeof event.message === 'string' && event.message) return event.message;
    const error = event.error || {};
    const message = error.data?.message || error.message || '';
    return [error.name, message].filter(Boolean).join(': ') || 'Unknown error';
}

/**
 * Extract response and session ID from output
 * Each line is a JSON object with type, timestamp, sessionID and part
 * (types: step_start, text, tool_use, step_finish, error).
 * @param {string} stdout - Raw output from CLI (NDJSON format)
 * @returns {Object} { response, sessionId }
 */
function extractResponse(stdout) {
    if (!stdout) {
        return { response: '', sessionId: null };
    }

    const lines = stdout.trim().split('\n');
    const texts = [];
    let sessionId = null;
    let error = null;

    for (const line of lines) {
        if (!line.trim()) continue;

        let event;
        try {
            event = JSON.parse(line);
        } catch (e) {
            continue;  // Skip non-JSON lines
        }

        if (event.sessionID && !sessionId) {
            sessionId = event.sessionID;
        }

        // text parts are complete texts, not fragments
        if (event.type === 'text' && event.part?.text?.trim()) {
            texts.push(event.part.text.trim());
        }

        if (event.type === 'error') {
            error = errorText(event);
        }
    }

    // An error event is an error, not an answer
    if (error && texts.length === 0) {
        throw new Error('OpenCode: ' + error);
    }

    return {
        response: texts.join('\n\n') || stdout.trim(),
        sessionId
    };
}

/**
 * Check whether an error means the stored session no longer exists
 * OpenCode prints "Error: Session not found" on stderr (with color codes)
 * @param {string} message - Error message
 * @returns {boolean}
 */
function isStaleSession(message) {
    return /session not found/i.test(cleanProcessOutput(message || ''));
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
    // Prompt via stdin (avoids argument length and quoting problems on Windows)
    const options = workspacePath ? { cwd: workspacePath, input: prompt } : { input: prompt };
    return executeProcessProvider(toolPath, args, 'OpenCode', t, 300000, options);
}

module.exports = {
    executeCommand,
    extractResponse,
    isStaleSession
};
