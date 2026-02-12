/*
 * AI.duino - File Management Utilities Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const fs = require("fs");
const fsPromises = require("fs").promises;
const os = require("os");
const path = require("path");

const AIDUINO_DIR = path.join(os.homedir(), '.aiduino');
const SECURE_FILE_MODE = 0o600;

// ===== CORE FILE OPERATIONS =====

/**
 * Safe file existence check (sync - fast enough)
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
 * Safe sync file read with fallback (for runtime usage)
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
 * Safe async file read with fallback (for startup performance)
 * @param {string} filePath - File to read
 * @param {string} fallback - Return value if read fails
 * @returns {Promise<string>} File content or fallback
 */
async function safeReadFileAsync(filePath, fallback = null) {
    if (!fileExists(filePath)) return fallback;
    
    try {
        const content = await fsPromises.readFile(filePath, 'utf8');
        return content.trim();
    } catch {
        return fallback;
    }
}

/**
 * Cross-platform atomic file write (sync is fine for writes)
 * @param {string} filePath - Target file path
 * @param {string} content - Content to write
 * @param {object} options - Write options
 * @returns {boolean} Success status
 */
function atomicWrite(filePath, content, options = { mode: SECURE_FILE_MODE }) {
    if (process.platform === 'win32') {
        // Windows: Backup-Strategie
        const backupFile = filePath + '.backup';
        try {
            if (fileExists(filePath)) {
                fs.copyFileSync(filePath, backupFile);
            }
            fs.writeFileSync(filePath, content, { ...options, encoding: 'utf8' });
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
                } catch {}
            }
            return false;
        }
    } else {
        // Unix: Atomic rename
        const tempFile = filePath + '.tmp';
        try {
            fs.writeFileSync(tempFile, content, { ...options, encoding: 'utf8' });
            fs.renameSync(tempFile, filePath);
            return true;
        } catch {
            if (fileExists(tempFile)) {
                try { fs.unlinkSync(tempFile); } catch {}
            }
            return false;
        }
    }
}

// ===== API KEY MANAGEMENT =====

/**
 * Save API key securely (sync is fine)
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
 * Load API key from file (sync - for runtime usage)
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
 * Load API key from file (async - for startup performance)
 * @param {string} modelId - Model identifier
 * @param {object} providers - Provider configurations
 * @returns {Promise<string|null>} API key or null
 */
async function loadApiKeyAsync(modelId, providers) {
    const provider = providers[modelId];
    if (!provider?.keyFile) return null;
    
    const keyFile = path.join(AIDUINO_DIR, provider.keyFile);
    return await safeReadFileAsync(keyFile);
}

/**
 * Load all available API keys (sync - for runtime usage)
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

/**
 * Load all available API keys (async with parallel loading - for startup)
 * @param {object} providers - Provider configurations
 * @returns {Promise<object>} Map of modelId -> apiKey
 */
async function loadAllApiKeysAsync(providers) {
    const apiKeys = {};
    
    // Create array of promises for parallel loading
    const loadPromises = Object.entries(providers).map(async ([modelId, provider]) => {
        if (!provider?.keyFile) return;
        
        const apiKey = await loadApiKeyAsync(modelId, providers);
        if (apiKey) {
            apiKeys[modelId] = apiKey;
        }
    });
    
    // Wait for all keys to load in parallel
    await Promise.all(loadPromises);
    
    return apiKeys;
}

// ===== MODEL SELECTION PERSISTENCE =====

/**
 * Save selected model preference (sync is fine)
 * @param {string} modelId - Model to save as default
 * @returns {boolean} Success status
 */
function saveSelectedModel(modelId) {
    const modelFile = path.join(AIDUINO_DIR, '.aiduino-model');
    return atomicWrite(modelFile, modelId);
}

/**
 * Load saved model selection with validation (sync - for runtime usage)
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

/**
 * Load saved model selection with validation (async - for startup)
 * @param {object} providers - Available providers for validation
 * @returns {Promise<string|null>} Valid model ID or null
 */
async function loadSelectedModelAsync(providers) {
    const modelFile = path.join(AIDUINO_DIR, '.aiduino-model');
    const savedModel = await safeReadFileAsync(modelFile);
    
    // Validate against available providers
    if (savedModel && providers?.[savedModel]) {
        return savedModel;
    }
    
    return null;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Get extension version from package.json (sync)
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
 * Get extension version from package.json (async)
 * @returns {Promise<string>} Version string
 */
async function getVersionFromPackageAsync() {
    const packagePath = path.join(__dirname, '..', '..', 'package.json');
    const packageContent = await safeReadFileAsync(packagePath);
    
    if (!packageContent) return '1.0.0';
    
    try {
        const packageJson = JSON.parse(packageContent);
        return packageJson.version || '1.0.0';
    } catch {
        return '1.0.0';
    }
}

// ===== MIGRATION UTILITIES =====

/**
 * Migrate legacy files from home directory (sync is fine - only runs once)
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

// ===== FILE PICKER & ADDITIONAL FILES =====

/**
 * Open file picker dialog for selecting additional files
 * @param {Array<string>} existingFiles - Already selected files to filter out
 * @param {Object} options - Optional picker options
 * @returns {Promise<Array<string>|null>} Array of file paths or null if cancelled
 */
async function pickAdditionalFiles(existingFiles = [], options = {}) {
    const vscode = require('vscode');
    
    const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        canSelectFiles: true,
        canSelectFolders: false,
        filters: options.filters || {
            'Arduino Files': ['ino', 'cpp', 'h', 'hpp', 'c'],
            'All Files': ['*']
        },
        openLabel: options.openLabel || 'Select Files',
        title: options.title || 'Select Additional Files',
        defaultUri: options.defaultUri
    });
    
    if (!fileUris || fileUris.length === 0) {
        return null;
    }
    
    // Convert to file paths and filter duplicates
    const newPaths = fileUris
        .map(uri => uri.fsPath)
        .filter(path => !existingFiles.includes(path));
    
    return newPaths;
}

/**
 * Read multiple files and return their contents
 * @param {Array<string>} filePaths - Array of file paths
 * @returns {Promise<Array<Object>>} Array of {path, name, content, error}
 */
async function readAdditionalFiles(filePaths) {
    const results = [];
    
    for (const filePath of filePaths) {
        const fileName = path.basename(filePath);
        
        try {
            const content = await safeReadFileAsync(filePath, '');
            results.push({
                path: filePath,
                name: fileName,
                content: content,
                error: null
            });
        } catch (error) {
            results.push({
                path: filePath,
                name: fileName,
                content: '',
                error: error.message
            });
        }
    }
    
    return results;
}

// ===== EXPORTS =====

module.exports = {
    // Core operations
    fileExists,
    safeReadFile,           // sync
    safeReadFileAsync,      // async
    atomicWrite,
    
    // API key management
    saveApiKey,
    loadApiKey,             // sync - for runtime
    loadApiKeyAsync,        // async - for startup
    loadAllApiKeys,         // sync - for runtime
    loadAllApiKeysAsync,    // async - for startup
    
    // Model selection
    saveSelectedModel,
    loadSelectedModel,      // sync - for runtime
    loadSelectedModelAsync, // async - for startup
    
    // Utilities
    getVersionFromPackage,       // sync
    getVersionFromPackageAsync,  // async
    migrateOldFiles,
    clearAIContext,

    // File picker & additional files
    pickAdditionalFiles,
    readAdditionalFiles
};
