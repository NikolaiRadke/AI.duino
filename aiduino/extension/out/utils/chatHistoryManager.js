/*
 * AI.duino - Multi-Chat History Manager
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const fileManager = require('./fileManager');

const AIDUINO_DIR = path.join(os.homedir(), '.aiduino');
const CHATS_DIR = path.join(AIDUINO_DIR, '.aiduino-chats');
const INDEX_FILE = path.join(AIDUINO_DIR, '.aiduino-chat-index.json');
const MAX_CHATS = 10;
const MAX_MESSAGES_PER_CHAT = 100;

/**
 * Multi-Chat History Manager for AI.duino
 * Manages multiple chat sessions with separate files
 */
class ChatHistoryManager {
    constructor() {
        this.ensureDirectories();
        this.index = this.loadIndex();
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        if (!fs.existsSync(CHATS_DIR)) {
            fs.mkdirSync(CHATS_DIR, { recursive: true, mode: 0o700 });
        }
    }

    /**
     * Load chat index (metadata for all chats)
     * @returns {Object} Chat index
     */
    loadIndex() {
        if (!fileManager.fileExists(INDEX_FILE)) {
            return this.createEmptyIndex();
        }

        try {
            const content = fileManager.safeReadFile(INDEX_FILE);
            if (!content) return this.createEmptyIndex();
            
            const data = JSON.parse(content);
            
            // Validate structure
            if (!data.version || !Array.isArray(data.chats)) {
                return this.createEmptyIndex();
            }
            
            return data;
        } catch (error) {
            return this.createEmptyIndex();
        }
    }

    /**
     * Create empty index structure
     * @returns {Object} Empty index
     */
    createEmptyIndex() {
        return {
            version: '2.0',
            activeChat: null,
            chats: []
        };
    }

    /**
     * Save chat index
     * @returns {boolean} Success status
     */
    saveIndex() {
        const content = JSON.stringify(this.index, null, 2);
        return fileManager.atomicWrite(INDEX_FILE, content, { mode: 0o600 });
    }

    /**
     * Create new chat with auto-generated title
     * @param {string} firstMessage - First user message for title generation
     * @returns {string|null} New chat ID or null if limit reached
     */
    createNewChat(firstMessage = '') {
        // Check limit
        if (this.index.chats.length >= MAX_CHATS) {
            return null;
        }

        // Generate unique ID
        const chatId = 'chat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        // Generate title
        const title = this.generateChatTitle(firstMessage);
        
        // Create chat metadata
        const chatMeta = {
            id: chatId,
            title: title,
            created: Date.now(),
            lastUpdated: Date.now(),
            messageCount: 0
        };

        // Add to index
        this.index.chats.unshift(chatMeta); // Add at beginning
        this.index.activeChat = chatId;
        this.saveIndex();

        // Create empty chat file
        this.saveChatFile(chatId, []);

        return chatId;
    }

    /**
     * Generate chat title from first message
     * @param {string} message - First message
     * @returns {string} Generated title
     */
    generateChatTitle(message) {
        if (!message || !message.trim()) {
            return 'New Chat';
        }

        // Take first 30 chars, remove newlines
        let title = message.trim().replace(/\n/g, ' ').substring(0, 30);
        
        // Add ellipsis if truncated
        if (message.length > 30) {
            title += '...';
        }

        return title;
    }

    /**
     * Switch to a different chat
     * @param {string} chatId - Chat ID to switch to
     * @returns {boolean} Success status
     */
    switchChat(chatId) {
        // Verify chat exists
        const chatExists = this.index.chats.find(c => c.id === chatId);
        if (!chatExists) {
            return false;
        }

        this.index.activeChat = chatId;
        return this.saveIndex();
    }

