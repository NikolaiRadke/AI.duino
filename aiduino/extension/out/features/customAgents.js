/*
 * AI.duino - Custom Agents Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const path = require('path');
const featureUtils = require('./featureUtils');
const contextManager = require('../utils/contextManager');
const shared = require('../shared');
const fileManager = require('../utils/fileManager');
const { getSharedCSS, getPrismScripts } = require('../utils/panels/sharedStyles');
const { CustomAgentManager } = require('../utils/customAgentManager');
const panelManager = require('../utils/panelManager');

let agentManager;
let currentView = 'overview'; // 'overview', 'editor'
let editingAgentId = null;

/**
 * Main entry point - Show Custom Agent Panel
 * @param {Object} context - Extension context with dependencies
 */
async function showCustomAgentPanel(context) {
    const { t } = context;
    
    // Initialize manager if needed
    if (!agentManager) {
        agentManager = new CustomAgentManager();
    }
    
    // Create or reveal panel using PanelManager
    const panel = panelManager.getOrCreatePanel({
        id: 'aiduinoCustomAgents',
        title: `🤖 ${t('customAgent.title')}`,
        viewColumn: vscode.ViewColumn.One,
        webviewOptions: { enableScripts: true },
        onDispose: () => {
            // Reset state
            currentView = 'overview';
            editingAgentId = null;
        },
        onReveal: (panel) => {
            // Reset to overview when reopened
            currentView = 'overview';
            editingAgentId = null;
            updatePanelContent(panel, context);
        }
    });
    
    // If panel was just revealed (not newly created), return early
    if (panel.webview.html) {
        return;
    }
    
    // Initial view for new panel
    currentView = 'overview';
    editingAgentId = null;
    updatePanelContent(panel, context);

    // Setup message handler with standard commands
    featureUtils.setupStandardMessageHandler(panel, context, {
        backToOverview: async (message) => {
            currentView = 'overview';
            editingAgentId = null;
            updatePanelContent(panel, context);
        },
        createAgent: async (message) => {
            currentView = 'editor';
            editingAgentId = null;
            updatePanelContent(panel, context);
        },
        editAgent: async (message) => {
            currentView = 'editor';
            editingAgentId = message.agentId;
            updatePanelContent(panel, context);
        },
        saveAgent: async (message) => {
            await handleSaveAgent(message.agentData, panel, context);
        },
        runAgent: async (message) => {
            await executeAgent(message.agentId, context);
        },
        deleteAgent: async (message) => {
            await handleDeleteAgent(message.agentId, panel, context);
        },
        pickAdditionalFiles: async (message) => {
            const existingFiles = message.existingFiles || [];
            const newFiles = await fileManager.pickAdditionalFiles(existingFiles, {
              title: t('customAgent.selectAdditionalFiles'),
              openLabel: t('customAgent.addFiles')
            });       
            if (newFiles && newFiles.length > 0) {
                panel.webview.postMessage({
                    command: 'filesSelected',
                    files: newFiles
                });
            }
        },
        pasteFromClipboard: async (message) => {
            const clipboardText = await vscode.env.clipboard.readText();
            panel.webview.postMessage({
                command: 'pasteText',
                text: clipboardText
            });
        }
    }); 
}

/**
 * Run Custom Agent (Quick Action)
 * Shows QuickPick list and executes immediately
 * @param {Object} context - Extension context with dependencies
 */
async function runCustomAgent(context) {
    const { t } = context;
    
    // Initialize manager if needed
    if (!agentManager) {
        agentManager = new CustomAgentManager();
    }
    
    const agents = agentManager.getAllAgents();
    
    if (agents.length === 0) {
        const choice = await vscode.window.showInformationMessage(
            t('customAgent.noAgentsYet'),
            t('customAgent.createFirst')
        );
        
        if (choice === t('customAgent.createFirst')) {
            await showCustomAgentPanel(context);
        }
        return;
    }
    
    // Build QuickPick items
    const items = agents.map(agent => ({
        label: `🤖 ${agent.name}`,
        description: (agent.prompt || '').substring(0, 60) + ((agent.prompt || '').length > 60 ? '...' : ''),
        agentId: agent.id
    }));
    
    // Show QuickPick
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: t('customAgent.selectAgent')
    });
    
    if (!selected) return;
    
    // Execute agent
    await executeAgent(selected.agentId, context);
}

