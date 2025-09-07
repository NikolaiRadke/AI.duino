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
const apiManager = require('./utils/apiManager');
const configUpdater = require('./utils/configUpdater');
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

// Load remote config URL once at module load
let remoteConfigUrl = null;
try {
    const { REMOTE_CONFIG_URL } = require('./config/providerConfigs');
    remoteConfigUrl = REMOTE_CONFIG_URL;
} catch (error) {
    // Silent error - auto-update will be disabled if URL is null
    remoteConfigUrl = null;
}

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

// ===== MINIMAL MODEL MANAGER CLASS =====
/**
 * Minimal dynamic model system for AI.duino
 * Works completely in background, only shows latest model in statusbar
 */
// VEREINFACHTER MODEL MANAGER - behält den Namen minimalModelManager

/**
 * Minimal Model Manager - Vereinfachte Version ohne Background-Updates
 * Fokus auf Provider-Info und API Key Management
 */
class MinimalModelManager {
    constructor(providers = null) {
        this.providers = providers || PROVIDER_CONFIGS; // Fallback
    }

    /**
     * Get provider info for status bar
     * @param {string} providerId - Provider identifier
     * @returns {Object} Provider information
     */
    getProviderInfo(providerId) {
        const provider = this.providers[providerId];
        if (!provider) {
            return {
                name: 'Unknown',
                icon: '❓',
                color: '#999999',
                modelName: 'Unknown',
                modelId: 'unknown',
                hasApiKey: false
            };
        }
        
        return {
            name: provider.name,
            icon: provider.icon,
            color: provider.color,
            modelName: this.cleanName(provider.fallback),
            modelId: provider.fallback,
            hasApiKey: this.hasApiKey(providerId)
        };
    }

    /**
     * Get current model info for provider (compatibility method)
     * @param {string} providerId - Provider identifier
     * @returns {Object} Model information
     */
    getCurrentModel(providerId) {
        const provider = this.providers[providerId];
        if (!provider) {
            return {
                id: 'unknown',
                name: 'Unknown',
                isFallback: true
            };
        }
        
        return {
            id: provider.fallback,
            name: this.cleanName(provider.fallback),
            isFallback: true
        };
    }

    /**
     * Check if provider has API key configured
     * @param {string} providerId - Provider identifier  
     * @returns {boolean} True if API key exists
     */
    hasApiKey(providerId) {
        try {
            const keyFile = path.join(os.homedir(), this.providers[providerId].keyFile);
            return fs.existsSync(keyFile);
        } catch {
            return false;
        }
    }

    /**
     * Clean model names for display
     * @param {string} rawName - Raw model name
     * @returns {string} Cleaned display name
     */
    cleanName(rawName) {
        return rawName
            .replace(/^models\//, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Debug helper: Show provider status
     * @returns {Object} Current providers for debugging
     */
    showCurrentModels() {
        console.log('AI.duino Provider Status:');
        Object.keys(this.providers).forEach(providerId => {
            const hasKey = this.hasApiKey(providerId);
            const provider = this.providers[providerId];
            console.log(`${providerId}: ${provider.fallback} - API Key: ${hasKey ? 'Yes' : 'No'}`);
        });
        console.log(`Active Provider: ${currentModel}`);
        return this.providers;
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
    // Einfaches Debouncing - clear previous timeout
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    // Save after short delay
    saveTimeout = setTimeout(() => {
        try {
            const data = JSON.stringify(tokenUsage, null, 2);
            fs.writeFileSync(TOKEN_USAGE_FILE, data, { mode: 0o600 });
        } catch (error) {
            // Silent error - token tracking is not critical
        } finally {
            saveTimeout = null;
        }
    }, 500);
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

    // Initialize core managers
    errorChecker = new ErrorChecker();
    apiKeyManager = new ApiKeyManager();
    
    // Auto-Update for providers
    configUpdater.setupAutoUpdates(getDependencies());

    // Register all commands
    registerCommands(context);
    
    // Setup event listeners
    setupEventListeners(context);
    
    // Show welcome message if needed
    if (uiTools.shouldShowWelcome(getDependencies())) {
        setTimeout(async () => {
            await uiTools.showWelcomeMessage(getDependencies());
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
    const { REMOTE_CONFIG_URL } = require('./config/providerConfigs');
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
        localeUtils,
        switchModel,
        apiClient, 
        fileManager,
        validation, 
        EXTENSION_VERSION,
        REMOTE_CONFIG_URL: remoteConfigUrl,
        updateTokenUsage,
        updateStatusBar,
        aiConversationContext,
        apiKeyManager,
        setCurrentModel: (newModel) => { currentModel = newModel; },  // <- Callback 
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
async function showWelcomeMessage() {
    await uiTools.showWelcomeMessage(getDependencies());
}

// NEUE VERSION:
function shouldShowWelcome() {
    return uiTools.shouldShowWelcome(getDependencies());
}

/**
 * Main API call function - delegates to UnifiedAPIClient
 * @param {string} prompt - The prompt to send to AI
 * @returns {Promise} AI response promise
 */
const configData = configUpdater.loadProviderConfigs();
const minimalModelManager = new MinimalModelManager(configData.providers);

function callAI(prompt) {
    return apiManager.callAI(prompt, getDependencies());
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
    
    // Build and show menu
    const items = uiTools.buildMenuItems(getDependencies());
    
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
    await uiTools.showWelcomeMessage(getDependencies());
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

// ===== MODEL/API MANAGEMENT =====

/**
 * Switch AI model with user selection and API key validation
 */
async function switchModel() {
    return await apiManager.switchModel(getDependencies());
}

/**
 * API Key setup wrapper - delegates to ApiKeyManager
 * @returns {Promise<boolean>} True if API key was successfully set
 */
async function setApiKey() {
    return await apiManager.setApiKey(getDependencies());
}

/**
 * Get provider display name for a model
 * @param {string} modelId - Model identifier
 * @returns {string} Provider name or 'Unknown'
 */
function getProviderName(modelId) {
    return apiManager.getProviderName(modelId, minimalModelManager);
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
    localeUtils = null;

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
    // Emergency save without complex queue logic
    try {
        const data = JSON.stringify(tokenUsage, null, 2);
        fs.writeFileSync(TOKEN_USAGE_FILE, data, { mode: 0o600 });
    } catch (error) {
        // Silent error on shutdown
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
