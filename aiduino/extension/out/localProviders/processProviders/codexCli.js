/**
 * Codex / ChatGPT CLI integration
 * API-identical to claudeCode.js
 */

'use strict';

const { executeProcessProvider, cleanProcessOutput } = require('./processProvider');

/**
 * Build CLI arguments
 * Signature must stay identical to claudeCode.js
 *
 * @param {string} prompt
 * @param {string|null} sessionId
 * @param {boolean} agenticMode
 * @returns {string[]}
 */
function buildArgs(prompt, sessionId = null, agenticMode = false) {
    const args = ['exec', '--skip-git-repo-check'];

    if (sessionId) {
        args.push('--session', sessionId);
    }

    if (agenticMode) {
        args.push('--full-auto');
    }
    
    args.push('--json');
    args.push(prompt);

    return args;
}

/**
 * Extract the actual model response from raw CLI output
 * Signature must stay identical to claudeCode.js
 *
 * @param {string} rawOutput
 * @returns {string}
 */
function extractResponse(rawOutput) {
    if (!rawOutput) {
        return { response: '', sessionId: null };
    }
    
    try {
        // Codex CLI outputs NDJSON - find item.completed events with text
        const lines = rawOutput.split(/\}\s*\{/).map((line, i, arr) => {
            if (i === 0) return line + '}';
            if (i === arr.length - 1) return '{' + line;
            return '{' + line + '}';
        });
        
        let text = '';
        for (const line of lines) {
            try {
                const event = JSON.parse(line);
                if (event.type === 'item.completed' && event.item?.text) {
                    text += event.item.text;
                }
            } catch (e) {
                // Skip invalid JSON
            }
        }
        
        if (text) {
            return { response: text.trim(), sessionId: null };
        }
    } catch (e) {
        // Fallback to raw output
    }
    
    return { response: rawOutput.trim(), sessionId: null };
}

/**
 * Execute the Codex / ChatGPT CLI
 * Signature and parameter order must stay identical to claudeCode.js
 *
 * @param {string} toolPath
 * @param {string} prompt
 * @param {object} context
 * @param {string|null} sessionId
 * @param {string|null} workspacePath
 * @param {boolean} agenticMode
 * @returns {Promise<string>}
 */
async function executeCommand(
    toolPath,
    prompt,
    context,
    sessionId = null,
    workspacePath = null,
    agenticMode = false
) {
    const { t } = context;
    const args = buildArgs(prompt, sessionId, agenticMode);

    const options = workspacePath ? { cwd: workspacePath } : {};

    return executeProcessProvider(
        toolPath,
        args,
        'Codex CLI',
        t,
        300000,
        options
    );
}

module.exports = {
    executeCommand,
    extractResponse
};

