/**
 * Mistral Vibe Process Provider
 * Provider-specific logic for Mistral Vibe CLI (requires Vibe 3.0 or newer)
 *
 * vibe -p --output streaming --trust --output-dir <runDir> [--auto-approve] [--resume <id>]
 * The prompt is sent via stdin. Streaming prints one JSON object per session message.
 * Session ID and exit code only come from <runDir>/export.json (checked against Vibe 3.1.2).
 * The message layout is not documented, so parsing is deliberately tolerant.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { executeProcessProvider } = require('./processProvider');

const EXPORT_FILE = 'export.json';
const MIN_VERSION = '3.0';
const UPDATE_HINT = 'uv tool upgrade mistral-vibe';

// Marker between the streamed messages and the export report (added by executeCommand)
const EXPORT_MARKER = '\n__AIDUINO_VIBE_EXPORT__\n';

/**
 * Build command arguments with session support
 * @param {string} runDir - Folder for export.json
 * @param {string|null} sessionId - Session ID for persistent conversations
 * @param {boolean} agenticMode - If true, approve all tools (file editing)
 * @returns {Array<string>} Command arguments
 */
function buildArgs(runDir, sessionId = null, agenticMode = false) {
    const args = ['-p', '--output', 'streaming', '--trust', '--output-dir', runDir];

    // Since Vibe 3.x, -p no longer approves tools on its own
    if (agenticMode) {
        args.push('--auto-approve');
    }

    // Model selection stays in Vibe's own config (--model only works for new sessions)

    if (sessionId) {
        args.push('--resume', sessionId);
    }

    return args;
}

/**
 * Text of a message content (string or list of parts)
 * @param {*} content - Message content
 * @returns {string} Text
 */
function contentText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(part => (typeof part === 'string' ? part : part?.text || '')).join('');
    }
    return '';
}

/**
 * Parse a JSON string safely
 * @param {string} text - JSON text
 * @returns {*} Parsed value or null
 */
function parseJson(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

/**
 * Extract response and session ID from output
 * @param {string} stdout - Streamed messages, optionally followed by the export report
 * @returns {Object} { response, sessionId }
 */
function extractResponse(stdout) {
    if (!stdout) {
        return { response: '', sessionId: null };
    }

    const [stream, exportText] = stdout.split(EXPORT_MARKER);
    const report = exportText ? parseJson(exportText) : null;

    // Collect assistant texts (plain messages and wrapped ones {message: {...}})
    const texts = [];
    const collect = (event) => {
        const message = event?.role ? event : event?.message;
        if (message?.role !== 'assistant') return;
        const text = contentText(message.content).trim();
        if (text) texts.push(text);
    };

    const whole = parseJson(stream.trim());
    if (Array.isArray(whole)) {
        whole.forEach(collect);
    } else {
        for (const line of stream.split('\n')) {
            if (line.trim()) collect(parseJson(line));
        }
    }

    const sessionId = report?.session_id || null;
    const errorMessage = report?.error?.message || '';
    if (texts.length === 0 && errorMessage) {
        throw new Error('Mistral Vibe: ' + errorMessage);
    }

    // The last assistant message is the answer
    return {
        response: texts.length > 0 ? texts[texts.length - 1] : stream.trim(),
        sessionId
    };
}

/**
 * Check whether an error means the stored session no longer exists
 * @param {string} message - Error message
 * @returns {boolean}
 */
function isStaleSession(message) {
    return /session.*not found|no session/i.test(message || '');
}

/**
 * Execute Mistral Vibe command with project awareness
 * @param {string} toolPath - Path to Mistral Vibe CLI
 * @param {string} prompt - User prompt
 * @param {Object} context - Extension context
 * @param {string|null} sessionId - Session ID for persistent conversations
 * @param {string|null} workspacePath - Project directory (used as cwd)
 * @param {boolean} agenticMode - If true, allow file editing
 * @param {string|null} modelId - Selected model ID (unused, see buildArgs)
 * @returns {Promise<string>} Streamed output plus export report
 */
async function executeCommand(toolPath, prompt, context, sessionId = null, workspacePath = null, agenticMode = false, modelId = null) {
    const { t } = context;
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiduino-vibe-'));
    const args = buildArgs(runDir, sessionId, agenticMode);

    // Pass workspacePath as cwd so Vibe can access sketch files, prompt via stdin
    const options = workspacePath ? { cwd: workspacePath, input: prompt } : { input: prompt };

    try {
        const output = await executeProcessProvider(toolPath, args, 'Mistral Vibe', t, 300000, options);
        let report = '';
        try {
            report = fs.readFileSync(path.join(runDir, EXPORT_FILE), 'utf8');
        } catch (e) {
            // No export report - session ID stays unknown
        }
        return report ? output + EXPORT_MARKER + report : output;
    } catch (error) {
        // Vibe 2.x does not know --output-dir and --trust
        if (/unrecognized arguments|no such option|unknown option/i.test(error.message || '')) {
            throw new Error(t('errors.cliTooOld', 'Mistral Vibe', MIN_VERSION, UPDATE_HINT));
        }
        throw error;
    } finally {
        fs.rmSync(runDir, { recursive: true, force: true });
    }
}

module.exports = {
    executeCommand,
    extractResponse,
    isStaleSession
};
