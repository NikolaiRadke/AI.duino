/*
 * AI.duino
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
 *
 * Changelog:
 * Better board name rendering
 * All AI Chats now have an own Tab for better reading und saving
 * AskAI follow up enhanced with user input displaying 
 * Line breaks for long lines
 * Fixed button inconsistencies
 */

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");

let i18n = {};
let currentLocale = 'en';

let lastDiagnosticsCount = 0;
let lastErrorCheck = 0;
let lastCheckedUri = null;

let aiConversationContext = {
    lastQuestion: null,
    lastAnswer: null,
    lastCode: null,
    timestamp: null
};

class ExecutionStateManager {
    constructor() {
        this.states = new Map();
        this.OPERATIONS = {
            EXPLAIN: 'explain',
            IMPROVE: 'improve',
            COMMENTS: 'comments',
            DEBUG: 'debug',
            ASK: 'ask',
            ERROR: 'error',
            // NEU:
            SET_API_KEY: 'setApiKey',
            SWITCH_MODEL: 'switchModel',
            SWITCH_LANGUAGE: 'switchLanguage'
        };
    }
    
    isRunning(operation) {
        return this.states.has(operation) && this.states.get(operation) === true;
    }
    
    start(operation) {
        if (this.isRunning(operation)) {
            return false; // Already running
        }
        this.states.set(operation, true);
        return true;
    }
    
    stop(operation) {
        this.states.delete(operation);
    }
}
const executionStates = new ExecutionStateManager();

// Board detection
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
        if (stats.size <= bufferSize) {
            content = fs.readFileSync(logPath, 'utf8');
        } else {
            const buffer = Buffer.alloc(bufferSize);
            const fd = fs.openSync(logPath, 'r');
            fs.readSync(fd, buffer, 0, bufferSize, stats.size - bufferSize);
            fs.closeSync(fd);
            content = buffer.toString('utf8');
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

function getBoardContext() {
    const board = detectArduinoBoard();
    return board ? `\n\nTarget Board: ${board}` : '';
}

function getBoardDisplayName(fqbn) {
    if (!fqbn) return '—';
    // Split by colon and take last part
    const parts = fqbn.split(':');
    if (parts.length < 3) {
        return fqbn;
    }
    return `${parts[0]}:${parts[2]}`;
}

// Language Metadate
const LANGUAGE_METADATA = {
    'en': { name: 'English', flag: '🇺🇸', region: 'English' },
    'de': { name: 'Deutsch', flag: '🇩🇪', region: 'German' },
    'es': { name: 'Español', flag: '🇪🇸', region: 'Spanish' },
    'fr': { name: 'Français', flag: '🇫🇷', region: 'French' },
    'it': { name: 'Italiano', flag: '🇮🇹', region: 'Italian' },
    'pt': { name: 'Português', flag: '🇵🇹', region: 'Portuguese' },
    'zh': { name: '中文', flag: '🇨🇳', region: 'Chinese' },
    'ja': { name: '日本語', flag: '🇯🇵', region: 'Japanese' },
    'ko': { name: '한국어', flag: '🇰🇷', region: 'Korean' },
    'ru': { name: 'Русский', flag: '🇷🇺', region: 'Russian' },
    'nl': { name: 'Nederlands', flag: '🇳🇱', region: 'Dutch' },
    'pl': { name: 'Polski', flag: '🇵🇱', region: 'Polish' },
    'tr': { name: 'Türkçe', flag: '🇹🇷', region: 'Turkish' },
    'el': { name: 'Ελληνικά', flag: '🇬🇷', region: 'Greek' },
    'cs': { name: 'Čeština', flag: '🇨🇿', region: 'Czech' },
    'sv': { name: 'Svenska', flag: '🇸🇪', region: 'Swedish' },
    'ro': { name: 'Română', flag: '🇷🇴', region: 'Romanian' },
    'da': { name: 'Dansk', flag: '🇩🇰', region: 'Danish' },
    'no': { name: 'Norsk', flag: '🇳🇴', region: 'Norwegian' },
    'fi': { name: 'Suomi', flag: '🇫🇮', region: 'Finnish' },
    'hu': { name: 'Magyar', flag: '🇭🇺', region: 'Hungarian' },
    'bg': { name: 'Български', flag: '🇧🇬', region: 'Bulgarian' },
    'hr': { name: 'Hrvatski', flag: '🇭🇷', region: 'Croatian' },
    'sk': { name: 'Slovenčina', flag: '🇸🇰', region: 'Slovak' },
    'sl': { name: 'Slovenščina', flag: '🇸🇮', region: 'Slovenian' },
    'lt': { name: 'Lietuvių', flag: '🇱🇹', region: 'Lithuanian' },
    'lv': { name: 'Latviešu', flag: '🇱🇻', region: 'Latvian' },
    'et': { name: 'Eesti', flag: '🇪🇪', region: 'Estonian' },
    'uk': { name: 'Українська', flag: '🇺🇦', region: 'Ukrainian' },
    'be': { name: 'Беларуская', flag: '🇧🇾', region: 'Belarusian' },
    'mk': { name: 'Македонски', flag: '🇲🇰', region: 'Macedonian' },
    'sr': { name: 'Српски', flag: '🇷🇸', region: 'Serbian' },
    'bs': { name: 'Bosanski', flag: '🇧🇦', region: 'Bosnian' },
    'me': { name: 'Crnogorski', flag: '🇲🇪', region: 'Montenegrin' },
    'mt': { name: 'Malti', flag: '🇲🇹', region: 'Maltese' },
    'is': { name: 'Íslenska', flag: '🇮🇸', region: 'Icelandic' },
    'hi': { name: 'हिन्दी', flag: '🇮🇳', region: 'Hindi' },
    'bn': { name: 'বাংলা', flag: '🇧🇩', region: 'Bengali' },
    'ta': { name: 'தமிழ்', flag: '🇱🇰', region: 'Tamil' },
    'te': { name: 'తెలుగు', flag: '🇮🇳', region: 'Telugu' },
    'mr': { name: 'मराठी', flag: '🇮🇳', region: 'Marathi' },
    'gu': { name: 'ગુજરાતી', flag: '🇮🇳', region: 'Gujarati' },
    'pa': { name: 'ਪੰਜਾਬੀ', flag: '🇮🇳', region: 'Punjabi' },
    'ur': { name: 'اردو', flag: '🇵🇰', region: 'Urdu' },
    'fa': { name: 'فارسی', flag: '🇮🇷', region: 'Persian' },
    'ar': { name: 'العربية', flag: '🇸🇦', region: 'Arabic' },
    'he': { name: 'עברית', flag: '🇮🇱', region: 'Hebrew' },
    'th': { name: 'ไทย', flag: '🇹🇭', region: 'Thai' },
    'vi': { name: 'Tiếng Việt', flag: '🇻🇳', region: 'Vietnamese' },
    'id': { name: 'Bahasa Indonesia', flag: '🇮🇩', region: 'Indonesian' },
    'ms': { name: 'Bahasa Malaysia', flag: '🇲🇾', region: 'Malay' },
    'tl': { name: 'Filipino', flag: '🇵🇭', region: 'Filipino' },
    'my': { name: 'မြန်မာ', flag: '🇲🇲', region: 'Burmese' },
    'km': { name: 'ខ្មែរ', flag: '🇰🇭', region: 'Khmer' },
    'lo': { name: 'ລາວ', flag: '🇱🇦', region: 'Lao' },
    'sw': { name: 'Kiswahili', flag: '🇰🇪', region: 'Swahili' },
    'af': { name: 'Afrikaans', flag: '🇿🇦', region: 'Afrikaans' },
    'am': { name: 'አማርኛ', flag: '🇪🇹', region: 'Amharic' }
};

let availableLocales = null;

function getVersionFromPackage() {
    try {
        const packagePath = path.join(__dirname, '..', 'package.json');
        if (fs.existsSync(packagePath)) {
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            return packageJson.version || '1.0.0';
        }
    } catch (error) {
        // Silent fallback - keine Console-Logs
        return '1.0.0';
    }
    return '1.0.0';
}

const EXTENSION_VERSION = getVersionFromPackage();

function getAvailableLocales() {
    const localesDir = path.join(__dirname, '..', 'locales');
    const availableLocales = [];
    
    try {
        if (fs.existsSync(localesDir)) {
            const files = fs.readdirSync(localesDir);
            
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    const locale = file.replace('.json', '');
                    availableLocales.push(locale);
                }
            });
        }
    } catch (error) {
        // Silent fallback
        return ['en', 'de'];
    }
    
    return ['en', ...availableLocales.filter(l => l !== 'en').sort()];
}

// Get language info from metadata
function getLanguageInfo(locale) {
    return LANGUAGE_METADATA[locale] || { 
        name: locale.toUpperCase(), 
        flag: '🌐', 
        region: locale.toUpperCase() 
    };
}

// Minimal dynamic model system for AI.duino
// Works completely in background, only shows latest model in statusbar

class MinimalModelManager {
    constructor() {
        this.providers = this.getProviders();
        this.currentModels = {}; // Latest model per provider
        this.lastCheck = {};
        this.isUpdating = false;
    }

    getProviders() {
        return {
            claude: {
                name: 'Claude',
                icon: '🤖',
                color: '#6B46C1',
                keyFile: '.aiduino-claude-api-key',
                keyPrefix: 'sk-ant-',
                hostname: 'api.anthropic.com',
                path: '/v1/models',
                headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
                extractModels: (data) => data.data?.filter(m => m.type === 'text' && !m.id.includes('deprecated')) || [],
                selectBest: (models) => models.find(m => m.id.includes('3-5-sonnet')) || models[0],
                fallback: 'claude-3-5-sonnet-20241022'
            },
            chatgpt: {
                name: 'ChatGPT',
                icon: '🧠', 
                color: '#10A37F',
                keyFile: '.aiduino-openai-api-key',
                keyPrefix: 'sk-',
                hostname: 'api.openai.com',
                path: '/v1/models',
                headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
                extractModels: (data) => data.data?.filter(m => m.id.startsWith('gpt-') && !m.id.includes('instruct')) || [],
                selectBest: (models) => models.find(m => m.id.includes('gpt-4-turbo')) || models.find(m => m.id.includes('gpt-4')) || models[0],
                fallback: 'gpt-4-turbo'
            },
            gemini: {
                name: 'Gemini',
                icon: '💎',
                color: '#4285F4', 
                keyFile: '.aiduino-gemini-api-key',
                keyPrefix: 'AIza',
                hostname: 'generativelanguage.googleapis.com',
                path: '/v1/models?key=',
                headers: () => ({}),
                extractModels: (data) => data.models?.filter(m => m.supportedGenerationMethods?.includes('generateContent')) || [],
                selectBest: (models) => models.find(m => m.name.includes('1.5-pro')) || models.find(m => m.name.includes('1.5-flash')) || models[0],
                fallback: 'gemini-1.5-flash'
            },
            mistral: {
                name: 'Mistral',
                icon: '🌟',
                color: '#FF7000',
                keyFile: '.aiduino-mistral-api-key', 
                keyPrefix: 'sk-',
                hostname: 'api.mistral.ai',
                path: '/v1/models',
                headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
                extractModels: (data) => data.data?.filter(m => !m.id.includes('embed')) || [],
                selectBest: (models) => models.find(m => m.id.includes('large')) || models[0],
                fallback: 'mistral-large-latest'
            },
            
            // New
            
            perplexity: {
                name: 'Perplexity',
                icon: '🔍',
                color: '#20B2AA',
                keyFile: '.aiduino-perplexity-api-key',
                keyPrefix: 'pplx-',
                hostname: 'api.perplexity.ai',
                path: '/chat/completions',
                headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
                extractModels: (data) => [{ id: 'llama-3.1-sonar-large-128k-online', name: 'Llama 3.1 Sonar Large' }], // Perplexity hat feste Modelle
                selectBest: (models) => models[0],
                fallback: 'llama-3.1-sonar-large-128k-online'
            },
            
            cohere: {
                name: 'Cohere',
                icon: '🔥', 
                color: '#39C5BB',
                keyFile: '.aiduino-cohere-api-key',
                keyPrefix: 'co-',
                hostname: 'api.cohere.ai',
                path: '/v1/models',
                headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
                extractModels: (data) => data.models?.filter(m => m.name.includes('command')) || [],
                selectBest: (models) => models.find(m => m.name.includes('command-r-plus')) || models[0],
                fallback: 'command-r-plus'
            },
            
            groq: {
                name: 'Groq',
                icon: '🚀',
                color: '#F55036',
                keyFile: '.aiduino-groq-api-key',
                keyPrefix: 'gsk_',
                hostname: 'api.groq.com',
                path: '/openai/v1/models',
                headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
                extractModels: (data) => data.data?.filter(m => m.id.includes('llama') || m.id.includes('mixtral')) || [],
                selectBest: (models) => models.find(m => m.id.includes('llama-3.1')) || models[0],
                fallback: 'llama-3.1-70b-versatile'
            }
        };
    }

