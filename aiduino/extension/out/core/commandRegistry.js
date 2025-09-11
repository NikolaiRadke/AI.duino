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
            explainCodeFeature,
            improveCodeFeature, 
            addCommentsFeature,
            explainErrorFeature,
            debugHelpFeature,
            askAIFeature,
            promptEditorFeature,
            uiTools
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
                handler: () => explainCodeFeature.explainCode(deps.getDependencies()),
                description: 'Explain Selected Code'
            },
            { 
                name: 'aiduino.improveCode', 
                handler: () => improveCodeFeature.improveCode(deps.getDependencies()),
                description: 'Improve Selected Code'
            },
            { 
                name: 'aiduino.addComments', 
                handler: () => addCommentsFeature.addComments(deps.getDependencies()),
                description: 'Add Comments to Code'
            },

            // Error & Debug Features
            { 
                name: 'aiduino.explainError', 
                handler: () => explainErrorFeature.explainError(deps.getDependencies()),
                description: 'Explain Compiler Error'
            },
            { 
                name: 'aiduino.debugHelp', 
                handler: () => debugHelpFeature.debugHelp(deps.getDependencies()),
                description: 'Debug Help'
            },

            // AI Chat Features
            { 
                name: 'aiduino.askAI', 
                handler: () => askAIFeature.askAI(deps.getDependencies(), false),
                description: 'Ask AI a Question'
            },
            { 
                name: 'aiduino.askFollowUp', 
                handler: () => askAIFeature.askAI(deps.getDependencies(), true),
                description: 'Ask Follow-up Question'
            },
            { 
                name: 'aiduino.clearAIContext', 
                handler: clearAIContext,
                description: 'Clear AI Conversation Context'
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
            
            // Prompt Management
{
            name: 'aiduino.editPrompts',
            handler: () => promptEditorFeature.showPromptEditor(deps.getDependencies()),
            description: 'Edit AI Prompts'
        },
            // Debug Commands (normally hidden)
            { 
                name: 'aiduino.showModels', 
                handler: () => deps.minimalModelManager.showCurrentModels(),
                description: 'Show Current Models (Debug)',
                debug: true
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
            try {
                const disposable = vscode.commands.registerCommand(cmd.name, cmd.handler);
                context.subscriptions.push(disposable);
                
                // Store for potential cleanup/debugging
                this.commands.push({
                    name: cmd.name,
                    description: cmd.description,
                    debug: cmd.debug || false,
                    disposable: disposable
                });
                
            } catch (error) {
                // Fail silently for individual commands to avoid breaking entire extension
                console.log(`AI.duino: Failed to register command ${cmd.name}: ${error.message}`);
            }
        });
        
        console.log(`AI.duino: Registered ${this.commands.length} commands`);
    }

    /**
     * Get list of registered commands (for debugging)
     * @returns {Array} List of command info
     */
    getRegisteredCommands() {
        return this.commands.map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            debug: cmd.debug
        }));
    }

    /**
     * Dispose all registered commands (cleanup)
     */
    dispose() {
        this.commands.forEach(cmd => {
            try {
                if (cmd.disposable) {
                    cmd.disposable.dispose();
                }
            } catch (error) {
                // Silent disposal errors
            }
        });
        this.commands = [];
    }
}

module.exports = { CommandRegistry };
