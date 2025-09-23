/*
 * AI.duino
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
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
const { EventManager } = require('./core/eventManager');
const { CommandRegistry } = require('./core/commandRegistry');

// Feature modules
const shared = require('./shared');
const explainCodeFeature = require('./features/explainCode');
const improveCodeFeature = require('./features/improveCode');
const addCommentsFeature = require('./features/addComments');
const askAIFeature = require('./features/askAI');
const explainErrorFeature = require('./features/explainError');
const debugHelpFeature = require('./features/debugHelp');
const promptEditorFeature = require('./features/promptEditor'); 

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
const { PromptManager } = require('./utils/promptManager');
const { checkExtensionUpdate } = require('./utils/updateChecker');
const { StatusBarManager } = require('./utils/statusBarManager');
const { PromptHistoryManager } = require('./utils/promptHistory');
const { buildMenuItems } = require('./utils/menuBuilder');

// Configuration modules
const { LANGUAGE_METADATA, getLanguageInfo } = require('./config/languageMetadata');

// ===== CONSTANTS =====
const AIDUINO_DIR = path.join(os.homedir(), '.aiduino');
const EXTENSION_VERSION = fileManager.getVersionFromPackage();
const MODEL_FILE = path.join(AIDUINO_DIR, '.aiduino-model');
const TOKEN_USAGE_FILE = path.join(AIDUINO_DIR, '.aiduino-token-usage.json');

// ===== GLOBAL VARIABLES =====
// Core system state
let globalContext;
let currentModel = 'claude';
let currentLocale = 'en';
let i18n = {};
let isPromptEditorOpen = false;
let promptEditorHasChanges = false;

// Module instances
let commandRegistry;
let errorChecker;
let apiKeyManager;
let localeUtils;
let promptManager;
let statusBarManager;
let quickMenuTreeProvider;
let executionStates;
let eventManager;
let promptHistory;
const apiClient = new UnifiedAPIClient();

// Single instance of model manager
let configData;
let minimalModelManager;
let REMOTE_CONFIG_URL;

// Data stores
const apiKeys = {};
let tokenUsage = {};
let aiConversationContext = {
    lastQuestion: null,
    lastAnswer: null,
    lastCode: null,
    timestamp: null
};

// ===== MINIMAL MODEL MANAGER CLASS =====

/**
 * Minimal dynamic model system for AI.duino
 * Works completely in background, only shows latest model in statusbar
 */