    // Main function: Silent update of all providers
    async updateModelsQuietly() {
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
            for (const [providerId, provider] of Object.entries(this.providers)) {
                const apiKey = this.getApiKey(providerId);
                if (apiKey && this.shouldCheck(providerId)) {
                    await this.updateProviderModel(providerId, apiKey);
                }
            }
        } catch (error) {
            // Silent handling - no user feedback
            console.log('AI.duino: Model update completed with some fallbacks');
        } finally {
            this.isUpdating = false;
        }
    }

    // Update single provider
    async updateProviderModel(providerId, apiKey) {
        try {
            const models = await this.fetchModels(providerId, apiKey);
            if (models.length > 0) {
                const provider = this.providers[providerId];
                const bestModel = provider.selectBest(models);
                if (bestModel) {
                    this.currentModels[providerId] = this.formatModel(providerId, bestModel);
                    this.lastCheck[providerId] = Date.now();
                    console.log(`AI.duino: Updated ${providerId} to ${this.currentModels[providerId].id}`);
                }
            }
        } catch (error) {
            // Use fallback
            this.useFallback(providerId);
        }
    }

    // API call for models
    async fetchModels(providerId, apiKey) {
        const provider = this.providers[providerId];
        const path = providerId === 'gemini' ? provider.path + apiKey : provider.path;
        
        return new Promise((resolve, reject) => {
            const options = {
                hostname: provider.hostname,
                port: 443,
                path: path,
                method: 'GET',
                headers: { 'Content-Type': 'application/json', ...provider.headers(apiKey) },
                timeout: 5000
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const parsed = JSON.parse(data);
                            const models = provider.extractModels(parsed);
                            resolve(models);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}`));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });

            req.end();
        });
    }

    // Format model object
    formatModel(providerId, model) {
        const formatters = {
            claude: (m) => ({ id: m.id, name: m.display_name || this.cleanName(m.id) }),
            chatgpt: (m) => ({ id: m.id, name: this.cleanName(m.id) }),
            gemini: (m) => ({ id: m.name.replace('models/', ''), name: m.displayName || this.cleanName(m.name) }),
            mistral: (m) => ({ id: m.id, name: this.cleanName(m.id) }),
            groq: (m) => ({ id: m.id, name: this.cleanName(m.id) }),
            perplexity: (m) => ({ id: m.id, name: this.cleanName(m.id) }),
            cohere: (m) => ({ id: m.id || m.name, name: this.cleanName(m.name || m.id) })    
        };
    
        const formatter = formatters[providerId];
        if (!formatter) {
            // Fallback für unbekannte Provider
            return { id: model.id || 'unknown', name: this.cleanName(model.name || model.id || 'Unknown') };
        }
    
        return formatter(model);
    }

    // Clean model names
    cleanName(rawName) {
        return rawName
            .replace(/^models\//, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    // Use fallback model
    useFallback(providerId) {
        const provider = this.providers[providerId];
        this.currentModels[providerId] = {
            id: provider.fallback,
            name: this.cleanName(provider.fallback),
            isFallback: true
        };
    }

    // Check if update needed (daily)
    shouldCheck(providerId) {
        const lastCheck = this.lastCheck[providerId] || 0;
        return Date.now() - lastCheck > 24 * 60 * 60 * 1000; // 24 hours
    }

    // Read API key from file
    getApiKey(providerId) {
        try {
            const keyFile = path.join(os.homedir(), this.providers[providerId].keyFile);
            return fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : null;
        } catch {
            return null;
        }
    }

    // Get current model for provider
    getCurrentModel(providerId) {
        return this.currentModels[providerId] || {
            id: this.providers[providerId].fallback,
            name: this.cleanName(this.providers[providerId].fallback),
            isFallback: true
        };
    }

    // Provider info for statusbar
    getProviderInfo(providerId) {
        const provider = this.providers[providerId];
        const model = this.getCurrentModel(providerId);
        
        return {
            name: provider.name,
            icon: provider.icon,
            color: provider.color,
            modelName: model.name,
            modelId: model.id,
            isLatest: !model.isFallback,
            hasApiKey: !!this.getApiKey(providerId)
        };
    }

    // Debug helper: Show current models
    showCurrentModels() {
        console.log('AI.duino Current Models:');
        Object.keys(this.providers).forEach(providerId => {
            const model = this.getCurrentModel(providerId);
            const hasKey = !!this.getApiKey(providerId);
            console.log(`${providerId}: ${model.id} (${model.name}) - API Key: ${hasKey ? 'Yes' : 'No'} - Fallback: ${model.isFallback ? 'Yes' : 'No'}`);
        });
        console.log(`Active Provider: ${currentModel}`);
        return this.currentModels;
    }
}

// Global instance
const minimalModelManager = new MinimalModelManager();

function loadLocale() {
    const config = vscode.workspace.getConfiguration('aiduino');
    const userLanguageChoice = config.get('language', 'auto');
    
    if (userLanguageChoice !== 'auto') {
        currentLocale = userLanguageChoice;
    } else {
        // Auto-Detection with dynamic list
        const vscodeLocale = vscode.env.language || 'en';
        const detectedLang = vscodeLocale.substring(0, 2);
        const supportedLocales = getAvailableLocales(); 
        
        currentLocale = supportedLocales.includes(detectedLang) ? detectedLang : 'en';
    }
    
    // Load locale file with fallback chain to en.json
    const localeFiles = [
        path.join(__dirname, '..', 'locales', `${currentLocale}.json`),
        path.join(__dirname, '..', 'locales', 'en.json')  // Always available fallback
    ];
    
    let localeLoaded = false;
    for (const localeFile of localeFiles) {
        try {
            if (fs.existsSync(localeFile)) {
                const content = fs.readFileSync(localeFile, 'utf8');
                i18n = JSON.parse(content);
                localeLoaded = true;
                console.log(`AI.duino: Loaded locale from ${path.basename(localeFile)}`);
                break;
            }
        } catch (error) {
            console.log(`AI.duino: Failed to load ${path.basename(localeFile)}: ${error.message}`);
            continue; // Try next fallback
        }
    }
    
    // Critical error if no locale could be loaded
    if (!localeLoaded) {
        console.error('AI.duino CRITICAL: No locale files found! Extension may not work properly.');
        // Set currentLocale to 'en' and create minimal i18n object
        currentLocale = 'en';
        i18n = {
            commands: { quickMenu: "Open Quick Menu" },
            messages: { selectAction: "What would you like to do?" },
            buttons: { cancel: "Cancel" }
        };
    }
}

// Global listener
let configListener = null;
let diagnosticsListener = null;
let errorTimeout = null;
let statusBarUpdateTimeout = null;

function setupEventListeners(context) {
    // Cleanup existing listeners
    disposeEventListeners();
    
    // Configuration change listener with debouncing
    let configDebounceTimeout = null;
    configListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('aiduino.language')) {
            // Debounce multiple rapid config changes
            if (configDebounceTimeout) {
                clearTimeout(configDebounceTimeout);
            }
            configDebounceTimeout = setTimeout(() => {
                loadLocale();
                updateStatusBar();
                configDebounceTimeout = null;
            }, 300);
        }
    });
    
    // Diagnostics listener
    diagnosticsListener = vscode.languages.onDidChangeDiagnostics(e => {
        // Performance: Only process for .ino files
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('.ino')) {
            return;
        }
        
        // Performance: Only process if the changed URI matches the active document
        const changedUris = e.uris || [];
        const activeUri = activeEditor.document.uri.toString();
        const isRelevantChange = changedUris.some(uri => uri.toString() === activeUri);
        
        if (!isRelevantChange) {
            return;
        }
        
        // Debounce error checking to avoid excessive calls
        if (errorTimeout) {
            clearTimeout(errorTimeout);
            errorTimeout = null;
        }
        errorTimeout = setTimeout(() => {
            checkForErrors();
            errorTimeout = null;
        }, 1000);
    });
    
    // Add to context.subscriptions for proper cleanup
    context.subscriptions.push(configListener);
    context.subscriptions.push(diagnosticsListener);
}

function disposeEventListeners() {
    if (configListener) {
        configListener.dispose();
        configListener = null;
    }
    if (diagnosticsListener) {
        diagnosticsListener.dispose();
        diagnosticsListener = null;
    }
    if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
    }
    if (statusBarUpdateTimeout) {
        clearTimeout(statusBarUpdateTimeout);
        statusBarUpdateTimeout = null;
    }
}

// Helper function to get localized string
function t(key, ...args) {
    const keys = key.split('.');
    let value = i18n;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return key; // Return key as fallback
        }
    }
    if (typeof value === 'string' && args.length > 0) {
        return value.replace(/{(\d+)}/g, (match, index) => {
            return args[parseInt(index)] || match;
        });
    }
    
    return value;
}

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

// Helper function to wrap long lines
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

// Global variables
let statusBarItem;
let globalContext;
let currentModel = 'claude';
const apiKeys = {};
const MODEL_FILE = path.join(os.homedir(), '.aiduino-model');

// Token tracking
let tokenUsage = {};
const TOKEN_USAGE_FILE = path.join(os.homedir(), '.aiduino-token-usage.json');
let tokenFileLock = false;
let tokenSaveQueue = [];
let saveTimeout = null;

// Activation
function activate(context) {
    // Ensure clean state on activation
    if (globalContext) {
        // Extension was somehow already active - cleanup first
        deactivate();
    }    
    // Load locale first
    loadLocale();
    
    // Store context globally
    globalContext = context;

    // Initialize token usage for all models
    initializeTokenUsage();
    
    // Load API keys and model on startup
    loadApiKeys();
    loadSelectedModel();
    loadTokenUsage();
    
    // Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    updateStatusBar();
    statusBarItem.command = "aiduino.quickMenu";
    statusBarItem.show();

    // NEW: Update models in background (after 3 seconds)
    setTimeout(async () => {
        await minimalModelManager.updateModelsQuietly();
        updateStatusBar(); // Update statusbar with latest models
    }, 3000);

    // NEW: Daily updates
    setInterval(async () => {
        await minimalModelManager.updateModelsQuietly();
        updateStatusBar();
    }, 24 * 60 * 60 * 1000); // Every 24 hours
    
    // Register commands
    registerCommands(context);
    
    setupEventListeners(context);

    // Welcome message
    if (shouldShowWelcome()) {
        setTimeout(() => {
            showWelcomeMessage();
        }, 1000);
    }
}
exports.activate = activate;

function registerCommands(context) {
    const commands = [
        { name: 'aiduino.quickMenu', handler: showQuickMenu }, 
        { name: 'aiduino.switchModel', handler: switchModel },
        { name: 'aiduino.setApiKey', handler: setApiKey },
        { name: 'aiduino.switchLanguage', handler: switchLanguage },
        { name: 'aiduino.explainCode', handler: explainCode },
        { name: 'aiduino.improveCode', handler: improveCode },
        { name: 'aiduino.addComments', handler: addComments },
        { name: 'aiduino.explainError', handler: explainError },
        { name: 'aiduino.debugHelp', handler: debugHelp },
        { name: 'aiduino.showTokenStats', handler: showTokenStats },
        { name: 'aiduino.about', handler: showAbout },
        { name: 'aiduino.resetTokenStats', handler: resetTokenStats },
        { name: 'aiduino.askAI', handler: () => askAI(false) },           // Regular question
        { name: 'aiduino.askFollowUp', handler: () => askAI(true) },      // Follow-up question
        { name: 'aiduino.clearAIContext', handler: clearAIContext }       // Clear context (optional)
    ];
    
    commands.forEach(cmd => {
        context.subscriptions.push(
            vscode.commands.registerCommand(cmd.name, cmd.handler)
        );
    });
    
    context.subscriptions.push(statusBarItem);
}

async function switchLanguage() {
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.SWITCH_LANGUAGE)) {
        vscode.window.showInformationMessage("Language switch is already running! Please wait...");
        return;
    }
    
    try {
        const supportedLocales = getAvailableLocales();
        const availableLanguages = [
            { 
                label: '🌐 Auto (VS Code)', 
                description: t('language.autoDetect') || 'Auto-detect from VS Code', 
                value: 'auto' 
            }
        ];
        
        supportedLocales.forEach(locale => {
            const info = getLanguageInfo(locale);
            availableLanguages.push({
                label: `${info.flag} ${info.name}`,
                description: info.region,
                value: locale
            });
        });
        
        const config = vscode.workspace.getConfiguration('aiduino');
        const currentSetting = config.get('language', 'auto');
        
        let activeValue = currentSetting === 'auto' ? 'auto' : currentLocale;
        
        availableLanguages.forEach(lang => {
            if (lang.value === activeValue) {
                if (activeValue === 'auto') {
                    const info = getLanguageInfo(currentLocale);
                    lang.description = `✓ Currently using ${info.region}`;
                } else {
                    lang.description = `✓ ${lang.description}`;
                }
            }
        });
        
        const selected = await vscode.window.showQuickPick(availableLanguages, {
            placeHolder: t('language.selectLanguage') || 'Choose language for AI.duino',
            title: `🌐 AI.duino ${t('language.changeLanguage') || 'Change Language'}`
        });
        
        if (selected && selected.value !== activeValue) {
            try {
                await config.update('language', selected.value, vscode.ConfigurationTarget.Global);
                
                if (selected.value === 'auto') {
                    const vscodeLocale = vscode.env.language || 'en';
                    const detectedLang = vscodeLocale.substring(0, 2);
                    currentLocale = supportedLocales.includes(detectedLang) ? detectedLang : 'en';
                } else {
                    currentLocale = selected.value;
                }
                
                // Load new locale file
                const localeFile = path.join(__dirname, '..', 'locales', `${currentLocale}.json`);
                if (fs.existsSync(localeFile)) {
                    const content = fs.readFileSync(localeFile, 'utf8');
                    i18n = JSON.parse(content);
                } else {
                    currentLocale = 'en';
                    const englishFile = path.join(__dirname, '..', 'locales', 'en.json');
                    if (fs.existsSync(englishFile)) {
                        const content = fs.readFileSync(englishFile, 'utf8');
                        i18n = JSON.parse(content);
                    }
                }
                
                updateStatusBar();
                
                let successMessage;
                if (selected.value === 'auto') {
                    const info = getLanguageInfo(currentLocale);
                    successMessage = t('language.changed', `Auto (${info.name})`) || 
                                    `Language set to Auto (${info.name})`;
                } else {
                    const info = getLanguageInfo(currentLocale);
                    successMessage = t('language.changed', info.name) || 
                                    `Language changed to ${info.name}`;
                }
                
                vscode.window.showInformationMessage(successMessage);
                
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to switch language: ${error.message}`);
            }
        }
    } finally {
        // Always cleanup
        executionStates.stop('switchLanguage');
    }
}

