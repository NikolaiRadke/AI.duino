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
const AGENTS_FILE = path.join(AIDUINO_DIR, '.aiduino-custom-agents.json');

/**
 * Custom Agent Manager for AI.duino
 * Manages custom AI agents with CRUD operations and build integration
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
            id: this.agents[index].id,
            created: this.agents[index].created
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
           const sketchDir = path.dirname(editor.document.uri.fsPath);
           const sketchFiles = contextManager.getSketchFiles(sketchDir); // KEIN await, und sketchDir statt uri!
        
           if (sketchFiles.length > 0) {
               let allFilesContent = '';
               for (const filePath of sketchFiles) {
                   try {
                       const content = fs.readFileSync(filePath, 'utf8');
                       const fileName = path.basename(filePath);
                       allFilesContent += `\n## File: ${fileName}\n\`\`\`cpp\n${content}\n\`\`\`\n`;
                   } catch (err) {
                       // Skip files that can't be read
                   }
               }
               if (allFilesContent) {
                   contextParts.push(allFilesContent);
               }
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

        // Build & Analysis Context
        const needsBuild = options.memoryUsage || options.compilerErrors || 
                           options.compilerWarnings || options.buildInfo;

        if (needsBuild && editor) {
            try {
                const buildInfo = await this.buildAndCollectInfo(editor.document.uri, context);
                const buildContext = this.formatBuildContext(buildInfo, options, context.t);
                
                if (buildContext) {
                    contextParts.push(buildContext);
                }
            } catch (error) {
                contextParts.push(`\n## Build Error:\n${error.message}`);
            }
        }

        return contextParts.join('\n\n');
    }

    /**
     * Trigger Arduino build and collect information
     * @param {vscode.Uri} fileUri - File URI to build
     * @param {Object} context - Extension context with t function
     * @returns {Promise<Object>} Build results
     */
    async buildAndCollectInfo(fileUri, context) {
        const { t } = context;
        
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: t('customAgent.buildingSketch'),
            cancellable: false
        }, async () => {
            try {
                // Find and execute verify/compile command
                const commands = await vscode.commands.getCommands();
                const verifyCommands = commands.filter(cmd => 
                    cmd.toLowerCase().includes('verify') || 
                    cmd.toLowerCase().includes('compile')
                );
                
                if (verifyCommands.length === 0) {
                    throw new Error('No compile command found');
                }
                
                await vscode.commands.executeCommand(verifyCommands[0]);
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const buildInfo = {
                    memory: await this.getMemoryUsage(fileUri),
                    errors: await this.getCompilerErrors(fileUri),
                    warnings: await this.getCompilerWarnings(fileUri),
                    buildDetails: await this.getBuildDetails()
                };
                
                return buildInfo;
            } catch (error) {
                throw new Error(`${t('customAgent.buildFailed')}: ${error.message}`);
            }
        });
    }

    /**
     * Get memory usage from compiled .elf file
     */
    async getMemoryUsage(fileUri) {
        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);
            
            const sketchName = path.basename(fileUri.fsPath, '.ino');
            const cacheDir = path.join(os.homedir(), '.cache', 'arduino', 'sketches');
            
            if (!fs.existsSync(cacheDir)) {
                return this.getMemoryPlaceholder();
            }
            
            const buildDirs = fs.readdirSync(cacheDir)
                .map(dir => path.join(cacheDir, dir))
                .filter(dir => fs.statSync(dir).isDirectory())
                .sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime);
            
            if (buildDirs.length === 0) {
                return this.getMemoryPlaceholder();
            }
            
            const elfFile = path.join(buildDirs[0], `${sketchName}.ino.elf`);
            
            if (!fs.existsSync(elfFile)) {
                return this.getMemoryPlaceholder();
            }
            
            const avrSizePath = this.findAvrSize();
            if (!avrSizePath) {
                return this.getMemoryPlaceholder();
            }
            
            const { stdout } = await execPromise(`"${avrSizePath}" -A "${elfFile}"`);
            return this.parseAvrSizeOutput(stdout);
            
        } catch (error) {
            return this.getMemoryPlaceholder();
        }
    }

    /**
     * Find avr-size tool path
     */
    findAvrSize() {
        const basePath = path.join(os.homedir(), '.arduino15', 'packages', 'arduino', 'tools', 'avr-gcc');
        
        if (fs.existsSync(basePath)) {
            try {
                const versions = fs.readdirSync(basePath);
                if (versions.length > 0) {
                    const avrSize = path.join(basePath, versions[0], 'bin', 'avr-size');
                    if (fs.existsSync(avrSize)) {
                        return avrSize;
                    }
                }
            } catch (e) {
                return null;
            }
        }
        
        return null;
    }

    /**
     * Parse avr-size output
     */
    parseAvrSizeOutput(output) {
        const lines = output.split('\n');
        let flashUsed = 0;
        let ramUsed = 0;
        
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
                const section = parts[0];
                const size = parseInt(parts[1]);
                
                if (section === '.text' || section === '.data') {
                    flashUsed += size;
                }
                if (section === '.data' || section === '.bss') {
                    ramUsed += size;
                }
            }
        }
    
        return {
            flash: {
                used: flashUsed,
                total: 0,
                percent: 0
            },
            ram: {
                used: ramUsed,
                total: 0,
                percent: 0
            },
            available: flashUsed > 0
        };
    }   

    /**
     * Return placeholder when memory info not available
     */
    getMemoryPlaceholder() {
        return {
            flash: { used: 0, total: 0, percent: 0 },
            ram: { used: 0, total: 0, percent: 0 },
            available: false
        };
    }

    /**
     * Get compiler errors from diagnostics
     */
    async getCompilerErrors(fileUri) {
        const diagnostics = vscode.languages.getDiagnostics(fileUri);
        const errors = diagnostics
            .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
            .map(d => ({
                line: d.range.start.line + 1,
                message: d.message,
                source: d.source
            }));
        
        return errors;
    }

    /**
     * Get compiler warnings from diagnostics
     */
    async getCompilerWarnings(fileUri) {
        const diagnostics = vscode.languages.getDiagnostics(fileUri);
        const warnings = diagnostics
            .filter(d => d.severity === vscode.DiagnosticSeverity.Warning)
            .map(d => ({
                line: d.range.start.line + 1,
                message: d.message,
                source: d.source
            }));
        
        return warnings;
    }

    /**
     * Get general build information
     */
    async getBuildDetails() {
        return {
            timestamp: new Date().toISOString(),
            available: true
        };
    }

    /**
     * Format build info for AI context
     */
    formatBuildContext(buildInfo, options, t) {
        const parts = [];
        
        if (options.memoryUsage) {
            if (buildInfo.memory.available) {
                parts.push(`\n## ${t('customAgent.memoryUsage')}:`);
                parts.push(`Flash: ${buildInfo.memory.flash.used} bytes`);
                parts.push(`RAM: ${buildInfo.memory.ram.used} bytes`);
                
                // Add board info for context
                const boardFqbn = shared.detectArduinoBoard();
                if (boardFqbn) {
                    const boardName = shared.getBoardDisplayName(boardFqbn);
                    parts.push(`Board: ${boardName}`);
                }
            } else {
                parts.push(`\n## ${t('customAgent.memoryUsage')}:`);
                parts.push(t('customAgent.memoryNotAvailable'));
            }
        }
        
        if (options.compilerErrors) {
            if (buildInfo.errors && buildInfo.errors.length > 0) {
                parts.push(`\n## ${t('customAgent.compilerErrors')}:`);
                buildInfo.errors.forEach(err => {
                    parts.push(`${t('customAgent.line')} ${err.line}: ${err.message}`);
                });
            } else {
                parts.push(`\n## ${t('customAgent.compilerErrors')}: ${t('customAgent.noErrors')}`);
            }
        }
        
        if (options.compilerWarnings) {
            if (buildInfo.warnings && buildInfo.warnings.length > 0) {
                parts.push(`\n## ${t('customAgent.compilerWarnings')}:`);
                buildInfo.warnings.forEach(warn => {
                    parts.push(`${t('customAgent.line')} ${warn.line}: ${warn.message}`);
                });
            } else {
                parts.push(`\n## ${t('customAgent.compilerWarnings')}: ${t('customAgent.noWarnings')}`);
            }
        }
        
        if (options.buildInfo && buildInfo.buildDetails && buildInfo.buildDetails.available) {
            parts.push(`\n## ${t('customAgent.buildInfo')}:`);
            parts.push(t('customAgent.buildSuccessful'));
            const timestamp = buildInfo.buildDetails.timestamp || '';
            if (timestamp) {
                parts.push(`${t('customAgent.timestamp')}: ${timestamp.substring(0, 19).replace('T', ' ')}`);
            }
        }
        
        return parts.join('\n');
    }
}

module.exports = { CustomAgentManager };
