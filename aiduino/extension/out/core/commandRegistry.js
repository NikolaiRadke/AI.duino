/*
 * AI.duino - Command Registry Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require("vscode");

/**
 * Command Registry - Centralized command registration for AI.duino
 * 
 * This module handles all VS Code command registration in a clean, maintainable way.
 * Each command is defined with its handler and automatically registered.
 */
class CommandRegistry {
    constructor() {
        this.commands = [];
    }

    /**
     * Define all AI.duino commands with their handlers
     * @param {Object} deps - Dependency injection object with handlers
     * @returns {Array} Array of command definitions
     */
    defineCommands(deps) {
        const { 
            showQuickMenu, 
            switchModel, 
            setApiKey, 
            switchLanguage,
            clearAIContext,
            loadFeature,  // NEW: Lazy loader function
            uiTools,
            inlineCompletion
     } = deps;

    return [
            // Core Menu Commands
            { 
                name: 'aiduino.quickMenu', 
                handler: showQuickMenu,
                description: 'Open AI.duino Quick Menu'
            },
            { 
                name: 'aiduino.switchModel', 
                handler: switchModel,
                description: 'Switch AI Model'
            },
            { 
                name: 'aiduino.setApiKey', 
                handler: setApiKey,
                description: 'Enter API Key'
            },
            { 
                name: 'aiduino.switchLanguage', 
                handler: switchLanguage,
                description: 'Switch Language'
            },

            // Code Features
            { 
                name: 'aiduino.explainCode', 
                handler: () => loadFeature('explainCode').explainCode(deps.getDependencies()),
                description: 'Explain Selected Code'
            },
            { 
                name: 'aiduino.improveCode', 
                handler: () => loadFeature('improveCode').improveCode(deps.getDependencies()),
                description: 'Improve Selected Code'
            },
            { 
                name: 'aiduino.addComments', 
                handler: () => loadFeature('addComments').addComments(deps.getDependencies()),
                description: 'Add Comments to Code'
            },
            { 
                name: 'aiduino.runCustomAgent', 
                handler: () => loadFeature('customAgents').runCustomAgent(deps.getDependencies()),
                description: 'Run Custom AI Agent'
            },
            { 
                name: 'aiduino.analyzeCode', 
                handler: () => loadFeature('analyzeCode').analyzeCodeOffline(deps.getDependencies()),
                description: 'Analyze Code (Offline)'
            },

            // Error & Debug Features
            { 
                name: 'aiduino.explainError', 
                handler: () => loadFeature('explainError').explainError(deps.getDependencies()),
                description: 'Explain Compiler Error'
            },
            {
                name: 'aiduino.explainCopiedError',
                handler: () => loadFeature('explainError').explainCopiedError(deps.getDependencies()),
                description: 'Explain Copied Compiler Error'
            },
            { 
                name: 'aiduino.debugHelp', 
                handler: () => loadFeature('debugHelp').debugHelp(deps.getDependencies()),
                description: 'Debug Help'
            },

            // AI Chat Features
            { 
                name: 'aiduino.askAI', 
                handler: () => loadFeature('askAI').askAI(deps.getDependencies(), false),
                description: 'Ask AI a Question'
            },
            { 
                name: 'aiduino.askFollowUp', 
                handler: () => loadFeature('askAI').askAI(deps.getDependencies(), true),
                description: 'Ask Follow-up Question'
            },
            {
                name: 'aiduino.openChatPanel',
                handler: () => loadFeature('chatPanel').showChatPanel(deps.getDependencies()),
                description: 'Open AI Chat Panel'
            },

            // Utility & Info Commands
            { 
                name: 'aiduino.showTokenStats', 
                handler: () => uiTools.showTokenStats(deps.getDependencies()),
                description: 'Show Token Statistics'
            },
            { 
                name: 'aiduino.about', 
                handler: () => uiTools.showAbout(deps.getDependencies()),
                description: 'About AI.duino'
            },
            { 
                name: 'aiduino.openSettings',
                handler: deps.showSettings,
                description: 'Open Settings'
            },
            {
                name: 'aiduino.openMaxTokensSetting',
                handler: () => deps.showSettings(deps.getDependencies(), 'aiBehavior'),
                description: 'Open Max Tokens Setting'
            },
            {
                name: 'aiduino.openHelp',
                handler: () => {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/NikolaiRadke/AI.duino/blob/main/HELP.md'));
                },
                description: 'Open Help Documentation'
            },
            {
                name: 'aiduino.toggleInlineCompletion',
                handler: () => deps.inlineCompletion.toggleInlineCompletion(deps.getDependencies()),
                description: 'Toggle Inline Code Completion'
            },
            {
                name: 'aiduino.editPrompts',
                handler: () => loadFeature('promptEditor').editPrompts(deps.getDependencies()),
                description: 'Edit AI Prompts'
            },
            { 
                name: 'aiduino.manageCustomAgents', 
                handler: () => loadFeature('customAgents').showCustomAgentPanel(deps.getDependencies()),
                description: 'Manage Custom AI Agents'
            },

            // Refresh Menu
            { 
                name: 'aiduino.refreshQuickMenu', 
                handler: () => {
                    if (deps.quickMenuTreeProvider) {
                        deps.quickMenuTreeProvider.refresh();
                    }
                },
                description: 'Refresh Quick Menu Tree View'
            }
        ];
    }

    /**
     * Register all commands with VS Code
     * @param {vscode.ExtensionContext} context - VS Code extension context
     * @param {Object} deps - Dependencies object with handlers
     */
    registerCommands(context, deps) {
        const commands = this.defineCommands(deps);
        
        commands.forEach(cmd => {
            const disposable = vscode.commands.registerCommand(cmd.name, cmd.handler);
            context.subscriptions.push(disposable);
            
            // Store for potential cleanup/debugging
            this.commands.push({
                name: cmd.name,
                description: cmd.description,
                debug: cmd.debug || false,
                disposable: disposable
            });
        });
    }

    /**
     * Dispose all registered commands (cleanup)
     */
    dispose() {
        this.commands.forEach(cmd => {
            if (cmd.disposable) {
                cmd.disposable.dispose();
            }
        });
        this.commands = [];
    }
}

module.exports = { CommandRegistry };