function getCurrentLanguageName() {
    const config = vscode.workspace.getConfiguration('aiduino');
    const currentSetting = config.get('language', 'auto');
    const info = getLanguageInfo(currentLocale); 
    
    if (currentSetting === 'auto') {
        return `Auto (${info.name})`;
    }
    
    return info.name;
}


function initializeTokenUsage() {
    tokenUsage = {
        daily: new Date().toDateString()
    };
    
    // Initialize for each model
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        tokenUsage[modelId] = { input: 0, output: 0, cost: 0 };
    });
}

function shouldShowWelcome() {
    return Object.keys(minimalModelManager.providers).every(modelId => !apiKeys[modelId]);
}

// Configuration management
function loadApiKeys() {
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        const model = minimalModelManager.providers[modelId];
        const keyFile = path.join(os.homedir(), model.keyFile);
        
        try {
            if (fs.existsSync(keyFile)) {
                apiKeys[modelId] = fs.readFileSync(keyFile, 'utf8').trim();
            }
        } catch (error) {
            console.log(`❌ Error loading ${model.name} API Key:`, error);
        }
    });
}

function loadSelectedModel() {
    try {
        if (fs.existsSync(MODEL_FILE)) {
            const savedModel = fs.readFileSync(MODEL_FILE, 'utf8').trim();
            if (minimalModelManager.providers[savedModel]) {
                currentModel = savedModel;
            }
        }
    } catch (error) {
        // Silent
    }
}

function saveSelectedModel() {
    try {
        fs.writeFileSync(MODEL_FILE, currentModel, { mode: 0o600 });
    } catch (error) {
        console.log('❌ Error saving model:', error);
    }
}

// Token management
function loadTokenUsage() {
    try {
        const currentDate = new Date();
        const today = currentDate.toDateString();
        
        // Check if file exists and is readable
        if (!fs.existsSync(TOKEN_USAGE_FILE)) {
            initializeTokenUsage();
            saveTokenUsage();
            return;
        }
        
        let fileContent;
        try {
            fileContent = fs.readFileSync(TOKEN_USAGE_FILE, 'utf8');
        } catch (readError) {
            // File might be corrupted, reinitialize
            initializeTokenUsage();
            saveTokenUsage();
            return;
        }
        
        // Validate JSON
        let data;
        try {
            data = JSON.parse(fileContent);
        } catch (parseError) {
            // Corrupted JSON, reinitialize
            initializeTokenUsage();
            saveTokenUsage();
            return;
        }
        
        // Validate data structure
        if (!data || typeof data !== 'object' || !data.daily) {
            initializeTokenUsage();
            saveTokenUsage();
            return;
        }
        
        // Check if it's the same day
        if (data.daily === today) {
            // Same day - restore data
            tokenUsage = data;
            
            // Ensure all models exist in loaded data
            Object.keys(minimalModelManager.providers).forEach(modelId => {
                if (!tokenUsage[modelId]) {
                    tokenUsage[modelId] = { input: 0, output: 0, cost: 0 };
                }
            });
        } else {
            // Different day - reset
            initializeTokenUsage();
            saveTokenUsage();
        }
        
        // Update status bar after loading
        if (statusBarItem) {
            updateStatusBar();
        }
        
    } catch (error) {
        // Start with empty values on error
        initializeTokenUsage();
        saveTokenUsage();
    }
}

function saveTokenUsage() {
    // Add to queue
    if (!tokenSaveQueue.includes('save')) {
        tokenSaveQueue.push('save');
    }
    
    // Debounced save
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
        processSaveQueue();
    }, 500); // 500ms delay - more stable
}

function processSaveQueue() {
    if (tokenFileLock || tokenSaveQueue.length === 0) {
        return; // Already saving or nothing to save
    }
    
    tokenFileLock = true;
    tokenSaveQueue = []; // Clear queue
    
    try {
        const data = JSON.stringify(tokenUsage, null, 2);
        
        // Windows-compatible atomic write
        if (process.platform === 'win32') {
            // Windows: Direct overwrite (backup strategy)
            const backupFile = TOKEN_USAGE_FILE + '.backup';
            
            // Create backup if original exists
            if (fs.existsSync(TOKEN_USAGE_FILE)) {
                try {
                    fs.copyFileSync(TOKEN_USAGE_FILE, backupFile);
                } catch (backupError) {
                    // Backup failed, but continue trying
                }
            }
            
            // Write new file
            fs.writeFileSync(TOKEN_USAGE_FILE, data, { mode: 0o600 });
            
            // Remove backup on success
            try {
                if (fs.existsSync(backupFile)) {
                    fs.unlinkSync(backupFile);
                }
            } catch (cleanupError) {
                // Backup cleanup failed - not critical
            }
            
        } else {
            // Unix/Linux: Atomic rename-Strategie
            const tempFile = TOKEN_USAGE_FILE + '.tmp';
            
            // Write to temp file first
            fs.writeFileSync(tempFile, data, { mode: 0o600 });
            
            // Atomic rename (this is atomic on most Unix filesystems)
            fs.renameSync(tempFile, TOKEN_USAGE_FILE);
        }
        
    } catch (error) {
        // Fallback: Try direct write
        try {
            const data = JSON.stringify(tokenUsage, null, 2);
            fs.writeFileSync(TOKEN_USAGE_FILE, data, { mode: 0o600 });
        } catch (fallbackError) {
            // Last fallback: Keep in-memory, silent fail
            // Token usage will be lost but extension continues working
        }
        
        // Cleanup temp files on error
        const possibleTempFiles = [
            TOKEN_USAGE_FILE + '.tmp',
            TOKEN_USAGE_FILE + '.backup'
        ];
        
        possibleTempFiles.forEach(tempFile => {
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (cleanupError) {
                // Silent cleanup error
            }
        });
        
    } finally {
        tokenFileLock = false;
        saveTimeout = null;
        
        // Process remaining queue items (in case more were added during save)
        if (tokenSaveQueue.length > 0) {
            // Slight delay to avoid rapid successive saves
            setTimeout(() => processSaveQueue(), 100);
        }
    }
}

