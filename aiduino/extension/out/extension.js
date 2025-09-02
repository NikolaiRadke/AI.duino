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
 * Modular build
 */

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const shared = require('./shared');
const explainCodeFeature = require('./features/explainCode');
const improveCodeFeature = require('./features/improveCode');
const addCommentsFeature = require('./features/addComments');
const askAIFeature = require('./features/askAI');
const explainErrorFeature = require('./features/explainError');
const debugHelpFeature = require('./features/debugHelp');
const uiTools = require('./utils/ui');
const networkUtils = require('./utils/network');
const errorHandling = require('./utils/errorHandling');
const validation = require('./utils/validation');
const fileManager = require('./utils/fileManager');
const { UnifiedAPIClient } = require('./core/apiClient');
const { ExecutionStateManager } = require('./core/executionStateManager');
const { CommandRegistry } = require('./core/commandRegistry');
const { PROVIDER_CONFIGS } = require('./config/providerConfigs');
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
let commandRegistry;
let aiConversationContext = {
    lastQuestion: null,
    lastAnswer: null,
    lastCode: null,
    timestamp: null
};

const executionStates = new ExecutionStateManager();

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

const EXTENSION_VERSION = fileManager.getVersionFromPackage();

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
        this.providers = PROVIDER_CONFIGS;
        this.currentModels = {}; // Latest model per provider
        this.lastCheck = {};
        this.isUpdating = false;
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
        claude: (m) => ({ 
            id: m.id, 
            name: m.display_name || this.cleanName(m.id) 
        }),
        chatgpt: (m) => ({ 
            id: m.id, 
            name: this.cleanName(m.id) 
        }),
        gemini: (m) => ({ 
            id: m.name || m.id,  
            name: m.displayName || this.cleanName(m.name || m.id)
        }),
        mistral: (m) => ({ 
            id: m.id, 
            name: this.cleanName(m.id) 
        }),
        groq: (m) => ({ 
            id: m.id, 
            name: this.cleanName(m.id) 
        }),
        perplexity: (m) => ({ 
            id: m.id, 
            name: this.cleanName(m.id) 
        }),
        cohere: (m) => ({ 
            id: m.id || m.name, 
            name: this.cleanName(m.name || m.id) 
        })    
    };

    const formatter = formatters[providerId];
    if (!formatter) {
        return { 
            id: model.id || 'unknown', 
            name: this.cleanName(model.name || model.id || 'Unknown') 
        };
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

function setupEventListeners(context) {
    // Cleanup existing listeners FIRST
    disposeEventListeners();
    
    // Configuration change listener with debouncing
    let configDebounceTimeout = null; // Lokale Variable
    configListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('aiduino.language')) {
            // Debounce multiple rapid config changes
            if (configDebounceTimeout) {
                clearTimeout(configDebounceTimeout);
            }
            configDebounceTimeout = setTimeout(() => {
                try {
                    loadLocale();
                    updateStatusBar();
                } catch (error) {
                    // Silent error - don't break extension
                } finally {
                    configDebounceTimeout = null;
                }
            }, 300);
        }
    });
    
    // Diagnostics listener mit besserer Performance
    diagnosticsListener = vscode.languages.onDidChangeDiagnostics(e => {
        // Performance: Only process for Arduino-related files
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return;
        }
        
        const fileName = activeEditor.document.fileName;
        const isArduinoFile = fileName.endsWith('.ino') || 
                             fileName.endsWith('.cpp') || 
                             fileName.endsWith('.h') || 
                             fileName.endsWith('.c');
        
        if (!isArduinoFile) {
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
        }
        errorTimeout = setTimeout(() => {
            try {
                checkForErrors();
            } catch (error) {
                // Silent error handling
            } finally {
                errorTimeout = null;
            }
        }, 1000);
    });
    
    // CRITICAL: Add cleanup timeout handler
    const cleanupTimeouts = () => {
        if (configDebounceTimeout) {
            clearTimeout(configDebounceTimeout);
            configDebounceTimeout = null;
        }
    };
    
    // Store cleanup function for disposal
    if (context && context.subscriptions) {
        context.subscriptions.push(configListener);
        context.subscriptions.push(diagnosticsListener);
        // Add custom disposable for timeout cleanup
        context.subscriptions.push({
            dispose: cleanupTimeouts
        });
    }
}

