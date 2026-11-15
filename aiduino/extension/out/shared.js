/*
 * AI.duino - Shared Functions Module
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ===== ARDUINO BOARD CONTEXT =====

// First scan of an IDE log file reads this much from its end
const LOG_INITIAL_SCAN_BYTES = 1024 * 1024;

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
        this.logSizes = new Map();
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
     * Check for board changes in all IDE log files.
     * The first scan of a file reads up to 1 MB, later scans only what was appended,
     * so a board selected long ago in a long IDE session is still found.
     */
    async checkForBoardChanges() {
        if (!this.logDir || !fs.existsSync(this.logDir)) return;
        if (!this.logSizes) this.logSizes = new Map();

        let newest = null;
        try {
            for (const name of fs.readdirSync(this.logDir).filter(f => f.endsWith('.log'))) {
                const file = path.join(this.logDir, name);
                const size = fs.statSync(file).size;
                const previous = this.logSizes.get(file);
                if (previous === size) continue;

                const isNewOrTruncated = previous === undefined || previous > size;
                const start = isNewOrTruncated ? Math.max(0, size - LOG_INITIAL_SCAN_BYTES) : previous;
                this.logSizes.set(file, size);

                const entry = this.extractBoardFromLog(this.readLogRange(file, start, size));
                if (entry && (!newest || entry.time >= newest.time)) newest = entry;
            }
        } catch (error) {
            return;  // Logs are optional, detection simply stays as it is
        }

        if (newest && newest.fqbn !== this.currentBoard) {
            await this.updateBoardState({ fqbn: newest.fqbn, timestamp: Date.now() });
        }
    }

    /**
     * Read a byte range of a file
     * @param {string} file - File path
     * @param {number} start - Start offset
     * @param {number} end - End offset (exclusive)
     * @returns {string} Content
     */
    readLogRange(file, start, end) {
        const length = end - start;
        if (length <= 0) return '';
        const buffer = Buffer.alloc(length);
        const fd = fs.openSync(file, 'r');
        try {
            fs.readSync(fd, buffer, 0, length, start);
        } finally {
            fs.closeSync(fd);
        }
        return buffer.toString('utf8');
    }
    
    /**
     * Extract the newest board FQBN from log content.
     * The language server line carries the full FQBN incl. options, so it wins.
     * @param {string} content - Log file content
     * @returns {Object|null} {fqbn, time} with the log timestamp of the line
     */
    extractBoardFromLog(content) {
        const patterns = [
            /Starting language server:\s*([^\s\n]+)/i,
            /Failed to get debug config:\s*([^,\s\n]+)/i
        ];
        const found = patterns.map(() => null);
        for (const line of content.split('\n')) {
            patterns.forEach((pattern, index) => {
                const value = line.match(pattern)?.[1]?.trim();
                if (value && value.split(':').length >= 3) {
                    found[index] = { fqbn: value, time: line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)?.[1] || '' };
                }
            });
        }
        return found.find(Boolean) || null;
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

// ===== PROJECT NOTES =====

/**
 * Get project notes from NOTES.ino if it exists
 * @param {string} sketchPath - Path to the sketch directory
 * @returns {string} Project notes content or empty string
 */
