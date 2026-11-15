/*
 * AI.duino - Agentic Client Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 * 
 * Unified client for CLI-based agentic providers (Claude Code, Codex CLI, etc.)
 * These providers can maintain sessions, access the filesystem, and use tools.
 */

"use strict";

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const os = require('os');
const TokenManager = require('./tokenManager');
const shared = require('../shared');
const agentLogin = require('../utils/agentLogin');

const AIDUINO_DIR = path.join(os.homedir(), '.aiduino');
const SESSIONS_FILE = path.join(AIDUINO_DIR, '.aiduino-sessions.json');

// Sketch files the compile loop watches: the sketch folder and src/, like the Arduino build.
// Other subfolders (e.g. Agentuino's agentuino/ project folder) are not part of the sketch.
const SKETCH_EXTENSIONS = ['.ino', '.cpp', '.c', '.h', '.hpp', '.S'];
const SRC_DIR = 'src';

// Fixed rules for agentic mode, independent of the semantic anchors
const AGENTIC_RULES = [
    'When the user asks for code (create, change, fix, extend), write it directly into the sketch files with your file tools. Do not only show it in the chat and do not ask for confirmation first.',
    'For questions, analyses, reviews or explanations, answer without modifying any file.',
    'Work only inside this sketch folder. Ignore the folder agentuino/ if present: it belongs to another extension, its instructions do not apply here.',
    'Additional code files (.h, .cpp) belong in the sketch folder or in src/, otherwise they are not compiled.',
    'NEVER upload the sketch to the board on your own, not even after a successful compile. The board may control motors, relays or other hardware.',
    'Install libraries or board packages (lib install, core install) only after asking the user. They apply to all sketches.',
    'AI.duino compiles the sketch automatically after your changes and shows the result to the user. Do not offer to compile.'
];

/**
 * Agentic client for CLI-based AI providers
 * Provides session management, workspace awareness, and unified interface
 */
class AgenticClient {
    constructor(context = null) {
        this.context = context;
        this.agents = {};
        this.sessions = new Map();
        this.loadSessions();
    }

    /**
     * Load sessions from persistent storage
     */
    loadSessions() {
        try {
            if (fs.existsSync(SESSIONS_FILE)) {
                const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
                Object.entries(data).forEach(([key, value]) => {
                    this.sessions.set(key, value);
                });
            }
        } catch (error) {
            // Session loading failed - start fresh
        }
    }

    /**
     * Save sessions to persistent storage
     */
    saveSessions() {
        try {
            if (!fs.existsSync(AIDUINO_DIR)) {
                fs.mkdirSync(AIDUINO_DIR, { recursive: true });
            }
            const data = Object.fromEntries(this.sessions);
            fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
        } catch (error) {
            // Session saving failed - not critical
        }
    }

    /**
     * Get session key for model and workspace combination.
     * Agentic chats add the chat ID, so every chat continues its own agent session.
     */
    getSessionKey(modelId, workspacePath, chatId = null) {
        const key = `${modelId}:${workspacePath || 'global'}`;
        return chatId ? `${key}#${chatId}` : key;
    }

