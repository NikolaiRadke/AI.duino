/*
 * AI.duino - Shared Functions Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ===== ARDUINO BOARD CONTEXT =====

/**
 * Arduino Board Context Manager
 * Handles board detection, monitoring, and state management for Arduino IDE 2.x
 */
class ArduinoBoardContext {
    constructor() {
        const AIDUINO_DIR = path.join(os.homedir(), '.aiduino');
        this.currentBoard = null;
        this.boardDetails = null;
        this._onDidChangeBoardEmitter = new vscode.EventEmitter();
        
        this.logWatcher = null;
        this.lastLogSize = 0;
        this.changeTimeout = null;
        
        this.cacheFile = path.join(AIDUINO_DIR, '.aiduino-board-context.json');
        this.logDir = this.getLogDirectory();
    }
    
    /**
     * Initialize board context with cache loading and monitoring
     */
    async initialize() {
        this.loadFromCache();
        this.startLogMonitoring();
        await this.performInitialDetection();
    }
    
    /**
     * Start monitoring Arduino IDE log files for board changes
     */
    startLogMonitoring() {
        if (!this.logDir || !fs.existsSync(this.logDir)) {
            return this.startPolling();
        }
        
        this.logWatcher = fs.watch(this.logDir, { recursive: false }, (eventType, filename) => {
            if (filename?.endsWith('.log') && eventType === 'change') {
                this.handleLogChange();
            }
        });
    }
    
    /**
     * Fallback polling method when file watching is unavailable
     */
    startPolling() {
        this.pollingInterval = setInterval(() => this.handleLogChange(), 3000);
    }
    
    /**
     * Handle log file changes with debouncing
     */
    handleLogChange() {
        clearTimeout(this.changeTimeout);
        this.changeTimeout = setTimeout(() => this.checkForBoardChanges(), 750);
    }
    
    /**
     * Check for board changes in log files
     */
    async checkForBoardChanges() {
        const logPath = this.findNewestLogFile();
        if (!logPath) return;
        
        const stats = fs.statSync(logPath);
        if (stats.size === this.lastLogSize) return;
        this.lastLogSize = stats.size;
        
        const content = this.readLogTail(logPath);
        const boardInfo = this.extractBoardFromLog(content);
        
        if (boardInfo && boardInfo.fqbn !== this.currentBoard) {
            await this.updateBoardState(boardInfo);
        }
    }
    
    /**
     * Find the newest log file in the Arduino IDE logs directory
     * @returns {string|null} Path to newest log file
     */
    findNewestLogFile() {
        const files = fs.readdirSync(this.logDir)
            .filter(f => f.endsWith('.log'))
            .map(f => ({ path: path.join(this.logDir, f), mtime: fs.statSync(path.join(this.logDir, f)).mtime }))
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        
        return files[0]?.path || null;
    }
    
    /**
     * Read the tail of a log file efficiently
     * @param {string} logPath - Path to log file
     * @param {number} maxBytes - Maximum bytes to read from end
     * @returns {string} Log content
     */
    readLogTail(logPath, maxBytes = 2048) {
        const stats = fs.statSync(logPath);
        const bytesToRead = Math.min(maxBytes, stats.size);
        
        if (stats.size <= bytesToRead) {
            return fs.readFileSync(logPath, 'utf8');
        }
        
        const buffer = Buffer.alloc(bytesToRead);
        const fd = fs.openSync(logPath, 'r');
        fs.readSync(fd, buffer, 0, bytesToRead, stats.size - bytesToRead);
        fs.closeSync(fd);
        return buffer.toString('utf8');
    }
    