/**
 * Execute agent and show output
 * @param {string} agentId - Agent ID
 * @param {Object} context - Extension context
 */
async function executeAgent(agentId, context) {
    const { t } = context;
    const agent = agentManager.getAgent(agentId);
    
    if (!agent) {
        vscode.window.showErrorMessage(t('customAgent.agentNotFound'));
        return;
    }
    
    const editor = vscode.window.activeTextEditor;
    
    // Validate context requirements
    const needsEditor = agent.context.currentSelection || 
                   agent.context.currentFileFull || 
                   agent.context.currentFileFunctions ||
                   agent.context.usedLibraries ||
                   agent.context.pinConfiguration;  
    
    if (needsEditor && !editor) {
        vscode.window.showWarningMessage(t('messages.openInoFile'));
        return;
    }
    
    if (agent.context.currentSelection && (!editor || editor.selection.isEmpty)) {
        vscode.window.showWarningMessage(t('messages.selectCodeFirst'));
        return;
    }
    
    // Build context
    const contextData = await agentManager.buildContext(agent, editor, context);
    
    // Build final prompt
    const fullPrompt = `${agent.prompt}\n\n${contextData}`;
    
    // Call AI
    const response = await featureUtils.callAIWithProgress(
        fullPrompt,
        'progress.processing',
        context
    );
    
    // Update last used
    agentManager.updateLastUsed(agentId);
    
    // Show output in new panel
    const outputPanel = vscode.window.createWebviewPanel(
        'aiduinoCustomAgentOutput',
        `🤖 ${agent.name}`,
        vscode.ViewColumn.Two,
        { enableScripts: true }
    );
    
    outputPanel.webview.html = generateOutputHTML(agent, response, context);

    // Message handler for output panel
    featureUtils.setupStandardMessageHandler(outputPanel, context, {
        backToOverview: async (message) => {
            outputPanel.dispose();
            await showCustomAgentPanel(context);
        }
    });
}

/**
 * Update panel content based on current view
 */
function updatePanelContent(panel, context) {
    if (currentView === 'overview') {
        const agents = agentManager.getAllAgents();
        panel.webview.html = generateOverviewHTML(agents, context);
    } else if (currentView === 'editor') {
        const agent = editingAgentId ? agentManager.getAgent(editingAgentId) : null;
        panel.webview.html = generateEditorHTML(agent, context);
    }
}

/**
 * Generate Overview HTML (Agent List)
 */