    /**
     * Call an agentic provider
     * @param {string} modelId - Model identifier
     * @param {string} prompt - User prompt
     * @param {Object} context - Extension context with dependencies
     * @param {Object} options - Optional settings
     * @returns {Promise<string>} AI response text
     */
    async callAgent(modelId, prompt, context, options = {}) {
        const { minimalModelManager, tokenManager, settings, t } = context;
        const provider = minimalModelManager.providers[modelId];

        if (!provider || !provider.agentModule) {
            throw new Error(t('errors.invalidProvider', modelId));
        }

        const agent = this.getAgent(modelId, provider);
        let toolPath = this.getToolPath(modelId, context);
        
        if (!toolPath) {
            throw new Error(t('errors.noPath', provider.name));
        }

        // Extract model ID from apiKey if present (format: path|model-id)
        // Only if model discovery is enabled for this provider
        let selectedModel = null;
        const apiKeyValue = context.apiKeys[modelId];
        if (apiKeyValue && apiKeyValue.includes('|') && provider.modelDiscovery?.enabled) {
            const parts = apiKeyValue.split('|');
            toolPath = parts[0];  // Path to CLI tool
            selectedModel = parts[1];  // Selected model ID
        }

        // Agentic runs work in the sketch folder the compile loop compiles and backs up
        const workspacePath = options.agenticMode 
            ? (options.workspacePath || context.workspacePath || this.getWorkspacePath())
            : null;
        const sessionKey = this.getSessionKey(modelId, workspacePath, options.agenticMode ? options.chatId : null);
        
        // Continue the agent's own session (per chat in agentic mode), so it keeps the conversation
        let sessionId = null;
        if (provider.persistent) {
            sessionId = options.resumeSessionId || this.sessions.get(sessionKey) || null;
        }
        this.lastSessionId = null;

        let result;
        try {
            result = await agent.executeCommand(
                toolPath, 
                prompt, 
                context, 
                sessionId, 
                workspacePath, 
                options.agenticMode || false,
                selectedModel
            );
        } catch (error) {
            // Stale session: clear it and retry without session ID
            const staleSession = typeof agent.isStaleSession === 'function'
                ? agent.isStaleSession(error.message)
                : (error.message || '').includes('session ID');
            if (sessionId && staleSession) {
                this.sessions.delete(sessionKey);
                this.saveSessions();
                result = await agent.executeCommand(
                    toolPath, 
                    prompt, 
                    context, 
                    null,           // no session ID on retry
                    workspacePath, 
                    options.agenticMode || false,
                    selectedModel
                );
            } else {
                throw this.markAuthError(error, provider, toolPath, workspacePath, context);
            }
        }

        let parsed;
        try {
            parsed = this.parseResult(result, agent);
        } catch (error) {
            throw this.markAuthError(error, provider, toolPath, workspacePath, context);
        }
        const { response, sessionId: newSessionId } = parsed;
        this.lastSessionId = newSessionId || sessionId || null;

        if (provider.persistent && newSessionId) {
            this.sessions.set(sessionKey, newSessionId);
            this.saveSessions();
        }

        if (tokenManager) {
            const usage = {
                inputTokens: TokenManager.estimateTokens(prompt, settings),
                outputTokens: TokenManager.estimateTokens(response, settings),
                estimated: true
            };
            tokenManager.update(modelId, usage);
            context.updateStatusBar?.();
        }

        return response;
    }

    /**
     * If an error means a missing or expired login, offer the login in a terminal
     * and mark the error so the generic error handler does not report it again
     * @returns {Error} The error
     */
    markAuthError(error, provider, toolPath, workspacePath, context) {
        if (agentLogin.isAuthError(provider.agentModule, error?.message)) {
            error.type = 'AGENT_AUTH';
            agentLogin.offerLogin(context, provider, toolPath, workspacePath);
        }
        return error;
    }

    /**
     * Fixed rules for agentic mode as a prompt block
     * @returns {string}
     */
    getAgenticRules(sketchPath = null) {
        const rules = [...AGENTIC_RULES];
        if (sketchPath) {
            // Agents like to create a new sketch folder instead of using the open sketch
            const mainFile = path.basename(sketchPath) + '.ino';
            rules.unshift(`The sketch file is ${mainFile} in the current folder. Put the program there; never create a new sketch, sketch folder or second .ino file.`);
        }
        return 'Rules:\n' + rules.map(rule => '- ' + rule).join('\n');
    }

    /**
     * Open code files the agent created, so they appear as tabs in the IDE
     * @param {Map} before - Timestamps before the agent run
     * @param {Map} after - Timestamps after the agent run
     */
    async openNewFiles(before, after) {
        for (const file of after.keys()) {
            if (before.has(file)) continue;
            try {
                const document = await vscode.workspace.openTextDocument(file);
                await vscode.window.showTextDocument(document, {
                    viewColumn: vscode.ViewColumn.One,
                    preview: false,
                    preserveFocus: true
                });
            } catch (error) {
                // Opening is a convenience; the file exists either way
            }
        }
    }