function estimateTokens(text) {
    if (!text) return 0;
    
    // Better estimation for code vs text
    const words = text.split(/\s+/).length;
    const codeBlocks = (text.match(/```/g) || []).length / 2;
    const specialChars = (text.match(/[{}()\[\];,.<>]/g) || []).length;
    
    // Base: ~0.75 words per token (more accurate than character count)
    let tokens = words * 0.75;
    tokens += codeBlocks * 10;   // Code blocks need more tokens
    tokens += specialChars * 0.2; // Syntax characters
    
    return Math.ceil(tokens);
}

function updateTokenUsage(modelId, inputText, outputText) {
    const inputTokens = estimateTokens(inputText);
    const outputTokens = estimateTokens(outputText);
    
    tokenUsage[modelId].input += inputTokens;
    tokenUsage[modelId].output += outputTokens;
    
    // Calculate costs
    const model = minimalModelManager.providers[modelId];
    if (!model) return;
    const inputCost = inputTokens * model.prices.input;
    const outputCost = outputTokens * model.prices.output;
    tokenUsage[modelId].cost += (inputCost + outputCost);
    
    saveTokenUsage();
    updateStatusBar();
}


// UI functions
function updateStatusBar() {
    const providerInfo = minimalModelManager.getProviderInfo(currentModel);
    const hasApiKey = providerInfo.hasApiKey;
    
    // Token-Kosten (bestehende Logik)
    const todayCost = tokenUsage[currentModel]?.cost.toFixed(3) || '0.000';
    const costDisplay = todayCost > 0 ? ` (${todayCost})` : '';
    
    if (hasApiKey) {
        statusBarItem.text = `${providerInfo.icon} AI.duino${costDisplay}`;
        
        // Fixed: Proper model status without t() function calls
        const modelStatus = providerInfo.isLatest ? 
            `Latest: ${providerInfo.modelName}` :
            `Fallback: ${providerInfo.modelName}`;
            
        statusBarItem.tooltip = 
            `${providerInfo.name} - ${modelStatus}\n` +
            `Tokens: ${(tokenUsage[currentModel]?.input || 0) + (tokenUsage[currentModel]?.output || 0)}${costDisplay}\n` +
            `Input: ${tokenUsage[currentModel]?.input || 0} | Output: ${tokenUsage[currentModel]?.output || 0}`;
            
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = `${providerInfo.icon} AI.duino $(warning)`;
        statusBarItem.tooltip = `No API key for ${providerInfo.name}`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

// Menu functions
async function showWelcomeMessage() {
    const modelList = Object.keys(minimalModelManager.providers).map(m => m.name).join(', ');
    const message = t('messages.welcome', modelList);
    const choice = await vscode.window.showInformationMessage(
        message,
        t('buttons.chooseModel'),
        t('buttons.later')
    );
    
    if (choice === t('buttons.chooseModel')) {
        await switchModel();
    }
}

async function showQuickMenu() {
    const model = minimalModelManager.providers[currentModel];
    const hasApiKey = apiKeys[currentModel];
    const board = detectArduinoBoard();
    const boardDisplay = getBoardDisplayName(board);  // Use short name
    
    if (!hasApiKey) {
        const choice = await vscode.window.showWarningMessage(
            t('messages.noApiKey', model.name),
            t('buttons.setupNow'),
            t('buttons.switchModel'),
            t('buttons.cancel')
        );
        if (choice === t('buttons.setupNow')) {
            await setApiKey();
        } else if (choice === t('buttons.switchModel')) {
            await switchModel();
        }
        return;
    }
    
    const editor = vscode.window.activeTextEditor;
    const hasSelection = editor && !editor.selection.isEmpty;
    // const hasErrors = await checkForErrors(false); 
    
    const items = [
        {
            label: '$(symbol-method) ' + t('commands.improveCode'),
            description: hasSelection ? t('descriptions.improveSelected') : t('descriptions.selectFirst'),
            command: 'aiduino.improveCode'
        },
        {
            label: '$(comment-discussion) ' + t('commands.explainCode'),
            description: hasSelection ? t('descriptions.explainSelected') : t('descriptions.selectFirst'),
            command: 'aiduino.explainCode'
        },
        {
            label: '$(edit) ' + t('commands.addComments'),
            description: hasSelection ? t('descriptions.addComments') : t('descriptions.selectFirst'),
            command: 'aiduino.addComments'
        },
        {
            label: '$(error) ' + t('commands.explainError'),
            description: t('descriptions.noErrors'),  
            command: 'aiduino.explainError'
        },
        {
            label: '$(bug) ' + t('commands.debugHelp'),
            description: t('descriptions.debugHelp'),
            command: 'aiduino.debugHelp'
        },
        {
            label: '$(comment-discussion) ' + t('commands.askAI'),
            description: t('descriptions.askAI'),
            command: 'aiduino.askAI'
        },
        ...(hasValidContext() ? [{
            label: '$(arrow-right) ' + t('commands.askFollowUp'),
            description: t('descriptions.askFollowUp', formatQuestionPreview(aiConversationContext.lastQuestion)),
            command: 'aiduino.askFollowUp'
        }] : []),
        {
            label: '$(globe) ' + t('commands.switchLanguage'),
            description: t('descriptions.currentLanguage', getCurrentLanguageName()),
            command: 'aiduino.switchLanguage'
        },
        {
            label: '$(sync) ' + t('commands.switchModel'),
            description: t('descriptions.currentModel', model.name),
            command: 'aiduino.switchModel'
        },
        {
            label: '$(circuit-board) Board',
            description: boardDisplay,
            command: null  // Not clickable, just info
        },
        {
            label: '$(key) ' + t('commands.changeApiKey'),
            description: model.name + ' Key',
            command: 'aiduino.setApiKey'
        },
        {
            label: '$(graph) ' + t('commands.tokenStats'),
            description: 'Token-Statistik', 
            command: 'aiduino.showTokenStats'
        },
        {
            label: '$(info) ' + t('commands.about'),
            description: `Version ${EXTENSION_VERSION}`, 
            command: 'aiduino.about'
        }
    ];
    
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: t('messages.selectAction'),
        title: `🤖 AI.duino v${EXTENSION_VERSION} (${model.name})`
    });
    
    if (selected && selected.command) {
        vscode.commands.executeCommand(selected.command);
    }
}

// Check if context is available and valid
function hasValidContext() {
    if (!aiConversationContext.lastQuestion || !aiConversationContext.timestamp) {
        return false;
    }
    
    const contextAge = Date.now() - aiConversationContext.timestamp;
    return contextAge < 30 * 60 * 1000; // 30 minutes
}

// Format question preview for menu
function formatQuestionPreview(question) {
    if (!question) return '';
    const preview = question.length > 40 ? question.substring(0, 40) + '...' : question;
    const contextAge = Math.round((Date.now() - aiConversationContext.timestamp) / 60000);
    return `"${preview}" (${contextAge}min ago)`;
}

// Clear conversation context
function clearAIContext() {
    aiConversationContext = {
        lastQuestion: null,
        lastAnswer: null,
        lastCode: null,
        timestamp: null
    };
    vscode.window.showInformationMessage(t('messages.contextCleared'));
}

// Get today's usage for menu
function getTodayUsage() {
    const usage = tokenUsage[currentModel];
    const totalTokens = usage.input + usage.output;
    return totalTokens > 0 ? `${totalTokens} tokens ($${usage.cost.toFixed(3)})` : '0 tokens';
}


// Model management
async function switchModel() {
    if (!executionStates.start(executionStates.OPERATIONS.SWITCH_MODEL)) {
        vscode.window.showInformationMessage("Model switch is already running! Please wait...");
        return;
    }
    
    try {
        const items = Object.keys(minimalModelManager.providers).map(modelId => {
            const provider = minimalModelManager.providers[modelId];
            const currentModel = minimalModelManager.getCurrentModel(modelId);
            return {
                label: `${provider.icon} ${provider.name}`,
                description: currentModel === modelId ? '✓ ' + t('labels.active') : currentModel.name,
                value: modelId
            };
        });
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: t('messages.selectModel')
        });
        
        if (selected) {
            currentModel = selected.value;
            saveSelectedModel();
            updateStatusBar();
            
            if (!minimalModelManager.getProviderInfo(currentModel).hasApiKey) {
                const provider = minimalModelManager.providers[currentModel];
                const choice = await vscode.window.showWarningMessage(
                    t('messages.apiKeyRequired', provider.name),
                    t('buttons.enterNow'),
                    t('buttons.later')
                );
                if (choice === t('buttons.enterNow')) {
                    // Don't await setApiKey to avoid blocking the execution state
                    setApiKey();
                }
            } else {
                const provider = minimalModelManager.providers[currentModel];
                vscode.window.showInformationMessage(t('messages.modelSwitched', provider.name));
            }
        }
    } finally {
        // Always cleanup execution state
        executionStates.stop(executionStates.OPERATIONS.SWITCH_MODEL);
    }
}

async function setApiKey() {
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.SET_API_KEY)) {
        vscode.window.showInformationMessage("API Key setup is already running! Please wait...");
        return false;
    }
    
    try {
        const model = AI_MODELS[currentModel];
        const providerName = getProviderName(currentModel);
        
        const input = await vscode.window.showInputBox({
            prompt: t('prompts.enterApiKey', providerName),
            placeHolder: model.keyPrefix + '...',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value) return t('validation.apiKeyRequired');
                if (!value.startsWith(model.keyPrefix)) return t('validation.apiKeyPrefix', model.keyPrefix);
                if (value.length < model.keyMinLength) return t('validation.apiKeyTooShort');
                return null;
            }
        });
        
        if (input) {
            try {
                const keyFile = path.join(os.homedir(), model.keyFile);
                apiKeys[currentModel] = input;
                fs.writeFileSync(keyFile, input, { mode: 0o600 });
                updateStatusBar();
                vscode.window.showInformationMessage(
                    t('messages.apiKeySaved', providerName)
                );
                return true;
            } catch (error) {
                vscode.window.showErrorMessage(
                    t('errors.saveFailed', error.message)
                );
                return false;
            }
        }
        return false;
    } finally {
        // Always cleanup
        executionStates.stop('setApiKey');
    }
}

function getProviderName(modelId) {
    return minimalModelManager.providers[modelId]?.name || 'Unknown';
}

function handleApiError(error) {
    const model = AI_MODELS[currentModel];

    // Add model context to all errors if not present
    if (!error.message.includes(model.name)) {
        error.message = `${model.name}: ${error.message}`;
    }
    
    // Use error types for enhanced errors (from enhanceError function)
    if (error.type === 'API_KEY_ERROR') {
        vscode.window.showErrorMessage(
            error.message,  // Already translated by enhanceError()
            t('buttons.enterApiKey'),
            t('buttons.getApiKey'),
            t('buttons.switchModel')
        ).then(selection => {
            if (selection === t('buttons.enterApiKey')) {
                vscode.commands.executeCommand('aiduino.setApiKey');
            } else if (selection === t('buttons.getApiKey')) {
                openApiKeyUrl(currentModel);
            } else if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            }
        });
        return;
    }
    
    // Rate Limiting with token stats
    if (error.type === 'RATE_LIMIT_ERROR') {
        vscode.window.showErrorMessage(
            error.message,  // Already translated
            t('buttons.switchModel'),
            t('buttons.tryLater'),
            t('buttons.showTokenStats')
        ).then(selection => {
            if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            } else if (selection === t('buttons.showTokenStats')) {
                vscode.commands.executeCommand('aiduino.showTokenStats');
            }
        });
        return;
    }
    
    // Server Errors with status page links
    if (error.type === 'SERVER_ERROR') {
        vscode.window.showErrorMessage(
            error.message,  // Already translated
            t('buttons.tryAgain'),
            t('buttons.switchModel'),
            t('buttons.checkStatus')
        ).then(selection => {
            if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            } else if (selection === t('buttons.checkStatus')) {
                openServiceStatusUrl(currentModel);
            }
        });
        return;
    }
    
    // Network Errors (original messages, not enhanced)
    if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT') || 
        error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET') ||
        error.message.includes('EHOSTUNREACH') || error.message.includes('ENETUNREACH') ||
        error.message.includes('ECONNABORTED')) {
        
        vscode.window.showErrorMessage(
            t('errors.noInternet'),
            t('buttons.retry'),
            t('buttons.offlineHelp'),
            t('buttons.checkConnection')
        ).then(selection => {
            if (selection === t('buttons.retry')) {
                vscode.window.showInformationMessage(t('messages.retryLater'));
            } else if (selection === t('buttons.offlineHelp')) {
                showOfflineHelp();
            } else if (selection === t('buttons.checkConnection')) {
                testNetworkConnectivity();
            }
        });
        return;
    }
    
    // Fallback for original API errors that weren't enhanced
    if (error.message.includes('Invalid API Key') || error.message.includes('401') || 
        error.message.includes('403') || error.message.includes('Unauthorized')) {
        
        vscode.window.showErrorMessage(
            `🔑 ${t('errors.invalidApiKey', model.name)}`,
            t('buttons.enterApiKey'),
            t('buttons.getApiKey'),
            t('buttons.switchModel')
        ).then(selection => {
            if (selection === t('buttons.enterApiKey')) {
                vscode.commands.executeCommand('aiduino.setApiKey');
            } else if (selection === t('buttons.getApiKey')) {
                openApiKeyUrl(currentModel);
            } else if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            }
        });
        return;
    }
    
    // Fallback for original rate limit errors
    if (error.message.includes('Rate Limit') || error.message.includes('429')) {
        vscode.window.showErrorMessage(
            t('errors.rateLimit', model.name),
            t('buttons.switchModel'),
            t('buttons.tryLater'),
            t('buttons.showTokenStats')
        ).then(selection => {
            if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            } else if (selection === t('buttons.showTokenStats')) {
                vscode.commands.executeCommand('aiduino.showTokenStats');
            }
        });
        return;
    }
    
    // Fallback for original server errors
    if (error.message.includes('500') || error.message.includes('502') || 
        error.message.includes('503') || error.message.includes('504') ||
        error.message.includes('Server Error') || error.message.includes('Service Unavailable')) {
        
        vscode.window.showErrorMessage(
            t('errors.serverUnavailable', model.name),
            t('buttons.tryAgain'),
            t('buttons.switchModel'),
            t('buttons.checkStatus')
        ).then(selection => {
            if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            } else if (selection === t('buttons.checkStatus')) {
                openServiceStatusUrl(currentModel);
            }
        });
        return;
    }
    
    // Generic error fallback
    vscode.window.showErrorMessage(
        `${model.name}: ${error.message}`,
        t('buttons.retry'),
        t('buttons.switchModel')
    ).then(selection => {
        if (selection === t('buttons.switchModel')) {
            vscode.commands.executeCommand('aiduino.switchModel');
        }
    });
}

function openApiKeyUrl(modelId) {
    const urls = {
        claude: 'https://console.anthropic.com/api-keys',
        chatgpt: 'https://platform.openai.com/api-keys',
        gemini: 'https://makersuite.google.com/app/apikey',
        mistral: 'https://console.mistral.ai/',
        groq: 'https://console.groq.com/keys',
        perplexity: 'https://www.perplexity.ai/settings/api',
        cohere: 'https://dashboard.cohere.ai/api-keys'
    };
    
    const url = urls[modelId];
    if (url) {
        vscode.env.openExternal(vscode.Uri.parse(url));
    } else {
        vscode.window.showWarningMessage(`No API key URL configured for ${modelId}`);
    }
}

// Open service status page for the current model
function openServiceStatusUrl(modelId) {
    const urls = {
        claude: 'https://status.anthropic.com/',
        chatgpt: 'https://status.openai.com/',
        gemini: 'https://status.cloud.google.com/',
        mistral: 'https://status.mistral.ai/',
        groq: 'https://status.groq.com/',
        perplexity: 'https://status.perplexity.ai/',
        cohere: 'https://status.cohere.ai/'
    };
    
    const url = urls[modelId];
    if (url) {
        vscode.env.openExternal(vscode.Uri.parse(url));
    } else {
        // FIX: Verwende minimalModelManager statt AI_MODELS
        const providerName = minimalModelManager.providers[modelId]?.name || 'Unknown Provider';
        vscode.window.showInformationMessage(t('messages.noStatusPage', providerName));
    }
}

// Test basic network connectivity
async function testNetworkConnectivity() {
    const testUrls = [
        'google.com',
        'github.com',
        'cloudflare.com'
    ];
    
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: t('progress.testingConnection'),
        cancellable: false
    }, async () => {
        let connectionWorks = false;
        
        for (const testUrl of testUrls) {
            try {
                // Simple DNS lookup test
                const dns = require('dns');
                await new Promise((resolve, reject) => {
                    dns.lookup(testUrl, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                connectionWorks = true;
                break;
            } catch (error) {
                continue;
            }
        }
        
        if (connectionWorks) {
            vscode.window.showInformationMessage(
                t('messages.connectionOk'),
                t('buttons.checkFirewall')
            ).then(selection => {
                if (selection === t('buttons.checkFirewall')) {
                    showFirewallHelp();
                }
            });
        } else {
            vscode.window.showErrorMessage(
                t('messages.noConnection'),
                t('buttons.checkRouter'),
                t('buttons.offlineHelp')
            ).then(selection => {
                if (selection === t('buttons.offlineHelp')) {
                    showOfflineHelp();
                }
            });
        }
    });
}

// Get hostname for current model
function getModelHostname(modelId) {
    return minimalModelManager.providers[modelId]?.hostname || 'unknown';
}

// Error diagnosis
async function checkForErrors(silent = true) {
    const now = Date.now();
    
    // Throttling
    if (now - lastErrorCheck < 500) {
        return false;
    }
    lastErrorCheck = now;
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return false;
    }
    
    // Only.ino for better performance
    if (!editor.document.fileName.endsWith('.ino')) {
        return false;
    }
    
    const currentUri = editor.document.uri.toString();
    
    if (currentUri !== lastCheckedUri) {
        lastCheckedUri = currentUri;
        lastDiagnosticsCount = 0; // Reset count for new file
    }
    
    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
    const errorCount = errors.length;
    
    if (errorCount !== lastDiagnosticsCount) {
        lastDiagnosticsCount = errorCount;
        
        if (errorCount > 0 && !silent) {
            const model = AI_MODELS[currentModel];
            statusBarItem.text = `${model.icon} AI.duino $(error)`;
            statusBarItem.tooltip = t('statusBar.errorsFound', errorCount);
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            
            setTimeout(() => {
                const currentDiagnostics = vscode.languages.getDiagnostics(editor.document.uri);
                const currentErrors = currentDiagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
                
                if (currentErrors.length === 0) {
                    updateStatusBar();
                }
            }, 5000);
        } else if (errorCount === 0 && lastDiagnosticsCount > 0) {
            updateStatusBar();
        }
    }
    
    return errorCount > 0;
}

// Unified API client
class UnifiedAPIClient {
    constructor() {
        this.timeout = 30000; // 30 seconds
        this.maxRetries = 3;
    }

    async callAPI(modelId, prompt) {
    if (!apiKeys[modelId]) {
        // FIX: Verwende minimalModelManager statt AI_MODELS
        const providerName = minimalModelManager.providers[modelId]?.name || 'Unknown Provider';
        throw new Error(t('errors.noApiKey', providerName));
    }

        const config = this.getModelConfig(modelId, prompt);
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this.makeRequest(config);
                const extractedResponse = this.extractResponse(modelId, response);
                
                // Token usage tracking
                updateTokenUsage(modelId, prompt, extractedResponse);
                
                return extractedResponse;
            } catch (error) {
                if (attempt === this.maxRetries || !this.isRetryableError(error)) {
                    throw this.enhanceError(modelId, error);
                }
                
                // Exponential backoff for retries
                await this.delay(1000 * attempt);
            }
        }
    }

    getModelConfig(modelId, prompt) {
        // NEW: Use latest detected model
        const currentModel = minimalModelManager.getCurrentModel(modelId);
        const provider = minimalModelManager.providers[modelId];
        
        if (!provider) {
            throw new Error(`Unknown provider: ${modelId}`);
        }

        // Existing configurations, but with dynamic model
        const configs = {
            claude: {
                hostname: 'api.anthropic.com',
                path: '/v1/messages',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKeys.claude,
                    'anthropic-version': '2023-06-01'
                },
                body: {
                    model: currentModel.id, // NEW: Dynamic model
                    max_tokens: 2000,
                    messages: [{ role: "user", content: prompt }]
                }
            },
            
            chatgpt: {
                hostname: 'api.openai.com',
                path: '/v1/chat/completions',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeys.chatgpt}`
                },
                body: {
                    model: currentModel.id, // NEW: Dynamic model
                    messages: [
                        { role: "system", content: t('prompts.systemPrompt') },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 2000,
                    temperature: 0.7
                }
            },
            
            gemini: {
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/${currentModel.id}:generateContent?key=${apiKeys.gemini}`, // NEW: Dynamic model
                headers: {
                    'Content-Type': 'application/json'
                },
                body: {
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 1,
                        topP: 1,
                        maxOutputTokens: 2048,
                    },
                    safetySettings: this.getGeminiSafetySettings()
                }
            },
            
            mistral: {
                hostname: 'api.mistral.ai',
                path: '/v1/chat/completions',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeys.mistral}`
                },
                body: {
                    model: currentModel.id, // NEW: Dynamic model
                    messages: [
                        { role: "system", content: t('prompts.systemPrompt') },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 2000,
                    temperature: 0.7
                }
            },

            perplexity: {
                hostname: 'api.perplexity.ai',
                path: '/chat/completions',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeys.perplexity}`
                },
                body: {
                    model: currentModel.id,
                    messages: [
                        { role: "system", content: t('prompts.systemPrompt') },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 2000,
                    temperature: 0.7
                }
            },

            cohere: {
                hostname: 'api.cohere.ai',
                path: '/v1/chat',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeys.cohere}`
                },
                body: {
                    model: currentModel.id,
                    message: prompt,
                    max_tokens: 2000,
                    temperature: 0.7
                }
            },

            groq: {
                hostname: 'api.groq.com',
                path: '/openai/v1/chat/completions',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeys.groq}`
                },
                body: {
                    model: currentModel.id,
                    messages: [
                        { role: "system", content: t('prompts.systemPrompt') },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 2000,
                    temperature: 0.7
                }
            }
        };

        return configs[modelId];
    }

    async makeRequest(config) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(config.body);
            
            const options = {
                hostname: config.hostname,
                port: 443,
                path: config.path,
                method: 'POST',
                headers: {
                    ...config.headers,
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            // Timeout handling
            const timeout = setTimeout(() => {
                req.destroy();
                reject(new Error(t('errors.timeout')));
            }, this.timeout);

            const req = https.request(options, (res) => {
                clearTimeout(timeout);
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(responseData);
                        
                        if (res.statusCode === 200) {
                            resolve(parsedData);
                        } else {
                            reject(this.createHttpError(res.statusCode, parsedData));
                        }
                    } catch (e) {
                        reject(new Error('JSON Parse Error: ' + e.message));
                    }
                });
            });

            req.on('error', (e) => {
                clearTimeout(timeout);
                reject(this.handleNetworkError(e));
            });

            req.write(data);
            req.end();
        });
    }

    extractResponse(modelId, responseData) {
        const extractors = {
            claude: (data) => data.content[0].text,
            chatgpt: (data) => data.choices[0].message.content,
            gemini: (data) => {
                if (data.candidates && data.candidates[0] && 
                    data.candidates[0].content && 
                    data.candidates[0].content.parts && 
                    data.candidates[0].content.parts[0]) {
                    return data.candidates[0].content.parts[0].text;
                }
                throw new Error('Unexpected response format from Gemini');
            },
            mistral: (data) => data.choices[0].message.content,
            groq: (data) => data.choices[0].message.content,
            perplexity: (data) => data.choices[0].message.content,
            cohere: (data) => data.text || data.message || data.choices[0].message.content
        };

        const extractor = extractors[modelId];
        if (!extractor) {
            throw new Error(`Unknown model: ${modelId}`);
        }

        return extractor(responseData);
    }

    getGeminiSafetySettings() {
        return [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
        ];
    }

    createHttpError(statusCode, responseData) {
        const errorMessages = {
            401: 'Invalid API Key',
            403: 'Access Forbidden',
            429: 'Rate Limit Exceeded',
            500: 'Internal Server Error',
            502: 'Bad Gateway',
            503: 'Service Unavailable'
        };

        const message = errorMessages[statusCode] || 'Unknown HTTP Error';
        const details = responseData.error?.message || responseData.message || 'No details available';
        
        return new Error(`${message} (${statusCode}): ${details}`);
    }

    handleNetworkError(error) {
        const errorMessages = {
            'ENOTFOUND': t('errors.network.dns'),
            'ETIMEDOUT': t('errors.network.timeout'),
            'ECONNREFUSED': t('errors.network.refused'),
            'ECONNRESET': t('errors.network.reset'),
            'EHOSTUNREACH': t('errors.network.hostUnreachable'),
            'ENETUNREACH': t('errors.network.netUnreachable'),
            'ECONNABORTED': t('errors.network.aborted')
        };
        
        const message = errorMessages[error.code] || t('errors.network.general', error.message);
        return new Error(message);
    }

    enhanceError(modelId, error) {
    const modelName = minimalModelManager.providers[modelId]?.name || 'Unknown Provider';
    
    // Add model context to error WITH error types
    if (error.message.includes('Invalid API Key')) {
        const enhancedError = new Error(t('errors.invalidApiKey', modelName));
        enhancedError.type = 'API_KEY_ERROR';  
        return enhancedError;
    } else if (error.message.includes('Rate Limit')) {
        const enhancedError = new Error(t('errors.rateLimit', modelName));
        enhancedError.type = 'RATE_LIMIT_ERROR'; 
        return enhancedError;
    } else if (error.message.includes('Server Error') || error.message.includes('Service Unavailable')) {
        const enhancedError = new Error(t('errors.serverUnavailable', modelName));
        enhancedError.type = 'SERVER_ERROR';  
        return enhancedError;
    }
    
    return new Error(`${modelName}: ${error.message}`);
}

    isRetryableError(error) {
        // Retry on network errors and temporary server issues
        return error.message.includes('timeout') ||
               error.message.includes('ECONNRESET') ||
               error.message.includes('ECONNREFUSED') ||
               error.message.includes('Service Unavailable') ||
               error.message.includes('502') ||
               error.message.includes('503');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const apiClient = new UnifiedAPIClient();

function callAI(prompt) {   
    return apiClient.callAPI(currentModel, prompt);
}

// Network error handling
function handleNetworkError(error) {
    const errorMessages = {
        'ENOTFOUND': t('errors.network.dns'),
        'ETIMEDOUT': t('errors.network.timeout'),
        'ECONNREFUSED': t('errors.network.refused'),
        'ECONNRESET': t('errors.network.reset'),
        'EHOSTUNREACH': t('errors.network.hostUnreachable'),
        'ENETUNREACH': t('errors.network.netUnreachable'),
        'ECONNABORTED': t('errors.network.aborted')
    };
    
    const message = errorMessages[error.code] || t('errors.network.general', error.message);
    return new Error(message);
}

// Explain Code
async function explainCode() {
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.EXPLAIN)) {
        vscode.window.showInformationMessage("Code Explanation is already running! Please wait...");
        return;
    }
    
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage(t('messages.noEditor'));
            return;
        }
        
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (!selectedText.trim()) {
            vscode.window.showWarningMessage(t('messages.selectCodeToExplain'));
            return;
        }
        
        const prompt = t('prompts.explainCode', selectedText) + getBoardContext();
        const model = minimalModelManager.providers[currentModel];
        
        let response;
        try {
            response = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: t('progress.explaining', model.name),
                cancellable: false
            }, async () => {
                const result = await callAI(prompt);
                return result;
            });
        } catch (progressError) {
            throw progressError;
        }
        
        // Wrap long lines
        const wrappedResponse = response.split('\n').map(line => 
            line.length > 80 ? wrapText(line, 80) : line
        ).join('\n');
        
        // Create formatted content
        const formattedContent = [
            `🤖 ${t('output.explanationFrom', model.name.toUpperCase())}`,
            '='.repeat(50),
            '',
            wrappedResponse
        ].join('\n');
        
        // Create and show document
        try {
            const doc = await vscode.workspace.openTextDocument({
                content: formattedContent,
                language: 'markdown'
            });
        
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside); 
        } catch (docError) {
            vscode.window.showErrorMessage('Failed to create document: ' + docError.message);
        }     
    } catch (error) {
        handleApiError(error);
    } finally {
        executionStates.stop(executionStates.OPERATIONS.EXPLAIN);
    }
}
    
// Improve Code
async function improveCode() {
    if (!executionStates.start(executionStates.OPERATIONS.IMPROVE)) {
        vscode.window.showInformationMessage("Code Improvement is already running! Please wait...");
        return;
    }
    
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage(t('messages.noEditor'));
            return;
        }
        
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (!selectedText.trim()) {
            vscode.window.showWarningMessage(t('messages.selectCodeToImprove'));
            return;
        }
        
        const savedInstructions = globalContext.globalState.get('aiduino.customInstructions', '');
        
        const customInstructions = await vscode.window.showInputBox({
            prompt: t('prompts.customInstructions'),
            placeHolder: t('placeholders.customInstructions'),
            value: savedInstructions,
            ignoreFocusOut: true
        });
        
        if (customInstructions === undefined) {
            return;
        }
        
        globalContext.globalState.update('aiduino.customInstructions', customInstructions);
        
        let prompt = t('prompts.improveCode', selectedText) + getBoardContext();
        
        if (customInstructions && customInstructions.trim()) {
            const instructions = customInstructions.split(',').map(s => s.trim()).join('\n- ');
            prompt += '\n\n' + t('prompts.additionalInstructions', instructions);
        }
        
        prompt += '\n\n' + t('prompts.improveCodeSuffix');
        
        const model = minimalModelManager.providers[currentModel];
        
        const response = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: t('progress.optimizing', model.name),
            cancellable: false
        }, async () => {
            return await callAI(prompt);
        });
        
        // Extract code
        let cleanedResponse = response;
        let extractedCode = '';
        let aiComments = '';
        
        const codeBlockMatch = cleanedResponse.match(/```(?:cpp|c\+\+|arduino)?\s*\n([\s\S]*?)\n```([\s\S]*)?/);
        if (codeBlockMatch) {
            extractedCode = codeBlockMatch[1].trim();
            aiComments = codeBlockMatch[2] ? codeBlockMatch[2].trim() : '';
        } else {
            extractedCode = cleanedResponse;
            extractedCode = extractedCode.replace(/^```(?:cpp|c\+\+|arduino)?\s*\n?/i, '');
            const endIndex = extractedCode.indexOf('```');
            if (endIndex !== -1) {
                extractedCode = extractedCode.substring(0, endIndex);
            }
            extractedCode = extractedCode.trim();
        }
        
        let displayContent = extractedCode;
        let footer = [];
        
        if (customInstructions && customInstructions.trim()) {
            footer.push('/* ========== Custom Instructions ==========');
            const wrappedInstructions = wrapText(customInstructions, 80);
            wrappedInstructions.split('\n').forEach(line => {
                footer.push(`   ${line}`);
            });
            footer.push('   ======================================== */');
        }
        
        if (aiComments) {
            footer.push('/* ========== ' + t('labels.aiHints') + ' ==========');
            const wrappedComments = wrapText(aiComments, 80);
            wrappedComments.split('\n').forEach(line => {
                footer.push(`   ${line}`);
            });
            footer.push('   ================================= */');
        }
        
        if (footer.length > 0) {
            displayContent += '\n\n' + footer.join('\n');
        }
        
        // Create document
        try {
            const doc = await vscode.workspace.openTextDocument({
                content: displayContent,
                language: 'cpp'
            });
            
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        } catch (docError) {
            vscode.window.showErrorMessage('Failed to create document: ' + docError.message);
        }
        
        const choice = await vscode.window.showInformationMessage(
            t('messages.codeImproved'),
            t('buttons.replaceOriginal'),
            t('buttons.keepBoth')
        );
        
        if (choice === t('buttons.replaceOriginal')) {
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, extractedCode);
            });
            vscode.window.showInformationMessage(t('messages.codeReplaced'));
        }
        
    } catch (error) {
        handleApiError(error);
    } finally {
        executionStates.stop(executionStates.OPERATIONS.IMPROVE);
    }
}
// Add comments
async function addComments() {
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.COMMENTS)) {
        vscode.window.showInformationMessage("Add Comments is already running! Please wait...");
        return;
    }
    
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage(t('messages.noEditor'));
            return;
        }
        
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (!selectedText.trim()) {
            vscode.window.showWarningMessage(t('messages.selectCodeToComment'));
            return;
        }
        
        // Load saved custom instructions for comments
        const savedInstructions = globalContext.globalState.get('aiduino.commentInstructions', '');
        
        // Dialog for custom instructions
        const customInstructions = await vscode.window.showInputBox({
            prompt: t('prompts.commentInstructions'),
            placeHolder: t('placeholders.commentInstructions'),
            value: savedInstructions,
            ignoreFocusOut: true
        });
        
        // Cancel if user pressed Cancel
        if (customInstructions === undefined) {
            return;
        }
        
        // Save instructions for next time
        globalContext.globalState.update('aiduino.commentInstructions', customInstructions);
        
        // Build prompt
        let prompt = t('prompts.addComments', selectedText) + getBoardContext();
    
        // Add custom instructions if provided
        if (customInstructions && customInstructions.trim()) {
            const instructions = customInstructions.split(',').map(s => s.trim()).join('\n- ');
            prompt += '\n\n' + t('prompts.additionalInstructions', instructions);
        }
    
        prompt += '\n\n' + t('prompts.addCommentsSuffix');
        
        const model = minimalModelManager.providers[currentModel];
        
        let response;
        try {
            response = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: t('progress.addingComments', model.name),
                cancellable: false
            }, async () => {
                const result = await callAI(prompt);
                return result;
            });
        } catch (progressError) {
            throw progressError;
        }
        
        // Remove markdown code block markers
        let cleanedResponse = response;
        let extractedCode = '';
        
        // Search for pattern ```cpp...``` and extract only the code
        const codeBlockMatch = cleanedResponse.match(/```(?:cpp|c\+\+|arduino)?\s*\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
            extractedCode = codeBlockMatch[1].trim();
        } else {
            // Fallback
            extractedCode = cleanedResponse;
            extractedCode = extractedCode.replace(/^```(?:cpp|c\+\+|arduino)?\s*\n?/i, '');
            const endIndex = extractedCode.indexOf('```');
            if (endIndex !== -1) {
                extractedCode = extractedCode.substring(0, endIndex);
            }
            extractedCode = extractedCode.trim();
        }
        
        // Create display content with custom instructions info
        let displayContent = extractedCode;
        
        // Add custom instructions footer if present
        if (customInstructions && customInstructions.trim()) {
            displayContent += '\n\n';
            displayContent += '/* ========================================\n';
            displayContent += '   COMMENT INSTRUCTIONS USED:\n';
            
            const wrappedInstructions = wrapText(customInstructions, 80);
            wrappedInstructions.split('\n').forEach(line => {
                displayContent += `   ${line}\n`;
            });
            
            displayContent += '   ======================================== */';
        }
        
        // Add board info if detected
        const board = detectArduinoBoard();
        if (board) {
            displayContent += '\n';
            displayContent += `// Board: ${board}`;
        }
        
        // Create and show document
        try {
            const doc = await vscode.workspace.openTextDocument({
                content: displayContent,
                language: 'cpp'
            });
            
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        } catch (docError) {
            vscode.window.showErrorMessage('Failed to create document: ' + docError.message);
        }
        
        // Choice dialog
        const choice = await vscode.window.showInformationMessage(
            t('messages.commentsAdded'),
            t('buttons.replaceOriginal'),
            t('buttons.keepBoth')
        );
        
        if (choice === t('buttons.replaceOriginal')) {
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, extractedCode);  // Only code without footer
            });
            vscode.window.showInformationMessage(t('messages.codeReplaced'));
        }
        
    } catch (error) {
        handleApiError(error);
    } finally {
        // Always cleanup
        executionStates.stop(executionStates.OPERATIONS.COMMENTS);
    }
}

