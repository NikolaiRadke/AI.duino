/*
 * AI.duino - File Management Utilities Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const AIDUINO_DIR = path.join(os.homedir(), '.aiduino');
const SECURE_FILE_MODE = 0o600;

// ===== CORE FILE OPERATIONS =====

/**
 * Safe file existence check
 * @param {string} filePath - File path to check
 * @returns {boolean} True if file exists
 */
function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

/**
 * Safe file read with fallback
 * @param {string} filePath - File to read
 * @param {string} fallback - Return value if read fails
 * @returns {string} File content or fallback
 */
function safeReadFile(filePath, fallback = null) {
    if (!fileExists(filePath)) return fallback;
    
    try {
        return fs.readFileSync(filePath, 'utf8').trim();
    } catch {
        return fallback;
    }
}

/**
 * Cross-platform atomic file write
 * @param {string} filePath - Target file path
 * @param {string} content - Content to write
 * @param {object} options - Write options
 * @returns {boolean} Success status
 */
function atomicWrite(filePath, content, options = { mode: SECURE_FILE_MODE }) {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
        return windowsWrite(filePath, content, options);
    } else {
        return unixWrite(filePath, content, options);
    }
}

/**
 * Windows-compatible file write with backup
 */
function windowsWrite(filePath, content, options) {
    const backupFile = filePath + '.backup';
    
    try {
        // Create backup if original exists
        if (fileExists(filePath)) {
            fs.copyFileSync(filePath, backupFile);
        }
        
        // Write new content
        fs.writeFileSync(filePath, content, options);
        
        // Cleanup backup on success
        if (fileExists(backupFile)) {
            fs.unlinkSync(backupFile);
        }
        
        return true;
    } catch {
        // Restore backup on failure
        if (fileExists(backupFile)) {
            try {
                fs.copyFileSync(backupFile, filePath);
                fs.unlinkSync(backupFile);
            } catch {
                // Backup restore failed - file may be corrupted
            }
        }
        return false;
    }
}

/**
 * Unix atomic write using temp file + rename
 */
function unixWrite(filePath, content, options) {
    const tempFile = filePath + '.tmp';
    
    try {
        fs.writeFileSync(tempFile, content, options);
        fs.renameSync(tempFile, filePath);
        return true;
    } catch {
        // Cleanup temp file on failure
        if (fileExists(tempFile)) {
            try {
                fs.unlinkSync(tempFile);
            } catch {
                // Temp file cleanup failed - not critical
            }
        }
        return false;
    }
}

// ===== API KEY MANAGEMENT =====

/**
 * Save API key securely
 * @param {string} modelId - Model identifier
 * @param {string} apiKey - API key to save
 * @param {object} providers - Provider configurations
 * @returns {boolean} Success status
 */
function saveApiKey(modelId, apiKey, providers) {
    const provider = providers[modelId];
    if (!provider?.keyFile) return false;
    
    const keyFile = path.join(AIDUINO_DIR, provider.keyFile);
    return atomicWrite(keyFile, apiKey);
}

/**
 * Load API key from file
 * @param {string} modelId - Model identifier
 * @param {object} providers - Provider configurations
 * @returns {string|null} API key or null
 */
function loadApiKey(modelId, providers) {
    const provider = providers[modelId];
    if (!provider?.keyFile) return null;
    
    const keyFile = path.join(AIDUINO_DIR, provider.keyFile);
    return safeReadFile(keyFile);
}

/**
 * Load all available API keys
 * @param {object} providers - Provider configurations
 * @returns {object} Map of modelId -> apiKey
 */
function loadAllApiKeys(providers) {
    const apiKeys = {};
    
    for (const [modelId, provider] of Object.entries(providers)) {
        if (!provider?.keyFile) continue;
        
        const apiKey = loadApiKey(modelId, providers);
        if (apiKey) {
            apiKeys[modelId] = apiKey;
        }
    }
    
    return apiKeys;
}

// ===== MODEL SELECTION PERSISTENCE =====

/**
 * Save selected model preference
 * @param {string} modelId - Model to save as default
 * @returns {boolean} Success status
 */
function saveSelectedModel(modelId) {
    const modelFile = path.join(AIDUINO_DIR, '.aiduino-model');
    return atomicWrite(modelFile, modelId);
}

/**
 * Load saved model selection with validation
 * @param {object} providers - Available providers for validation
 * @returns {string|null} Valid model ID or null
 */
function loadSelectedModel(providers) {
    const modelFile = path.join(AIDUINO_DIR, '.aiduino-model');
    const savedModel = safeReadFile(modelFile);
    
    // Validate against available providers
    if (savedModel && providers?.[savedModel]) {
        return savedModel;
    }
    
    return null;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Get extension version from package.json
 * @returns {string} Version string
 */
function getVersionFromPackage() {
    const packagePath = path.join(__dirname, '..', '..', 'package.json');
    const packageContent = safeReadFile(packagePath);
    
    if (!packageContent) return '1.0.0';
    
    try {
        const packageJson = JSON.parse(packageContent);
        return packageJson.version || '1.0.0';
    } catch {
        return '1.0.0';
    }
}

/**
 * Check file read permissions
 * @param {string} filePath - Path to check
 * @returns {boolean} True if readable
 */
function isFileReadable(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
}

// ===== MIGRATION UTILITIES =====

/**
 * Migrate legacy files from home directory
 * @param {string} targetDir - Target .aiduino directory
 */
function migrateOldFiles(targetDir) {
    try {
        const homeDir = os.homedir();
        const files = fs.readdirSync(homeDir);
        
        for (const filename of files) {
            if (!filename.startsWith('.aiduino-')) continue;
            
            const oldPath = path.join(homeDir, filename);
            const newPath = path.join(targetDir, filename);
            
            // Skip if target already exists
            if (fileExists(newPath)) continue;
            
            try {
                fs.copyFileSync(oldPath, newPath);
                fs.unlinkSync(oldPath);
            } catch {
                // Individual file migration failure - not critical
                continue;
            }
        }
    } catch {
        // Home directory not readable - skip migration
    }
}

// ===== CONTEXT MANAGEMENT =====

/**
 * Reset AI conversation context
 * @returns {object} Clean context object
 */
function clearAIContext() {
    return {
        lastQuestion: null,
        lastAnswer: null,
        lastCode: null,
        timestamp: null
    };
}

/**
 * Legacy wrapper for safeWriteFile (backward compatibility)
 * @deprecated Use atomicWrite instead
 */
function safeWriteFile(filePath, content, options = { mode: SECURE_FILE_MODE }) {
    return atomicWrite(filePath, content, options);
}

// ===== EXPORTS =====

module.exports = {
    // Core operations
    fileExists,
    safeReadFile,
    atomicWrite,
    
    // API key management
    saveApiKey,
    loadApiKey,
    loadAllApiKeys,
    
    // Model selection
    saveSelectedModel,
    loadSelectedModel,
    
    // Utilities
    getVersionFromPackage,
    isFileReadable,
    migrateOldFiles,
    clearAIContext,
    
    // Legacy compatibility
    safeWriteFile
};