    /**
     * Extract board FQBN from log content using known patterns
     * @param {string} content - Log file content
     * @returns {Object|null} Board information with FQBN and timestamp
     */
    extractBoardFromLog(content) {
        const patterns = [
            /Starting language server:\s*([^\s\n]+)/i,
            /Failed to get debug config:\s*([^,\s\n]+)/i
        ];
        
        const lines = content.split('\n').reverse();
        for (const line of lines.slice(0, 50)) {
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match?.[1]?.includes(':') && match[1].split(':').length >= 3) {
                    return {
                        fqbn: match[1].trim(),
                        timestamp: Date.now()
                    };
                }
            }
        }
        return null;
    }
    
    /**
     * Update board state and notify listeners
     * @param {Object} newBoardInfo - New board information
     */
    async updateBoardState(newBoardInfo) {
        const previousBoard = this.currentBoard;
        this.currentBoard = newBoardInfo.fqbn;
        this.boardDetails = { fqbn: newBoardInfo.fqbn, lastUpdated: newBoardInfo.timestamp };
        
        this.saveToCache();
        
        if (previousBoard !== this.currentBoard) {
            this._onDidChangeBoardEmitter.fire({
                previousBoard,
                currentBoard: this.currentBoard,
                currentDetails: this.boardDetails
            });
        }
    }
    
    /**
     * Perform initial board detection from various sources
     */
    async performInitialDetection() {
        await this.checkForBoardChanges();
        
        if (!this.currentBoard) {
            const codeBoard = this.detectBoardFromCodeComments();
            if (codeBoard) {
                await this.updateBoardState({ fqbn: codeBoard, timestamp: Date.now() });
            }
        }
    }
    
    /**
     * Detect board from code comments in active editor
     * @returns {string|null} Board FQBN from comments
     */
    detectBoardFromCodeComments() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return null;
        
        const text = editor.document.getText(new vscode.Range(0, 0, 15, 0));
        const match = text.match(/\/\/\s*(?:Board|FQBN):\s*([^\n]+)/i);
        
        if (match?.[1]) {
            const hint = match[1].trim();
            if (hint.includes(':') && hint.split(':').length >= 3) {
                return hint;
            }
        }
        return null;
    }
    
    /**
     * Get platform-specific Arduino IDE log directory
     * @returns {string} Path to log directory
     */
    getLogDirectory() {
        const dirs = {
            win32: path.join(os.homedir(), 'AppData', 'Roaming', 'Arduino IDE'),
            darwin: path.join(os.homedir(), 'Library', 'Logs', 'Arduino IDE'),
            default: path.join(os.homedir(), '.config', 'Arduino IDE')
        };
        return dirs[process.platform] || dirs.default;
    }
    
    /**
     * Save board context to cache file
     */
    saveToCache() {
        const data = { 
            currentBoard: this.currentBoard, 
            boardDetails: this.boardDetails, 
            savedAt: Date.now() 
        };
        const content = JSON.stringify(data, null, 2);
        
        // Atomic write with temp file
        const tempFile = this.cacheFile + '.tmp';
        fs.writeFileSync(tempFile, content, { mode: 0o600 });
        fs.renameSync(tempFile, this.cacheFile);
    }
    
    /**
     * Load board context from cache file
     */
    loadFromCache() {
        if (!fs.existsSync(this.cacheFile)) return;
        
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        const cacheAge = Date.now() - data.savedAt;
        
        // Use cache if less than 48 hours old
        if (cacheAge < 48 * 60 * 60 * 1000 && data.currentBoard) {
            this.currentBoard = data.currentBoard;
            this.boardDetails = data.boardDetails;
        }
    }
    
    /**
     * Get board change event emitter
     */
    get onDidChangeBoard() { 
        return this._onDidChangeBoardEmitter.event; 
    }
    
    /**
     * Get current board FQBN
     */
    get fqbn() { 
        return this.currentBoard; 
    }
    
    /**
     * Get current board details
     */
    get board() { 
        return this.boardDetails; 
    }
    
    /**
     * Dispose all resources and cleanup
     */
    dispose() {
        this.logWatcher?.close();
        clearInterval(this.pollingInterval);
        clearTimeout(this.changeTimeout);
        this._onDidChangeBoardEmitter.dispose();
    }
}

// ===== GLOBAL INSTANCE MANAGEMENT =====

let globalBoardContext = null;

/**
 * Get singleton instance of board context
 * @returns {ArduinoBoardContext} Global board context instance
 */
function getBoardContextInstance() {
    if (!globalBoardContext) {
        globalBoardContext = new ArduinoBoardContext();
        globalBoardContext.initialize();
    }
    return globalBoardContext;
}

// ===== PUBLIC API FUNCTIONS =====

/**
 * Detect currently active Arduino board
 * @returns {string|null} Board FQBN or null if not detected
 */
function detectArduinoBoard() {
    return getBoardContextInstance().fqbn;
}

/**
 * Get board context string for AI prompts
 * @returns {string} Formatted board context string
 */
function getBoardContext() {
    const fqbn = detectArduinoBoard();
    if (!fqbn) return '';
    return `\n\nTarget Board: ${getBoardDisplayName(fqbn)} (${fqbn})`;
}

/**
 * Register callback for board change events
 * @param {Function} callback - Callback function for board changes
 * @returns {vscode.Disposable} Event listener disposable
 */