// Explain error
async function explainError() {
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.ERROR)) {
        vscode.window.showInformationMessage("Error Explanation is already running! Please wait...");
        return;
    }
    
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('.ino')) {
            vscode.window.showWarningMessage(t('messages.openInoFile'));
            return;
        }
        
        // For Arduino files, directly ask for error
        const errorInput = await vscode.window.showInputBox({
            prompt: t('prompts.pasteError'),
            placeHolder: t('placeholders.errorExample'),
            ignoreFocusOut: true
        });
        
        if (!errorInput) return;
        
        // Get code context around current cursor position
        const line = editor.selection.active.line;
        const startLine = Math.max(0, line - 5);
        const endLine = Math.min(editor.document.lineCount - 1, line + 5);
        const codeContext = editor.document.getText(
            new vscode.Range(startLine, 0, endLine, Number.MAX_VALUE)
        );
        
        const prompt = t('prompts.explainError', errorInput, line + 1, codeContext) + getBoardContext();
        
        try {
            const model = minimalModelManager.providers[currentModel];
            
            // Use vscode.window.withProgress like askAI
            const response = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: t('progress.analyzingError', model.name),
                cancellable: false
            }, async () => {
                return await callAI(prompt);
            });
            
            // Create WebviewPanel for error explanation
            const panel = vscode.window.createWebviewPanel(
                'aiError',
                t('panels.errorExplanation'),
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );
            
            panel.webview.html = createErrorExplanationHtml(
                errorInput,
                line + 1,
                response,
                currentModel
            );
            
        } catch (error) {
            handleApiError(error);
        }
    } finally {
        // Always cleanup
        executionStates.stop(executionStates.OPERATIONS.ERROR);
    }
}

