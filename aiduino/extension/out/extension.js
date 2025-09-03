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
 * Modular build - Cleaned up and restructured
 */

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;

// ===== IMPORTS =====
// Node.js modules
const vscode = require("vscode");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Core modules
const { UnifiedAPIClient } = require('./core/apiClient');
const { ExecutionStateManager } = require('./core/executionStateManager');
const { CommandRegistry } = require('./core/commandRegistry');

// Feature modules
const shared = require('./shared');
const explainCodeFeature = require('./features/explainCode');
const improveCodeFeature = require('./features/improveCode');
const addCommentsFeature = require('./features/addComments');
const askAIFeature = require('./features/askAI');
const explainErrorFeature = require('./features/explainError');
const debugHelpFeature = require('./features/debugHelp');

// Utility modules
const uiTools = require('./utils/ui');
const networkUtils = require('./utils/network');
const errorHandling = require('./utils/errorHandling');
const validation = require('./utils/validation');
const fileManager = require('./utils/fileManager');
const { ErrorChecker } = require('./utils/errorChecker');
const { ApiKeyManager } = require('./utils/apiKeyManager');
const { LocaleUtils } = require('./utils/localeUtils');

// Configuration modules
const { LANGUAGE_METADATA, getLanguageInfo } = require('./config/languageMetadata');
const { PROVIDER_CONFIGS } = require('./config/providerConfigs');

// ===== CONSTANTS =====
const EXTENSION_VERSION = fileManager.getVersionFromPackage();
const MODEL_FILE = path.join(os.homedir(), '.aiduino-model');
const TOKEN_USAGE_FILE = path.join(os.homedir(), '.aiduino-token-usage.json');

// ===== GLOBAL VARIABLES =====
// Core system state
let globalContext;
let statusBarItem;
let currentModel = 'claude';
let currentLocale = 'en';
let i18n = {};

// Module instances
let commandRegistry;
let errorChecker;
let apiKeyManager;
let localeUtils;
const executionStates = new ExecutionStateManager();
const apiClient = new UnifiedAPIClient();

// Data stores
const apiKeys = {};
let tokenUsage = {};
let aiConversationContext = {
    lastQuestion: null,
    lastAnswer: null,
    lastCode: null,
    timestamp: null
};

// Event listeners and timeouts
let configListener = null;
let diagnosticsListener = null;
let errorTimeout = null;
let saveTimeout = null;

// Token management state
let tokenFileLock = false;
let tokenSaveQueue = [];

// ===== MINIMAL MODEL MANAGER CLASS =====
/**
 * Minimal dynamic model system for AI.duino
 * Works completely in background, only shows latest model in statusbar
 */
class MinimalModelManager {
    constructor() {
        this.providers = PROVIDER_CONFIGS;
        this.currentModels = {}; // Latest model per provider
        this.lastCheck = {};
        this.isUpdating = false;
    }

    /**
     * Main function: Silent update of all providers
     */
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

    /**
     * Update single provider
     */
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

    /**
     * API call for models
     */
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

    /**
     * Format model object
     */
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

