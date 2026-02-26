/*
 * AI.duino - Chat Renderer Module
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const shared = require('../../shared');
const featureUtils = require('../featureUtils');
const fileManager = require('../../utils/fileManager');
const { getSharedCSS, getPrismScripts } = require('../../utils/panels/sharedStyles');

/**
 * Update panel content based on current view
 * @param {Object} panel - Webview panel
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 */
function updatePanelContent(panel, context, state) {
    const { minimalModelManager } = context;
    
    const actualCurrentModel = fileManager.loadSelectedModel(minimalModelManager.providers) || context.currentModel;
    const hasApiKey = minimalModelManager.getProviderInfo(actualCurrentModel).hasApiKey;
    
    if (state.currentView === 'overview') {
        const allChats = state.historyManager.getAllChats();
        panel.webview.html = generateOverviewHTML(allChats, minimalModelManager, hasApiKey, context, state);
    } else {
        const chatHistory = state.historyManager.getActiveChat();
        panel.webview.html = generateChatHTML(chatHistory, minimalModelManager, hasApiKey, context, state);
    }
}

/**
 * Generate overview page HTML
 * @param {Array} allChats - All chat sessions
 * @param {Object} minimalModelManager - Model manager
 * @param {boolean} hasApiKey - Whether API key is configured
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 * @returns {string} Complete HTML
 */
function generateOverviewHTML(allChats, minimalModelManager, hasApiKey, context, state) {
    const { t } = context;
    const canCreateNew = state.historyManager.canCreateNewChat();
    
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
                    ${chat.workspacePath ? `<div class="card-sketch">📁 ${chat.workspacePath.split('/').pop()}</div>` : ''}
                    <div class="card-info">
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
 * @param {Object} attachedContext - Attached context object
 * @param {Function} t - Translation function
 * @returns {string} HTML for attachment buttons
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
 * @param {Object} panel - Webview panel
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 */
function updateAttachmentButtons(panel, context, state) {
    const buttonsHtml = generateAttachmentButtons(state.attachedContext, context.t);
    panel.webview.postMessage({
        command: 'updateAttachments',
        buttonsHtml: buttonsHtml
    });
}

/**
 * Generate chat view HTML with back button
 * @param {Array} chatHistory - Chat message history
 * @param {Object} minimalModelManager - Model manager
 * @param {boolean} hasApiKey - Whether API key is configured
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 * @returns {string} Complete HTML
 */
function generateChatHTML(chatHistory, minimalModelManager, hasApiKey, context, state) {
    const { t } = context;
    let messagesHTML = '';
    const allCodeBlocks = {}; // messageId -> codeBlocks array 
    const messageStyle = context.settings.get('cardStyle') || 'arduino-green';
    
    // Check if current provider supports agentic mode
    const selectedModel = fileManager.loadSelectedModel(minimalModelManager.providers) || Object.keys(minimalModelManager.providers)[0];
    const currentProvider = minimalModelManager.providers[selectedModel];
    const isAgenticProvider = !!currentProvider?.agentModule;
    
    chatHistory.forEach(msg => {
        const timeStr = new Date(msg.timestamp).toLocaleTimeString();
        const isUser = msg.sender === 'user';

        let modelName = 'AI';
        if (!isUser) {
            if (msg.modelId) {
                const msgModel = minimalModelManager.providers[msg.modelId];
                modelName = msgModel ? msgModel.name : 'AI';
            } else {
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
                        style="background: ${state.arduinoMode ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)'}">
                        ${state.arduinoMode ? '🎯' : '💬'}
                    </button>
                    <button class="action-btn" 
                        id="codeModeBtn"
                        onclick="toggleCodeMode()" 
                        title="${t('chat.toggleCodeMode') || 'Code Mode (lower temperature)'}"
                        style="background: ${state.chatCodeMode ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)'}">
                        ${state.chatCodeMode ? '❄️' : '🔥'}
                    </button>
                    ${isAgenticProvider ? `
                    <button class="action-btn" 
                        id="agenticModeBtn"
                        onclick="toggleAgenticMode()" 
                        title="${t('chat.toggleAgenticMode') || 'Agentic Coding (auto-compile)'}"
                        style="background: ${state.agenticMode ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)'}">
                        ${state.agenticMode ? '🤖' : '💬'}
                    </button>
                    ` : ''}
                    <button class="action-btn" onclick="attachContext()" title="${t('chat.attachContext')}">🔎</button>
                    <span id="attachmentButtons">${generateAttachmentButtons(state.attachedContext, t)}</span>
                    ${state.lastUsedContext ? `
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

                function toggleAgenticMode() {
                    vscode.postMessage({ command: 'toggleAgenticMode' });
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

                    if (message.command === 'updateCodeMode') {
                        const button = document.querySelector('[onclick="toggleCodeMode()"]');
                        if (button) {
                            button.style.background = message.chatCodeMode ? 
                                'var(--vscode-button-background)' : 
                                'var(--vscode-button-secondaryBackground)';
                            button.textContent = message.chatCodeMode ? '❄️' : '🔥';
                        }
                    }

                    if (message.command === 'updateAgenticMode') {
                        const button = document.querySelector('[onclick="toggleAgenticMode()"]');
                        if (button) {
                            button.style.background = message.agenticMode ? 
                                'var(--vscode-button-background)' : 
                                'var(--vscode-button-secondaryBackground)';
                            button.textContent = message.agenticMode ? '🤖' : '💬';
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

module.exports = {
    updatePanelContent,
    updateAttachmentButtons,
    generateOverviewHTML,
    generateChatHTML
};
