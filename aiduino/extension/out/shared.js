/**
 * shared.js - Streamlined board detection for Arduino IDE 2.x extensions
 * Based on tested methods that actually work in practice
 */

const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ============================================================================
// CONSTANTS
// ============================================================================

const BOARD_CACHE_FILE = path.join(os.homedir(), '.aiduino-last-board.json');

// ============================================================================
// BOARD CACHE FUNCTIONS
// ============================================================================

/**
 * Save board information to persistent cache using secure write methods
 * @param {string} fqbn - Fully Qualified Board Name to cache
 * @returns {boolean} True if successful
 */
function saveBoardToCache(fqbn) {
    try {
        const cacheData = {
            fqbn: fqbn,
            timestamp: Date.now(),
            source: 'detected'
        };
        
        const content = JSON.stringify(cacheData, null, 2);
        
        if (process.platform === 'win32') {
            // Windows: Backup strategy for safe overwrite
            const backupFile = BOARD_CACHE_FILE + '.backup';
            
            if (fs.existsSync(BOARD_CACHE_FILE)) {
                try {
                    fs.copyFileSync(BOARD_CACHE_FILE, backupFile);
                } catch (backupError) {
                    // Backup failed, but continue
                }
            }
            
            fs.writeFileSync(BOARD_CACHE_FILE, content, { mode: 0o600 });
            
            try {
                if (fs.existsSync(backupFile)) {
                    fs.unlinkSync(backupFile);
                }
            } catch (cleanupError) {
                // Cleanup failed - not critical
            }
            
        } else {
            // Unix/Linux: Atomic rename strategy
            const tempFile = BOARD_CACHE_FILE + '.tmp';
            fs.writeFileSync(tempFile, content, { mode: 0o600 });
            fs.renameSync(tempFile, BOARD_CACHE_FILE);
        }
        
        return true;
    } catch (error) {
        // Fallback: Direct write attempt
        try {
            const content = JSON.stringify({ fqbn: fqbn, timestamp: Date.now() });
            fs.writeFileSync(BOARD_CACHE_FILE, content, { mode: 0o600 });
            return true;
        } catch (fallbackError) {
            return false;
        }
    }
}

/**
 * Load board information from persistent cache
 * @returns {string|null} Board FQBN or null if not available/expired
 */
function loadBoardFromCache() {
    try {
        if (!fs.existsSync(BOARD_CACHE_FILE)) {
            return null;
        }
        
        const content = fs.readFileSync(BOARD_CACHE_FILE, 'utf8');
        const cacheData = JSON.parse(content);
        
        // Check cache age (max 7 days)
        const cacheAge = Date.now() - cacheData.timestamp;
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        if (cacheAge > maxAge) {
            return null; // Cache expired
        }
        
        return cacheData.fqbn;
    } catch (error) {
        return null;
    }
}

/**
 * Clear board cache for debugging or reset purposes
 * @returns {boolean} True if successful
 */
function clearBoardCache() {
    try {
        if (fs.existsSync(BOARD_CACHE_FILE)) {
            fs.unlinkSync(BOARD_CACHE_FILE);
        }
        return true;
    } catch (error) {
        return false;
    }
}

// ============================================================================
// SIMPLIFIED BOARD DETECTION
// ============================================================================

/**
 * Detect Arduino board from IDE logs (Linux-tested, cross-platform paths)
 * @returns {string|null} Board FQBN or null if not detected
 */