    /**
     * Delete a chat
     * @param {string} chatId - Chat ID to delete
     * @returns {boolean} Success status
     */
    deleteChat(chatId) {
        // Remove from index
        this.index.chats = this.index.chats.filter(c => c.id !== chatId);
        
        // If active chat was deleted, switch to first available
        if (this.index.activeChat === chatId) {
            this.index.activeChat = this.index.chats.length > 0 ? this.index.chats[0].id : null;
        }
        
        // Delete chat file
        const chatFile = path.join(CHATS_DIR, `${chatId}.json`);
        if (fileManager.fileExists(chatFile)) {
            try {
                fs.unlinkSync(chatFile);
            } catch (error) {
                // Silent fail
            }
        }

        return this.saveIndex();
    }

    /**
     * Get active chat messages
     * @returns {Array} Chat messages or empty array
     */
    getActiveChat() {
        if (!this.index.activeChat) {
            return [];
        }
        return this.loadChatFile(this.index.activeChat);
    }

    /**
     * Get all chat metadata
     * @returns {Array} Array of chat metadata objects
     */
    getAllChats() {
        return this.index.chats;
    }

    /**
     * Get active chat ID
     * @returns {string|null} Active chat ID
     */
    getActiveChatId() {
        return this.index.activeChat;
    }

    /**
     * Check if new chat can be created
     * @returns {boolean} True if under limit
     */
    canCreateNewChat() {
        return this.index.chats.length < MAX_CHATS;
    }

    /**
     * Add message to active chat
     * @param {string} sender - 'user' or 'ai'
     * @param {string} text - Message text
     * @param {string} code - Optional code content
     * @param {string} modelId - Model ID for AI messages
     */
    addMessage(sender, text, code = null, modelId = null) {
        if (!this.index.activeChat) {
            // No active chat - create one
            const firstMessage = sender === 'user' ? text : '';
            this.createNewChat(firstMessage);
        }

        const chatId = this.index.activeChat;
        const messages = this.loadChatFile(chatId);

        // Create message
        const message = {
            id: Date.now(),
            sender,
            text,
            code,
            timestamp: Date.now(),
            modelId: sender === 'ai' ? modelId : null
        };

        messages.push(message);

        // Update chat title if this is first message
        const chatMeta = this.index.chats.find(c => c.id === chatId);
        if (chatMeta && chatMeta.messageCount === 0 && sender === 'user') {
            chatMeta.title = this.generateChatTitle(text);
        }

        // Update metadata
        if (chatMeta) {
            chatMeta.messageCount = messages.length;
            chatMeta.lastUpdated = Date.now();
        }

        // Prune if too many messages
        const prunedMessages = messages.length > MAX_MESSAGES_PER_CHAT 
            ? messages.slice(-MAX_MESSAGES_PER_CHAT)
            : messages;

        // Save
        this.saveChatFile(chatId, prunedMessages);
        this.saveIndex();
    }

    /**
     * Clear active chat history
     */
    clearActiveChat() {
        if (!this.index.activeChat) return;

        this.saveChatFile(this.index.activeChat, []);
        
        // Update metadata
        const chatMeta = this.index.chats.find(c => c.id === this.index.activeChat);
        if (chatMeta) {
            chatMeta.messageCount = 0;
            chatMeta.lastUpdated = Date.now();
            this.saveIndex();
        }
    }

    /**
     * Load chat messages from file
     * @param {string} chatId - Chat ID
     * @returns {Array} Chat messages
     */
    loadChatFile(chatId) {
        const chatFile = path.join(CHATS_DIR, `${chatId}.json`);
        
        if (!fileManager.fileExists(chatFile)) {
            return [];
        }

        try {
            const content = fileManager.safeReadFile(chatFile);
            if (!content) return [];
            
            const data = JSON.parse(content);
            return Array.isArray(data.messages) ? data.messages : [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Save chat messages to file
     * @param {string} chatId - Chat ID
     * @param {Array} messages - Messages to save
     * @returns {boolean} Success status
     */
    saveChatFile(chatId, messages) {
        const chatFile = path.join(CHATS_DIR, `${chatId}.json`);
        
        const data = {
            id: chatId,
            messages: messages
        };

        const content = JSON.stringify(data, null, 2);
        return fileManager.atomicWrite(chatFile, content, { mode: 0o600 });
    }
}

module.exports = { ChatHistoryManager };
