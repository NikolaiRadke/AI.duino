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

const AIDUINO_DIR = path.join(os.homedir(), '.aiduino');
const SESSIONS_FILE = path.join(AIDUINO_DIR, '.aiduino-sessions.json');

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
     * Get session key for model and workspace combination
     */
    getSessionKey(modelId, workspacePath) {
        return `${modelId}:${workspacePath || 'global'}`;
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

        const workspacePath = options.agenticMode 
            ? (context.workspacePath || this.getWorkspacePath())
            : null;
        const sessionKey = this.getSessionKey(modelId, workspacePath);
        
        // Don't reuse sessions in agentic mode
        const sessionId = (provider.persistent && !options.agenticMode) 
            ? this.sessions.get(sessionKey) 
            : null;

        const result = await agent.executeCommand(
            toolPath, 
            prompt, 
            context, 
            sessionId, 
            workspacePath, 
            options.agenticMode || false,
            selectedModel  // Pass selected model to agent
        );
        const { response, sessionId: newSessionId } = this.parseResult(result, agent);

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
    hasSession(modelId, workspacePath = null) {
        const wsPath = workspacePath || this.getWorkspacePath();
        const sessionKey = this.getSessionKey(modelId, wsPath);
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
        
        const extensions = ['.ino', '.cpp', '.c', '.h', '.hpp'];
        try {
            const files = fs.readdirSync(sketchPath);
            for (const file of files) {
                if (extensions.some(ext => file.endsWith(ext))) {
                    const filePath = path.join(sketchPath, file);
                    const stat = fs.statSync(filePath);
                    timestamps.set(filePath, stat.mtimeMs);
                }
            }
        } catch (error) {
            // Directory read failed
        }
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
     * @param {string[]} errors - Compile errors
     * @returns {string} Prompt with error context
     */
    buildRetryPrompt(originalPrompt, errors) {
        const errorText = errors.slice(0, 10).join('\n');
        return `The previous code change caused compile errors:\n\n\`\`\`\n${errorText}\n\`\`\`\n\nPlease fix these errors. Original request: ${originalPrompt}`;
    }

    /**
     * Call agent with compile-feedback-loop
     * Automatically retries if compile fails after code changes
     * @param {string} modelId - Model identifier
     * @param {string} prompt - User prompt
     * @param {Object} context - Extension context
     * @param {Object} options - { maxRetries: 3, sketchPath: null, panel: null }
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
                });
                
                for (let i = 0; i < maxRetries && !cancelled; i++) {
                    iterations = i + 1;
                    
                    const currentPrompt = i === 0 
                        ? prompt 
                        : this.buildRetryPrompt(prompt, compileResult.errors);
                    
                    const filesBefore = this.getFileTimestamps(sketchPath);
                    
                    try {
                        lastResponse = await this.callAgent(modelId, currentPrompt, context, { agenticMode: true });
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
                    
                    if (compileResult.success) {
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
