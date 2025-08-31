/**
 * shared.js - Shared utilities for AI.duino
 * Board Detection and Text Utilities
 */

const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ============================================================================
// BOARD DETECTION
// ============================================================================

/**
 * Main function to detect Arduino board
 * @returns {string|null} Board identifier or null if not detected
 */
function detectArduinoBoard() {
    try {
        // 1. Try to find Arduino IDE log file
        const logBoard = detectBoardFromLog();
        if (logBoard) {
            return logBoard;
        }
        
        // 2. Fallback: Check for .vscode/arduino.json (old projects or Arduino IDE 1.x)
        const arduinoJsonBoard = detectBoardFromArduinoJson();
        if (arduinoJsonBoard) {
            return arduinoJsonBoard;
        }
        
        // 3. Fallback: Check code comments
        const commentBoard = detectBoardFromComments();
        if (commentBoard) {
            return commentBoard;
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Detect board from Arduino IDE log files
 * @returns {string|null} Board identifier from logs
 */
function detectBoardFromLog() {
    try {
        // Determine log directory based on OS
        let logDir;
        if (process.platform === 'win32') {
            logDir = path.join(process.env.APPDATA || process.env.HOME || '', 'Arduino IDE');
        } else if (process.platform === 'darwin') {
            logDir = path.join(os.homedir(), 'Library', 'Application Support', 'Arduino IDE');
        } else {
            logDir = path.join(os.homedir(), '.config', 'Arduino IDE');
        }
        
        // Check if log directory exists
        if (!fs.existsSync(logDir)) {
            return null;
        }
        
        // Find log files (today's or most recent)
        const files = fs.readdirSync(logDir);
        const logFiles = files.filter(f => f.endsWith('.log'))
                              .sort()
                              .reverse(); // Most recent first
        
        if (logFiles.length === 0) {
            return null;
        }
        
        // Try today's log first, then most recent
        const today = new Date().toISOString().split('T')[0];
        let logFile = logFiles.find(f => f.includes(today)) || logFiles[0];
        const logPath = path.join(logDir, logFile);
        
        // Read the log file (last 10KB should be enough)
        const stats = fs.statSync(logPath);
        const bufferSize = Math.min(10240, stats.size);
        
        let content;
        try {
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
        } catch (error) {
            return null;
        }
        
        // Split into lines and search from bottom
        const lines = content.split('\n');
        
        // Patterns to search for
        const patterns = [
            /Starting language server:\s+([^\s]+)/,
            /FQBN:\s+([^\s]+)/,
            /Failed to get debug config:\s+([^\s,]+)/
        ];
        
        // Search from bottom to top (most recent first)
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match && match[1]) {
                    // Just return what we found - no interpretation
                    return match[1].trim().replace(/,$/, '');
                }
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Detect board from .vscode/arduino.json file
 * @returns {string|null} Board identifier from arduino.json
 */
function detectBoardFromArduinoJson() {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }
        
        const arduinoJsonPath = path.join(
            workspaceFolders[0].uri.fsPath,
            '.vscode',
            'arduino.json'
        );
        
        if (fs.existsSync(arduinoJsonPath)) {
            const content = fs.readFileSync(arduinoJsonPath, 'utf8');
            const config = JSON.parse(content);
            
            if (config.board) {
                return config.board;
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Detect board from code comments
 * @returns {string|null} Board identifier from comments
 */
function detectBoardFromComments() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }
        
        // Only check first 50 lines
        const document = editor.document;
        const maxLines = Math.min(50, document.lineCount);
        let text = '';
        
        for (let i = 0; i < maxLines; i++) {
            text += document.lineAt(i).text + '\n';
        }
        
        // Look for board info in comments
        const patterns = [
            /\/\/\s*Board:\s*([^\n]+)/i,
            /\/\*\s*Board:\s*([^*]+)\*/i,
            /\/\/\s*FQBN:\s*([^\n]+)/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                // Return exactly what the user wrote
                return match[1].trim();
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Get board context string for AI prompts
 * @returns {string} Board context string or empty string
 */
function getBoardContext() {
    const board = detectArduinoBoard();
    return board ? `\n\nTarget Board: ${board}` : '';
}

/**
 * Get display-friendly board name from FQBN
 * @param {string} fqbn - Fully Qualified Board Name
 * @returns {string} Display name or fallback
 */
function getBoardDisplayName(fqbn) {
    if (!fqbn) return '—';
    // Split by colon and take last part
    const parts = fqbn.split(':');
    if (parts.length < 3) {
        return fqbn;
    }
    return `${parts[0]}:${parts[2]}`;
}

// ============================================================================
// TEXT UTILITIES
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
        // If single word is longer than maxWidth, break it
        if (word.length > maxWidth) {
            if (currentLine) {
                lines.push(currentLine);
                currentLine = '';
            }
            // Break long word
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
// EXPORTS
// ============================================================================

module.exports = {
    // Board Detection
    detectArduinoBoard,
    detectBoardFromLog,
    detectBoardFromArduinoJson, 
    detectBoardFromComments,
    getBoardContext,
    getBoardDisplayName,
    
    // Text Utilities
    escapeHtml,
    wrapText,
    
    // Context Management
    hasValidContext
};
