/**
 * shared.js - Compact event-driven board detection for Arduino IDE 2.x
 */

const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ============================================================================
// ARDUINO BOARD CONTEXT
// ============================================================================

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
    
    async initialize() {
        this.loadFromCache();
        this.startLogMonitoring();
        await this.performInitialDetection();
    }
    
    startLogMonitoring() {
        if (!this.logDir || !fs.existsSync(this.logDir)) {
            return this.startPolling();
        }
        
        try {
            this.logWatcher = fs.watch(this.logDir, { recursive: false }, (eventType, filename) => {
                if (filename?.endsWith('.log') && eventType === 'change') {
                    this.handleLogChange();
                }
            });
        } catch (error) {
            this.startPolling();
        }
    }
    
    startPolling() {
        this.pollingInterval = setInterval(() => this.handleLogChange(), 3000);
    }
    
    handleLogChange() {
        clearTimeout(this.changeTimeout);
        this.changeTimeout = setTimeout(() => this.checkForBoardChanges(), 750);
    }
    
    async checkForBoardChanges() {
        try {
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
        } catch (error) {
            // Silent error
        }
    }
    
    findNewestLogFile() {
        try {
            const files = fs.readdirSync(this.logDir)
                .filter(f => f.endsWith('.log'))
                .map(f => ({ path: path.join(this.logDir, f), mtime: fs.statSync(path.join(this.logDir, f)).mtime }))
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
            
            return files[0]?.path || null;
        } catch (error) {
            return null;
        }
    }
    
    readLogTail(logPath, maxBytes = 2048) {
        try {
            const stats = fs.statSync(logPath);
            const bytesToRead = Math.min(maxBytes, stats.size);
            
            if (stats.size <= bytesToRead) {
                return fs.readFileSync(logPath, 'utf8');
            }
            
            const buffer = Buffer.alloc(bytesToRead);
            const fd = fs.openSync(logPath, 'r');
            try {
                fs.readSync(fd, buffer, 0, bytesToRead, stats.size - bytesToRead);
                return buffer.toString('utf8');
            } finally {
                fs.closeSync(fd);
            }
        } catch (error) {
            return '';
        }
    }
    
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
    
    async performInitialDetection() {
        await this.checkForBoardChanges();
        
        if (!this.currentBoard) {
            const codeBoard = this.detectBoardFromCodeComments();
            if (codeBoard) {
                await this.updateBoardState({ fqbn: codeBoard, timestamp: Date.now() });
            }
        }
    }
    
    detectBoardFromCodeComments() {
        try {
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
        } catch (error) {
            return null;
        }
    }
    
    getLogDirectory() {
        const dirs = {
            win32: path.join(os.homedir(), 'AppData', 'Roaming', 'Arduino IDE'),
            darwin: path.join(os.homedir(), 'Library', 'Logs', 'Arduino IDE'),
            default: path.join(os.homedir(), '.config', 'Arduino IDE')
        };
        return dirs[process.platform] || dirs.default;
    }
    
    saveToCache() {
        try {
            const data = { currentBoard: this.currentBoard, boardDetails: this.boardDetails, savedAt: Date.now() };
            const content = JSON.stringify(data, null, 2);
            
            // Simple atomic write
            const tempFile = this.cacheFile + '.tmp';
            fs.writeFileSync(tempFile, content, { mode: 0o600 });
            fs.renameSync(tempFile, this.cacheFile);
        } catch (error) {
            // Fallback: direct write
            try {
                fs.writeFileSync(this.cacheFile, JSON.stringify(data), { mode: 0o600 });
            } catch (fallbackError) {
                // Silent error
            }
        }
    }
    
    loadFromCache() {
        try {
            if (!fs.existsSync(this.cacheFile)) return;
            
            const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
            const cacheAge = Date.now() - data.savedAt;
            
            if (cacheAge < 48 * 60 * 60 * 1000 && data.currentBoard) { // 48 hours
                this.currentBoard = data.currentBoard;
                this.boardDetails = data.boardDetails;
            }
        } catch (error) {
            // Silent error
        }
    }
    
    get onDidChangeBoard() { return this._onDidChangeBoardEmitter.event; }
    get fqbn() { return this.currentBoard; }
    get board() { return this.boardDetails; }
    
    dispose() {
        this.logWatcher?.close();
        clearInterval(this.pollingInterval);
        clearTimeout(this.changeTimeout);
        this._onDidChangeBoardEmitter.dispose();
    }
}

// ============================================================================
// GLOBAL INSTANCE AND API
// ============================================================================

let globalBoardContext = null;

function getBoardContextInstance() {
    if (!globalBoardContext) {
        globalBoardContext = new ArduinoBoardContext();
        globalBoardContext.initialize();
    }
    return globalBoardContext;
}

/**
 * Get display-friendly board name from FQBN
 */
function getBoardDisplayName(fqbn) {
    if (!fqbn) return 'Unknown Board';
    
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

// ============================================================================
// PUBLIC API
// ============================================================================

function detectArduinoBoard() {
    return getBoardContextInstance().fqbn;
}

function getBoardContext() {
    const fqbn = detectArduinoBoard();
    if (!fqbn) return '';
    return `\n\nTarget Board: ${getBoardDisplayName(fqbn)} (${fqbn})`;
}

function onBoardChange(callback) {
    return getBoardContextInstance().onDidChangeBoard(callback);
}

function getBoardDetails() {
    return getBoardContextInstance().board;
}

function clearBoardCache() {
    try {
        const cacheFile = path.join(AIDUINO_DIR, '.aiduino-board-context.json');
        if (fs.existsSync(cacheFile)) {
            fs.unlinkSync(cacheFile);
        }
        if (globalBoardContext) {
            globalBoardContext.currentBoard = null;
            globalBoardContext.boardDetails = null;
        }
        return true;
    } catch (error) {
        return false;
    }
}

// ============================================================================
// TEXT UTILITIES
// ============================================================================

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

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

function hasValidContext(aiConversationContext) {
    return aiConversationContext?.lastQuestion && aiConversationContext?.timestamp && 
           (Date.now() - aiConversationContext.timestamp) < 30 * 60 * 1000;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Primary API
    detectArduinoBoard,
    getBoardContext,
    getBoardDisplayName,
    getBoardDetails,
    onBoardChange,
    clearBoardCache,
    
    // Text utilities
    escapeHtml,
    wrapText,
    hasValidContext
};