// Debug help
async function debugHelp() {
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.DEBUG)) {
        vscode.window.showInformationMessage("Debug Help is already running! Please wait...");
        return;
    }
    
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        
        const options = [
            {
                label: '$(search) ' + t('debug.analyzeSerial'),
                description: t('debug.analyzeSerialDesc'),
                value: 'serial'
            },
            {
                label: '$(circuit-board) ' + t('debug.hardwareProblem'),
                description: t('debug.hardwareProblemDesc'),
                value: 'hardware'
            },
            {
                label: '$(watch) ' + t('debug.addDebugCode'),
                description: t('debug.addDebugCodeDesc'),
                value: 'debug'
            },
            {
                label: '$(pulse) ' + t('debug.timingProblems'),
                description: t('debug.timingProblemsDesc'),
                value: 'timing'
            }
        ];
        
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: t('debug.selectHelp')
        });
        
        if (!selected) return;
        
        let prompt = '';
        let needsCode = true;
        
        switch (selected.value) {
            case 'serial':
                const serialOutput = await vscode.window.showInputBox({
                    prompt: t('prompts.pasteSerial'),
                    placeHolder: t('placeholders.serialExample'),
                    ignoreFocusOut: true
                });
                if (!serialOutput) return;
                
                const codeForSerial = editor.selection.isEmpty ? '' : editor.document.getText(editor.selection);
                prompt = t('prompts.analyzeSerial', serialOutput, codeForSerial);
                needsCode = false;
                break;
                
            case 'hardware':
                const hardwareCode = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
                prompt = t('prompts.hardwareDebug', hardwareCode) + getBoardContext();  
                break;
                
            case 'debug':
                const debugCode = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
                prompt = t('prompts.addDebugStatements', debugCode); 
                break;
                
            case 'timing':
                const timingCode = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
                prompt = t('prompts.analyzeTiming', timingCode) + getBoardContext();  
                break;
        }
        
        if (needsCode && editor.selection.isEmpty) {
            vscode.window.showWarningMessage(
                t('messages.selectRelevantCode')
            );
            return;
        }
        
        try {
    const model = minimalModelManager.providers[currentModel];
    
    let response;
    try {
              response = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: t('progress.analyzingProblem', model.name),
                    cancellable: false
                }, async () => {
                    const result = await callAI(prompt);
                    return result;
                });
            } catch (progressError) {
                throw progressError;
            }
    
         const panel = vscode.window.createWebviewPanel(
                'aiDebug',
                t('panels.debugHelp'),
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );
            panel.webview.html = createDebugHelpHtml(selected.label, response, currentModel);
        } catch (error) {
            handleApiError(error);
        }
    } finally {
        // Always cleanup
        executionStates.stop(executionStates.OPERATIONS.DEBUG);
    }
}