function detectBoardFromIDELogs() {
    try {
        let logDirs = [];
        
        if (process.platform === 'win32') {
            logDirs = [
                path.join(os.homedir(), 'AppData', 'Roaming', 'Arduino IDE'),
                path.join(os.homedir(), 'AppData', 'Local', 'Arduino IDE')
            ];
        } else if (process.platform === 'darwin') {
            logDirs = [
                path.join(os.homedir(), 'Library', 'Logs', 'Arduino IDE'),
                path.join(os.homedir(), 'Library', 'Application Support', 'Arduino IDE')
            ];
        } else {
            // Linux - tested and working
            logDirs = [
                path.join(os.homedir(), '.config', 'Arduino IDE'),
                path.join(os.homedir(), '.cache', 'Arduino IDE')
            ];
        }
        
        for (const logDir of logDirs) {
            if (fs.existsSync(logDir)) {
                const boardInfo = scanLogDirectory(logDir);
                if (boardInfo) {
                    return boardInfo;
                }
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Scan log directory for board information
 * @param {string} logDir - Directory to scan
 * @returns {string|null} Board FQBN or null if not found
 */
function scanLogDirectory(logDir) {
    try {
        const logFiles = fs.readdirSync(logDir)
            .filter(file => file.endsWith('.log'))
            .sort((a, b) => {
                const statA = fs.statSync(path.join(logDir, a));
                const statB = fs.statSync(path.join(logDir, b));
                return statB.mtime.getTime() - statA.mtime.getTime();
            })
            .slice(0, 2); // Only check 2 newest files for performance
        
        for (const logFile of logFiles) {
            const logPath = path.join(logDir, logFile);
            const boardInfo = analyzeLogFile(logPath);
            if (boardInfo) {
                return boardInfo;
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Analyze individual log file for board information
 * @param {string} logPath - Path to log file
 * @returns {string|null} Board FQBN or null if not found
 */
function analyzeLogFile(logPath) {
    try {
        const stats = fs.statSync(logPath);
        const bufferSize = Math.min(4096, stats.size); // Reduced buffer size
        
        let content;
        if (stats.size <= bufferSize) {
            content = fs.readFileSync(logPath, 'utf8');
        } else {
            const buffer = Buffer.alloc(bufferSize);
            const fd = fs.openSync(logPath, 'r');
            try {
                fs.readSync(fd, buffer, 0, bufferSize, stats.size - bufferSize);
                content = buffer.toString('utf8');
            } finally {
                fs.closeSync(fd);
            }
        }
        
        // Tested patterns that actually work in Arduino IDE 2.x
        const patterns = [
            /Starting language server:\s*([^\s\n]+)/i,
            /Failed to get debug config:\s*([^,\s\n]+)/i
        ];
        
        const lines = content.split('\n').reverse();
        
        for (const line of lines.slice(0, 100)) { // Reduced scan range
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match && match[1] && match[1].includes(':')) {
                    const fqbn = match[1].trim();
                    const parts = fqbn.split(':');
                    if (parts.length >= 3) {
                        return fqbn;
                    }
                }
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Detect board from code comments (fallback method)
 * @returns {string|null} Board identifier or null if not found
 */
function detectBoardFromComments() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }
        
        const document = editor.document;
        const maxLines = Math.min(20, document.lineCount); // Reduced scan range
        let text = '';
        
        for (let i = 0; i < maxLines; i++) {
            text += document.lineAt(i).text + '\n';
        }
        
        // Simple patterns for explicit board declarations
        const patterns = [
            /\/\/\s*Board:\s*([^\n]+)/i,
            /\/\/\s*FQBN:\s*([^\n]+)/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const boardHint = match[1].trim();
                
                // If it's already a full FQBN, return it
                if (boardHint.includes(':') && boardHint.split(':').length >= 3) {
                    return boardHint;
                }
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

// ============================================================================
// MAIN DETECTION LOGIC
// ============================================================================

/**
 * Main function for board detection - streamlined version
 * Priority: Live detection > Cache fallback
 * @returns {string|null} Board FQBN or null if not detected
 */
function detectArduinoBoard() {
    try {
        // 1. Try live detection from logs (when available)
        const liveBoard = detectBoardFromIDELogs();
        if (liveBoard) {
            saveBoardToCache(liveBoard);
            return liveBoard;
        }
        
        // 2. Check for explicit code comments
        const codeBoard = detectBoardFromComments();
        if (codeBoard) {
            return codeBoard;
        }
        
        // 3. Fallback to cache
        const cachedBoard = loadBoardFromCache();
        if (cachedBoard) {
            return cachedBoard;
        }
        
        return null;
    } catch (error) {
        return loadBoardFromCache();
    }
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

/**
 * Get board context string for AI prompts
 * @returns {string} Board context string or empty string if no board detected
 */
function getBoardContext() {
    const boardFqbn = detectArduinoBoard();
    
    if (!boardFqbn) {
        return '';
    }
    
    const boardName = getBoardDisplayName(boardFqbn);
    return `\n\nTarget Board: ${boardName} (${boardFqbn})`;
}

/**
 * Get display-friendly board name from FQBN
 * @param {string} fqbn - Fully Qualified Board Name
 * @returns {string} Display name or fallback
 */
function getBoardDisplayName(fqbn) {
    if (!fqbn) return '—';
    
    // Remove board options for display
    const baseFqbn = fqbn.split(':').slice(0, 3).join(':');
    
    const friendlyNames = {
        'arduino:avr:uno': 'Arduino Uno',
        'arduino:avr:nano': 'Arduino Nano',
        'arduino:avr:mega': 'Arduino Mega 2560',
        'arduino:avr:leonardo': 'Arduino Leonardo',
        'esp32:esp32:esp32': 'ESP32 Dev Module',
        'esp32:esp32:esp32cam': 'ESP32-CAM',
        'esp8266:esp8266:generic': 'ESP8266 Generic',
        'esp8266:esp8266:nodemcu': 'NodeMCU 1.0'
    };
    
    if (friendlyNames[baseFqbn]) {
        return friendlyNames[baseFqbn];
    }
    
    // Fallback: Parse FQBN parts
    const parts = baseFqbn.split(':');
    if (parts.length >= 3) {
        const vendor = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        const board = parts[2].replace(/_/g, ' ').toUpperCase();
        return `${vendor} ${board}`;
    }
    
    return fqbn;
}

// ============================================================================
// TEXT UTILITIES (from original shared.js)
// ============================================================================

/**
 * Escape HTML characters in text
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
 * Wrap long text lines for better readability
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum line width (default: 50)
 * @returns {string} Wrapped text with line breaks
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
 * Check if conversation context is valid
 * @param {Object} aiConversationContext - Conversation context
 * @returns {boolean} Whether context is valid
 */
function hasValidContext(aiConversationContext) {
    if (!aiConversationContext.lastQuestion || !aiConversationContext.timestamp) {
        return false;
    }
    
    const contextAge = Date.now() - aiConversationContext.timestamp;
    return contextAge < 30 * 60 * 1000; // 30 minutes
}

// ============================================================================
// EXPORTS - Only what's actually needed
// ============================================================================

module.exports = {
    // Core functions (actually used by extension)
    detectArduinoBoard,
    getBoardContext,
    getBoardDisplayName,
    
    // Legacy compatibility (for existing extension code)
    detectBoardFromLog: detectBoardFromIDELogs,
    detectBoardFromArduinoJson: () => null,
    detectBoardFromComments,
    
    // Text utilities (from original shared.js)
    escapeHtml,
    wrapText,
    hasValidContext
};
