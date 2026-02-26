/*
 * AI.duino - Chat Panel Feature Module
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const featureUtils = require('./featureUtils');
const contextManager = require('../utils/contextManager');
const panelManager = require('../utils/panelManager');
const { ChatHistoryManager } = require('./chat/chatHistoryManager');
const chatHandlers = require('./chat/chatHandlers');
const chatRenderer = require('./chat/chatRenderer');

// Global state variables
let historyManager = null;
let currentView = 'overview'; // 'overview' or 'chat'
let attachedContext = null; // Stores attached context for current message
let lastUsedContext = null; // Store last used context for reuse
let activeSessions = {}; // Format: { 'chatId-providerId': 'session-abc123' }
let arduinoMode = true;
let chatCodeMode = false;
let agenticMode = false; // Agentic Coding mode with compile loop
let lastUsedProvider = null;

/**
 * Create state object to pass to handlers and renderers
 * This bundles all mutable state and helper functions
 */
function createStateObject() {
    return {
        // State variables (passed by reference)
        get historyManager() { return historyManager; },
        set historyManager(value) { historyManager = value; },
        
        get currentView() { return currentView; },
        set currentView(value) { currentView = value; },
        
        get attachedContext() { return attachedContext; },
        set attachedContext(value) { attachedContext = value; },
        
        get lastUsedContext() { return lastUsedContext; },
        set lastUsedContext(value) { lastUsedContext = value; },
        
        get activeSessions() { return activeSessions; },
        set activeSessions(value) { activeSessions = value; },
        
        get arduinoMode() { return arduinoMode; },
        set arduinoMode(value) { arduinoMode = value; },
        
        get chatCodeMode() { return chatCodeMode; },
        set chatCodeMode(value) { chatCodeMode = value; },
        
        get agenticMode() { return agenticMode; },
        set agenticMode(value) { agenticMode = value; },
        
        get lastUsedProvider() { return lastUsedProvider; },
        set lastUsedProvider(value) { lastUsedProvider = value; },
        
        // Helper functions
        updatePanelContent: (panel, context) => {
            chatRenderer.updatePanelContent(panel, context, createStateObject());
        },
        
        updateAttachmentButtons: (panel, context) => {
            chatRenderer.updateAttachmentButtons(panel, context, createStateObject());
        }
    };
}

/**
 * Show persistent AI chat panel with overview page
 * @param {Object} context - Extension context with dependencies
 */
async function showChatPanel(context) {
    const { t } = context;
    
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
    
    // Create state object for handlers
    const state = createStateObject();
    
    // Setup message handler with standard commands
    featureUtils.setupStandardMessageHandler(panel, context, {
        openChat: async (message) => {
            await chatHandlers.handleOpenChat(message.chatId, panel, context, state);
        },
        backToOverview: async (message) => {
            // Reset attachments when going back to overview
            attachedContext = null;
            lastUsedContext = null;
            currentView = 'overview';
            chatRenderer.updatePanelContent(panel, context, state);
        },
        sendMessage: async (message) => {
            await chatHandlers.handleUserMessage(message.text, panel, context, state);
        },
        manageAttachments: async (message) => {
            await chatHandlers.handleManageAttachments(panel, context, state);
        },
        attachContext: async (message) => {
            await chatHandlers.handleAttachContext(panel, context, state);
        },
        reuseLastContext: async (message) => {
            if (lastUsedContext) {
                attachedContext = lastUsedContext;
                chatRenderer.updatePanelContent(panel, context, state);
    
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
            chatRenderer.updateAttachmentButtons(panel, context, state);
        },
        toggleArduinoMode: async (message) => {
            arduinoMode = !arduinoMode;
            // Update button style without re-rendering entire panel
            panel.webview.postMessage({ 
                command: 'updateArduinoMode', 
                arduinoMode: arduinoMode 
            });
        },
        toggleCodeMode: async (message) => {
            chatCodeMode = !chatCodeMode;
            // Update button style without re-rendering entire panel
            panel.webview.postMessage({ 
                command: 'updateCodeMode', 
                chatCodeMode: chatCodeMode 
            });
        },
        toggleAgenticMode: async () => {
            agenticMode = !agenticMode;
            // Clear session only when ENABLING agentic mode (to get fresh cwd)
            if (agenticMode && context.agenticClient) {
                context.agenticClient.clearSession(context.currentModel);
            }
            // Only update button state, not entire panel
            panel.webview.postMessage({
                command: 'updateAgenticMode',
                agenticMode: agenticMode
            });
        },
        newChat: async (message) => {
            await chatHandlers.handleNewChat(panel, context, state);
        },
        deleteChat: async (message) => {
            await chatHandlers.handleDeleteChat(message.chatId, panel, context, state);
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
                chatRenderer.updatePanelContent(panel, context, state);
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
    chatRenderer.updatePanelContent(panel, context, state);
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
    const workspacePath = chatHandlers.getWorkspacePath();
    const chatId = historyManager.createNewChat('', workspacePath);
    
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
        const state = createStateObject();
        chatRenderer.updatePanelContent(panel, context, state);
    }
}

module.exports = {
    showChatPanel,
    continueInChat
};
