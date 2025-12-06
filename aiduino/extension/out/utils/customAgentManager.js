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
const AGENT_FILES_DIR = path.join(AIDUINO_DIR, 'agent-files'); 

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
            additionalFiles: [],  // ← Will be filled below
            created: new Date().toISOString(),
            lastUsed: null
        };
    
        // Create agent directory for file storage
        const agentDir = path.join(AGENT_FILES_DIR, agent.id);
        if (!fs.existsSync(agentDir)) {
            fs.mkdirSync(agentDir, { recursive: true, mode: 0o700 });
        }
    
        // Copy additional files to agent directory
        if (agentData.additionalFiles && agentData.additionalFiles.length > 0) {
            agent.additionalFiles = agentData.additionalFiles.map(filePath => {
                try {
                    const fileName = path.basename(filePath);
                    const targetPath = path.join(agentDir, fileName);
                    fs.copyFileSync(filePath, targetPath);
                    return targetPath;
                } catch (error) {
                    return null;
                }
            }).filter(Boolean);  // Remove failed copies
        }

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
    
        const agent = this.agents[index];
        const agentDir = path.join(AGENT_FILES_DIR, id);
    
        // Handle additionalFiles updates
        if (updates.additionalFiles) {
            // Ensure agent directory exists
            if (!fs.existsSync(agentDir)) {
                fs.mkdirSync(agentDir, { recursive: true, mode: 0o700 });
            }
            
            // Remove old files that are not in the new list
            const oldFiles = agent.additionalFiles || [];
            const newFilePaths = updates.additionalFiles;
            
            oldFiles.forEach(oldPath => {
                if (!newFilePaths.includes(oldPath) && oldPath.includes(agentDir)) {
                    try {
                        fs.unlinkSync(oldPath);
                    } catch {}
                }
            });
        
            // Copy new files to agent directory
            updates.additionalFiles = newFilePaths.map(filePath => {
                // If file is already in agent directory, keep it
                if (filePath.startsWith(agentDir)) {
                    return filePath;
                }
            
                // Copy external file to agent directory
                try {
                    const fileName = path.basename(filePath);
                    const targetPath = path.join(agentDir, fileName);
                    fs.copyFileSync(filePath, targetPath);
                    return targetPath;
                } catch (error) {
                    return null;
                }
            }).filter(Boolean);
        }

        this.agents[index] = {
            ...agent,
            ...updates,
            id: agent.id,
            created: agent.created
        };

        this.saveAgents({ agents: this.agents });
        return true;
    }   

    /**
     * Delete agent
     * @param {string} id - Agent ID
     * @returns {boolean} Success status
     */
    deleteAgent(id) {
        const index = this.agents.findIndex(agent => agent.id === id);
        if (index === -1) return false;
    
        // Delete agent directory with all files
        const agentDir = path.join(AGENT_FILES_DIR, id);
        if (fs.existsSync(agentDir)) {
            try {
                fs.rmSync(agentDir, { recursive: true, force: true });
            } catch (error) {
            }
        }

        this.agents.splice(index, 1);
        this.saveAgents({ agents: this.agents });
    
        return true;
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
           const sketchFiles = contextManager.getSketchFiles(sketchDir);
        
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

        // Additional Files (outside of sketch directory)
        if (agent.additionalFiles && agent.additionalFiles.length > 0) {
            const additionalFilesData = await fileManager.readAdditionalFiles(agent.additionalFiles);
            
            if (additionalFilesData.length > 0) {
                let additionalContent = '';
                for (const file of additionalFilesData) {
                    if (file.error) {
                        // Skip files that couldn't be read
                        continue;
                    }
                    additionalContent += `// ========== ${file.name} ==========\n`;
                    additionalContent += `${file.content}\n\n`;
                }
                
                if (additionalContent.trim()) {
                    contextParts.push(`## Additional Files:\n\`\`\`cpp\n${additionalContent}\`\`\``);
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
            const pins = codeAnalyzer.extractPinConfiguration(editor.document.getText(), t);
            if (pins.length > 0) {
                contextParts.push(`## Pin Configuration:\n${pins.join('\n')}`);
            }
        }

        // Build & Analysis Context
        const needsBuild = options.memoryUsage || options.compilerErrors || 
                           options.compilerWarnings || options.buildInfo;

        if (needsBuild) {
            // Try to find an Arduino editor if not provided
            let buildEditor = editor;
            if (!buildEditor) {
                // Find Arduino document in ALL open documents
                const openDocs = vscode.workspace.textDocuments;
                const arduinoDoc = openDocs.find(doc => 
                    doc.fileName.match(/\.(ino|cpp|c|h)$/i)
                );
                
                if (arduinoDoc) {
                    // Create editor-like object with document and uri
                    buildEditor = { document: arduinoDoc };
                }
            }
            
            if (buildEditor) {
                try {
                    const buildInfo = await this.buildAndCollectInfo(buildEditor.document.uri, context);
                    const buildContext = this.formatBuildContext(buildInfo, options, context.t);
                    
                    if (buildContext) {
                        contextParts.push(buildContext);
                    }
                } catch (error) {
                    contextParts.push(`\n## Build Error:\n${error.message}`);
                }
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

    /**
     * Export agent(s) to JSON with embedded file contents
     * @param {string|Array|null} agentIds - Single ID, array of IDs, or null for all
     * @returns {Object} Export data with embedded files
     */
    exportAgents(agentIds = null) {
        let agentsToExport;
        
        if (agentIds === null) {
            // Export all agents
            agentsToExport = this.agents;
        } else if (Array.isArray(agentIds)) {
            // Export multiple agents
            agentsToExport = this.agents.filter(a => agentIds.includes(a.id));
        } else {
            // Export single agent
            agentsToExport = this.agents.filter(a => a.id === agentIds);
        }
        
        // Embed file contents
        const agentsWithContent = agentsToExport.map(agent => {
            const filesWithContent = (agent.additionalFiles || []).map(filePath => {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    return {
                        name: path.basename(filePath),
                        content: content
                    };
                } catch (error) {
                    // File read failed - skip this file
                    return null;
                }
            }).filter(Boolean);
            
            return {
                id: agent.id,
                name: agent.name,
                prompt: agent.prompt,
                context: agent.context,
                additionalFiles: filesWithContent,
                created: agent.created
            };
        });
    
        return {
            version: "1.0",
            exportDate: new Date().toISOString(),
            aiduinoVersion: "1.0.0",
            agents: agentsWithContent
        };
    }

     /**
     * Import agents from JSON data
     * @param {Object} importData - Import data object
     * @param {boolean} replaceExisting - Replace agents with same name
     * @returns {Object} Import result with statistics
     */
    importAgents(importData, replaceExisting = false) {
        if (!importData || !importData.agents || !Array.isArray(importData.agents)) {
            return { 
                success: false, 
                error: 'Invalid import format: missing agents array' 
            };
        }
    
        // Version check
        if (importData.version !== "1.0") {
            return { 
                success: false, 
                error: `Unsupported export version: ${importData.version}` 
            };
        }
    
        const imported = [];
        const skipped = [];
        const errors = [];
        
        for (const importedAgent of importData.agents) {
            try {
                // Validate agent data
                if (!importedAgent.name || !importedAgent.prompt) {
                    errors.push(`Invalid agent data: missing name or prompt`);
                    continue;
                }
                
                // Check if agent with same name exists
                const existingIndex = this.agents.findIndex(a => a.name === importedAgent.name);
                
                if (existingIndex !== -1 && !replaceExisting) {
                    skipped.push(importedAgent.name);
                    continue;
                }
                
                // Generate new ID for imported agent
                const newId = this.generateId();
                const agentDir = path.join(AGENT_FILES_DIR, newId);
                
                // Create agent directory
                if (!fs.existsSync(agentDir)) {
                    fs.mkdirSync(agentDir, { recursive: true, mode: 0o700 });
                }
            
                // Write files to agent directory
                const localFiles = (importedAgent.additionalFiles || []).map(file => {
                    try {
                        const targetPath = path.join(agentDir, file.name);
                        fs.writeFileSync(targetPath, file.content, 'utf8');
                        return targetPath;
                    } catch (error) {
                        return null;
                    }
                }).filter(Boolean);
                
                // Create new agent object
                const newAgent = {
                    id: newId,
                    name: importedAgent.name,
                    prompt: importedAgent.prompt,
                    context: importedAgent.context || 'current-sketch',
                    additionalFiles: localFiles,
                    created: new Date().toISOString(),
                    lastUsed: null
                };
                
                if (existingIndex !== -1 && replaceExisting) {
                    // Replace existing agent (keep old ID and created date)
                    const oldId = this.agents[existingIndex].id;
                    const oldCreated = this.agents[existingIndex].created;
                    
                    // Delete old agent directory
                    const oldAgentDir = path.join(AGENT_FILES_DIR, oldId);
                    if (fs.existsSync(oldAgentDir)) {
                        fs.rmSync(oldAgentDir, { recursive: true, force: true });
                    }
                    
                    newAgent.id = oldId;
                    newAgent.created = oldCreated;
                    
                    // Move files to old agent directory
                    const correctDir = path.join(AGENT_FILES_DIR, oldId);
                    if (!fs.existsSync(correctDir)) {
                        fs.mkdirSync(correctDir, { recursive: true, mode: 0o700 });
                    }
                    
                    newAgent.additionalFiles = localFiles.map(filePath => {
                    const fileName = path.basename(filePath);
                        const newPath = path.join(correctDir, fileName);
                        fs.renameSync(filePath, newPath);
                        return newPath;
                    });
                    
                    // Remove temporary directory
                    fs.rmSync(agentDir, { recursive: true, force: true });
                    
                    this.agents[existingIndex] = newAgent;
                } else {
                    // Add new agent
                    this.agents.push(newAgent);
                }
            
                imported.push(importedAgent.name);
                
            } catch (error) {
                errors.push(`Failed to import agent "${importedAgent.name}": ${error.message}`);
            }
        }
        
        // Save updated agents
        this.saveAgents({ agents: this.agents });
    
        return {
            success: true,
            imported: imported.length,
            skipped: skipped.length,
            errors: errors.length,
            importedNames: imported,
            skippedNames: skipped,
            errorMessages: errors
        };
    }   
    
    /** 
     * Save agent export to file
     * @param {Object} exportData - Export data from exportAgents()
     * @param {string} filePath - Target file path
     * @returns {boolean} Success status
     */
    saveExportToFile(exportData, filePath) {
        try {
            const content = JSON.stringify(exportData, null, 2);
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Load agent import from file
     * @param {string} filePath - Source file path
     * @returns {Object|null} Import data or null on error
     */
    loadImportFromFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }
}

module.exports = { CustomAgentManager };