function onBoardChange(callback) {
    return getBoardContextInstance().onDidChangeBoard(callback);
}

/**
 * Get detailed board information
 * @returns {Object|null} Board details object or null
 */
function getBoardDetails() {
    return getBoardContextInstance().board;
}

/**
 * Dispose board context singleton and cleanup all resources
 * Should be called during extension deactivation to prevent resource leaks
 */
function disposeBoardContext() {
    if (globalBoardContext) {
        globalBoardContext.dispose();
        globalBoardContext = null;
    }
}

/**
 * Get display-friendly board name from FQBN
 * @param {string} fqbn - Fully Qualified Board Name
 * @returns {string} Human-readable board name
 */
function getBoardDisplayName(fqbn) {
    if (!fqbn) return (typeof t !== 'undefined') ? t('output.boardUnknown') : 'Unknown Board';
    
    const baseFqbn = fqbn.split(':').slice(0, 3).join(':');
    const names = {
        'arduino:avr:uno': 'Arduino Uno',
        'arduino:avr:nano': 'Arduino Nano',
        'arduino:avr:mega': 'Arduino Mega 2560',
        'arduino:avr:leonardo': 'Arduino Leonardo',
        'esp32:esp32:esp32': 'ESP32 Dev Module',
        'esp32:esp32:esp32cam': 'ESP32-CAM',
        'esp8266:esp8266:generic': 'ESP8266 Generic'
    };
    
    if (names[baseFqbn]) return names[baseFqbn];
    
    const parts = baseFqbn.split(':');
    if (parts.length >= 3) {
        const vendor = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        const board = parts[2].replace(/_/g, ' ').toUpperCase();
        return `${vendor} ${board}`;
    }
    return fqbn;
}

// ===== TEXT UTILITIES =====

/**
 * Escape HTML special characters for safe display
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = { 
        '&': '&amp;', 
        '<': '&lt;', 
        '>': '&gt;', 
        '"': '&quot;', 
        "'": '&#039;' 
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}


/**
 * Clean HTML-encoded code back to plain text
 * @param {string} html - HTML-encoded code
 * @returns {string} Plain text code
 */
function cleanHtmlCode(html) {
    if (!html) return '';
    
    return html
        .replace(/<br>/g, '\n')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
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


/**
 * Wrap text to specified width with word boundaries
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum line width (default: 50)
 * @returns {string} Word-wrapped text
 */
function wrapText(text, maxWidth = 50) {
    if (!text || text.length <= maxWidth) return text;
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        if (word.length > maxWidth) {
            if (currentLine) {
                lines.push(currentLine);
                currentLine = '';
            }
            for (let i = 0; i < word.length; i += maxWidth) {
                lines.push(word.substring(i, i + maxWidth));
            }
        } else if ((currentLine + ' ' + word).length > maxWidth) {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = currentLine ? currentLine + ' ' + word : word;
        }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
}

/**
 * Check if AI conversation context is valid and recent
 * @param {Object} aiConversationContext - Context object with timestamp
 * @returns {boolean} True if context is valid and within 30 minutes
 */
function hasValidContext(aiConversationContext) {
    return aiConversationContext?.lastQuestion && 
           aiConversationContext?.timestamp && 
           (Date.now() - aiConversationContext.timestamp) < 30 * 60 * 1000;
}

/**
 * Iterate over providers with callback
 * @param {Object} providers - Provider configurations
 * @param {Function} callback - Callback function (modelId, provider)
 */
function forEachProvider(providers, callback) {
    Object.entries(providers).forEach(([modelId, provider]) => {
        callback(modelId, provider);
    });
}

/**
 * Calculate total cost across all providers
 * @param {Object} tokenUsage - Token usage data
 * @param {Object} providers - Provider configurations
 * @returns {number} Total cost today
 */
function calculateTotalCost(tokenUsage, providers) {
    let total = 0;
    Object.keys(providers).forEach(modelId => {
        if (tokenUsage[modelId]) {
            total += tokenUsage[modelId].cost;
        }
    });
    return total;
}

// ===== MODULE EXPORTS =====

module.exports = {
    // Board detection API
    detectArduinoBoard,
    getBoardContext,
    getBoardDisplayName,
    getBoardDetails,
    onBoardChange,
    disposeBoardContext,
    
    // Text utilities
    escapeHtml,
    wrapText,
    hasValidContext,
    cleanHtmlCode,
    formatTimeAgo,
    
    // Provider utilities
    forEachProvider,
    calculateTotalCost
};
