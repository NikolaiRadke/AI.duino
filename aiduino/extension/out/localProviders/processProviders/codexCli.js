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
 * @param {string|null} modelId - Selected model ID (e.g. 'gpt-4o')
 * @returns {string[]}
 */
function buildArgs(prompt, sessionId = null, agenticMode = false, modelId = null) {
    // Checked against codex-cli 0.167: options first, then 'resume <id>', then '-' for stdin
    const args = ['exec', '--json', '--skip-git-repo-check', '--color', 'never'];

    // Agentic mode may write inside the sketch folder. AI.duino compiles itself,
    // so the agent does not need access outside the workspace.
    if (agenticMode) {
        args.push('--sandbox', 'workspace-write');
    }

    // Add model selection if specified
    if (modelId && modelId !== 'default') {
        args.push('--model', modelId);
    }

    // '--session' no longer exists, a session is continued with 'resume <thread_id>'
    if (sessionId) {
        args.push('resume', sessionId);
    }

    /*
     * IMPORTANT:
     *
     * Do not push the full prompt as a command-line argument.
     *
     * AI.duino can build very large prompts/context blocks, and Windows/Node can throw:
     *     spawn ENAMETOOLONG
     *
     * Codex CLI reads the prompt from stdin when '-' is used.
     * The actual prompt is passed via options.input in executeCommand().
     */
    args.push('-');

    return args;
}

/**
 * Get the item type (older versions used item_type and assistant_message)
 * @param {Object} item - Codex item
 * @returns {string} Normalized type
 */
function itemType(item) {
    const type = item?.type || item?.item_type || '';
    return type === 'assistant_message' ? 'agent_message' : type;
}

/**
 * Extract the actual model response from raw CLI output
 * Signature must stay identical to claudeCode.js
 *
 * @param {string} rawOutput
 * @returns {{response: string, sessionId: string|null}}
 */
function extractResponse(rawOutput) {
    if (!rawOutput) {
        return { response: '', sessionId: null };
    }

    // Codex CLI outputs JSONL: thread.started, item.*, turn.completed / turn.failed
    const lines = rawOutput.trim().split('\n');
    let text = '';
    let sessionId = null;
    let failure = null;
    let sawEvent = false;

    for (const line of lines) {
        if (!line.trim()) continue;

        let event;
        try {
            event = JSON.parse(line);
        } catch (e) {
            continue;  // Skip non-JSON lines
        }
        sawEvent = true;

        if (event.type === 'thread.started' && event.thread_id) {
            sessionId = event.thread_id;
        }

        if (event.type === 'item.completed' &&
            itemType(event.item) === 'agent_message' &&
            event.item?.text) {
            text += event.item.text + '\n';
        }

        if (event.type === 'turn.failed') {
            failure = event.error?.message || 'turn failed';
        }
    }

    // A failed turn is an error, not an answer
    if (failure && !text) {
        throw new Error('Codex CLI: ' + failure);
    }

    if (sawEvent && text.trim()) {
        return { response: text.trim(), sessionId };
    }

    // Fallback to raw output (keeps a session ID if one was found)
    return { response: rawOutput.trim(), sessionId };
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
 * @param {string|null} modelId - Selected model ID
 * @returns {Promise<string>}
 */
async function executeCommand(
    toolPath,
    prompt,
    context,
    sessionId = null,
    workspacePath = null,
    agenticMode = false,
    modelId = null
) {
    const { t } = context;
    const args = buildArgs(prompt, sessionId, agenticMode, modelId);

    const options = workspacePath
        ? { cwd: workspacePath, input: prompt }
        : { input: prompt };

    return executeProcessProvider(
        toolPath,
        args,
        'Codex CLI',
        t,
        300000,
        options
    );
}

/**
 * Check whether an error means the stored session no longer exists
 * @param {string} message - Error message
 * @returns {boolean}
 */
function isStaleSession(message) {
    return /no (conversation|session|thread|rollout) found|not found/i.test(message || '');
}

module.exports = {
    executeCommand,
    extractResponse,
    isStaleSession
};
