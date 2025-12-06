/*
 * AI.duino - Chat Panel Feature Module (Mit Übersichtsseite)
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const path = require('path');
const shared = require('../shared');
const featureUtils = require('./featureUtils');
const contextManager = require('../utils/contextManager');
const fileManager = require('../utils/fileManager');
const panelManager = require('../utils/panelManager');
const { getSharedCSS, getPrismScripts } = require('../utils/panels/sharedStyles');
const { ChatHistoryManager } = require('../utils/chatHistoryManager');

// Global panel reference to prevent multiple instances
let historyManager = null;
let currentView = 'overview'; // 'overview' or 'chat'
let attachedContext = null; // Stores attached context for current message
let lastUsedContext = null; // Store last used context for reuse
let activeSessions = {}; // Format: { 'chatId-providerId': 'session-abc123' }
let arduinoMode = true;
let chatCodeMode = false;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let lastUsedProvider = null;

/**
 * Show persistent AI chat panel with overview page
 * @param {Object} context - Extension context with dependencies
 */
async function showChatPanel(context) {
    const { t, minimalModelManager } = context;
    
    // Create or reveal panel using PanelManager
    const panel = panelManager.getOrCreatePanel({
        id: 'aiduinoChatPanel',
        title: `🤖 ${t('commands.openChatPanel')}`,
        viewColumn: vscode.ViewColumn.Two,
        webviewOptions: { 
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: []
        },
        onDispose: () => {
            historyManager = null;
            currentView = 'overview';
            attachedContext = null;
            lastUsedContext = null;
        },
        onReveal: () => {
            // Panel already exists, just return
            return;
        }
    });
    
    // If panel was just revealed (not newly created), return early
    if (panel.webview.html) {
        return;
    }
    
    // Initialize ChatHistoryManager for new panel
    historyManager = new ChatHistoryManager(context.settings);
    
    // Start with overview
    currentView = 'overview';
    
    // Setup message handler with standard commands
    featureUtils.setupStandardMessageHandler(panel, context, {
        openChat: async (message) => {
            await handleOpenChat(message.chatId, panel, context);
        },
        backToOverview: async (message) => {
            // Reset attachments when going back to overview
            attachedContext = null;
            lastUsedContext = null;
            currentView = 'overview';
            updatePanelContent(panel, context);
        },
        sendMessage: async (message) => {
            await handleUserMessage(message.text, panel, context);
        },
        toggleCodeMode: async (message) => {
            chatCodeMode = !chatCodeMode;
            updatePanelContent(panel, context);
        },
        manageAttachments: async (message) => {
            await handleManageAttachments(panel, context);
        },
        attachContext: async (message) => {
            await handleAttachContext(panel, context);
        },
        reuseLastContext: async (message) => {
            if (lastUsedContext) {
                attachedContext = lastUsedContext;
                updatePanelContent(panel, context);
    
                // Show badge
                let badgeHtml = contextManager.getContextBadgeHtml(lastUsedContext, context.t);
                badgeHtml = badgeHtml.replace('</div>', 
                '<span onclick="event.stopPropagation(); clearContext()" style="cursor: pointer; margin-left: 5px; font-weight: bold;">×</span></div>');

                panel.webview.postMessage({
                    command: 'contextAttached',
                    badge: badgeHtml
                });
            }
        },
        clearContext: async (message) => {
            attachedContext = null;
            lastUsedContext = null;
            updateAttachmentButtons(panel, context);
        },
        toggleArduinoMode: async (message) => {
            arduinoMode = !arduinoMode;
            // Update button style without re-rendering entire panel
            panel.webview.postMessage({ 
                command: 'updateArduinoMode', 
                arduinoMode: arduinoMode 
            });
        },
        newChat: async (message) => {
            await handleNewChat(panel, context);
        },
        deleteChat: async (message) => {
            await handleDeleteChat(message.chatId, panel, context);
        },
        clearChat: async (message) => {
            const { t } = context;
            
            const choice = await vscode.window.showWarningMessage(
                t('chat.confirmDelete'),
                t('buttons.yes'),
                t('buttons.no')
            );
            
            if (choice === t('buttons.yes')) {
                historyManager.clearActiveChat();
                updatePanelContent(panel, context);
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
    
    // Initial render
    updatePanelContent(panel, context);
}

/**
 * Handle opening a chat
 */
async function handleOpenChat(chatId, panel, context) {
    if (historyManager.switchChat(chatId)) {
        // Sessions aus History wiederherstellen
        const savedSessions = historyManager.loadSessions(chatId);
        activeSessions = savedSessions || {};
        
        currentView = 'chat';
        updatePanelContent(panel, context);
    }
}

/**
 * Handle new chat creation
 */
async function handleNewChat(panel, context) {
    const { t } = context;
    
    if (!historyManager.canCreateNewChat()) {
        vscode.window.showWarningMessage(t('chat.maxChatsReached'));
        return;
    }
    
    const chatId = historyManager.createNewChat('');
    if (chatId) {
        currentView = 'chat';
        updatePanelContent(panel, context);
    }
}

/**
 * Handle chat deletion
 */
async function handleDeleteChat(chatId, panel, context) {
    const { t } = context;
    
    const allChats = historyManager.getAllChats();
    if (allChats.length <= 1) {
        vscode.window.showWarningMessage(t('chat.cannotDeleteLastChat'));
        return;
    }
    
    const choice = await vscode.window.showWarningMessage(
        t('chat.confirmDelete'),
        t('buttons.yes'),
        t('buttons.no')
    );
    
    if (choice === t('buttons.yes')) {
        if (historyManager.deleteChat(chatId)) {
            // If we deleted the active chat while in chat view, go back to overview
            if (currentView === 'chat' && historyManager.getActiveChatId() !== chatId) {
                currentView = 'overview';
            }
            updatePanelContent(panel, context);
        }
    }
}

/**
 * Handle user message
 */
async function handleUserMessage(userText, panel, context) {
    if (!userText?.trim() && !attachedContext) return;

    const messageText = userText?.trim() || '';
    const fileManager = require('../utils/fileManager');
    const actualCurrentModel = fileManager.loadSelectedModel(context.minimalModelManager.providers) || context.currentModel;
    
    if (lastUsedProvider && lastUsedProvider !== actualCurrentModel) {
        activeSessions = {}; // Alle Sessions löschen
    }

    lastUsedProvider = actualCurrentModel;
    historyManager.addMessage('user', messageText, attachedContext);
    updatePanelContent(panel, context);

    const chatHistory = historyManager.getActiveChat();
    const chatId = historyManager.getActiveChatId();
    const sessionKey = `${chatId}-${actualCurrentModel}`;
    const hadNoSession = !activeSessions[sessionKey];
    
    let prompt;

    if (attachedContext) {
        lastUsedContext = attachedContext;
        prompt = buildChatPromptWithAttachments(messageText, attachedContext, context);
        attachedContext = null;
        panel.webview.postMessage({ command: 'contextAttached', badge: '' });
    } else {
        prompt = buildChatPrompt(userText, chatHistory, actualCurrentModel, context.minimalModelManager, chatId, context);
    }
    
    try {
        // DON'T create modifiedContext - modify context directly!
        context.currentModel = actualCurrentModel;
        context.sessionId = activeSessions[sessionKey] || null;
    
        const result = await featureUtils.callAIWithProgress(
            prompt, 
            'progress.askingAI', 
            context,
            { useCodeTemperature: chatCodeMode }
        );
    
        // Result is always a string now (sessionId is stored in context)
        const response = result;
        const newSessionId = context.sessionId || null;      
        const provider = context.minimalModelManager.providers[actualCurrentModel];
        const gotNewSession = provider?.persistent && hadNoSession && newSessionId;
    
        if (gotNewSession) {
            activeSessions[sessionKey] = newSessionId;
            historyManager.addMessage('system', context.t('chat.newSessionStarted'), null, actualCurrentModel);
        } else if (provider?.persistent && newSessionId) {
            activeSessions[sessionKey] = newSessionId;
        }
    
        historyManager.addMessage('ai', response, null, actualCurrentModel);

        if (provider?.persistent) {
            historyManager.saveSessions(
                historyManager.getActiveChatId(), 
                activeSessions
            );
        }

        updatePanelContent(panel, context);
    } catch (error) {
        throw error;
    }
}

/**
 * Build chat prompt with history context
 */
function buildChatPrompt(newMessage, history, currentModel, minimalModelManager, chatId, context) {
    const provider = minimalModelManager.providers[currentModel];
    const sessionKey = `${chatId}-${currentModel}`;
    const sessionId = activeSessions[sessionKey];
    const hasActiveSession = provider?.persistent && sessionId;
    
    if (hasActiveSession) {
        let prompt = `User: ${newMessage}\n\n`;
        if (arduinoMode) {
            prompt += shared.getBoardContext();
        }
        prompt += "\n\nWhen writing code, always show the complete code in markdown code blocks (```cpp, ```python, etc.) in your response, not just file references.";
        return prompt;
    }
    
    if (history.length === 0) {
        let prompt = arduinoMode ? 
            "You are an Arduino programming assistant.\n\n" :
            "You are a helpful AI assistant.\n\n";
        prompt += `User: ${newMessage}\n\n`;
        if (arduinoMode) {
            prompt += shared.getBoardContext();
        }
        prompt += "\n\nWhen writing code, always show the complete code in markdown code blocks (```cpp, ```python, etc.) in your response, not just file references.";
        return prompt;
    }
    
    let prompt = arduinoMode ?
        "You are an Arduino programming assistant. Previous conversation:\n\n" :
        "You are a helpful AI assistant. Previous conversation:\n\n";
    
    const maxHistory = context.settings.get('chatHistoryLength') || 20;
    const recentHistory = history.slice(-maxHistory);
    recentHistory.forEach(msg => {
        const role = msg.sender === 'user' ? 'User' : 'Assistant';
        prompt += `${role}: ${msg.text}\n\n`;
    });
    
    prompt += `User: ${newMessage}\n\n`;
    if (arduinoMode) {
        prompt += shared.getBoardContext();
    }
    prompt += "\n\nWhen writing code, always show the complete code in markdown code blocks (```cpp, ```python, etc.) in your response, not just file references.";
    prompt += "\n\nPlease respond as the AI assistant:";
    
    return prompt;
}

/**
 * Build chat prompt with attachments (Arduino files and/or external files)
 * @param {string} messageText - User message
 * @param {Object} attachedContext - Context with contextData and externalFiles
 * @param {Object} context - Extension context
 * @returns {string} Complete prompt
 */
function buildChatPromptWithAttachments(messageText, attachedContext, context) {
    const { t } = context;
    let prompt = '';
    
    // Start with base prompt
    prompt = arduinoMode ? 
        "You are an Arduino programming assistant.\n\n" :
        "You are a helpful AI assistant.\n\n";
    
    // Add user message
    prompt += `User question: ${messageText}\n\n`;
    
    // Add Arduino context files if present
    if (attachedContext.contextData && attachedContext.contextData.contextFiles) {
        const files = attachedContext.contextData.contextFiles;
        
        if (files.length === 1) {
            // Single file
            const file = files[0];
            prompt += `Code file (${file.name}):\n\`\`\`cpp\n${file.content}\n\`\`\`\n\n`;
        } else if (files.length > 1) {
            // Multiple files (full sketch)
            prompt += `Complete Arduino Sketch:\n\n`;
            for (const file of files) {
                prompt += `// ========== ${file.name} ==========\n`;
                prompt += `\`\`\`cpp\n${file.content}\n\`\`\`\n\n`;
            }
        }
    }
    
    // Add external files if present
    if (attachedContext.externalFiles && attachedContext.externalFiles.length > 0) {
        prompt += `\n=== Additional External Files ===\n`;
        for (const file of attachedContext.externalFiles) {
            prompt += `\n// ========== ${file.name} ==========\n`;
            prompt += `\`\`\`\n${file.content}\n\`\`\`\n`;
        }
    }
    
    // Add board context if Arduino mode
    if (arduinoMode) {
        prompt += '\n\n' + shared.getBoardContext();
    }
    prompt += "\n\nWhen writing code, always show the complete code in markdown code blocks (```cpp, ```python, etc.) in your response, not just file references.";
    return prompt;
}

/**
 * Handle attaching context - shows menu with 3 options
 */
async function handleAttachContext(panel, context) {
    const { t } = context;
    const editor = vscode.window.activeTextEditor;
    
    // Build options
    const options = [];
    
    // Only show code options if Arduino file is open
    if (editor && context.validation.validateArduinoFile(editor.document.fileName)) {
        options.push({
            label: '📂 ' + t('context.currentFile'),
            description: t('context.currentFileDetailNoSelection'),
            value: 'currentFile'
        });
        
        options.push({
            label: '📂 ' + t('context.fullSketch'),
            description: t('context.fullSketchDetailNoSelection'),
            value: 'fullSketch'
        });
    }
    
    // Always show external files option
    options.push({
        label: '📁 ' + t('customAgent.additionalFiles'),
        description: t('customAgent.additionalFilesDesc'),
        value: 'externalFiles'
    });
    
    const choice = await vscode.window.showQuickPick(options, {
        placeHolder: t('chat.attachFile'),
        ignoreFocusOut: true
    });
    
    if (!choice) return;
    
    // Handle choice
    if (choice.value === 'externalFiles') {
        await handleAttachExternalFiles(panel, context);
    } else {
        // currentFile or fullSketch
        const contextData = contextManager.buildContextData(
            choice.value,
            editor,
            contextManager.getSketchFiles(path.dirname(editor.document.uri.fsPath)),
            ''
        );
        
        // Store in new structure
        if (!attachedContext) {
            attachedContext = {
                contextData: null,
                externalFiles: []
            };
        }
        
        attachedContext.contextData = contextData;
        lastUsedContext = { ...attachedContext };
        updateAttachmentButtons(panel, context);

        vscode.window.showInformationMessage(t('messages.contextAttachedInfo'));
    }
}

/**
 * Handle attaching external files
 */
async function handleAttachExternalFiles(panel, context) {
    const { t } = context;
    
    const existingFiles = attachedContext?.externalFiles || [];
    
    const newFiles = await fileManager.pickAdditionalFiles(existingFiles.map(f => f.path), {
        title: t('customAgent.selectAdditionalFiles'),
        openLabel: t('customAgent.addFiles')
    });
    
    if (!newFiles || newFiles.length === 0) return;
    
    const filesData = await fileManager.readAdditionalFiles(newFiles);
    
    if (!attachedContext) {
        attachedContext = {
            contextData: null,
            externalFiles: []
        };
    }
    
    attachedContext.externalFiles = [
        ...attachedContext.externalFiles,
        ...filesData.filter(f => !f.error)
    ];
    
    lastUsedContext = { ...attachedContext };
    updateAttachmentButtons(panel, context);
    
    const count = filesData.filter(f => !f.error).length;
    vscode.window.showInformationMessage(
        count === 1 
            ? t('chat.externalFileAttached')
            : t('chat.externalFilesAttached', count)
    );
}

/**
 * Handle managing attachments via QuickPick
 */
async function handleManageAttachments(panel, context) {
    const { t } = context;
    
    if (!attachedContext) return;
    
    const items = [];
    
    if (attachedContext.contextData && attachedContext.contextData.contextFiles) {
        attachedContext.contextData.contextFiles.forEach(file => {
            items.push({
                label: `📂 ${file.name}`,
                description: t('context.currentFile'),
                filePath: `context:${file.name}`,
                type: 'context'
            });
        });
    }
    
    if (attachedContext.externalFiles) {
        attachedContext.externalFiles.forEach(file => {
            items.push({
                label: `📁 ${file.name}`,
                description: '(extern)',
                filePath: file.path,
                type: 'external'
            });
        });
    }
    
    if (items.length === 0) return;
    
    const choice = await vscode.window.showQuickPick(items, {
        placeHolder: t('chat.removeFilePrompt', t('buttons.remove') + '?'),
        ignoreFocusOut: true
    });
    
    if (!choice) return;
    
    if (choice.type === 'context') {
        const fileName = choice.filePath.replace('context:', '');
        if (attachedContext.contextData && attachedContext.contextData.contextFiles) {
            attachedContext.contextData.contextFiles = attachedContext.contextData.contextFiles.filter(
                f => f.name !== fileName
            );
            
            if (attachedContext.contextData.contextFiles.length === 0) {
                attachedContext.contextData = null;
            }
        }
    } else {
        attachedContext.externalFiles = attachedContext.externalFiles.filter(
            f => f.path !== choice.filePath
        );
    }
    
    if (!attachedContext.contextData && attachedContext.externalFiles.length === 0) {
        attachedContext = null;
        lastUsedContext = null;
    }

    updateAttachmentButtons(panel, context);
}
/**
 * Update panel content based on current view
 */
function updatePanelContent(panel, context) {
    const { minimalModelManager } = context;
    
    const fileManager = require('../utils/fileManager');
    const actualCurrentModel = fileManager.loadSelectedModel(minimalModelManager.providers) || context.currentModel;
    const hasApiKey = minimalModelManager.getProviderInfo(actualCurrentModel).hasApiKey;
    
    if (currentView === 'overview') {
        const allChats = historyManager.getAllChats();
        panel.webview.html = generateOverviewHTML(allChats, minimalModelManager, hasApiKey, context);
    } else {
        const chatHistory = historyManager.getActiveChat();
        panel.webview.html = generateChatHTML(chatHistory, minimalModelManager, hasApiKey, context);
    }
}

/**
 * Generate overview page HTML
 */
function generateOverviewHTML(allChats, minimalModelManager, hasApiKey, context) {
    const { t } = context;
    const canCreateNew = historyManager.canCreateNewChat();
    
    // Generate chat cards
    let chatsHTML = '';
    
    if (allChats.length === 0) {
        chatsHTML = `
            <div class="empty-state">
                <h2>💬 ${t('chat.noChatsYet')}</h2>
                <p>${t('chat.createFirstChat')}</p>
            </div>
        `;
    } else {
        chatsHTML = allChats.map(chat => {
            const date = new Date(chat.lastUpdated);
            const timeAgo = shared.formatTimeAgo(date, t);
            const cardStyle = context.settings.get('cardStyle') || 'arduino-green';
            
            return `
                <div class="card style-${cardStyle}" onclick="openChat('${chat.id}')">
                    <div class="card-header">
                        <div class="card-title">📝 ${shared.escapeHtml(chat.title)}</div>
                        <button class="card-delete" onclick="event.stopPropagation(); deleteChat('${chat.id}')" title="${t('buttons.delete')}">
                            🗑️
                        </button>
                    </div>
                    <div class="card-info">
                        ${chat.messageCount} ${t('chat.messages')} • ${timeAgo}}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${t('commands.openChatPanel')}</title>
            ${getSharedCSS()}
            <style>
                body {
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .chat-counter {
                    color: var(--vscode-descriptionForeground);
                    font-size: 14px;
                    margin-left: 10px;
                }
                .new-chat-btn {
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-size: 16px;
                    transition: background 0.2s;
                }
            </style>
        </head>
        <body>
            ${hasApiKey ? '' : `<div class="warning">⚠️ ${t('messages.noApiKey', 'AI Provider')}</div>`}
            
            <div class="overview-header">
                <div>
                    <span class="overview-title">🤖 ${t('chat.chatsOverview')}</span>
                    <span class="chat-counter">${allChats.length}/10</span>
                </div>
                <button 
                    class="panel-btn new-chat-btn ${canCreateNew ? '' : 'disabled'}" 
                    onclick="createNewChat()"
                    ${canCreateNew ? '' : 'disabled'}
                    title="${canCreateNew ? '' : t('chat.maxChatsReached')}"
                >
                    + ${t('chat.newChat')}
                </button>
            </div>
            
            <div class="chats-list">
                ${chatsHTML}
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function createNewChat() {
                    vscode.postMessage({ command: 'newChat' });
                }
                
                function openChat(chatId) {
                    vscode.postMessage({ 
                        command: 'openChat',
                        chatId: chatId
                    });
                }
                
                function deleteChat(chatId) {
                    vscode.postMessage({ 
                        command: 'deleteChat',
                        chatId: chatId
                    });
                }
            </script>
        </body>
        </html>
    `;
}

/**
 * Generate attachment buttons (simple approach)
 */
function generateAttachmentButtons(attachedContext, t) {
    if (!attachedContext) return '';
    
    let fileCount = 0;
    
    if (attachedContext.contextData && attachedContext.contextData.contextFiles) {
        fileCount += attachedContext.contextData.contextFiles.length;
    }
    
    if (attachedContext.externalFiles) {
        fileCount += attachedContext.externalFiles.length;
    }
    
    if (fileCount === 0) return '';
    
    return `
        <button class="action-btn" onclick="manageAttachments()" title="${t('chat.manageAttachments')}">
            ${fileCount}
        </button>
        <button class="action-btn" onclick="clearContext()" title="${t('chat.clearContext')}" style="padding: 6px 8px;">
            ×
        </button>
    `;
}

/**
 * Update attachment buttons without re-rendering the panel
 */
function updateAttachmentButtons(panel, context) {
    const buttonsHtml = generateAttachmentButtons(attachedContext, context.t);
    panel.webview.postMessage({
        command: 'updateAttachments',
        buttonsHtml: buttonsHtml
    });
}

/**
 * Generate chat view HTML with back button
 */
    function generateChatHTML(chatHistory, minimalModelManager, hasApiKey, context) {
    const { t } = context;
    let messagesHTML = '';
    const allCodeBlocks = {}; // messageId -> codeBlocks array 
    const messageStyle = context.settings.get('cardStyle') || 'arduino-green';
    
    chatHistory.forEach(msg => {
        const timeStr = new Date(msg.timestamp).toLocaleTimeString();
        const isUser = msg.sender === 'user';

        let modelName = 'AI';
        if (!isUser) {
            if (msg.modelId) {
                const msgModel = minimalModelManager.providers[msg.modelId];
                modelName = msgModel ? msgModel.name : 'AI';
            } else {
                const fileManager = require('../utils/fileManager');
                const currentModelId = fileManager.loadSelectedModel(minimalModelManager.providers);
                const currentModel = minimalModelManager.providers[currentModelId];
                modelName = currentModel ? currentModel.name : 'AI';
            }
        }
        
        // Process message content
        let messageContent;
        if (!isUser && msg.text && msg.text.includes('```')) {
            // AI message with code blocks - process like improveCode.js
            const result = featureUtils.processMessageWithCodeBlocks(msg.text, msg.id, t, ['copy']);
            messageContent = result.html;
            allCodeBlocks[msg.id] = result.codeBlocks;
        } else if (isUser && !msg.text && msg.code) {       
            // User sent only files without text
            messageContent = `<em style="opacity: 0.7">[${t('chat.filesSent')}]</em>`;
        } else {
            // Simple text message
            messageContent = shared.escapeHtml(msg.text || '').replace(/\n/g, '<br>');
        }

        messagesHTML += `
            <div class="message ${isUser ? 'user-message' : `ai-message style-${messageStyle}`}">
                <div class="message-header">
                    <span class="sender">${isUser ? `👤 ${t('chat.you')}` : `🤖 ${modelName}`}</span>
                    <span class="timestamp">${timeStr}</span>
                </div>
                <div class="message-content">
                    ${messageContent}
                </div>
            </div>
        `;
    });
    
    if (chatHistory.length === 0) {
        messagesHTML = `
            <div class="welcome-message">
                <h3>🤖 ${t('commands.openChatPanel')}</h3>
                <p>${t('chat.welcomeMessage')}</p>
            </div>
        `;
    }
    
    const disabledClass = hasApiKey ? '' : 'disabled';
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${t('commands.openChatPanel')}</title>
            ${getSharedCSS()}
            <style>
                /* Chat specific - uses shared button, textarea, .warning */
                body {
                    text-align: left;
                    max-width: none;
                    margin: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    padding: 0;
                }                
                .chat-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px 20px;
                    background: var(--vscode-editor-background);
                }        
                .message {
                    margin-bottom: 15px;
                    padding: 10px;
                    border-radius: 8px;
                    max-width: 90%;
                }        
                .user-message {
                    background: var(--vscode-textBlockQuote-background);
                    margin-left: auto;
                    border-left: 3px solid var(--vscode-textLink-foreground);
                }                              
                .message-header {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    margin-bottom: 5px;
                    opacity: 0.8;
                }                
                .sender {
                    font-weight: bold;
                }                
                .timestamp {
                    color: var(--vscode-descriptionForeground);
                }                
                .message-content {
                    line-height: 1.4;
                }                
                .input-container {
                    padding: 20px;
                    border-top: 1px solid var(--vscode-panel-border);
                    background: var(--vscode-panel-background);
                    flex-shrink: 0;
                }                
                .input-actions {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                }               
               .input-row {
                    display: flex;
                    gap: 10px;
                    align-items: flex-end;
                }                
                .input-field {
                    flex: 1;
                    min-height: 60px;
                    resize: vertical;
                }
                .send-btn {
                    height: fit-content;
                }
                .action-btn.active-pin {
                    background: var(--vscode-inputValidation-warningBackground);
                    color: var(--vscode-inputValidation-warningForeground);
                }               
                .welcome-message {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            ${featureUtils.generateContextMenu(t, { showPaste: true }).html}
            
            <div class="chat-container" id="chatContainer">
                ${messagesHTML}
            </div>
            
            <div class="input-container">
                ${hasApiKey ? '' : `<div class="warning">⚠️ ${t('messages.noApiKey', 'AI Provider')}</div>`}
                
                <div class="input-actions">
                    <button class="action-btn" onclick="backToOverview()" title="${t('chat.backToOverview')}">←</button>
                    <button class="action-btn" 
                        onclick="toggleArduinoMode()" 
                        title="${t('chat.toggleMode')}"
                        style="background: ${arduinoMode ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)'}">
                        ${arduinoMode ? '🎯' : '💬'}
                    </button>
                    <button class="action-btn" 
                        id="codeModeBtnƒ"
                        onclick="toggleCodeMode()" 
                        title="${t('chat.toggleCodeMode') || 'Code Mode (lower temperature)'}"
                        style="background: ${chatCodeMode ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)'}">
                        ${chatCodeMode ? '❄️' : '🔥'}
                    </button>
                    <button class="action-btn" onclick="attachContext()" title="${t('chat.attachContext')}">📎</button>
                    <span id="attachmentButtons">${generateAttachmentButtons(attachedContext, t)}</span>
                    ${lastUsedContext ? `
                        <button class="action-btn" onclick="reuseLastContext()" title="${t('chat.reuseLastContext')}">🔄</button>
                    ` : ''}
                    <button class="action-btn" onclick="clearChat()" title="${t('buttons.reset')}" style="margin-left: auto;">🗑️</button>
                </div>
                
                <div class="input-row">
                    <textarea 
                        id="messageInput" 
                        class="input-field" 
                        placeholder="${t('chat.inputPlaceholder')}"
                        ${hasApiKey ? '' : 'disabled'}
                    ></textarea>
                    <button class="send-btn ${disabledClass}" onclick="sendMessage()" ${disabledClass}>
                        ${t('buttons.send')}
                    </button>
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
    
                // Code blocks data per message
                const allCodeBlocks = ${JSON.stringify(allCodeBlocks)};
    
                // Event delegation for code block buttons
                document.addEventListener('click', (e) => {
                    const button = e.target.closest('[data-action]');
                    if (!button) return;
        
                    const action = button.dataset.action;
                    const messageId = button.dataset.messageId;
                    const index = parseInt(button.dataset.index);
            
                    if (!allCodeBlocks[messageId]) return;
                    const code = allCodeBlocks[messageId][index];

                    if (action === 'copy') {
                        vscode.postMessage({ command: 'copyCode', code: code });
                    } 
                });

                // Context menu
                ${featureUtils.generateContextMenu(t, { showPaste: true }).script}
    
                function closePanel() {
                    vscode.postMessage({ command: 'closePanel' });
                }
                    
                function scrollToBottom() {
                    const container = document.getElementById('chatContainer');
                    container.scrollTop = container.scrollHeight;
                }
                
                function sendMessage() {
                    const input = document.getElementById('messageInput');
                    const text = input.value.trim();
                    const hasContext = document.querySelector('.context-badge') !== null;
    
                    // Allow sending if text OR context is present
                    if (!text && !hasContext) return;
    
                    vscode.postMessage({
                        command: 'sendMessage',
                        text: text || ''
                    });

                    input.value = '';
                }

                function attachContext() {
                    vscode.postMessage({ command: 'attachContext' });
                }

                function toggleArduinoMode() {
                    vscode.postMessage({ command: 'toggleArduinoMode' });
                }

                function clearContext() {
                    vscode.postMessage({ command: 'clearContext' });
                }
                
                function toggleCodeMode() {
                    vscode.postMessage({ command: 'toggleCodeMode' });
                }

                function manageAttachments() {
                    vscode.postMessage({ command: 'manageAttachments' });
                }

                function reuseLastContext() {
                    vscode.postMessage({ command: 'reuseLastContext' });
                }

                function backToOverview() {
                    vscode.postMessage({ command: 'backToOverview' });
                }
                
                function clearChat() {
                    vscode.postMessage({
                        command: 'clearChat'
                    });
                }
                
                window.addEventListener('message', function(event) {
                    const message = event.data;
    
                    if (message.command === 'insertCodeIntoInput') {
                        const input = document.getElementById('messageInput');
                        const currentText = input.value;
                        const codeBlock = message.code;
        
                        input.value = currentText ? currentText + '\\n\\n' + codeBlock : codeBlock;
                        input.focus();
                    }
    
                    if (message.command === 'updateArduinoMode') {
                        const button = document.querySelector('[onclick="toggleArduinoMode()"]');
                        if (button) {
                            button.style.background = message.arduinoMode ? 
                                'var(--vscode-button-background)' : 
                                'var(--vscode-button-secondaryBackground)';
                            button.textContent = message.arduinoMode ? '🎯' : '💬';
                        }
                    }

                    if (message.command === 'updateAttachments') {
                        const container = document.getElementById('attachmentButtons');
                        if (container) {
                            container.innerHTML = message.buttonsHtml;
                        }
                    }
                });
    
                document.getElementById('messageInput').addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });
                
                const observer = new MutationObserver(scrollToBottom);
                observer.observe(document.getElementById('chatContainer'), {
                    childList: true,
                    subtree: true
                });
                
                scrollToBottom();
            </script>
            
            ${getPrismScripts()}
        </body>
        </html>
    `;
}   

/**
 * Continue from another feature in chat
 * @param {string} userPrompt - Original user prompt/code
 * @param {string} aiResponse - AI response to continue from
 * @param {Object} context - Extension context
 */
async function continueInChat(userPrompt, aiResponse, context) {
    // First open chat panel (this initializes historyManager)
    await showChatPanel(context);
    
    // Now check if chat history is available
    if (!historyManager) {
        vscode.window.showErrorMessage(context.t('chat.historyNotAvailable'));
        return;
    }
    
    // Create new chat
    const chatId = historyManager.createNewChat('');
    
    // Check if chat creation failed (max chats reached)
    if (!chatId) {
        vscode.window.showWarningMessage(context.t('chat.maxChatsReached'));
        return;
    }
    
    historyManager.addMessage('user', userPrompt, null);
    historyManager.addMessage('ai', aiResponse, null);
    
    // Switch to chat view and update
    currentView = 'chat';
    const panel = panelManager.getPanel('aiduinoChatPanel');
    if (panel) {
        updatePanelContent(panel, context);
    }
}

module.exports = {
    showChatPanel,
    continueInChat
};