// Ask AI
async function askAI(isFollowUp = false) {
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.ASK)) {
        vscode.window.showInformationMessage("AI question is already running! Please wait...");
        return;
    }
    
    try {
        // Check if follow-up is possible
        if (isFollowUp && !hasValidContext()) {
            vscode.window.showWarningMessage(t('messages.noValidContext'));
            return;
        }

        // Check if API key is available
        if (!apiKeys[currentModel]) {
            const model = minimalModelManager.providers[currentModel];
            const choice = await vscode.window.showWarningMessage(
                t('messages.noApiKey', model.name),
                t('buttons.setupNow'),
                t('buttons.switchModel'),
                t('buttons.cancel')
            );
            if (choice === t('buttons.setupNow')) {
                await setApiKey();
                if (!apiKeys[currentModel]) return;
            } else if (choice === t('buttons.switchModel')) {
                await switchModel();
                if (!apiKeys[currentModel]) return;
            } else {
                return;
            }
        }

        // Different prompts for follow-up vs new question
        const promptText = isFollowUp ? t('prompts.askFollowUp') : t('prompts.askAI');
        const placeholderText = isFollowUp ? t('placeholders.askFollowUp') : t('placeholders.askAI');

        // Show context info for follow-ups
        if (isFollowUp) {
            const contextAge = Math.round((Date.now() - aiConversationContext.timestamp) / 60000);
            vscode.window.showInformationMessage(
                t('messages.followUpContext', aiConversationContext.lastQuestion, contextAge)
            );
        }

        // Input dialog
        const question = await vscode.window.showInputBox({
            prompt: promptText,
            placeHolder: placeholderText,
            ignoreFocusOut: true
        });

        if (!question || !question.trim()) {
            return;
        }

        // Build final prompt
        let finalPrompt;
        let currentCode = null;

        if (isFollowUp) {
            // Build context-aware follow-up prompt
            finalPrompt = buildFollowUpPrompt(question);
            currentCode = aiConversationContext.lastCode;
        } else {
            // Handle new question with optional code context
            const editor = vscode.window.activeTextEditor;
           
            finalPrompt = question; 

            if (editor && !editor.selection.isEmpty) {
                const includeCode = await vscode.window.showQuickPick([
                    {
                        label: t('chat.includeSelectedCode'),
                        description: t('chat.includeSelectedCodeDesc'),
                        value: true
                    },
                    {
                        label: t('chat.questionOnly'), 
                        description: t('chat.questionOnlyDesc'),
                        value: false
                    }
                ], {
                    placeHolder: t('chat.selectContext'),
                    ignoreFocusOut: true
                });
        
                if (includeCode === undefined) return;
        
                if (includeCode.value) {
                    currentCode = editor.document.getText(editor.selection);
                    // Add board info only when code is included
                    finalPrompt = t('prompts.askAIWithContext', question, currentCode) + getBoardContext();
                }
            }
        }   

        // Call AI
        const model = minimalModelManager.providers[currentModel];
        
        let response;
        try {
            response = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: isFollowUp ? t('progress.askingFollowUp', model.name) : t('progress.askingAI', model.name),
                cancellable: false
            }, async () => {
                const result = await callAI(finalPrompt);
                return result; 
            });
        } catch (progressError) {
            throw progressError; 
        }

        // Store context for potential follow-ups
        aiConversationContext = {
            lastQuestion: question,
            lastAnswer: response,
            lastCode: currentCode,
            timestamp: Date.now()
        };

        // Show response
        try {
            await showAIResponseWithFollowUp(model, question, response, isFollowUp);
        } catch (displayError) {
            // Silent fail
        }

    } catch (error) {
        handleApiError(error);
    } finally {
        // Always cleanup
        executionStates.stop(executionStates.OPERATIONS.ASK);
    }
}

