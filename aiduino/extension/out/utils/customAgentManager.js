/*
 * AI.duino - Custom Agent Manager
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');
const fileManager = require('./fileManager');
const contextManager = require('./contextManager');
const codeAnalyzer = require('./codeAnalyzer');
const shared = require('../shared');

const AIDUINO_DIR = path.join(os.homedir(), '.aiduino');
const AGENTS_FILE = path.join(AIDUINO_DIR, 'custom-agents.json');

/**
 * Custom Agent Manager for AI.duino
 * Manages custom AI agents with CRUD operations
 */
class CustomAgentManager {
    constructor() {
        this.ensureFile();
        this.agents = this.loadAgents();
    }

    /**
     * Ensure agents file exists
     */
    ensureFile() {
        if (!fileManager.fileExists(AGENTS_FILE)) {
            this.saveAgents({ agents: [] });
        }
    }

    /**
     * Load all agents from file
     * @returns {Array} Array of agents
     */
    loadAgents() {
        if (!fileManager.fileExists(AGENTS_FILE)) {
            return [];
        }

        try {
            const content = fileManager.safeReadFile(AGENTS_FILE);
            if (!content) return [];
            
            const data = JSON.parse(content);
            return Array.isArray(data.agents) ? data.agents : [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Save agents to file
     * @param {Object} data - Data object with agents array
     * @returns {boolean} Success status
     */
    saveAgents(data) {
        try {
            return fileManager.atomicWrite(AGENTS_FILE, JSON.stringify(data, null, 2));
        } catch {
            return false;
        }
    }

    /**
     * Get all agents
     * @returns {Array} Array of agents
     */
    getAllAgents() {
        return this.agents;
    }

    /**
     * Get agent by ID
     * @param {string} id - Agent ID
     * @returns {Object|null} Agent or null
     */
    getAgent(id) {
        return this.agents.find(agent => agent.id === id) || null;
    }

    /**
     * Create new agent
     * @param {Object} agentData - Agent data (name, prompt, context)
     * @returns {Object} Created agent with ID
     */
    createAgent(agentData) {
        const agent = {
            id: this.generateId(),
            name: agentData.name,
            prompt: agentData.prompt,
            context: agentData.context,
            created: new Date().toISOString(),
            lastUsed: null
        };

        this.agents.push(agent);
        this.saveAgents({ agents: this.agents });
        
        return agent;
    }

    /**
     * Update existing agent
     * @param {string} id - Agent ID
     * @param {Object} updates - Fields to update
     * @returns {boolean} Success status
     */
    updateAgent(id, updates) {
        const index = this.agents.findIndex(agent => agent.id === id);
        if (index === -1) return false;

        this.agents[index] = {
            ...this.agents[index],
            ...updates,
            id: this.agents[index].id, // Keep original ID
            created: this.agents[index].created // Keep original creation date
        };

        return this.saveAgents({ agents: this.agents });
    }

    /**
     * Delete agent
     * @param {string} id - Agent ID
     * @returns {boolean} Success status
     */
    deleteAgent(id) {
        const index = this.agents.findIndex(agent => agent.id === id);
        if (index === -1) return false;

        this.agents.splice(index, 1);
        return this.saveAgents({ agents: this.agents });
    }

    /**
     * Update last used timestamp
     * @param {string} id - Agent ID
     */
    updateLastUsed(id) {
        const index = this.agents.findIndex(agent => agent.id === id);
        if (index !== -1) {
            this.agents[index].lastUsed = new Date().toISOString();
            this.saveAgents({ agents: this.agents });
        }
    }

    /**
     * Generate unique ID for agent
     * @returns {string} Unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Build context string based on agent configuration
     * @param {Object} agent - Agent with context configuration
     * @param {vscode.TextEditor} editor - Active editor
     * @param {Object} context - Extension context
     * @returns {Promise<string>} Context string
     */
    async buildContext(agent, editor, context) {
        const { t } = context;
        const contextParts = [];
        const options = agent.context;

        // Code Context
        if (options.currentSelection && editor && !editor.selection.isEmpty) {
            const selectedText = editor.document.getText(editor.selection);
            contextParts.push(`## Selected Code:\n\`\`\`cpp\n${selectedText}\n\`\`\``);
        }

        if (options.currentFileFull && editor) {
            const fullText = editor.document.getText();
            contextParts.push(`## Current File:\n\`\`\`cpp\n${fullText}\n\`\`\``);
        }

        if (options.currentFileFunctions && editor) {
            const functions = codeAnalyzer.extractFunctionSignatures(editor.document.getText());
            if (functions.length > 0) {
                contextParts.push(`## Function Signatures:\n${functions.join('\n')}`);
            }
        }

        if (options.allSketchFiles && editor) {
            const sketchFiles = await contextManager.getSketchFiles(editor.document.uri);
            if (sketchFiles.length > 0) {
                contextParts.push(`## Sketch Files:\n${sketchFiles.join('\n')}`);
            }
        }

        // Hardware Context
        if (options.boardInfo) {
            const boardFqbn = shared.detectArduinoBoard();
            if (boardFqbn) {
                const boardName = shared.getBoardDisplayName(boardFqbn);
                contextParts.push(`## Board: ${boardName}`);
            }
        }

        if (options.usedLibraries && editor) {
            const libraries = codeAnalyzer.extractLibraries(editor.document.getText());
            if (libraries.length > 0) {
                contextParts.push(`## Used Libraries:\n${libraries.join('\n')}`);
            }
        }

        if (options.pinConfiguration && editor) {
            const pins = codeAnalyzer.extractPinConfiguration(editor.document.getText());
            if (pins.length > 0) {
                contextParts.push(`## Pin Configuration:\n${pins.join('\n')}`);
            }
        }

        return contextParts.join('\n\n');
    }
}

module.exports = { CustomAgentManager };