function disposeEventListeners() {
    // Clear all listeners with error handling
    [
        { listener: configListener, name: 'configListener' },
        { listener: diagnosticsListener, name: 'diagnosticsListener' }
    ].forEach(({ listener, name }) => {
        if (listener) {
            try {
                listener.dispose();
            } catch (error) {
                // Silent disposal error
            }
        }
    });
    
    // Reset references
    configListener = null;
    diagnosticsListener = null;
    
    // Clear all timeouts safely
    [
        { timeout: errorTimeout, name: 'errorTimeout' },
        { timeout: saveTimeout, name: 'saveTimeout' }
    ].forEach(({ timeout, name }) => {
        if (timeout) {
            clearTimeout(timeout);
            if (name === 'errorTimeout') errorTimeout = null;
            if (name === 'saveTimeout') saveTimeout = null;
        }
    });
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

// Dependency factory for feature modules
function getDependencies() {
    return {
        t,
        callAI,
        executionStates,
        minimalModelManager,
        currentModel,
        globalContext,
        apiKeys,
        tokenUsage,       
        currentLocale,     
        EXTENSION_VERSION, 
        updateTokenUsage,
        updateStatusBar,
        aiConversationContext,
        handleApiError: (error) => errorHandling.handleApiError(error, getDependencies()),
        updateTokenUsage: (modelId, inputText, outputText) => updateTokenUsage(modelId, inputText, outputText),        
        setAiConversationContext: (newContext) => { 
            Object.assign(aiConversationContext, newContext); 
        }
    };
}

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
    Object.assign(apiKeys, fileManager.loadAllApiKeys(minimalModelManager.providers));
    const savedModel = fileManager.loadSelectedModel(minimalModelManager.providers);
    if (savedModel) currentModel = savedModel;
    
    // Token statistics
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
    // Initialisiere Command Registry
    commandRegistry = new CommandRegistry();
    
    // Prepare dependencies für command handlers
    const commandDeps = {
        // Handler functions
        showQuickMenu,
        switchModel, 
        setApiKey,
        switchLanguage,
        clearAIContext,
        
        // Feature modules  
        explainCodeFeature,
        improveCodeFeature,
        addCommentsFeature, 
        explainErrorFeature,
        debugHelpFeature,
        askAIFeature,
        uiTools,
        
        // System dependencies
        minimalModelManager,
        getDependencies
    };
    
    // Register all commands
    commandRegistry.registerCommands(context, commandDeps);
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
    const itemsToSave = [...tokenSaveQueue]; // Create copy
    tokenSaveQueue = []; // Clear queue
    
    try {
        const data = JSON.stringify(tokenUsage, null, 2);
        
        // Unified error handling for all platforms
        const writeFileAtomically = (filePath, content) => {
            const tempFile = filePath + '.tmp';
            const backupFile = filePath + '.backup';
            
            try {
                // Create backup if original exists
                if (fs.existsSync(filePath)) {
                    fs.copyFileSync(filePath, backupFile);
                }
                
                // Write to temp file
                fs.writeFileSync(tempFile, content, { mode: 0o600 });
                
                // Atomic rename (works on all platforms)
                fs.renameSync(tempFile, filePath);
                
                // Cleanup backup on success
                if (fs.existsSync(backupFile)) {
                    fs.unlinkSync(backupFile);
                }
                
                return true;
            } catch (error) {
                // Cleanup on error
                [tempFile, backupFile].forEach(file => {
                    try {
                        if (fs.existsSync(file)) {
                            fs.unlinkSync(file);
                        }
                    } catch (cleanupError) {
                        // Silent cleanup
                    }
                });
                throw error;
            }
        };
        
        // Try atomic write first
        if (!writeFileAtomically(TOKEN_USAGE_FILE, data)) {
            throw new Error('Atomic write failed');
        }
        
    } catch (error) {
        // Fallback: Direct write (last resort)
        try {
            fs.writeFileSync(TOKEN_USAGE_FILE, data, { mode: 0o600 });
        } catch (fallbackError) {
            // Complete failure - token usage will be lost this session
            // but extension continues working
        }
    } finally {
        tokenFileLock = false;
        
        // Check for new entries during save
        if (tokenSaveQueue.length > 0) {
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
    const board = shared.detectArduinoBoard();
    const boardDisplay = shared.getBoardDisplayName(board);  // Use short name
    
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
        ...(shared.hasValidContext(aiConversationContext) ? [{
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
            fileManager.saveSelectedModel(currentModel);
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
        const model = minimalModelManager.providers[currentModel]; 
        const providerName = getProviderName(currentModel);
        
        const input = await vscode.window.showInputBox({
            prompt: t('prompts.enterApiKey', providerName),
            placeHolder: model.keyPrefix + '...',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                return validation.validateApiKey(
                    value, 
                    model.keyPrefix, 
                    model.keyMinLength || 15, 
                    t
                );
            }
        });
        
        if (input) {
            try {
                const keyFile = path.join(os.homedir(), model.keyFile);
                apiKeys[currentModel] = input;
                if (fileManager.saveApiKey(currentModel, input, minimalModelManager.providers)) {
                    apiKeys[currentModel] = input;
                }
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

const apiClient = new UnifiedAPIClient();

function callAI(prompt) {   
    return apiClient.callAPI(currentModel, prompt, getDependencies());
}

// Deactivation
function deactivate() {
    // Cleanup command registry
    if (commandRegistry) {
        commandRegistry.dispose();
        commandRegistry = null;
    }
    
    // Cleanup execution states
    if (executionStates) {
        // Clear all states
        executionStates.states.clear();
    }

    if (configDebounceTimeout) {
        clearTimeout(configDebounceTimeout);
        configDebounceTimeout = null;
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
