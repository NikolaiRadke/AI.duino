/*
 * AI.duino - Chat Panel Feature Module (Mit Übersichtsseite)
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const shared = require('../shared');
const featureUtils = require('./featureUtils');
const { getSharedCSS, getPrismScripts } = require('../utils/panels/sharedStyles');
const { ChatHistoryManager } = require('../utils/chatHistoryManager');

// Global panel reference to prevent multiple instances
let activeChatPanel = null;
let historyManager = null;
let currentView = 'overview'; // 'overview' or 'chat'

/**
 * Show persistent AI chat panel with overview page
 * @param {Object} context - Extension context with dependencies
 */
async function showChatPanel(context) {
    const { t, minimalModelManager } = context;
    
    // If panel already exists, reveal it
    if (activeChatPanel) {
        activeChatPanel.reveal(vscode.ViewColumn.Two);
        return;
    }
    
    // Initialize ChatHistoryManager
    historyManager = new ChatHistoryManager();
    
    // Start with overview
    currentView = 'overview';
    
    // Create persistent panel
    const panel = vscode.window.createWebviewPanel(
        'aiduinoChatPanel',
        `🤖 ${t('commands.openChatPanel')}`,
        vscode.ViewColumn.Two,
        { 
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: []
        }
    );

    // Store panel reference
    activeChatPanel = panel;
    
    // Clear reference when panel is disposed
    panel.onDidDispose(() => {
        activeChatPanel = null;
        historyManager = null;
        currentView = 'overview';
    });
    
    // Setup message handler
    panel.webview.onDidReceiveMessage(async (message) => {
        try {
            switch (message.command) {
                case 'openChat':
                    await handleOpenChat(message.chatId, panel, context);
                    break;
                    
                case 'backToOverview':
                    currentView = 'overview';
                    updatePanelContent(panel, context);
                    break;
                    
                case 'sendMessage':
                    await handleUserMessage(message.text, panel, context);
                    break;
                    
                case 'sendSelectedCode':
                    await handleSendSelectedCode(panel, context);
                    break;
                    
                case 'newChat':
                    await handleNewChat(panel, context);
                    break;
                    
                case 'deleteChat':
                    await handleDeleteChat(message.chatId, panel, context);
                    break;
                    
                case 'clearChat':
                    historyManager.clearActiveChat();
                    updatePanelContent(panel, context);
                    break;
                    
                case 'copyCode':
                    await vscode.env.clipboard.writeText(featureUtils.cleanHtmlCode(message.code));
                    vscode.window.showInformationMessage(context.t('messages.copiedToClipboard'));
                    break;
                    
                case 'insertCode':
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showWarningMessage(context.t('messages.noEditor'));
                        break;
                    }
                    await editor.edit(editBuilder => {
                        editBuilder.insert(editor.selection.active, featureUtils.cleanHtmlCode(message.code));
                    });
                    vscode.window.showInformationMessage(context.t('messages.codeUpdated'));
                    break;
                    
                case 'closePanel':
                    panel.dispose();
                    break;
            }
        } catch (error) {
            context.handleApiError(error);
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
    if (!userText?.trim()) return;

    const fileManager = require('../utils/fileManager');
    const actualCurrentModel = fileManager.loadSelectedModel(context.minimalModelManager.providers) || context.currentModel;
    
    historyManager.addMessage('user', userText);
    updatePanelContent(panel, context);

    const chatHistory = historyManager.getActiveChat();
    let prompt = buildChatPrompt(userText, chatHistory);
    
    try {
        const freshContext = {
            ...context,
            currentModel: actualCurrentModel
        };
    
        const response = await featureUtils.callAIWithProgress(
            prompt,
            'progress.askingAI',
            freshContext
        );
    
        historyManager.addMessage('ai', response, null, actualCurrentModel);
        updatePanelContent(panel, context);
        
    } catch (error) {
        throw error;
    }
}

/**
 * Build chat prompt with history context
 */
function buildChatPrompt(newMessage, history) {
    if (history.length === 0) {
        let prompt = "You are an Arduino programming assistant.\n\n";
        prompt += `User: ${newMessage}\n\n`;
        prompt += shared.getBoardContext();
        return prompt;
    }
    
    let prompt = "You are an Arduino programming assistant. Previous conversation:\n\n";
    const recentHistory = history.slice(-8);
    
    recentHistory.forEach(msg => {
        const role = msg.sender === 'user' ? 'User' : 'Assistant';
        prompt += `${role}: ${msg.text}\n\n`;
    });
    
    prompt += `User: ${newMessage}\n\n`;
    prompt += shared.getBoardContext();
    prompt += "\n\nPlease respond as the Arduino assistant:";
    
    return prompt;
}

/**
 * Handle sending selected code
 */
async function handleSendSelectedCode(panel, context) {
    const { t } = context;
    const editor = vscode.window.activeTextEditor;
    
    if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage(t('messages.selectCodeToExplain'));
        return;
    }
    
    const selectedCode = editor.document.getText(editor.selection);
    
    panel.webview.postMessage({
        command: 'insertCodeIntoInput',
        code: selectedCode
    });
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
        panel.webview.html = generateOverviewHTML(allChats, minimalModelManager, hasApiKey, context.t);
    } else {
        const chatHistory = historyManager.getActiveChat();
        panel.webview.html = generateChatHTML(chatHistory, minimalModelManager, hasApiKey, context.t);
    }
}