function getProjectNotes(sketchPath) {
    if (!sketchPath) {
        return '';
    }
    
    const notesFile = path.join(sketchPath, 'NOTES.ino');
    
    // Read from open editor (file is always open if it exists in Arduino IDE)
    const vscode = require('vscode');
    const openDocs = vscode.workspace.textDocuments;
    const openNotesDoc = openDocs.find(doc => doc.uri.fsPath === notesFile);
    
    if (openNotesDoc) {
        // File is open - use current editor content (includes unsaved changes)
        const content = openNotesDoc.getText();
        const match = content.trim().match(/#if\s+0\s*\n([\s\S]*?)\n#endif/);
        if (match && match[1]) {
            // Filter out lines starting with // (comments)
            const lines = match[1].split('\n');
            const filteredLines = lines.filter(line => {
                const trimmed = line.trim();
                return trimmed.length > 0 && !trimmed.startsWith('//');
            });
            
            const notes = filteredLines.join('\n').trim();
            if (notes) {
                return '\n\n=== PROJECT NOTES ===\n' + notes + '\n=== END PROJECT NOTES ===\n';
            }
        }
    }
    
    return '';
}

/**
 * Find arduino-cli binary bundled with Arduino IDE 2.x
 * @returns {string|null} Path to arduino-cli or null if not found
 */
function findArduinoCli() {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const platform = os.platform();
    const possiblePaths = [];

    // First the copy bundled with the running Arduino IDE (works for any install location, AppImage included)
    const exe = platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli';
    const bundledRel = path.join('lib', 'backend', 'resources', exe);
    const execDir = path.dirname(process.execPath);
    if (vscode.env.appRoot) possiblePaths.push(path.join(vscode.env.appRoot, bundledRel));
    possiblePaths.push(
        path.join(execDir, 'resources', 'app', bundledRel),
        path.join(execDir, '..', 'Resources', 'app', bundledRel)
    );
    
    if (platform === 'linux') {
        possiblePaths.push(
            '/usr/share/arduino/resources/app/lib/backend/resources/arduino-cli',
            '/usr/share/arduino-ide/resources/app/lib/backend/resources/arduino-cli',
            '/opt/arduino-ide/resources/app/lib/backend/resources/arduino-cli'
        );
    } else if (platform === 'darwin') {
        possiblePaths.push(
            '/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli'
        );
    } else if (platform === 'win32') {
        const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
        const localAppData = process.env['LOCALAPPDATA'] || path.join(os.homedir(), 'AppData', 'Local');
        
        possiblePaths.push(
            path.join(programFiles, 'Arduino IDE', 'resources', 'app', 'lib', 'backend', 'resources', 'arduino-cli.exe'),
            path.join(localAppData, 'Programs', 'Arduino IDE', 'resources', 'app', 'lib', 'backend', 'resources', 'arduino-cli.exe')
        );
    }
    
    // Check each path
    for (const cliPath of possiblePaths) {
        if (fs.existsSync(cliPath)) {
            return path.normalize(cliPath);
        }
    }
    
    // Fallback: check if arduino-cli is in PATH
    const { execSync } = require('child_process');
    try {
        const which = platform === 'win32' ? 'where arduino-cli' : 'which arduino-cli';
        const result = execSync(which, { encoding: 'utf8' }).trim();
        if (result) {
            return result.split('\n')[0]; // First result
        }
    } catch (e) {
        // Not in PATH
    }
    
    return null;
}

/**
 * Get the arduino-cli config of the Arduino IDE (sketchbook, libraries, cores).
 * Without it, libraries in a moved sketchbook are missing when compiling.
 * @returns {string|null} Path or null
 */
function findArduinoCliConfig() {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const configFile = path.join(os.homedir(), '.arduinoIDE', 'arduino-cli.yaml');
    return fs.existsSync(configFile) ? configFile : null;
}

// One compile at a time; a new compile request waits for nothing and starts fresh
let compileChecker = null;

/**
 * Compile Arduino sketch using arduino-cli (asynchronous, does not block the IDE)
 * @param {string} sketchPath - Path to sketch directory or .ino file
 * @param {string} fqbn - Fully Qualified Board Name (optional, auto-detect if null)
 * @returns {Promise<Object>} {success, output, errors, errorText, flash, ram, ramWarning, missingLibraries, moreErrors}
 */
async function compileSketch(sketchPath, fqbn = null) {
    const path = require('path');
    const { CompileChecker } = require('./utils/compileChecker');
    
    const cliPath = findArduinoCli();
    if (!cliPath) {
        return {
            success: false,
            setupError: 'noCli',
            output: '',
            errors: ['arduino-cli not found']
        };
    }
    
    // Ensure we have sketch directory
    const sketchDir = sketchPath.endsWith('.ino') 
        ? path.dirname(sketchPath) 
        : sketchPath;

    // Board: parameter, then sketch.yaml (default_fqbn), then the IDE selection
    const board = fqbn || readSketchYamlFqbn(sketchDir) || detectArduinoBoard();
    if (!board) {
        return {
            success: false,
            setupError: 'noBoard',
            output: '',
            errors: ['No board selected. Please select a board in Arduino IDE.']
        };
    }

    if (!compileChecker) compileChecker = new CompileChecker();
    try {
        const result = await compileChecker.compile({
            cliPath,
            configFile: findArduinoCliConfig(),
            fqbn: board,
            sketchPath: sketchDir
        });
        if (result.stopped) {
            return { success: false, setupError: 'stopped', output: '', errors: ['Compile stopped'] };
        }
        return {
            success: result.ok,
            output: result.output || '',
            errors: result.errors || [],
            errorText: result.errorText || '',
            moreErrors: result.moreErrors || 0,
            missingLibraries: result.missingLibraries || null,
            flash: result.flash || null,
            ram: result.ram || null,
            ramWarning: Boolean(result.ramWarning)
        };
    } catch (error) {
        return {
            success: false,
            setupError: 'cliFailed',
            output: '',
            errors: [error.message]
        };
    }
}

/**
 * Read default_fqbn from the sketch's sketch.yaml
 * @param {string} sketchDir - Sketch folder
 * @returns {string|null} FQBN or null
 */
function readSketchYamlFqbn(sketchDir) {
    const fs = require('fs');
    const path = require('path');
    try {
        const content = fs.readFileSync(path.join(sketchDir, 'sketch.yaml'), 'utf8');
        const fqbn = content.match(/^default_fqbn:\s*(\S+)/m)?.[1];
        return fqbn && fqbn.split(':').length >= 3 ? fqbn : null;
    } catch (error) {
        return null;
    }
}

/**
 * Stop a running compile (e.g. when the user cancels)
 */
function stopCompile() {
    if (compileChecker) compileChecker.stop();
}

/**
 * Check if the extension is running inside Arduino IDE
 * Uses the VS Code app name to distinguish Arduino IDE (Eclipse Theia-based)
 * from standard VS Code or other compatible editors.
 * Arduino IDE reports its app name as "Arduino IDE".
 * @returns {boolean} True if running in Arduino IDE, false in VS Code or other hosts
 */
function isArduinoIDE() {
    return vscode.env.appName.includes('Arduino');
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
    calculateTotalCost,
    getProjectNotes,

    // CLI utilities
    findArduinoCli,
    findArduinoCliConfig,
    compileSketch,
    stopCompile,

    // Other
    isArduinoIDE
};