class MinimalModelManager {
    constructor(providers = null) {
        this.providers = providers || {}; // Fallback to empty object
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
                icon: 'â"',
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
        if (!this.providers[providerId]) return false;
        const keyFile = path.join(AIDUINO_DIR, this.providers[providerId].keyFile);
        return fs.existsSync(keyFile);
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
        Object.keys(this.providers).forEach(providerId => {
            const hasKey = this.hasApiKey(providerId);
            const provider = this.providers[providerId];
        });
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
    
    // Simplified locale loading with single fallback
    const localeFile = path.join(__dirname, '..', 'locales', `${currentLocale}.json`);
    const fallbackFile = path.join(__dirname, '..', 'locales', 'en.json');
    
    // Try current locale first, then fallback to english
    const fileToTry = fs.existsSync(localeFile) ? localeFile : fallbackFile;
    
    if (fs.existsSync(fileToTry)) {
        const content = fs.readFileSync(fileToTry, 'utf8');
        i18n = JSON.parse(content);
    } else {
        // Emergency fallback
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
        vscode.window.showInformationMessage(t('messages.operationAlreadyRunning'));
        return;
    }
    
    try {
        if (isPromptEditorOpen && promptEditorHasChanges) {
            const choice = await vscode.window.showWarningMessage(
                t('promptEditor.unsavedWarning'),
                t('buttons.yes'),    
                t('buttons.cancel') 
            );
    
            if (choice !== t('buttons.yes')) {
                return;
            }
    
        promptEditorHasChanges = false;
        }
            
        const config = vscode.workspace.getConfiguration('aiduino');
        const currentSetting = config.get('language', 'auto');
        
        // Use LocaleUtils for building language selection
        const availableLanguages = localeUtils.buildLanguagePickItems(currentLocale, currentSetting, t);
        
        const selected = await vscode.window.showQuickPick(availableLanguages, {
            placeHolder: t('language.selectLanguage') || 'Choose language for AI.duino',
            title: `🌍 AI.duino ${t('language.changeLanguage') || 'Change Language'}`
        });
        
        if (selected && selected.value !== currentSetting) {
            await config.update('language', selected.value, vscode.ConfigurationTarget.Global);
            
            if (selected.value === 'auto') {
                const vscodeLocale = vscode.env.language || 'en';
                currentLocale = localeUtils.autoDetectLocale(vscodeLocale);
            } else {
                currentLocale = selected.value;
            }
            
            loadLocale();
            promptManager.initialize(i18n, currentLocale); 
            statusBarManager.updateFromContext(getDependencies());;

            if (quickMenuTreeProvider) {
                quickMenuTreeProvider.refresh();
            }

            if (isPromptEditorOpen) {
                vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                isPromptEditorOpen = false; 
            }
            
            const successMessage = selected.value === 'auto' ? 
                t('language.changed', `Auto (${getLanguageInfo(currentLocale).name})`) :
                t('language.changed', getLanguageInfo(currentLocale).name);
            vscode.window.showInformationMessage(successMessage);
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

    // Check if model manager is ready
    if (!minimalModelManager || !minimalModelManager.providers) {
        return;
    }
    
    // Initialize for each model
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        tokenUsage[modelId] = { input: 0, output: 0, cost: 0 };
    });
}

/**
 * Load token usage from file or initialize if needed
 */
function loadTokenUsage() {
    const currentDate = new Date();
    const today = currentDate.toDateString();
    
    // Check if file exists and is readable
    if (!fs.existsSync(TOKEN_USAGE_FILE)) {
        initializeTokenUsage();
        saveTokenUsage();
        return;
    }
    
    const fileContent = fs.readFileSync(TOKEN_USAGE_FILE, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Check if model manager is ready
    if (!minimalModelManager || !minimalModelManager.providers) {
        return; // Skip if no providers loaded
    }

    // Validate data structure and check date
    if (!data || typeof data !== 'object' || !data.daily || data.daily !== today) {
        // Different day or invalid data - reset
        initializeTokenUsage();
        saveTokenUsage();
        return;
    }
    
    // Same day - restore data
    tokenUsage = data;
    
    // Ensure all models exist in loaded data
    Object.keys(minimalModelManager.providers).forEach(modelId => {
        if (!tokenUsage[modelId]) {
            tokenUsage[modelId] = { input: 0, output: 0, cost: 0 };
        }
    });
    
    // Update status bar after loading
    if (statusBarManager) {
        statusBarManager.updateFromContext(getDependencies());;
    }
}

/**
 * Queue token usage save with debouncing
 */
function saveTokenUsage() {
    eventManager.debouncedSave(() => {
        const data = JSON.stringify(tokenUsage, null, 2);
        fs.writeFileSync(TOKEN_USAGE_FILE, data, { mode: 0o600 });
    });
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
 
   // Check if model manager is ready
    if (!minimalModelManager || !minimalModelManager.providers) {
        return;
    }
    // Calculate costs
    const model = minimalModelManager.providers[modelId];
    if (!model) return;
    const inputCost = inputTokens * model.prices.input;
    const outputCost = outputTokens * model.prices.output;
    tokenUsage[modelId].cost += (inputCost + outputCost);
    
    saveTokenUsage();
    statusBarManager.updateFromContext(getDependencies());;
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
        statusBarManager.showErrorState(errorCount, t, providerInfo);
        
        // Auto-clear after 5 seconds
        setTimeout(() => {
            const currentStatus = errorChecker.getErrorStatus();
            if (currentStatus.lastDiagnosticsCount === 0) {
                statusBarManager.updateFromContext(getDependencies());;
            }
        }, 5000);
    } else if (!hasErrors) {
        statusBarManager.updateFromContext(getDependencies());;
    }
    
    return hasErrors;
}

// ===== CORE FUNCTIONS =====

/**
 * Main activation function - entry point for the extension
 * @param {vscode.ExtensionContext} context - VS Code extension context
 */
function activate(context) {
    // Initialize config and model manager first
    configData = configUpdater.loadProviderConfigs();
    const { REMOTE_CONFIG_URL: remoteUrl } = require('./config/providerConfigs');
    REMOTE_CONFIG_URL = remoteUrl;
    minimalModelManager = new MinimalModelManager(configData.providers);
    
    // Ensure clean state on activation
    if (globalContext) {
        // Extension was somehow already active - cleanup first
        deactivate();
    }    

    // Initialize EventManager FIRST - before anything else
    eventManager = new EventManager();
    eventManager.initialize({
        updateStatusBar: () => statusBarManager.updateFromContext(getDependencies()),
        onConfigChange: () => {}
    });

    // Initialize Locale Utils first
    localeUtils = new LocaleUtils();

    // Generate AI.duino folder and migrate files
    if (!fs.existsSync(AIDUINO_DIR)) {
        fs.mkdirSync(AIDUINO_DIR, { mode: 0o700 });
        fileManager.migrateOldFiles(AIDUINO_DIR);
    }
    
    // Load locale configuration
    loadLocale();

    // Prompt manager
    promptManager = new PromptManager();
    promptManager.initialize(i18n, currentLocale); 

    // Initialize Prompt History Manager
    promptHistory = new PromptHistoryManager();

    // Store context globally
    globalContext = context;

    // Load API keys and model configuration on startup
    Object.assign(apiKeys, fileManager.loadAllApiKeys(minimalModelManager.providers));
    const savedModel = fileManager.loadSelectedModel(minimalModelManager.providers);
    if (savedModel) currentModel = savedModel;
    
    // Load token statistics (handles initialization internally)
    loadTokenUsage();
    
    // Initialize and show status bar
    statusBarManager = new StatusBarManager();
    statusBarManager.createStatusBar();
    statusBarManager.updateFromContext(getDependencies());;

    // Initialize Quick Menu Tree Provider
    quickMenuTreeProvider = new uiTools.QuickMenuTreeProvider();
    quickMenuTreeProvider.initialize(getDependencies());
    const treeView = vscode.window.createTreeView('aiduino.quickMenuView', {
        treeDataProvider: quickMenuTreeProvider,
        showCollapseAll: false
    });
    context.subscriptions.push(treeView);

    // Initialize core managers
    errorChecker = new ErrorChecker();
    apiKeyManager = new ApiKeyManager();
    executionStates = new ExecutionStateManager();
  
    // Auto-Update for providers
    configUpdater.setupAutoUpdates(getDependencies());

    // Check for extension updates
    setTimeout(() => {
        checkExtensionUpdate(EXTENSION_VERSION, t);
    }, 5000);

    // Register all commands
    registerCommands(context);
    
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
        switchModel: () => apiManager.switchModel(getDependencies()),
        setApiKey: () => apiManager.setApiKey(getDependencies()),
        switchLanguage,
        clearAIContext,
        
        // Feature modules  
        explainCodeFeature,
        improveCodeFeature,
        addCommentsFeature, 
        explainErrorFeature,
        debugHelpFeature,
        askAIFeature,
        promptEditorFeature,
        setPromptEditorOpen: (isOpen) => { isPromptEditorOpen = isOpen; },
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
        // Core functions
        t,
        callAI: (prompt) => apiManager.callAI(prompt, getDependencies()),
        handleApiError: (error) => errorHandling.handleApiError(error, getDependencies()),
        
        // System configuration
        currentModel,
        currentLocale,
        globalContext,
        EXTENSION_VERSION,
        REMOTE_CONFIG_URL,
        
        // Data stores
        apiKeys,
        tokenUsage,
        aiConversationContext,
        
        // Manager instances
        minimalModelManager,
        executionStates,
        localeUtils,
        promptManager,
        promptHistory,
        apiKeyManager,
        quickMenuTreeProvider,
        
        // Core clients/services
        apiClient,
        fileManager,
        validation,
        
        // UI functions
        updateStatusBar: statusBarManager.updateFromContext.bind(statusBarManager),
        setPromptEditorChanges: (hasChanges) => { promptEditorHasChanges = hasChanges; },
        
        // API functions
        switchModel: () => apiManager.switchModel(getDependencies()),
        updateTokenUsage,
        
        // State setters (callbacks)
        setCurrentModel: (newModel) => { currentModel = newModel; },
        setAiConversationContext: (newContext) => { 
            Object.assign(aiConversationContext, newContext); 
        }
    };
}

