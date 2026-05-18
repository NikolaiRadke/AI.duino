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
    const args = ['exec', '--skip-git-repo-check'];

    // Add model selection if specified
    if (modelId && modelId !== 'default') {
        args.push('--model', modelId);
    }

    if (sessionId) {
        args.push('--session', sessionId);
    }

    if (agenticMode) {
        args.push('--full-auto');
    }

    args.push('--json');

    /*
     * IMPORTANT:
     *
     * Do not push the full prompt as a command-line argument.
     *
     * The old version did:
     *     args.push(prompt);
     *
     * AI.duino can build very large prompts/context blocks, and Windows/Node can throw:
     *     spawn ENAMETOOLONG
     *
     * Codex CLI supports reading the prompt from stdin when '-' is used:
     *     codex exec -
     *
     * The actual prompt is passed via options.input in executeCommand().
     */
    args.push('-');

    return args;
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

    try {
        // Codex CLI outputs NDJSON (Newline Delimited JSON)
        const lines = rawOutput.trim().split('\n');

        let text = '';
        for (const line of lines) {
            if (!line.trim()) continue;

            try {
                const event = JSON.parse(line);

                // Look for item.completed events with agent_message type
                if (event.type === 'item.completed' &&
                    event.item?.type === 'agent_message' &&
                    event.item?.text) {
                    text += event.item.text + '\n';
                }

                // Some Codex versions may emit slightly different final message shapes.
                if (event.type === 'response.completed' &&
                    event.response?.output_text) {
                    text += event.response.output_text + '\n';
                }

                if (event.type === 'message' && event.message?.content) {
                    text += event.message.content + '\n';
                }
            } catch (e) {
                // Skip invalid JSON lines
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

module.exports = {
    executeCommand,
    extractResponse
};
