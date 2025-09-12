/*
 * AI.duino - File Management Utilities
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const AIDUINO_DIR = path.join(os.homedir(), '.aiduino');

/**
 * Save API key to secure file
 * @param {string} modelId - Model identifier (claude, chatgpt, etc.)
 * @param {string} apiKey - API key to save
 * @param {object} providers - Provider configurations
 * @returns {boolean} True if successful
 */
function saveApiKey(modelId, apiKey, providers) {
    try {
        const model = providers[modelId];
        if (!model) return false;
        
        const keyFile = path.join(AIDUINO_DIR, model.keyFile);
        fs.writeFileSync(keyFile, apiKey, { mode: 0o600 });
        return true;
    } catch (error) {
        console.log(`Error saving ${modelId} API Key:`, error);
        return false;
    }
}

/**
 * Load API key from file
 * @param {string} modelId - Model identifier
 * @param {object} providers - Provider configurations
 * @returns {string|null} API key or null if not found
 */
function loadApiKey(modelId, providers) {
    try {
        const model = providers[modelId];
        if (!model) return null;
        
        const keyFile = path.join(AIDUINO_DIR, model.keyFile);
        
        if (fs.existsSync(keyFile)) {
            return fs.readFileSync(keyFile, 'utf8').trim();
        }
        return null;
    } catch (error) {
        console.log(`Error loading ${modelId} API Key:`, error);
        return null;
    }
}

/**
 * Load all API keys for available providers
 * @param {object} providers - Provider configurations
 * @returns {object} Object with modelId: apiKey pairs
 */
function loadAllApiKeys(providers) {
    const apiKeys = {};
    
    Object.keys(providers).forEach(modelId => {
        const key = loadApiKey(modelId, providers);
        if (key) {
            apiKeys[modelId] = key;
        }
    });
    
    return apiKeys;
}

/**
 * Save selected model to file
 * @param {string} modelId - Model to save as default
 * @returns {boolean} True if successful
 */
function saveSelectedModel(modelId) {
    try {
        const modelFile = path.join(AIDUINO_DIR, '.aiduino-model');
        fs.writeFileSync(modelFile, modelId, { mode: 0o600 });
        return true;
    } catch (error) {
        console.log('Error saving model:', error);
        return false;
    }
}

/**
 * Load saved model selection
 * @param {object} providers - Available providers to validate against
 * @returns {string|null} Model ID or null if not found/invalid
 */
function loadSelectedModel(providers) {
    try {
        const modelFile = path.join(os.homedir(), '.aiduino-model');
        
        if (fs.existsSync(modelFile)) {
            const savedModel = fs.readFileSync(modelFile, 'utf8').trim();
            
            // Validate model exists in providers
            if (providers && providers[savedModel]) {
                return savedModel;
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Check if file exists and is readable
 * @param {string} filePath - Path to check
 * @returns {boolean} True if file exists and is readable
 */
function isFileReadable(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if directory exists and is writable
 * @param {string} dirPath - Directory path to check
 * @returns {boolean} True if directory exists and is writable
 */
function isDirectoryWritable(dirPath) {
    try {
        fs.accessSync(dirPath, fs.constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Create directory if it doesn't exist
 * @param {string} dirPath - Directory path to create
 * @returns {boolean} True if successful or already exists
 */
function ensureDirectory(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        return true;
    } catch (error) {
        console.log('Error creating directory:', error);
        return false;
    }
}

/**
 * Safe file write with backup strategy for Windows compatibility
 * @param {string} filePath - File to write
 * @param {string} content - Content to write
 * @param {object} options - Write options (default: { mode: 0o600 })
 * @returns {boolean} True if successful
 */
function safeWriteFile(filePath, content, options = { mode: 0o600 }) {
    try {
        if (process.platform === 'win32') {
            // Windows: Direct overwrite with backup
            const backupFile = filePath + '.backup';
            
            // Create backup if original exists
            if (fs.existsSync(filePath)) {
                try {
                    fs.copyFileSync(filePath, backupFile);
                } catch (backupError) {
                    // Backup failed, but continue
                }
            }
            
            // Write new file
            fs.writeFileSync(filePath, content, options);
            
            // Remove backup on success
            try {
                if (fs.existsSync(backupFile)) {
                    fs.unlinkSync(backupFile);
                }
            } catch (cleanupError) {
                // Backup cleanup failed - not critical
            }
            
        } else {
            // Unix/Linux: Atomic rename strategy
            const tempFile = filePath + '.tmp';
            
            // Write to temp file first
            fs.writeFileSync(tempFile, content, options);
            
            // Atomic rename
            fs.renameSync(tempFile, filePath);
        }
        
        return true;
        
    } catch (error) {
        // Fallback: Try direct write
        try {
            fs.writeFileSync(filePath, content, options);
            return true;
        } catch (fallbackError) {
            console.log('File write failed:', fallbackError);
            return false;
        }
    }
}

/**
 * Get version from package.json
 * @returns {string} Version string or '1.0.0' as fallback
 */
function getVersionFromPackage() {
    try {
        const packagePath = path.join(__dirname, '..', '..', 'package.json');
        if (fs.existsSync(packagePath)) {
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            return packageJson.version || '1.0.0';
        }
    } catch (error) {
        return '1.0.0';
    }
    return '1.0.0';
}

/**
 * Migrate old AI.duino files from home directory to .aiduino subdirectory
 * Moves all files starting with '.aiduino-' to organized subdirectory
 * @param {string} aiduinoDir - Target .aiduino directory path
 */
function migrateOldFiles(aiduinoDir) {
    try {
        const homeDir = os.homedir();
        const files = fs.readdirSync(homeDir);
        
        files.forEach(filename => {
            if (filename.startsWith('.aiduino-')) {
                const oldPath = path.join(homeDir, filename);
                const newPath = path.join(aiduinoDir, filename); // Behält ursprünglichen Namen
                
                if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
                    try {
                        fs.copyFileSync(oldPath, newPath);
                        fs.unlinkSync(oldPath);
                    } catch (error) {
                        // Silent error für einzelne Dateien
                    }
                }
            }
        });
    } catch (error) {
        // Silent error falls Home-Directory nicht lesbar
    }
}

module.exports = {
    saveApiKey,
    loadApiKey,
    loadAllApiKeys,
    saveSelectedModel,
    loadSelectedModel,
    isFileReadable,
    isDirectoryWritable,
    ensureDirectory,
    safeWriteFile,
    getVersionFromPackage,
    migrateOldFiles
};