// ===== UI FUNCTIONS =====

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
    const items = buildMenuItems(getDependencies());
    
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: t('messages.selectAction'),
        title: `🤖 AI.duino v${EXTENSION_VERSION} (${model.name})`
    });
    
    if (selected && selected.command) {
        vscode.commands.executeCommand(selected.command);
    }
}

/**
 * Clear AI conversation context wrapper
 */
function clearAIContext() {
    Object.assign(aiConversationContext, fileManager.clearAIContext());
    vscode.window.showInformationMessage(t('messages.contextCleared'));
}

// ===== CLEANUP & DEACTIVATION =====

/**
 * Extension deactivation with comprehensive cleanup
 * Ensures all resources are properly disposed of
 */
function deactivate() {
    // Cleanup command registry
    commandRegistry.dispose();
    commandRegistry = null;

    // Cleanup error checker
    errorChecker.dispose();
    errorChecker = null;
    
    // Cleanup execution states
    executionStates.states.clear();

    // Cleanup locale utils
    localeUtils = null;

    // Cleanup API key manager
    apiKeyManager.dispose();
    apiKeyManager = null;
    
    // Force final save if queue has pending items
    // Emergency save without complex queue logic
    const data = JSON.stringify(tokenUsage, null, 2);
    fs.writeFileSync(TOKEN_USAGE_FILE, data, { mode: 0o600 });

    // Cleanup event manager
    eventManager.dispose();
    eventManager = null;
    
    // Cleanup status bar manager
    statusBarManager.dispose();
    statusBarManager = null;

    // Cleanup tree provider
    quickMenuTreeProvider = null;
    
    // Clear global references to prevent memory leaks
    globalContext = null;

    // Cleanup prompt manager
    if (promptManager) {
        promptManager = null;
    }

    if (promptHistory) {
        promptHistory.saveHistory(); // Final saving
        promptHistory = null;
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