    /**
     * Get or lazy-load an agent module
     */
    getAgent(modelId, provider) {
        if (!this.agents[modelId]) {
            const agentModule = provider.agentModule || modelId;
            try {
                this.agents[modelId] = require(`../localProviders/processProviders/${agentModule}`);
            } catch (error) {
                throw new Error(`Agent module not found: ${agentModule}`);
            }
        }
        return this.agents[modelId];
    }

    /**
     * Get tool path from stored configuration
     */
    getToolPath(modelId, context) {
        const { apiKeys, minimalModelManager } = context;
        const provider = minimalModelManager.providers[modelId];
        
        let toolPath = apiKeys[modelId];
        
        if (!toolPath && provider.processConfig?.command) {
            toolPath = provider.processConfig.command;
        }
        
        return toolPath || null;
    }

    /**
     * Get current workspace path
     */
    getWorkspacePath() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return workspaceFolders[0].uri.fsPath;
        }
        
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            return path.dirname(editor.document.uri.fsPath);
        }
        
        return null;
    }

    /**
     * Parse result from agent execution
     */
    parseResult(result, agent) {
        if (agent.extractResponse && typeof agent.extractResponse === 'function') {
            return agent.extractResponse(result);
        }

        if (typeof result === 'string') {
            return { response: result, sessionId: null };
        }

        return {
            response: result.response || result.text || String(result),
            sessionId: result.sessionId || result.session_id || null
        };
    }

    /**
     * Clear session for a provider
     */
    clearSession(modelId, workspacePath = null) {
        const wsPath = workspacePath || this.getWorkspacePath();
        const sessionKey = this.getSessionKey(modelId, wsPath);
        this.sessions.delete(sessionKey);
        this.saveSessions();
    }

    /**
     * Clear all sessions for a provider
     */
    clearAllSessions(modelId) {
        const keysToDelete = [];
        this.sessions.forEach((value, key) => {
            if (key.startsWith(`${modelId}:`)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => this.sessions.delete(key));
        this.saveSessions();
    }

    /**
     * Get current session ID for a provider
     */
    getSessionId(modelId, workspacePath = null) {
        const wsPath = workspacePath || this.getWorkspacePath();
        const sessionKey = this.getSessionKey(modelId, wsPath);
        return this.sessions.get(sessionKey) || null;
    }

    /**
     * Check if a provider has an active session
     */
    hasSession(modelId, workspacePath = null, chatId = null) {
        const wsPath = workspacePath || this.getWorkspacePath();
        const sessionKey = this.getSessionKey(modelId, wsPath, chatId);
        return this.sessions.has(sessionKey);
    }

    /**
     * Get timestamps of all sketch files
     * @param {string} sketchPath - Path to sketch directory
     * @returns {Map<string, number>} Map of filepath â†’ mtime
     */
    getFileTimestamps(sketchPath) {
        const timestamps = new Map();
        if (!sketchPath || !fs.existsSync(sketchPath)) return timestamps;

        // Sketch folder (not recursive) and src/ (recursive), like the Arduino build
        const scan = (dir, recursive) => {
            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch (error) {
                return;  // Directory read failed
            }
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (recursive) scan(fullPath, true);
                } else if (SKETCH_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
                    try {
                        timestamps.set(fullPath, fs.statSync(fullPath).mtimeMs);
                    } catch (error) {
                        // File vanished between readdir and stat
                    }
                }
            }
        };
        scan(sketchPath, false);
        const srcDir = path.join(sketchPath, SRC_DIR);
        if (fs.existsSync(srcDir)) scan(srcDir, true);
        return timestamps;
    }

    /**
     * Detect if any files changed between two timestamp snapshots
     * @param {Map<string, number>} before - Timestamps before
     * @param {Map<string, number>} after - Timestamps after
     * @returns {boolean} True if files changed
     */
    detectFileChanges(before, after) {
        // New files added?
        for (const [file, mtime] of after) {
            if (!before.has(file) || before.get(file) !== mtime) {
                return true;
            }
        }
        // Files deleted?
        for (const file of before.keys()) {
            if (!after.has(file)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Build retry prompt with compile errors
     * @param {string} originalPrompt - Original user prompt
     * @param {Object} compileResult - Result of shared.compileSketch()
     * @param {boolean} sameSession - The agent still knows the conversation
     * @returns {string} Prompt with error context
     */
    buildRetryPrompt(originalPrompt, compileResult, sameSession) {
        const errorText = compileResult.errorText || (compileResult.errors || []).slice(0, 10).join('\n');
        const intro = `Your last change does not compile. Compiler output:\n\n\`\`\`\n${errorText}\n\`\`\`\n\nPlease fix these errors.`;
        // A new session does not know the original request
        return sameSession ? intro : `${intro} Original request: ${originalPrompt}\n\n${this.getAgenticRules()}`;
    }

    /**
     * Call agent with compile-feedback-loop
     * Automatically retries if compile fails after code changes
     * @param {string} modelId - Model identifier
     * @param {string} prompt - User prompt
     * @param {Object} context - Extension context
     * @param {Object} options - { maxRetries: 3, sketchPath: null, chatId: null, panel: null }
     * @returns {Promise<Object>} { response, compileResult, iterations, cancelled }
     */
    async callAgentWithCompile(modelId, prompt, context, options = {}) {
        const { t } = context;
        const maxRetries = options.maxRetries || 3;
        const sketchPath = options.sketchPath || this.getWorkspacePath();
        const provider = context.minimalModelManager?.providers[modelId];
        
        let lastResponse = '';
        let compileResult = null;
        let iterations = 0;
        let cancelled = false;
        
        // Event-based focus: when chat panel becomes active, refocus editor
        let focusHandler = null;
        if (options.panel) {
            focusHandler = options.panel.onDidChangeViewState(e => {
                if (e.webviewPanel.active) {
                    vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
                }
            });
        }
        
        // Initial focus on editor
        await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
        
        // Save current file if dirty (so Claude Code sees latest changes)
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.isDirty) {
            await editor.document.save();
        }
        
        try {
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: t('progress.askingAI', provider.name),
                cancellable: true
            }, async (progress, token) => {
                
                token.onCancellationRequested(() => { 
                    cancelled = true; 
                    shared.stopCompile();
                });

                // Session of this loop, so retries keep the context of the first run
                let loopSessionId = null;
                
                for (let i = 0; i < maxRetries && !cancelled; i++) {
                    iterations = i + 1;
                    
                    const currentPrompt = i === 0 
                        ? `${prompt}\n\n${this.getAgenticRules(sketchPath)}`
                        : this.buildRetryPrompt(prompt, compileResult, Boolean(loopSessionId));
                    
                    const filesBefore = this.getFileTimestamps(sketchPath);
                    
                    try {
                        lastResponse = await this.callAgent(modelId, currentPrompt, context, {
                            agenticMode: true,
                            workspacePath: sketchPath,
                            chatId: options.chatId || null,
                            resumeSessionId: loopSessionId
                        });
                        loopSessionId = this.lastSessionId;
                    } catch (error) {
                        return { 
                            response: error.message, 
                            compileResult: null, 
                            iterations, 
                            cancelled,
                            error: true 
                        };
                    }
                    
                    if (cancelled) break;
                    
                    const filesAfter = this.getFileTimestamps(sketchPath);
                    const hasChanges = this.detectFileChanges(filesBefore, filesAfter);
                    
                    // The IDE does not always show files created outside of it
                    await this.openNewFiles(filesBefore, filesAfter);

                    if (!hasChanges) {
                        return { 
                            response: lastResponse, 
                            compileResult: null, 
                            iterations, 
                            cancelled,
                            codeChanged: false 
                        };
                    }
                    
                    if (cancelled) break;
                    
                    compileResult = await shared.compileSketch(sketchPath);
                    
                    // Success, missing libraries or no board/compiler: the agent cannot fix those
                    if (compileResult.success || compileResult.missingLibraries || compileResult.setupError) {
                        return { 
                            response: lastResponse, 
                            compileResult, 
                            iterations, 
                            cancelled,
                            codeChanged: true 
                        };
                    }
                }
                
                return { 
                    response: lastResponse, 
                    compileResult, 
                    iterations, 
                    cancelled,
                    codeChanged: true 
                };
            });
            
            return result;
        } finally {
            // Clean up event handler
            if (focusHandler) {
                focusHandler.dispose();
            }
        }
    }

}

module.exports = {
    AgenticClient
};
