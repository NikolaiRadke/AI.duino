/*
 * AI.duino - Ollama Agentic Provider
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 * 
 * Lightweight agentic coding provider for Ollama
 * Uses shared modules for file operations and HTTP calls
 */

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const contextManager = require('../../utils/contextManager');
const fileManager = require('../../utils/fileManager');

// Session storage using existing fileManager patterns
const SESSION_FILE = '.aiduino-ollama-sessions.json';

/**
 * Execute Ollama command with file editing capabilities
 * @param {string} ollamaUrl - Ollama server URL (format: url|model)
 * @param {string} prompt - User prompt
 * @param {Object} context - Extension context
 * @param {string|null} sessionId - Session ID for persistent conversations
 * @param {string|null} workspacePath - Project directory
 * @param {boolean} agenticMode - If true, allow file editing
 * @returns {Promise<string>} JSON: { response, sessionId }
 */
async function executeCommand(ollamaUrl, prompt, context, sessionId = null, workspacePath = null, agenticMode = false, selectedModel = null) {
    // Clean URL - remove model suffix if present
    ollamaUrl = ollamaUrl.split('|')[0].trim();
    
    const { settings } = context;
    const modelName = selectedModel || settings?.ollama_agentic_model || 'llama3.2-3b-8k';
    
    // Generate or load session
    if (!sessionId) {
        sessionId = 'ollama-' + crypto.randomBytes(16).toString('hex');
    }
    
    // Load conversation history from session
    const messageHistory = loadSessionHistory(sessionId);
    
    // Build prompt with project context if in agentic mode
    let fullPrompt = prompt;
    if (agenticMode && workspacePath) {
        fullPrompt = await buildAgenticPrompt(prompt, workspacePath);
    }
    
    // Call Ollama with history
    const response = await callOllamaHTTP(ollamaUrl, modelName, fullPrompt, messageHistory);
    
    // Save conversation history
    messageHistory.push({ role: 'user', content: fullPrompt });
    messageHistory.push({ role: 'assistant', content: response });
    saveSessionHistory(sessionId, messageHistory);
    
    // Apply code changes if in agentic mode
    if (agenticMode && workspacePath) {
        await applyCodeChanges(response, workspacePath);
    }
    
    // Return response with session ID
    return JSON.stringify({ response, sessionId });
}

/**
 * Build prompt with project context using contextManager
 */
async function buildAgenticPrompt(userPrompt, workspacePath) {
    const sketchFiles = contextManager.getSketchFiles(workspacePath);
    const projectName = path.basename(workspacePath);
    
    let prompt = `You are an Arduino coding assistant. You can modify files directly.

Project: ${projectName}
Location: ${workspacePath}

Files in project:
`;
    
    // Add all sketch files as context
    for (const filePath of sketchFiles) {
        const fileName = path.basename(filePath);
        const content = await fileManager.safeReadFileAsync(filePath, '');
        
        // Limit file size to avoid token overflow
        const lines = content.split('\n');
        const truncated = lines.length > 500 ? '\n... (truncated)' : '';
        
        prompt += `\n=== ${fileName} ===\n${lines.slice(0, 500).join('\n')}${truncated}\n`;
    }
    
    prompt += `\nTask: ${userPrompt}

IMPORTANT: Output complete file contents in code blocks with filename:
\`\`\`filename.ino
[complete code here]
\`\`\`

I will automatically detect and apply changes.`;
    
    return prompt;
}

/**
 * Call Ollama HTTP API with conversation history
 */
async function callOllamaHTTP(baseUrl, modelName, prompt, messageHistory = []) {
    return new Promise((resolve, reject) => {
        const url = new URL(baseUrl);
        
        const requestBody = JSON.stringify({
            model: modelName,
            messages: [...messageHistory, { role: 'user', content: prompt }],
            stream: false
        });
        
        const req = http.request({
            hostname: url.hostname,
            port: url.port || 11434,
            path: '/api/chat',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.message?.content) {
                        resolve(parsed.message.content);
                    } else if (parsed.error) {
                        reject(new Error(parsed.error));
                    } else {
                        reject(new Error('Unexpected Ollama response'));
                    }
                } catch (error) {
                    reject(new Error(`Parse error: ${error.message}`));
                }
            });
        });
        
        req.on('error', error => reject(new Error(`Connection failed: ${error.message}`)));
        req.setTimeout(300000, () => {
            req.destroy();
            reject(new Error('Timeout (5 min)'));
        });
        
        req.write(requestBody);
        req.end();
    });
}

/**
 * Apply code changes using fileManager
 */
async function applyCodeChanges(response, workspacePath) {
    const codeBlocks = extractCodeBlocks(response);
    if (codeBlocks.length === 0) return;
    
    // Find main .ino file as fallback
    const sketchFiles = contextManager.getSketchFiles(workspacePath);
    const mainInoFile = sketchFiles.find(f => f.endsWith('.ino'));
    const mainFileName = mainInoFile ? path.basename(mainInoFile) : null;
    
    for (const block of codeBlocks) {
        const filename = block.filename || mainFileName;
        if (!filename) continue;
        
        const filePath = path.join(workspacePath, filename);
        const success = fileManager.writeFileWithBackup(filePath, block.content);
        
        if (success) {
            console.log(`[Ollama Agentic] Wrote: ${filename}`);
        }
    }
}

/**
 * Extract code blocks from response
 */
function extractCodeBlocks(response) {
    const blocks = [];
    const pattern = /```(\S+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = pattern.exec(response)) !== null) {
        const header = match[1] || '';
        const content = match[2].trim();
        if (!content) continue;
        
        // Extract filename if present
        let filename = null;
        if (header.match(/\.(ino|cpp|c|h|hpp)$/)) {
            filename = header;
        }
        
        blocks.push({ filename, content });
    }
    
    return blocks;
}

/**
 * Session management using fileManager patterns
 */
function loadSessionHistory(sessionId) {
    const content = fileManager.safeReadFile(
        path.join(require('os').homedir(), '.aiduino', SESSION_FILE),
        '{}'
    );
    const sessions = JSON.parse(content);
    return sessions[sessionId] || [];
}

function saveSessionHistory(sessionId, messages) {
    const sessionPath = path.join(require('os').homedir(), '.aiduino', SESSION_FILE);
    const content = fileManager.safeReadFile(sessionPath, '{}');
    const sessions = JSON.parse(content);
    sessions[sessionId] = messages;
    fileManager.atomicWrite(sessionPath, JSON.stringify(sessions, null, 2));
}

/**
 * Extract response for agenticClient compatibility
 */
function extractResponse(output) {
    try {
        return JSON.parse(output);
    } catch {
        return { response: output, sessionId: null };
    }
}

module.exports = {
    executeCommand,
    extractResponse
};