/**
 * Generate overview page HTML
 */
function generateOverviewHTML(allChats, minimalModelManager, hasApiKey, t) {
    const canCreateNew = allChats.length < 10;
    
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
            const timeAgo = formatTimeAgo(date, t);
            
            return `
                <div class="chat-card" onclick="openChat('${chat.id}')">
                    <div class="chat-card-header">
                        <div class="chat-card-title">📝 ${shared.escapeHtml(chat.title)}</div>
                        <button class="chat-card-delete" onclick="event.stopPropagation(); deleteChat('${chat.id}')" title="${t('buttons.delete')}">
                            🗑️
                        </button>
                    </div>
                    <div class="chat-card-info">
                        ${chat.messageCount} ${t('chat.messages')} • ${timeAgo}
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
                
                .overview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                    padding-bottom: 15px;
                    border-bottom: 2px solid var(--vscode-panel-border);
                }
                
                .overview-title {
                    font-size: 24px;
                    font-weight: bold;
                }
                
                .chat-counter {
                    color: var(--vscode-descriptionForeground);
                    font-size: 14px;
                    margin-left: 10px;
                }
                
                .new-chat-btn {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 16px;
                    transition: background 0.2s;
                }
                
                .new-chat-btn:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                
                .new-chat-btn.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .chat-card {
                    background: var(--vscode-editor-selectionBackground);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 15px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .chat-card:hover {
                    background: var(--vscode-list-hoverBackground);
                    border-color: var(--vscode-focusBorder);
                    transform: translateX(5px);
                }
                
                .chat-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .chat-card-title {
                    font-size: 16px;
                    font-weight: bold;
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .chat-card-delete {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    font-size: 16px;
                    opacity: 0.6;
                    transition: opacity 0.2s;
                    padding: 5px;
                }
                
                .chat-card-delete:hover {
                    opacity: 1;
                }
                
                .chat-card-info {
                    font-size: 13px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .empty-state h2 {
                    font-size: 32px;
                    margin-bottom: 10px;
                }
                
                .warning {
                    background: var(--vscode-inputValidation-warningBackground);
                    color: var(--vscode-inputValidation-warningForeground);
                    padding: 15px;
                    border-radius: 4px;
                    margin-bottom: 20px;
                    text-align: center;
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
                    class="new-chat-btn ${canCreateNew ? '' : 'disabled'}" 
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
 * Generate chat view HTML with back button
 */
function generateChatHTML(chatHistory, minimalModelManager, hasApiKey, t) {
    let messagesHTML = '';
    const allCodeBlocks = {}; // messageId -> codeBlocks array 
    
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
        if (!isUser && msg.text.includes('```')) {
            // AI message with code blocks - process like improveCode.js
            const result = featureUtils.processMessageWithCodeBlocks(msg.text, msg.id, t);
            messageContent = result.html;
            allCodeBlocks[msg.id] = result.codeBlocks;
        } else {
            // Simple text message
            messageContent = shared.escapeHtml(msg.text).replace(/\n/g, '<br>');
        }

        messagesHTML += `
            <div class="message ${isUser ? 'user-message' : 'ai-message'}">
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
                
                .action-toolbar {
                    display: flex;
                    gap: 10px;
                }
                
                .back-btn {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: 1px solid var(--vscode-panel-border);
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    transition: background 0.2s;
                }
                
                .back-btn:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
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
                
                .ai-message {
                    background: var(--vscode-editor-selectionBackground);
                    margin-right: auto;
                    border-left: 3px solid #4CAF50;
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
                
                .action-btn.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .input-row {
                    display: flex;
                    gap: 10px;
                    align-items: flex-end;
                }
                
                .input-field {
                    flex: 1;
                    min-height: 60px;
                    padding: 8px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: inherit;
                    resize: vertical;
                }
                
                .send-btn {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    height: fit-content;
                }
                
                .send-btn:hover {
                    background: var(--vscode-button-hoverBackground);
                }
        
                .send-btn.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .welcome-message {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .warning {
                    background: var(--vscode-inputValidation-warningBackground);
                    color: var(--vscode-inputValidation-warningForeground);
                    padding: 15px;
                    border-radius: 4px;
                    margin-bottom: 10px;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="action-toolbar">
                <button class="back-btn" onclick="backToOverview()">←</button>
                <button class="toolbar-btn" onclick="toolbarCopy()">
                    📋 ${t('buttons.copy')}
                </button>
                <button class="toolbar-btn" onclick="toolbarInsertSelected()">
                    📝 ${t('chat.insertCode')}
                </button>
                <button class="toolbar-btn" onclick="closePanel()">
                    ✖ ${t('buttons.close')}
                </button>
            </div>
            
            <div class="chat-container" id="chatContainer">
                ${messagesHTML}
            </div>
            
            <div class="input-container">
                ${hasApiKey ? '' : `<div class="warning">⚠️ ${t('messages.noApiKey', 'AI Provider')}</div>`}
                
                <div class="input-actions">
                    <button class="action-btn" onclick="sendSelectedCode()" ${disabledClass}>
                        📤 ${t('chat.sendCode')}
                    </button>
                    <button class="action-btn" onclick="clearChat()">
                        🗑️ ${t('buttons.reset')}
                    </button>
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
                    } else if (action === 'insert') {
                        vscode.postMessage({ command: 'insertCode', code: code });
                    }
                });
    
                // Toolbar functions (from featureUtils)
                function toolbarCopy() {
                    const selection = window.getSelection().toString();
                    if (selection && selection.trim()) {
                        vscode.postMessage({ command: 'copyCode', code: selection.trim() });
                    }
                }
    
                function toolbarInsertSelected() {
                    const selection = window.getSelection().toString();
                    if (selection && selection.trim()) {
                        vscode.postMessage({ command: 'insertCode', code: selection.trim() });
                    }
                }
    
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
            
                    if (!text) return;
            
                    vscode.postMessage({
                        command: 'sendMessage',
                        text: text
                    });
                
                    input.value = '';
                }
                
                function sendSelectedCode() {
                    vscode.postMessage({
                        command: 'sendSelectedCode'
                    });
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
 * Format time ago string
 */
function formatTimeAgo(date, t) {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('time.justNow');
    if (minutes < 60) return t('time.minutesAgo', minutes);
    if (hours < 24) return t('time.hoursAgo', hours);
    if (days < 7) return t('time.daysAgo', days);
    
    return date.toLocaleDateString();
}

module.exports = {
    showChatPanel
};