function generateOverviewHTML(agents, context) {
    const { t } = context;
    
    let agentsHTML = '';
    
    if (agents.length === 0) {
        agentsHTML = `
            <div class="empty-state">
                <h2>🤖 ${t('customAgent.noAgentsYet')}</h2>
                <p>${t('customAgent.createFirstAgent')}</p>
            </div>
        `;
    } else {
        agentsHTML = agents.map(agent => {
            const lastUsed = agent.lastUsed ? shared.formatTimeAgo(new Date(agent.lastUsed), t) : t('customAgent.neverUsed');
            const cardStyle = context.settings.get('cardStyle') || 'arduino-green';
 
            return `
                <div class="card style-${cardStyle}">
                    <div class="card-header">
                        <div class="card-title">🤖 ${shared.escapeHtml(agent.name)}</div>
                        <div class="agent-card-actions">
                            <button class="agent-btn-run" onclick="runAgent('${agent.id}')" title="${t('customAgent.runAgent')}">
                                ▶
                            </button>
                            <button class="agent-btn-edit" onclick="editAgent('${agent.id}')" title="${t('customAgent.editAgent')}">
                                ✏️
                            </button>
                            <button class="agent-btn-delete" onclick="deleteAgent('${agent.id}')" title="${t('buttons.delete')}">
                                🗑️
                            </button>
                        </div>
                    </div>
                    <div class="card-info">
                        <div class="agent-prompt-preview">${shared.escapeHtml((agent.prompt || '').substring(0, 100))}${(agent.prompt || '').length > 100 ? '...' : ''}</div>
                        <div class="agent-last-used">${t('customAgent.lastUsed')}: ${lastUsed}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    const maxAgents = context.settings.get('maxCustomAgents');
    const canCreateMore = agents.length < maxAgents;
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${t('customAgent.title')}</title>
            ${getSharedCSS(context.settings.get('cardStyle'))}
            <style>
                body {
                    padding: 20px;
                    max-width: 900px;
                    margin: 0 auto;
                }
                .agent-counter {
                    color: var(--vscode-descriptionForeground);
                    font-size: 14px;
                    margin-left: 10px;
                }                
                .new-agent-btn {
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-size: 16px;
                    transition: background 0.2s;
                }
                .agent-last-used {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 5px;
                }
            </style>
        </head>
        <body>
            ${featureUtils.generateContextMenu(t).html}
            
            <div class="overview-header">
                <div>
                    <span class="overview-title">🤖 ${t('customAgent.myAgents')}</span>
                    <span class="agent-counter">${agents.length}/${maxAgents}</span>
                </div>
                <button 
                    class="panel-btn new-agent-btn ${canCreateMore ? '' : 'disabled'}"
                    onclick="createNewAgent()"
                    ${canCreateMore ? '' : 'disabled'}
                    title="${canCreateMore ? '' : t('customAgent.maxAgentsReached', maxAgents)}"
                >
                    + ${t('customAgent.newAgent')}
                </button>
            </div>
            
            <div class="agents-list">
                ${agentsHTML}
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function createNewAgent() {
                    vscode.postMessage({ command: 'createAgent' });
                }
                
                function editAgent(agentId) {
                    vscode.postMessage({ 
                        command: 'editAgent',
                        agentId: agentId
                    });
                }
                
                function runAgent(agentId) {
                    vscode.postMessage({ 
                        command: 'runAgent',
                        agentId: agentId
                    });
                }
                
                function deleteAgent(agentId) {
                    vscode.postMessage({ 
                        command: 'deleteAgent',
                        agentId: agentId
                    });
                }
                
                // Context menu
                ${featureUtils.generateContextMenu(t).script}
            </script>
        </body>
        </html>
    `;
}

/**
 * Generate HTML for additional files list
 */
function generateAdditionalFilesHTML(files, t) {
    if (!files || files.length === 0) {
        return `<p style="color: var(--vscode-descriptionForeground); font-size: 12px;">${t('customAgent.noAdditionalFiles')}</p>`;
    }
    
    let html = '<div class="file-list">';
    files.forEach(filePath => {
        const fileName = path.basename(filePath);
        html += `
            <div class="file-item">
                <span class="file-name" title="${filePath}">${fileName}</span>
                <button onclick="removeAdditionalFile('${filePath.replace(/\\/g, '\\\\')}')" class="remove-file-btn" title="${t('buttons.remove')}">
                    ✕
                </button>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

/**
 * Generate Editor HTML (Create/Edit Agent)
 */
function generateEditorHTML(agent, context) {
    const { t } = context;
    const isEdit = agent !== null;
    
    const defaultContext = {
        currentSelection: false,
        currentFileFull: false,
        currentFileFunctions: false,
        allSketchFiles: false,
        boardInfo: false,
        usedLibraries: false,
        pinConfiguration: false,
        memoryUsage: false,
        compilerErrors: false,
        compilerWarnings: false,
        buildInfo: false
    };

    const agentContext = agent ? { ...defaultContext, ...agent.context } : defaultContext;
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${isEdit ? t('customAgent.editAgent') : t('customAgent.newAgent')}</title>
            ${getSharedCSS(context.settings.get('cardStyle'))}
            <style>
                body {
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                
                .form-group {
                    margin-bottom: 20px;
                }
                
                label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: bold;
                    color: var(--vscode-foreground);
                }
                
                input[type="text"], textarea {
                    width: 100%;
                    padding: 10px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    font-family: var(--vscode-font-family);
                }
                
                textarea {
                    min-height: 150px;
                    resize: vertical;
                }
                
                .context-group {
                    margin-bottom: 20px;
                    padding: 15px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                }
                
                .context-group h3 {
                    margin-top: 0;
                    margin-bottom: 12px;
                    font-size: 14px;
                    color: var(--vscode-foreground);
                }
                
                .checkbox-item {
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                }
                
                .checkbox-item input[type="checkbox"] {
                    margin-right: 8px;
                }
                
                .checkbox-item label {
                    margin: 0;
                    font-weight: normal;
                    cursor: pointer;
                }
                
                .button-row {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                    margin-top: 20px;
                }
                
                .btn-primary {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                }
                
                .btn-primary:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                
                .btn-secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: 1px solid var(--vscode-panel-border);
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                .btn-secondary:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
            </style>
        </head>
        <body>
            ${featureUtils.generateContextMenu(t, { showPaste: true }).html}
            
            <h2>🤖 ${isEdit ? t('customAgent.editAgent') : t('customAgent.newAgent')}</h2>
            
            <div class="form-group">
                <label for="agentName">${t('customAgent.agentName')}:</label>
                <input 
                    type="text" 
                    id="agentName" 
                    placeholder="${t('customAgent.agentNamePlaceholder')}"
                    value="${agent ? shared.escapeHtml(agent.name) : ''}"
                >
            </div>
            
            <div class="form-group">
                <label for="agentPrompt">${t('customAgent.promptLabel')}</label>
                <textarea 
                    id="agentPrompt" 
                    placeholder="${t('customAgent.promptPlaceholder')}"
                >${agent ? shared.escapeHtml(agent.prompt) : ''}</textarea>
            </div>
            
            <div class="context-group">
                <h3>📄 ${t('customAgent.codeContext')}</h3>
                <div class="checkbox-item">
                    <input type="checkbox" id="ctx_currentSelection" ${agentContext.currentSelection ? 'checked' : ''}>
                    <label for="ctx_currentSelection">${t('customAgent.currentSelection')}</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" id="ctx_currentFileFull" ${agentContext.currentFileFull ? 'checked' : ''}>
                    <label for="ctx_currentFileFull">${t('customAgent.currentFileFull')}</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" id="ctx_currentFileFunctions" ${agentContext.currentFileFunctions ? 'checked' : ''}>
                    <label for="ctx_currentFileFunctions">${t('customAgent.currentFileFunctions')}</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" id="ctx_allSketchFiles" ${agentContext.allSketchFiles ? 'checked' : ''}>
                    <label for="ctx_allSketchFiles">${t('customAgent.allSketchFiles')}</label>
                </div>
            </div>
            
            <div class="context-group">
                <h3>⚡ ${t('customAgent.hardwareContext')}</h3>
                <div class="checkbox-item">
                    <input type="checkbox" id="ctx_boardInfo" ${agentContext.boardInfo ? 'checked' : ''}>
                    <label for="ctx_boardInfo">${t('customAgent.boardInfo')}</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" id="ctx_usedLibraries" ${agentContext.usedLibraries ? 'checked' : ''}>
                    <label for="ctx_usedLibraries">${t('customAgent.usedLibraries')}</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" id="ctx_pinConfiguration" ${agentContext.pinConfiguration ? 'checked' : ''}>
                    <label for="ctx_pinConfiguration">${t('customAgent.pinConfiguration')}</label>
                </div>
            </div>
            
            <div class="context-group">
                <h3>🔨 ${t('customAgent.buildContext')}</h3>
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 0;">
                    ⚠️ ${t('customAgent.buildWarning')}
                </p>
                <div class="checkbox-item">
                    <input type="checkbox" id="ctx_memoryUsage" ${agentContext.memoryUsage ? 'checked' : ''}>
                    <label for="ctx_memoryUsage">${t('customAgent.memoryUsage')}</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" id="ctx_compilerErrors" ${agentContext.compilerErrors ? 'checked' : ''}>
                    <label for="ctx_compilerErrors">${t('customAgent.compilerErrors')}</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" id="ctx_compilerWarnings" ${agentContext.compilerWarnings ? 'checked' : ''}>
                    <label for="ctx_compilerWarnings">${t('customAgent.compilerWarnings')}</label>
                </div>
                <div class="checkbox-item">
                    <input type="checkbox" id="ctx_buildInfo" ${agentContext.buildInfo ? 'checked' : ''}>
                    <label for="ctx_buildInfo">${t('customAgent.buildInfo')}</label>
                </div>
            </div>

            <div class="context-group">
                <h3>📎 ${t('customAgent.additionalFiles')}</h3>
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 0;">
                    ${t('customAgent.additionalFilesDesc')}
                </p>
                
                <button onclick="addAdditionalFiles()" class="action-button" style="margin-bottom: 10px;">
                    <span style="margin-right: 5px;">📁</span>
                    ${t('customAgent.addFiles')}
                </button>
                
                <div id="additionalFilesList" class="additional-files-list">
                    ${generateAdditionalFilesHTML(agent?.additionalFiles || [], t)}
                </div>
            </div>
            
            <div class="button-row">
                <button class="btn-secondary" onclick="backToOverview()">←</button>
                <button class="btn-primary" onclick="saveAgent()">
                    💾 ${t('buttons.save')}
                </button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                const isEdit = ${isEdit};
                const editingId = ${agent ? `'${agent.id}'` : 'null'};

                // Translations for frontend
                const i18n = {
                    noAdditionalFiles: '${t('customAgent.noAdditionalFiles')}',
                    removeTitle: '${t('buttons.remove')}'
                };
    
                // Additional Files Management
                let additionalFiles = ${JSON.stringify(agent?.additionalFiles || [])};
    
                function addAdditionalFiles() {
                    vscode.postMessage({
                        command: 'pickAdditionalFiles',
                        existingFiles: additionalFiles
                    });
                }
    
                function removeAdditionalFile(filePath) {
                    additionalFiles = additionalFiles.filter(f => f !== filePath);
                    updateAdditionalFilesList();
                }   
    
                function updateAdditionalFilesList() {
                    const listElement = document.getElementById('additionalFilesList');
                    if (!listElement) return;
        
                    if (additionalFiles.length === 0) {
                        listElement.innerHTML = '<p style="color: var(--vscode-descriptionForeground); font-size: 12px;">${t('customAgent.noAdditionalFiles')}</p>';
                        return;
                    }
        
                    let html = '<div class="file-list">';
                    additionalFiles.forEach(filePath => {
                        const fileName = filePath.split(/[\\\\/]/).pop();
                        html += \`
                            <div class="file-item">
                                <button onclick="removeAdditionalFile('\${filePath.replace(/\\\\/g, '\\\\\\\\')}')" class="remove-file-btn" title="${t('buttons.remove')}">
                                    ✕
                                </button>
                                <span class="file-name" title="\${filePath}">\${fileName}</span>
                            </div>
                        \`;
                    });
                    html += '</div>';
                    listElement.innerHTML = html;
                }
    
                // Listen for file selection from backend
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'filesSelected') {
                        additionalFiles = [...additionalFiles, ...message.files];
                        updateAdditionalFilesList();
                    }
                });
                
                function saveAgent() {
                    const name = document.getElementById('agentName').value.trim();
                    const prompt = document.getElementById('agentPrompt').value.trim();
                    
                    if (!name || !prompt) {
                        return;
                    }
                    
                    const agentData = {
                        name: name,
                        prompt: prompt,
                        additionalFiles: additionalFiles,
                        context: {
                            currentSelection: document.getElementById('ctx_currentSelection').checked,
                            currentFileFull: document.getElementById('ctx_currentFileFull').checked,
                            currentFileFunctions: document.getElementById('ctx_currentFileFunctions').checked,
                            allSketchFiles: document.getElementById('ctx_allSketchFiles').checked,
                            boardInfo: document.getElementById('ctx_boardInfo').checked,
                            usedLibraries: document.getElementById('ctx_usedLibraries').checked,
                            pinConfiguration: document.getElementById('ctx_pinConfiguration').checked,
                            memoryUsage: document.getElementById('ctx_memoryUsage').checked,
                            compilerErrors: document.getElementById('ctx_compilerErrors').checked,
                            compilerWarnings: document.getElementById('ctx_compilerWarnings').checked,
                            buildInfo: document.getElementById('ctx_buildInfo').checked
                        }
                    };
                    
                    if (isEdit) {
                        agentData.id = editingId;
                    }
                    
                    vscode.postMessage({
                        command: 'saveAgent',
                        agentData: agentData
                    });
                }
                
                function backToOverview() {
                    vscode.postMessage({ command: 'backToOverview' });
                }
                
                // Context menu
                ${featureUtils.generateContextMenu(t, { showPaste: true }).script}
            </script>
        </body>
        </html>
    `;
}

/**
 * Handle saving agent (create or update)
 */
async function handleSaveAgent(agentData, panel, context) {
    const { t } = context;
    
    if (agentData.id) {
        // Update existing
        agentManager.updateAgent(agentData.id, agentData);
        vscode.window.showInformationMessage(t('customAgent.agentUpdated'));
    } else {
        // Create new
        agentManager.createAgent(agentData);
        vscode.window.showInformationMessage(t('customAgent.agentCreated'));
    }
    
    currentView = 'overview';
    editingAgentId = null;
    updatePanelContent(panel, context);
}

/**
 * Handle deleting agent
 */
async function handleDeleteAgent(agentId, panel, context) {
    const { t } = context;
    
    const choice = await vscode.window.showWarningMessage(
        t('customAgent.deleteConfirm'),
        t('buttons.delete'),
        t('buttons.cancel')
    );
    
    if (choice === t('buttons.delete')) {
        agentManager.deleteAgent(agentId);
        vscode.window.showInformationMessage(t('customAgent.agentDeleted'));
        updatePanelContent(panel, context);
    }
}

/**
 * Generate Output HTML (After running agent)
 */
function generateOutputHTML(agent, response, context) {
    const { t } = context;
    
    const result = featureUtils.processMessageWithCodeBlocks(response, 'customAgent', t, ['copy']);
    const codeBlocks = result.codeBlocks;
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${shared.escapeHtml(agent.name)}</title>
            ${getSharedCSS(context.settings.get('cardStyle'))}
        </head>
        <body>
            ${featureUtils.generateContextMenu(t).html}
            
            <div class="question-box">
                <h3>🤖 ${shared.escapeHtml(agent.name)}</h3>
                <p>${shared.escapeHtml(agent.prompt)}</p>
            </div>
            
            ${featureUtils.getBoardInfoHTML(t)}
            
            <div class="panel-section">
                <h3>💡 ${t('customAgent.output')}:</h3>
                ${result.html}
            </div>
            
            <div style="margin-top: 20px;">
                <button class="btn-secondary" onclick="backToOverview()">
                    ← ${t('customAgent.backToAgents')}
                </button>
            </div>
            
            ${featureUtils.generateCodeBlockHandlers(codeBlocks, t, { includeBackButton: true })}
            
            ${getPrismScripts()}
        </body>
        </html>
    `;
}

module.exports = {
    showCustomAgentPanel,
    runCustomAgent
};