// Updated showAIResponseWithFollowUp to use document
async function showAIResponseWithFollowUp(model, question, response, isFollowUp) {
    const modelName = model.name || model;
    
    const lines = [
        `🤖 ${t('output.responseFrom', modelName.toUpperCase ? modelName.toUpperCase() : modelName)}`,
        '='.repeat(50),
        ''
    ];
    
    // Show follow-up context
    if (isFollowUp && aiConversationContext.lastQuestion) {
        lines.push(`🔗 ${t('output.followUpTo')}:`);
        const wrappedPrevQuestion = wrapText(aiConversationContext.lastQuestion, 80);  // 80 Zeichen
        wrappedPrevQuestion.split('\n').forEach(line => {
            lines.push(`   ${line}`);
        });
        lines.push('');
    }
    
    // Show if code was included
    if (aiConversationContext.lastCode) {
        const lineCount = aiConversationContext.lastCode.split('\n').length;
        lines.push(`📝 ${t('output.codeContextYes', lineCount)}`);
        lines.push('');
    }
    
    // Show board if detected
    const board = detectArduinoBoard();
    if (board) {
        lines.push(`🎯 ${t('output.boardDetected', board)}`);
        lines.push('');
    }
    
    // Show question
    lines.push(`❓ ${t('output.yourQuestion')}:`);
    const wrappedQuestion = wrapText(question, 80);  // 80 Zeichen
    wrappedQuestion.split('\n').forEach(line => {
        lines.push(`   ${line}`);
    });
    lines.push('');
    
    lines.push(`💡 ${t('output.aiAnswer')}:`);
    lines.push('');
    
    // Wrap response at 80 characters
    const wrappedResponse = response.split('\n').map(line => 
        line.length > 80 ? wrapText(line, 80) : line
    ).join('\n');
    
    lines.push(wrappedResponse);
    lines.push('');
    lines.push('='.repeat(50));
    lines.push(`💬 ${t('output.followUpHint')}`);
    lines.push(`   • ${t('shortcuts.askFollowUp')}: Ctrl+Shift+F`);
    lines.push(`   • ${t('shortcuts.askAI')}: Ctrl+Shift+A`);
    
    const formattedContent = lines.join('\n');
    
    const doc = await vscode.workspace.openTextDocument({
        content: formattedContent,
        language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
}

// follow-up prompt builder
function buildFollowUpPrompt(followUpQuestion) {
    let contextPrompt = t('prompts.followUpContext');
    
    // Add previous conversation
    contextPrompt += `\n\n${t('chat.previousQuestion')}: ${aiConversationContext.lastQuestion}`;
    contextPrompt += `\n\n${t('chat.previousAnswer')}: ${aiConversationContext.lastAnswer}`;
    
    // Add code context if available
    if (aiConversationContext.lastCode) {
        contextPrompt += `\n\n${t('chat.relatedCode')}:\n\`\`\`cpp\n${aiConversationContext.lastCode}\n\`\`\``;
    }
    
    // Add current follow-up question
    contextPrompt += `\n\n${t('chat.followUpQuestion')}: ${followUpQuestion}`;
    contextPrompt += `\n\n${t('prompts.followUpInstruction')}`;
    
    return contextPrompt;
}

// HTML generation
function createErrorExplanationHtml(error, line, explanation, modelId) {
    const model = minimalModelManager.providers[modelId];
    if (!model) return;
    const modelBadge = `<span style="background: ${model.color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${model.name}</span>`;
    
    // Escape HTML and replace newlines with <br> for HTML display
    const htmlExplanation = escapeHtml(explanation).replace(/\n/g, '<br>');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                    color: #333;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .error-box {
                    background: #ffebee;
                    border: 1px solid #ef5350;
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 20px;
                }
                .error-title {
                    color: #c62828;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .section {
                    margin: 20px 0;
                    padding: 15px;
                    background: #f5f5f5;
                    border-radius: 8px;
                }
                pre {
                    background: #1e1e1e;
                    color: #d4d4d4;
                    padding: 15px;
                    border-radius: 4px;
                    overflow-x: auto;
                }
                .solution {
                    background: #e8f5e9;
                    border-left: 4px solid #4caf50;
                    padding: 15px;
                    margin: 15px 0;
                }
                button {
                    background: #2196F3;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                button:hover {
                    background: #1976D2;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🔧 ${t('html.errorExplanation')}</h1>
                ${modelBadge}
            </div>
            
            <div class="error-box">
                <div class="error-title">${t('html.errorInLine', line)}:</div>
                <code>${escapeHtml(error)}</code>
            </div>
            
            <div class="explanation">
                ${htmlExplanation}
            </div>
            
            <br>
            <button onclick="copyToClipboard()">📋 ${t('buttons.copySolution')}</button>
            
            <script>
                function copyToClipboard() {
                    const text = document.querySelector('.explanation').innerText;
                    navigator.clipboard.writeText(text).then(() => {
                        alert('${t('messages.copiedToClipboard')}');
                    });
                }
            </script>
        </body>
        </html>
    `;
}

function createDebugHelpHtml(title, content, modelId) {
    const model = minimalModelManager.providers[modelId];
    if (!model) return;
    const modelBadge = `<span style="background: ${model.color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${model.name}</span>`;
    
    const htmlContent = escapeHtml(content).replace(/\n/g, '<br>');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                    color: #333;
                    max-width: 900px;
                    margin: 0 auto;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #e0e0e0;
                    padding-bottom: 10px;
                }
                h1 {
                    color: #2196F3;
                    margin: 0;
                }
                .content {
                    margin: 20px 0;
                    white-space: pre-wrap;
                }
                pre {
                    background: #f4f4f4;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 15px;
                    overflow-x: auto;
                }
                .tip {
                    background: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 15px;
                    margin: 15px 0;
                }
                button {
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 10px;
                }
                button:hover {
                    background: #45a049;
                }
            </style>
        </head>
        <body>
            div class="header">
                <h1>${escapeHtml(title)}</h1>
                ${modelBadge}
            </div>
            <div class="content">${htmlContent}</div>
            
            <button onclick="copyToClipboard()">📋 ${t('buttons.copy')}</button>
            
            <script>
                function copyToClipboard() {
                    const text = document.querySelector('.content').innerText;
                    navigator.clipboard.writeText(text).then(() => {
                        alert('${t('messages.copiedToClipboard')}');
                    });
                }
            </script>
        </body>
        </html>
    `;
}

// Offline help
function showOfflineHelp() {
    const panel = vscode.window.createWebviewPanel(
        'aiOfflineHelp',
        t('panels.offlineHelp'),
        vscode.ViewColumn.One,
        {}
    );
    
    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 { color: #2196F3; }
                .tip {
                    background: #e3f2fd;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .warning {
                    background: #fff3cd;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #ffc107;
                }
                code {
                    background: #f5f5f5;
                    padding: 2px 5px;
                    border-radius: 3px;
                }
                pre {
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 8px;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            <h1>📡 ${t('offline.title')}</h1>
            
            <div class="warning">
                <strong>${t('offline.requiresInternet')}</strong>
            </div>
            
            <h2>🔧 ${t('offline.solutions')}:</h2>
            
            <div class="tip">
                <h3>1. ${t('offline.checkInternet')}</h3>
                <ul>
                    <li>${t('offline.checkWifi')}</li>
                    <li>${t('offline.restartRouter')}</li>
                    <li>${t('offline.testOtherSites')}</li>
                </ul>
            </div>
            
            <div class="tip">
                <h3>2. ${t('offline.firewallSettings')}</h3>
                <p>${t('offline.ensureNotBlocked')}:</p>
                <ul>
                    <li><code>api.anthropic.com</code> (Claude)</li>
                    <li><code>api.openai.com</code> (ChatGPT)</li>
                    <li><code>generativelanguage.googleapis.com</code> (Gemini)</li>
                    <li><code>api.mistral.ai</code> (Mistral)</li>
                </ul>
            </div>
            
            <div class="tip">
                <h3>3. ${t('offline.disableVpn')}</h3>
                <p>${t('offline.vpnMayBlock')}</p>
            </div>
            
            <h2>💡 ${t('offline.commonProblems')}:</h2>
            
            <h3>❌ "was not declared in this scope"</h3>
            <pre>
// ${t('offline.solution')}: ${t('offline.declareVariable')}
int sensorPin = A0;  // ${t('offline.missingDeclaration')}
int sensorValue = analogRead(sensorPin);
            </pre>
            
            <h3>❌ "expected ';' before..."</h3>
            <pre>
// ${t('offline.solution')}: ${t('offline.addSemicolon')}
digitalWrite(13, HIGH);  // ${t('offline.dontForgetSemicolon')}
            </pre>
            
            <h3>❌ Non-blocking delay</h3>
            <pre>
// ${t('offline.insteadOfDelay')}:
unsigned long previousMillis = 0;
const long interval = 1000;

void loop() {
    unsigned long currentMillis = millis();
    if (currentMillis - previousMillis >= interval) {
        previousMillis = currentMillis;
        // ${t('offline.executeCodeHere')}
    }
}
            </pre>
            
            <div class="tip">
                <strong>${t('offline.tip')}:</strong> ${t('offline.onlineAgain')}
            </div>
        </body>
        </html>
    `;
}

// Token statistics
function showTokenStats() {
    let totalCostToday = 0;
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        totalCostToday += tokenUsage[modelId].cost;
    });
    
    const panel = vscode.window.createWebviewPanel(
        'tokenStats',
        t('panels.tokenStats'),
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    
    // Generate statistics cards for all models
    let modelCards = '';
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        const model = minimalModelManager.providers[modelId];
        if (!model) return;
        modelCards += `
            <div class="stat-card">
                <div class="model-name" style="color: ${model.color};">${model.icon} ${model.fullName}</div>
                <div class="stat-row">
                    <span>${t('stats.inputTokens')}:</span>
                    <span>${tokenUsage[modelId].input.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span>${t('stats.outputTokens')}:</span>
                    <span>${tokenUsage[modelId].output.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span>${t('stats.cost')}:</span>
                    <span class="cost">$${tokenUsage[modelId].cost.toFixed(3)}</span>
                </div>
            </div>
        `;
    });
    
    const currentDate = new Date().toLocaleDateString(currentLocale === 'de' ? 'de-DE' : 'en-US');
    
    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 { color: #2196F3; }
                .stat-card {
                    background: #f5f5f5;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .model-name {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .stat-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #e0e0e0;
                }
                .stat-row:last-child {
                    border-bottom: none;
                    font-weight: bold;
                }
                .cost {
                    color: #f44336;
                    font-weight: bold;
                }
                .total {
                    background: #e3f2fd;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    margin: 20px 0;
                }
                .reset-btn {
                    background: #ff5252;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-top: 20px;
                }
                .tip {
                    background: #fff3cd;
                    padding: 15px;
                    border-radius: 4px;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <h1>📊 ${t('stats.tokenUsageFor', currentDate)}</h1>
            
            <div class="total">
                <h2>${t('stats.totalCostToday')}: <span class="cost">$${totalCostToday.toFixed(3)}</span></h2>
            </div>
            
            ${modelCards}
            
            <div class="tip">
                💡 <strong>${t('stats.tip')}:</strong> ${t('stats.tipDescription')}
            </div>
            
            <button class="reset-btn" onclick="if(confirm('${t('stats.confirmReset')}')) { window.location.href = 'command:aiduino.resetTokenStats'; }">
                ${t('buttons.resetStats')}
            </button>
        </body>
        </html>
    `;
}

function resetTokenStats() {
    initializeTokenUsage();
    saveTokenUsage();
    updateStatusBar();
    vscode.window.showInformationMessage(t('messages.statsReset'));
}

// About Ai.duino
function showAbout() {
    const panel = vscode.window.createWebviewPanel(
        'aiduinoAbout',
        t('panels.about'),
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    
    // Generate model badges
    let modelBadges = '';
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        const model = minimalModelManager.providers[modelId];
        if (!model) return;
        modelBadges += `
            <span class="model-badge" style="background: ${model.color}; margin: 0 5px;">
                ${model.icon} ${model.name}
            </span>
        `;
    });
    
    // Generate feature list for all models
    let modelFeatures = '';
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        const model = minimalModelManager.providers[modelId];
        if (!model) return;
        modelFeatures += `<div class="feature">${model.icon} ${model.fullName} ${t('about.integration')}</div>`;
    });
    
    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    padding: 40px;
                    line-height: 1.6;
                    max-width: 600px;
                    margin: 0 auto;
                    text-align: center;
                }
                .logo {
                    font-size: 72px;
                    margin: 20px 0;
                }
                h1 {
                    color: #2196F3;
                    margin-bottom: 10px;
                }
                .version {
                    font-size: 24px;
                    color: #666;
                    margin-bottom: 30px;
                }
                .info-box {
                    background: #f5f5f5;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                    text-align: left;
                }
                .feature {
                    margin: 10px 0;
                    padding-left: 25px;
                    position: relative;
                }
                .feature:before {
                    content: "✓";
                    position: absolute;
                    left: 0;
                    color: #4CAF50;
                    font-weight: bold;
                }
                .credits {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e0e0e0;
                }
                a {
                    color: #2196F3;
                    text-decoration: none;
                }
                a:hover {
                    text-decoration: underline;
                }
                .license {
                    background: #e3f2fd;
                    padding: 15px;
                    border-radius: 4px;
                    margin: 20px 0;
                    font-family: monospace;
                    font-size: 14px;
                }
                .model-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: bold;
                    color: white;
                }
                .tutorial {
                    background: #e8f5e9;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    text-align: left;
                }
                .shortcut {
                    background: #f0f0f0;
                    padding: 3px 6px;
                    border-radius: 3px;
                    font-family: monospace;
                }
            </style>
        </head>
        <body>
            <div class="logo">🤖</div>
            <h1>AI.duino</h1>
            <div class="version">Version ${EXTENSION_VERSION}</div>
            
            <p><strong>${t('about.tagline')}</strong></p>
            
            <div>
                ${modelBadges}
            </div>
            
            <div class="info-box">
                <h3>${t('about.features')}:</h3>
                ${modelFeatures}
                <div class="feature">${t('about.feature1')}</div>
                <div class="feature">${t('about.feature2')}</div>
                <div class="feature">${t('about.feature3')}</div>
                <div class="feature">${t('about.feature4')}</div>
                <div class="feature">${t('about.feature5')}</div>
                <div class="feature">${t('about.feature6')}</div>
                <div class="feature">${t('about.feature7')}</div>
                <div class="feature">${t('about.feature8')}</div>
            </div>
            
            <div class="tutorial">
                <h3>${t('about.quickstart')}:</h3>
                <p>1. ${t('about.step1')}</p>
                <p>2. ${t('about.step2')} <span class="shortcut">Ctrl+Shift+C</span></p>
                <p>3. ${t('about.step3')}</p>
                <br>
                <p><strong>${t('about.tip')}:</strong> ${t('about.tipText')}</p>
            </div>
            
            <div class="license">
                <strong>${t('about.license')}:</strong> Apache License 2.0<br>
                Copyright © 2025 Monster Maker
            </div>
            
            <div class="info-box">
                <h3>${t('about.getApiKeys')}:</h3>
                <p>🤖 <strong>Claude:</strong> <a href="https://console.anthropic.com/api-keys">console.anthropic.com</a></p>
                <p>🧠 <strong>ChatGPT:</strong> <a href="https://platform.openai.com/api-keys">platform.openai.com</a></p>
                <p>💎 <strong>Gemini:</strong> <a href="https://makersuite.google.com/app/apikey">makersuite.google.com</a></p>
                <p>🌟 <strong>Mistral:</strong> <a href="https://console.mistral.ai/">console.mistral.ai</a></p>
            </div>
            
            <div class="credits">
                <p><strong>${t('about.publisher')}:</strong> Monster Maker</p>
                <p><strong>${t('about.repository')}:</strong> <a href="https://github.com/NikolaiRadke/AI.duino">GitHub</a></p>
                <p><strong>${t('about.reportBugs')}:</strong> <a href="https://github.com/NikolaiRadke/AI.duino/issues">Issue Tracker</a></p>
                <br>
                <p><em>${t('about.madeWith')}</em></p>
                <br>
                <p><strong>${t('about.changelog')}:</strong></p>
                <ul style="text-align: left;">
                    <li>✨ ${t('about.change1')}</li>
                    <!-- <li>✨ ${t('about.change2')}</li> //-->
                    <!-- <li>✨ ${t('about.change3')}</li> //-->
                </ul>
            </div>
        </body>
        </html>
    `;
}

// Deactivation
function deactivate() {
    // Cleanup execution states
    if (executionStates) {
        // Clear all states
        executionStates.states.clear();
    }

    // Force final token save if needed (synchronous for shutdown)
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    
    // Force final save if queue has pending items
    if (tokenSaveQueue.length > 0 && !tokenFileLock) {
        try {
            const data = JSON.stringify(tokenUsage, null, 2);
            fs.writeFileSync(TOKEN_USAGE_FILE, data, { mode: 0o600 });
        } catch (error) {
            // Silent error on shutdown - don't block deactivation
        }
    }
    
    // Cleanup all event listeners
    disposeEventListeners();
    
    // Dispose status bar item
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = null;
    }
    
    // Clear global references to prevent memory leaks
    globalContext = null;
    
    // Clear any remaining timeouts
    if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
    }

    // Clear AI conversation context
    aiConversationContext = {
        lastQuestion: null,
        lastAnswer: null,
        lastCode: null,
        timestamp: null
    };
}

exports.deactivate = deactivate;