    /**
     * Clean model names
     */
    cleanName(rawName) {
        return rawName
            .replace(/^models\//, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Use fallback model
     */
    useFallback(providerId) {
        const provider = this.providers[providerId];
        this.currentModels[providerId] = {
            id: provider.fallback,
            name: this.cleanName(provider.fallback),
            isFallback: true
        };
    }

    /**
     * Check if update needed (daily)
     */
    shouldCheck(providerId) {
        const lastCheck = this.lastCheck[providerId] || 0;
        return Date.now() - lastCheck > 24 * 60 * 60 * 1000; // 24 hours
    }

    /**
     * Read API key from file
     */
    getApiKey(providerId) {
        try {
            const keyFile = path.join(os.homedir(), this.providers[providerId].keyFile);
            return fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : null;
        } catch {
            return null;
        }
    }

    /**
     * Get current model for provider
     */
    getCurrentModel(providerId) {
        return this.currentModels[providerId] || {
            id: this.providers[providerId].fallback,
            name: this.cleanName(this.providers[providerId].fallback),
            isFallback: true
        };
    }

    /**
     * Provider info for statusbar
     */
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

    /**
     * Debug helper: Show current models
     */
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

// ===== LOCALE MANAGEMENT =====

/**
 * Load and initialize locale based on user settings
 */
function loadLocale() {
    const config = vscode.workspace.getConfiguration('aiduino');
    const userLanguageChoice = config.get('language', 'auto');
    
    if (userLanguageChoice !== 'auto') {
        currentLocale = userLanguageChoice;
    } else {
        // Auto-Detection with LocaleUtils
        const vscodeLocale = vscode.env.language || 'en';
        currentLocale = localeUtils.autoDetectLocale(vscodeLocale);
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

/**
 * Get localized string with parameter replacement
 * @param {string} key - Translation key (dot notation)
 * @param {...any} args - Arguments for string replacement
 * @returns {string} Localized string
 */
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

/**
 * Switch UI language with user selection
 */
async function switchLanguage() {
    // Check if already running
    if (!executionStates.start(executionStates.OPERATIONS.SWITCH_LANGUAGE)) {
        vscode.window.showInformationMessage("Language switch is already running! Please wait...");
        return;
    }
    
    try {
        const config = vscode.workspace.getConfiguration('aiduino');
        const currentSetting = config.get('language', 'auto');
        
        // Use LocaleUtils for building language selection
        const availableLanguages = localeUtils.buildLanguagePickItems(currentLocale, currentSetting);
        
        const selected = await vscode.window.showQuickPick(availableLanguages, {
            placeHolder: t('language.selectLanguage') || 'Choose language for AI.duino',
            title: `🌐 AI.duino ${t('language.changeLanguage') || 'Change Language'}`
        });
        
        if (selected && selected.value !== currentSetting) {
            try {
                await config.update('language', selected.value, vscode.ConfigurationTarget.Global);
                
                if (selected.value === 'auto') {
                    const vscodeLocale = vscode.env.language || 'en';
                    currentLocale = localeUtils.autoDetectLocale(vscodeLocale);
                } else {
                    currentLocale = selected.value;
                }
                
                // Load new locale file
                loadLocale();
                updateStatusBar();
                
                const successMessage = selected.value === 'auto' ? 
                    `Language set to Auto (${getLanguageInfo(currentLocale).name})` :
                    `Language changed to ${getLanguageInfo(currentLocale).name}`;
                
                vscode.window.showInformationMessage(successMessage);
                
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to switch language: ${error.message}`);
            }
        }
    } finally {
        executionStates.stop('switchLanguage');
    }
}

// ===== TOKEN MANAGEMENT =====

/**
 * Initialize token usage data structure for all models
 */
function initializeTokenUsage() {
    tokenUsage = {
        daily: new Date().toDateString()
    };
    
    // Initialize for each model
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        tokenUsage[modelId] = { input: 0, output: 0, cost: 0 };
    });
}

/**
 * Load token usage from file or initialize if needed
 */
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

/**
 * Queue token usage save with debouncing
 */
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

/**
 * Process the token save queue with atomic file operations
 */
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

/**
 * Estimate token count for text
 * @param {string} text - Text to analyze
 * @returns {number} Estimated token count
 */
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

/**
 * Update token usage statistics and costs
 * @param {string} modelId - Model identifier
 * @param {string} inputText - Input text
 * @param {string} outputText - Output text
 */
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

// ===== EVENT LISTENERS AND SETUP =====

/**
 * Setup all event listeners with proper cleanup
 * @param {vscode.ExtensionContext} context - VS Code extension context
 */
function setupEventListeners(context) {
    // Cleanup existing listeners FIRST
    disposeEventListeners();
    
    // Configuration change listener with debouncing
    let configDebounceTimeout = null;
    configListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('aiduino.language')) {
            if (configDebounceTimeout) {
                clearTimeout(configDebounceTimeout);
            }
            configDebounceTimeout = setTimeout(() => {
                try {
                    loadLocale();
                    updateStatusBar();
                } catch (error) {
                    // Silent error handling
                } finally {
                    configDebounceTimeout = null;
                }
            }, 300);
        }
    });
    
    // Diagnostics listener is now handled by ErrorChecker
    if (errorChecker) {
        diagnosticsListener = errorChecker.setupDiagnosticListener(context);
    }
    
    // Add to context subscriptions
    if (context && context.subscriptions) {
        context.subscriptions.push(configListener);
        // diagnosticsListener already added by errorChecker.setupDiagnosticListener
    }
}

/**
 * Dispose all event listeners with error handling
 */
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
    
    // Clear save timeout (ErrorChecker handles its own timeouts)
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
}

/**
 * Wrapper for error checking (delegates to ErrorChecker)
 * @param {boolean} silent - If true, don't show status updates
 * @returns {boolean} True if errors found
 */
async function checkForErrors(silent = true) {
    if (!errorChecker) return false;
    
    const hasErrors = await errorChecker.checkForErrors(silent);
    
    // Handle status bar updates here (where they belong)
    if (hasErrors && !silent) {
        const errorCount = errorChecker.getErrorStatus().lastDiagnosticsCount;
        const providerInfo = minimalModelManager.getProviderInfo(currentModel);
        statusBarItem.text = `${providerInfo.icon} AI.duino $(error)`;
        statusBarItem.tooltip = t('statusBar.errorsFound', errorCount) || `${errorCount} errors found`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        
        // Auto-clear after 5 seconds
        setTimeout(() => {
            const currentStatus = errorChecker.getErrorStatus();
            if (currentStatus.lastDiagnosticsCount === 0) {
                updateStatusBar();
            }
        }, 5000);
    } else if (!hasErrors) {
        updateStatusBar();
    }
    
    return hasErrors;
}

// ===== CORE FUNCTIONS =====

/**
 * Main activation function - entry point for the extension
 * @param {vscode.ExtensionContext} context - VS Code extension context
 */
function activate(context) {
    // Ensure clean state on activation
    if (globalContext) {
        // Extension was somehow already active - cleanup first
        deactivate();
    }    

    // Initialize Locale Utils first
    localeUtils = new LocaleUtils();
    
    // Load locale configuration
    loadLocale();

    // Store context globally
    globalContext = context;

    // Initialize token usage for all models
    initializeTokenUsage();
    
    // Load API keys and model configuration on startup
    Object.assign(apiKeys, fileManager.loadAllApiKeys(minimalModelManager.providers));
    const savedModel = fileManager.loadSelectedModel(minimalModelManager.providers);
    if (savedModel) currentModel = savedModel;
    
    // Load token statistics
    loadTokenUsage();
    
    // Initialize and show status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    updateStatusBar();
    statusBarItem.command = "aiduino.quickMenu";
    statusBarItem.show();

    // Update models in background (after 3 seconds)
    setTimeout(async () => {
        await minimalModelManager.updateModelsQuietly();
        updateStatusBar(); // Update statusbar with latest models
    }, 3000);

    // Schedule daily model updates
    setInterval(async () => {
        await minimalModelManager.updateModelsQuietly();
        updateStatusBar();
    }, 24 * 60 * 60 * 1000); // Every 24 hours

    // Initialize core managers
    errorChecker = new ErrorChecker();
    apiKeyManager = new ApiKeyManager();
    
    // Register all commands
    registerCommands(context);
    
    // Setup event listeners
    setupEventListeners(context);
        
    // Show welcome message if needed
    if (shouldShowWelcome()) {
        setTimeout(() => {
            showWelcomeMessage();
        }, 1000);
    }
}

/**
 * Register all extension commands using CommandRegistry
 * @param {vscode.ExtensionContext} context - VS Code extension context
 */
function registerCommands(context) {
    // Initialize Command Registry
    commandRegistry = new CommandRegistry();
    
    // Prepare dependencies for command handlers
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

/**
 * Dependency factory for feature modules
 * Provides all necessary dependencies in a centralized way
 * @returns {Object} Dependencies object
 */
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
        apiKeyManager,
        handleApiError: (error) => errorHandling.handleApiError(error, getDependencies()),
        setAiConversationContext: (newContext) => { 
            Object.assign(aiConversationContext, newContext); 
        }
    };
}

/**
 * Check if welcome message should be shown
 * @returns {boolean} True if no API keys are configured
 */
function shouldShowWelcome() {
    return Object.keys(minimalModelManager.providers).every(modelId => !apiKeys[modelId]);
}

/**
 * Main API call function - delegates to UnifiedAPIClient
 * @param {string} prompt - The prompt to send to AI
 * @returns {Promise} AI response promise
 */
const minimalModelManager = new MinimalModelManager();

function callAI(prompt) {   
    return apiClient.callAPI(currentModel, prompt, getDependencies());
}

// ===== UI FUNCTIONS =====

/**
 * Update status bar with current model info and token costs
 */
function updateStatusBar() {
    const providerInfo = minimalModelManager.getProviderInfo(currentModel);
    const hasApiKey = providerInfo.hasApiKey;
    
    // Token costs display
    const todayCost = tokenUsage[currentModel]?.cost.toFixed(3) || '0.000';
    const costDisplay = todayCost > 0 ? ` (${todayCost})` : '';
    
    if (hasApiKey) {
        statusBarItem.text = `${providerInfo.icon} AI.duino${costDisplay}`;
        
        // Model status information
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

/**
 * Show main quick menu with all available actions
 */
async function showQuickMenu() {
    const model = minimalModelManager.providers[currentModel];
    const hasApiKey = apiKeys[currentModel];
    const board = shared.detectArduinoBoard();
    const boardDisplay = shared.getBoardDisplayName(board);
    
    // Check API key first
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
    
    // Build menu items
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
        // Add follow-up option if context exists
        ...(shared.hasValidContext(aiConversationContext) ? [{
            label: '$(arrow-right) ' + t('commands.askFollowUp'),
            description: t('descriptions.askFollowUp', formatQuestionPreview(aiConversationContext.lastQuestion)),
            command: 'aiduino.askFollowUp'
        }] : []),
        {
            label: '$(globe) ' + t('commands.switchLanguage'),
            description: t('descriptions.currentLanguage', localeUtils.getCurrentLanguageName(currentLocale, vscode.workspace.getConfiguration('aiduino').get('language', 'auto'))),
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

/**
 * Show welcome message for new users
 */
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

/**
 * Format question preview for menu display
 * @param {string} question - The question to format
 * @returns {string} Formatted preview string
 */
function formatQuestionPreview(question) {
    if (!question) return '';
    const preview = question.length > 40 ? question.substring(0, 40) + '...' : question;
    const contextAge = Math.round((Date.now() - aiConversationContext.timestamp) / 60000);
    return `"${preview}" (${contextAge}min ago)`;
}

/**
 * Clear AI conversation context
 */
function clearAIContext() {
    aiConversationContext = {
        lastQuestion: null,
        lastAnswer: null,
        lastCode: null,
        timestamp: null
    };
    vscode.window.showInformationMessage(t('messages.contextCleared'));
}

/**
 * Get today's token usage summary
 * @returns {string} Usage summary string
 */
function getTodayUsage() {
    const usage = tokenUsage[currentModel];
    const totalTokens = usage.input + usage.output;
    return totalTokens > 0 ? `${totalTokens} tokens ($${usage.cost.toFixed(3)})` : '0 tokens';
}

// ===== MODEL/API MANAGEMENT =====

/**
 * Switch AI model with user selection and API key validation
 */
async function switchModel() {
    if (!executionStates.start(executionStates.OPERATIONS.SWITCH_MODEL)) {
        vscode.window.showInformationMessage("Model switch is already running! Please wait...");
        return;
    }
    
    try {
        // Build model selection items
        const items = Object.keys(minimalModelManager.providers).map(modelId => {
            const provider = minimalModelManager.providers[modelId];
            const currentModelInfo = minimalModelManager.getCurrentModel(modelId);
            return {
                label: `${provider.icon} ${provider.name}`,
                description: modelId === currentModel ? '✓ ' + t('labels.active') : currentModelInfo.name,
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
            
            // Check if API key is needed
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

/**
 * API Key setup wrapper - delegates to ApiKeyManager
 * @returns {Promise<boolean>} True if API key was successfully set
 */
async function setApiKey() {
    if (!apiKeyManager) {
        vscode.window.showErrorMessage("API Key Manager not initialized");
        return false;
    }
    
    // Prepare dependencies for ApiKeyManager
    const deps = {
        t,
        currentModel,
        providers: minimalModelManager.providers,
        fileManager,
        validation,
        apiKeys,
        updateStatusBar
    };
    
    return await apiKeyManager.setApiKey(deps);
}

/**
 * Get provider display name for a model
 * @param {string} modelId - Model identifier
 * @returns {string} Provider name or 'Unknown'
 */
function getProviderName(modelId) {
    return minimalModelManager.providers[modelId]?.name || 'Unknown';
}

// ===== CLEANUP & DEACTIVATION =====

/**
 * Extension deactivation with comprehensive cleanup
 * Ensures all resources are properly disposed of
 */
function deactivate() {
    // Cleanup command registry
    if (commandRegistry) {
        commandRegistry.dispose();
        commandRegistry = null;
    }

    // Cleanup error checker
    if (errorChecker) {
        errorChecker.dispose();
        errorChecker = null;
    }
    
    // Cleanup execution states
    if (executionStates) {
        // Clear all states
        executionStates.states.clear();
    }

    // Cleanup locale utils
    if (localeUtils) {
        localeUtils.clearCache();
        localeUtils = null;
    }

    // Cleanup API key manager
    if (apiKeyManager) {
        apiKeyManager.dispose();
        apiKeyManager = null;
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

// ===== EXPORTS =====
exports.activate = activate;
exports.deactivate = deactivate;
