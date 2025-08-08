/*
 * AI.duino v1.3.0 - Internationalized Version
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");

// ========================================
// INTERNATIONALIZATION SYSTEM
// ========================================

let i18n = {};
let currentLocale = 'en';

function loadLocale() {
    // Get VS Code's display language
    const vscodeLocale = vscode.env.language || 'en';
    
    // Map VS Code locale to our supported locales
    const supportedLocales = ['en', 'de', 'es', 'fr', 'it', 'pt', 'zh', 'ja', 'ko', 'ru'];
    currentLocale = supportedLocales.includes(vscodeLocale.substring(0, 2)) 
        ? vscodeLocale.substring(0, 2) 
        : 'en';
    
    try {
        // Try to load the locale file
        const localeFile = path.join(__dirname, '..', 'locales', `${currentLocale}.json`);
        if (fs.existsSync(localeFile)) {
            i18n = JSON.parse(fs.readFileSync(localeFile, 'utf8'));
            console.log(`✅ Loaded locale: ${currentLocale}`);
        } else {
            // Fallback to English
            const englishFile = path.join(__dirname, '..', 'locales', 'en.json');
            i18n = JSON.parse(fs.readFileSync(englishFile, 'utf8'));
            currentLocale = 'en';
            console.log('✅ Loaded default locale: en');
        }
    } catch (error) {
        console.error('Failed to load locale files:', error);
        // Use embedded fallback if files can't be loaded
        i18n = getEmbeddedEnglishLocale();
    }
}

// Minimal embedded English locale as ultimate fallback
function getEmbeddedEnglishLocale() {
    return {
        commands: {
            quickMenu: "Open Quick Menu",
            switchModel: "Switch AI Model",
            setApiKey: "Enter API Key",
            improveCode: "Improve Code",
            explainCode: "Explain Code",
            addComments: "Add Comments",
            explainError: "Explain Error",
            debugHelp: "Debug Help",
            about: "About AI.duino..."
        },
        messages: {
            welcome: "Welcome! AI.duino v1.3.0 supports multiple AI models!",
            noApiKey: "First you need an API key for",
            selectAction: "What would you like to do?",
            markCode: "Please select the code you want to",
            noEditor: "No code editor active",
            apiKeySet: "API Key saved!",
            modelSwitched: "Switched to",
            codeImproved: "Code improved! What would you like to do?",
            replaceOriginal: "Replace original",
            keepBoth: "Keep both"
        }
    };
}

// Helper function to get localized string
function t(key, ...args) {
    const keys = key.split('.');
    let value = i18n;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            console.warn(`Missing translation: ${key}`);
            return key; // Return key as fallback
        }
    }
    
    // Replace placeholders {0}, {1}, etc. with arguments
    if (typeof value === 'string' && args.length > 0) {
        return value.replace(/{(\d+)}/g, (match, index) => {
            return args[parseInt(index)] || match;
        });
    }
    
    return value;
}

// ========================================
// MODULAR AI MODEL CONFIGURATION
// ========================================

const AI_MODELS = {
    claude: {
        name: 'Claude',
        fullName: 'Claude-3.5-Sonnet',
        icon: '🤖',
        keyFile: '.aiduino-claude-api-key',
        keyPrefix: 'sk-ant-',
        keyMinLength: 50,
        prices: {
            input: 0.003 / 1000,   // $3 per 1M tokens
            output: 0.015 / 1000   // $15 per 1M tokens
        },
        color: '#6B46C1'
    },
    chatgpt: {
        name: 'ChatGPT',
        fullName: 'GPT-4',
        icon: '🧠',
        keyFile: '.aiduino-openai-api-key',
        keyPrefix: 'sk-',
        keyMinLength: 40,
        prices: {
            input: 0.03 / 1000,    // $30 per 1M tokens
            output: 0.06 / 1000    // $60 per 1M tokens
        },
        color: '#10A37F'
    },
    gemini: {
        name: 'Gemini',
        fullName: 'Gemini 1.5 Flash',
        icon: '💎',
        keyFile: '.aiduino-gemini-api-key',
        keyPrefix: 'AIza',
        keyMinLength: 39,
        prices: {
            input: 0.00025 / 1000,  // $0.25 per 1M tokens
            output: 0.0005 / 1000   // $0.50 per 1M tokens
        },
        color: '#4285F4'
    },
    mistral: {
        name: 'Mistral',
        fullName: 'Mistral Large',
        icon: '🌟',
        keyFile: '.aiduino-mistral-api-key',
        keyPrefix: 'sk-',
        keyMinLength: 32,
        prices: {
            input: 0.004 / 1000,   // $4 per 1M tokens
            output: 0.012 / 1000   // $12 per 1M tokens
        },
        color: '#FF7000'
    }
};

// Global variables
let statusBarItem;
let globalContext;
let currentModel = 'claude';
const apiKeys = {};
const MODEL_FILE = path.join(os.homedir(), '.aiduino-model');

// Token tracking
let tokenUsage = {};
const TOKEN_USAGE_FILE = path.join(os.homedir(), '.aiduino-token-usage.json');

// ========================================
// ACTIVATION & INITIALIZATION
// ========================================

function activate(context) {
    console.log('🤖 AI.duino v1.3.0 activated!');
    
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
    
    // Status bar with tooltip
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    updateStatusBar();
    statusBarItem.command = "aiduino.quickMenu";
    statusBarItem.show();
    
    // Register commands
    registerCommands(context);
    
    // Welcome message
    if (shouldShowWelcome()) {
        setTimeout(() => {
            showWelcomeMessage();
        }, 1000);
    }
    
    // Auto error detection
    let errorTimeout;
    vscode.languages.onDidChangeDiagnostics(e => {
        clearTimeout(errorTimeout);
        errorTimeout = setTimeout(() => checkForErrors(), 1000);
    });
}
exports.activate = activate;

function registerCommands(context) {
    const commands = [
        { name: 'aiduino.quickMenu', handler: showQuickMenu }, 
        { name: 'aiduino.switchModel', handler: switchModel },
        { name: 'aiduino.setApiKey', handler: setApiKey },
        { name: 'aiduino.explainCode', handler: explainCode },
        { name: 'aiduino.improveCode', handler: improveCode },
        { name: 'aiduino.addComments', handler: addComments },
        { name: 'aiduino.explainError', handler: explainError },
        { name: 'aiduino.debugHelp', handler: debugHelp },
        { name: 'aiduino.showTokenStats', handler: showTokenStats },
        { name: 'aiduino.about', handler: showAbout },
        { name: 'aiduino.resetTokenStats', handler: resetTokenStats }
    ];
    
    commands.forEach(cmd => {
        context.subscriptions.push(
            vscode.commands.registerCommand(cmd.name, cmd.handler)
        );
    });
    
    context.subscriptions.push(statusBarItem);
}

function initializeTokenUsage() {
    tokenUsage = {
        daily: new Date().toDateString()
    };
    
    // Initialize for each model
    Object.keys(AI_MODELS).forEach(modelId => {
        tokenUsage[modelId] = { input: 0, output: 0, cost: 0 };
    });
}

function shouldShowWelcome() {
    return Object.keys(AI_MODELS).every(modelId => !apiKeys[modelId]);
}

// ========================================
// CONFIGURATION MANAGEMENT
// ========================================

function loadApiKeys() {
    Object.keys(AI_MODELS).forEach(modelId => {
        const model = AI_MODELS[modelId];
        const keyFile = path.join(os.homedir(), model.keyFile);
        
        try {
            if (fs.existsSync(keyFile)) {
                apiKeys[modelId] = fs.readFileSync(keyFile, 'utf8').trim();
                console.log(`✅ ${model.name} API Key loaded`);
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
            if (AI_MODELS[savedModel]) {
                currentModel = savedModel;
                console.log('✅ Selected model:', currentModel);
            }
        }
    } catch (error) {
        console.log('❌ Error loading model:', error);
    }
}

function saveSelectedModel() {
    try {
        fs.writeFileSync(MODEL_FILE, currentModel, { mode: 0o600 });
    } catch (error) {
        console.log('❌ Error saving model:', error);
    }
}

// ========================================
// TOKEN MANAGEMENT
// ========================================

function loadTokenUsage() {
    try {
        const currentDate = new Date();
        const today = currentDate.toDateString();
        
        console.log('=== TOKEN USAGE LOADING ===');
        console.log('Current date:', today);
        console.log('Timestamp:', currentDate.toISOString());
        
        if (fs.existsSync(TOKEN_USAGE_FILE)) {
            const fileContent = fs.readFileSync(TOKEN_USAGE_FILE, 'utf8');
            console.log('File content:', fileContent);
            
            const data = JSON.parse(fileContent);
            console.log('Saved date:', data.daily);
            console.log('Date comparison:', data.daily === today);
            
            // Check if it's the same day
            if (data.daily === today) {
                // Same day - take over data
                tokenUsage = data;
                console.log('✅ Token statistics loaded from same day');
                
                // Ensure all models exist
                Object.keys(AI_MODELS).forEach(modelId => {
                    if (!tokenUsage[modelId]) {
                        tokenUsage[modelId] = { input: 0, output: 0, cost: 0 };
                    }
                });
            } else {
                // Different day - reset
                console.log('🔄 New day detected - resetting statistics');
                console.log('Old:', data.daily, 'New:', today);
                initializeTokenUsage();
                saveTokenUsage();
            }
        } else {
            // No file present
            console.log('📄 No token file found - creating new');
            initializeTokenUsage();
            saveTokenUsage();
        }
        
        // Update status bar after loading
        if (statusBarItem) {
            updateStatusBar();
        }
        
    } catch (error) {
        console.error('❌ Error loading token statistics:', error);
        
        // Start with empty values on error
        initializeTokenUsage();
        saveTokenUsage();
    }
}

function saveTokenUsage() {
    try {
        fs.writeFileSync(TOKEN_USAGE_FILE, JSON.stringify(tokenUsage, null, 2));
    } catch (error) {
        console.log('Error saving token usage:', error);
    }
}

function estimateTokens(text) {
    if (!text) return 0;
    
    // Base: ~4 characters = 1 token for normal text
    let tokens = text.length / 4;
    
    // Code has more tokens due to syntax
    const codeIndicators = text.match(/[{}()\[\];,.<>]/g);
    if (codeIndicators) {
        tokens += codeIndicators.length * 0.3;
    }
    
    // New lines also count as tokens
    const newlines = text.match(/\n/g);
    if (newlines) {
        tokens += newlines.length;
    }
    
    return Math.ceil(tokens);
}

function updateTokenUsage(modelId, inputText, outputText) {
    const inputTokens = estimateTokens(inputText);
    const outputTokens = estimateTokens(outputText);
    
    tokenUsage[modelId].input += inputTokens;
    tokenUsage[modelId].output += outputTokens;
    
    // Calculate costs
    const model = AI_MODELS[modelId];
    const inputCost = inputTokens * model.prices.input;
    const outputCost = outputTokens * model.prices.output;
    tokenUsage[modelId].cost += (inputCost + outputCost);
    
    saveTokenUsage();
    updateStatusBar();
}

// ========================================
// UI FUNCTIONS
// ========================================

function updateStatusBar() {
    const model = AI_MODELS[currentModel];
    const hasApiKey = apiKeys[currentModel];
    
    // Costs for today
    const todayCost = tokenUsage[currentModel].cost.toFixed(3);
    const costDisplay = todayCost > 0 ? ` ($${todayCost})` : '';
    
    if (hasApiKey) {
        statusBarItem.text = `${model.icon} AI.duino${costDisplay}`;
        statusBarItem.tooltip = t('statusBar.tooltip', 
            model.name,
            tokenUsage[currentModel].input + tokenUsage[currentModel].output,
            costDisplay,
            tokenUsage[currentModel].input,
            tokenUsage[currentModel].output
        );
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = `${model.icon} AI.duino $(warning)`;
        statusBarItem.tooltip = t('statusBar.noApiKey', model.name);
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

// ========================================
// MENU FUNCTIONS
// ========================================

async function showWelcomeMessage() {
    const modelList = Object.values(AI_MODELS).map(m => m.name).join(', ');
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
    const model = AI_MODELS[currentModel];
    const hasApiKey = apiKeys[currentModel];
    
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
    // const hasErrors = await checkForErrors(false);  // AUSKOMMENTIERT
    
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
            description: t('descriptions.noErrors'),  // GEÄNDERT - hasErrors entfernt
            command: 'aiduino.explainError'
        },
        {
            label: '$(bug) ' + t('commands.debugHelp'),
            description: t('descriptions.debugHelp'),
            command: 'aiduino.debugHelp'
        },
        {
            label: '$(sync) ' + t('commands.switchModel'),
            description: t('descriptions.currentModel', model.name),
            command: 'aiduino.switchModel'
        },
        {
            label: '$(key) ' + t('commands.changeApiKey'),
            description: model.name + ' Key',
            command: 'aiduino.setApiKey'
        },
        {
            label: '$(graph) ' + t('commands.tokenStats'),
            description: 'Token-Statistik',  // GEÄNDERT - generateTokenStatsDescription() entfernt
            command: 'aiduino.showTokenStats'
        },
        {
            label: '$(info) ' + t('commands.about'),
            description: 'Version 1.3.0',
            command: 'aiduino.about'
        }
    ];
    
    // .filter() entfernt - alle Items bleiben
    
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: t('messages.selectAction'),
        title: `🤖 AI.duino v1.3.0 (${model.name})`
    });
    
    if (selected && selected.command) {
        vscode.commands.executeCommand(selected.command);
    }
}

// ========================================
// MODEL MANAGEMENT
// ========================================

async function switchModel() {
    const items = Object.keys(AI_MODELS).map(modelId => {
        const model = AI_MODELS[modelId];
        const provider = getProviderName(modelId);
        return {
            label: `${model.icon} ${model.name} (${provider})`,
            description: currentModel === modelId ? '✓ ' + t('labels.active') : model.fullName,
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
        
        // Check if API key exists
        if (!apiKeys[currentModel]) {
            const model = AI_MODELS[currentModel];
            const choice = await vscode.window.showWarningMessage(
                t('messages.apiKeyRequired', model.name),
                t('buttons.enterNow'),
                t('buttons.later')
            );
            if (choice === t('buttons.enterNow')) {
                await setApiKey();
            }
        } else {
            const model = AI_MODELS[currentModel];
            vscode.window.showInformationMessage(t('messages.modelSwitched', model.name));
        }
    }
}

async function setApiKey() {
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
}

function getProviderName(modelId) {
    const providers = {
        claude: 'Claude',
        chatgpt: 'OpenAI',
        gemini: 'Google',
        mistral: 'Mistral'
    };
    return providers[modelId] || AI_MODELS[modelId].name;
}

// ========================================
// ERROR HANDLING
// ========================================

function handleApiError(error) {
    const model = AI_MODELS[currentModel];
    
    // Specific error handling
    if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT') || 
        error.message.includes('ECONNREFUSED') || error.message.includes(t('errors.networkError'))) {
        
        vscode.window.showErrorMessage(
            t('errors.noInternet'),
            t('buttons.retry'),
            t('buttons.offlineHelp')
        ).then(selection => {
            if (selection === t('buttons.retry')) {
                vscode.window.showInformationMessage(t('messages.retryLater'));
            } else if (selection === t('buttons.offlineHelp')) {
                showOfflineHelp();
            }
        });
        
    } else if (error.message.includes('API Key')) {
        vscode.window.showErrorMessage(
            `🔑 ${error.message}`,
            t('buttons.enterApiKey'),
            t('buttons.switchModel')
        ).then(selection => {
            if (selection === t('buttons.enterApiKey')) {
                vscode.commands.executeCommand('aiduino.setApiKey');
            } else if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            }
        });
        
    } else if (error.message.includes('Rate Limit')) {
        vscode.window.showErrorMessage(
            t('errors.rateLimit', model.name),
            t('buttons.switchModel'),
            t('buttons.tryLater')
        ).then(selection => {
            if (selection === t('buttons.switchModel')) {
                vscode.commands.executeCommand('aiduino.switchModel');
            }
        });
        
    } else {
        vscode.window.showErrorMessage(t('errors.apiError', model.name, error.message));
    }
}

async function withRetryableProgress(title, task) {
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
        try {
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: retryCount > 0 ? t('progress.retrying', title, retryCount + 1, maxRetries) : title,
                cancellable: true
            }, async (progress, token) => {
                token.onCancellationRequested(() => {
                    console.log("User cancelled the operation");
                });
                
                if (token.isCancellationRequested) {
                    throw new Error(t('errors.operationCancelled'));
                }
                
                return await task();
            });
        } catch (error) {
            retryCount++;
            
            if (error.message.includes(t('errors.networkError')) || 
                error.message.includes(t('errors.timeout')) ||
                error.message.includes(t('errors.unreachable'))) {
                
                if (retryCount < maxRetries) {
                    const retry = await vscode.window.showWarningMessage(
                        t('messages.connectionError'),
                        t('buttons.yes'),
                        t('buttons.no')
                    );
                    
                    if (retry !== t('buttons.yes')) {
                        throw error;
                    }
                    
                    // Wait before next retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                } else {
                    throw error;
                }
            } else {
                throw error;
            }
        }
    }
}

// ========================================
// ERROR DIAGNOSIS
// ========================================

async function checkForErrors(silent = true) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.ino')) {
        return false;
    }
    
    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
    
    if (errors.length > 0 && !silent) {
        const model = AI_MODELS[currentModel];
        statusBarItem.text = `${model.icon} AI.duino $(error)`;
        statusBarItem.tooltip = t('statusBar.errorsFound', errors.length);
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        
        setTimeout(() => updateStatusBar(), 5000);
    }
    
    return errors.length > 0;
}

// ========================================
// CENTRAL API CALL FUNCTION
// ========================================

function callAI(prompt) {
    const apiHandlers = {
        claude: callClaudeAPI,
        chatgpt: callChatGPTAPI,
        gemini: callGeminiAPI,
        mistral: callMistralAPI
    };
    
    const handler = apiHandlers[currentModel];
    if (!handler) {
        return Promise.reject(new Error(t('errors.unknownModel', currentModel)));
    }
    
    return handler(prompt);
}

// ========================================
// CLAUDE API
// ========================================

function callClaudeAPI(prompt) {
    return new Promise((resolve, reject) => {
        if (!apiKeys.claude) {
            reject(new Error(t('errors.noApiKey', 'Claude')));
            return;
        }

        // Timeout for requests
        const timeout = setTimeout(() => {
            req.destroy();
            reject(new Error(t('errors.timeout')));
        }, 30000); // 30 seconds timeout

        const data = JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 2000,
            messages: [{ 
                role: "user", 
                content: prompt 
            }]
        });

        const options = {
            hostname: 'api.anthropic.com',
            port: 443,
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'x-api-key': apiKeys.claude,
                'anthropic-version': '2023-06-01'
            }
        };

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
                        const response = parsedData.content[0].text;
                        updateTokenUsage('claude', prompt, response);
                        console.log('Claude tokens tracked:', estimateTokens(prompt), 'in,', estimateTokens(response), 'out');
                        resolve(response);
                    } else {
                        // Specific error messages
                        switch(res.statusCode) {
                            case 401:
                                reject(new Error(t('errors.invalidApiKey', 'Claude')));
                                break;
                            case 429:
                                reject(new Error(t('errors.rateLimit', 'Claude')));
                                break;
                            case 500:
                            case 502:
                            case 503:
                                reject(new Error(t('errors.serverUnavailable', 'Claude')));
                                break;
                            default:
                                reject(new Error(t('errors.apiErrorWithCode', 'Claude', res.statusCode, parsedData.error?.message || t('errors.unknownError'))));
                        }
                    }
                } catch (e) {
                    reject(new Error(t('errors.parseError', 'Claude')));
                }
            });
        });

        req.on('error', (e) => {
            clearTimeout(timeout);
            reject(handleNetworkError(e));
        });

        req.write(data);
        req.end();
    });
}

// ========================================
// CHATGPT API
// ========================================

function callChatGPTAPI(prompt) {
    return new Promise((resolve, reject) => {
        if (!apiKeys.chatgpt) {
            reject(new Error(t('errors.noApiKey', 'OpenAI')));
            return;
        }

        const timeout = setTimeout(() => {
            req.destroy();
            reject(new Error(t('errors.timeout')));
        }, 30000);

        const systemPrompt = t('prompts.systemPrompt');
        
        const data = JSON.stringify({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                { 
                    role: "user", 
                    content: prompt 
                }
            ],
            max_tokens: 2000,
            temperature: 0.7
        });

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'Authorization': `Bearer ${apiKeys.chatgpt}`
            }
        };

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
                        const response = parsedData.choices[0].message.content;
                        updateTokenUsage('chatgpt', prompt, response);
                        console.log('ChatGPT tokens tracked:', estimateTokens(prompt), 'in,', estimateTokens(response), 'out');
                        resolve(response);
                    } else {
                        switch(res.statusCode) {
                            case 401:
                                reject(new Error(t('errors.invalidApiKey', 'OpenAI')));
                                break;
                            case 429:
                                reject(new Error(t('errors.rateLimit', 'ChatGPT')));
                                break;
                            case 500:
                            case 502:
                            case 503:
                                reject(new Error(t('errors.serverUnavailable', 'OpenAI')));
                                break;
                            default:
                                reject(new Error(t('errors.apiErrorWithCode', 'OpenAI', res.statusCode, parsedData.error?.message || t('errors.unknownError'))));
                        }
                    }
                } catch (e) {
                    reject(new Error(t('errors.parseError', 'ChatGPT')));
                }
            });
        });

        req.on('error', (e) => {
            clearTimeout(timeout);
            reject(handleNetworkError(e));
        });

        req.write(data);
        req.end();
    });
}

// ========================================
// GEMINI API
// ========================================

function callGeminiAPI(prompt) {
    return new Promise((resolve, reject) => {
        if (!apiKeys.gemini) {
            reject(new Error(t('errors.noApiKey', 'Gemini')));
            return;
        }

        const timeout = setTimeout(() => {
            req.destroy();
            reject(new Error(t('errors.timeout')));
        }, 30000);

        const data = JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeys.gemini}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

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
                        if (parsedData.candidates && parsedData.candidates[0] && 
                            parsedData.candidates[0].content && 
                            parsedData.candidates[0].content.parts && 
                            parsedData.candidates[0].content.parts[0]) {
                            
                            const response = parsedData.candidates[0].content.parts[0].text;
                            updateTokenUsage('gemini', prompt, response);
                            console.log('Gemini tokens tracked:', estimateTokens(prompt), 'in,', estimateTokens(response), 'out');
                            resolve(response);
                        } else {
                            reject(new Error(t('errors.unexpectedResponse', 'Gemini')));
                        }
                    } else {
                        switch(res.statusCode) {
                            case 401:
                            case 403:
                                reject(new Error(t('errors.invalidApiKey', 'Gemini')));
                                break;
                            case 429:
                                reject(new Error(t('errors.rateLimit', 'Gemini')));
                                break;
                            case 500:
                            case 502:
                            case 503:
                                reject(new Error(t('errors.serverUnavailable', 'Google')));
                                break;
                            default:
                                reject(new Error(t('errors.apiErrorWithCode', 'Gemini', res.statusCode, parsedData.error?.message || t('errors.unknownError'))));
                        }
                    }
                } catch (e) {
                    reject(new Error(t('errors.parseError', 'Gemini') + ': ' + e.message));
                }
            });
        });

        req.on('error', (e) => {
            clearTimeout(timeout);
            reject(handleNetworkError(e));
        });

        req.write(data);
        req.end();
    });
}

// ========================================
// MISTRAL API
// ========================================

function callMistralAPI(prompt) {
    return new Promise((resolve, reject) => {
        if (!apiKeys.mistral) {
            reject(new Error(t('errors.noApiKey', 'Mistral')));
            return;
        }

        const timeout = setTimeout(() => {
            req.destroy();
            reject(new Error(t('errors.timeout')));
        }, 30000);

        const systemPrompt = t('prompts.systemPrompt');
        
        const data = JSON.stringify({
            model: "mistral-large-latest",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                { 
                    role: "user", 
                    content: prompt 
                }
            ],
            max_tokens: 2000,
            temperature: 0.7
        });

        const options = {
            hostname: 'api.mistral.ai',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'Authorization': `Bearer ${apiKeys.mistral}`
            }
        };

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
                        const response = parsedData.choices[0].message.content;
                        updateTokenUsage('mistral', prompt, response);
                        console.log('Mistral tokens tracked:', estimateTokens(prompt), 'in,', estimateTokens(response), 'out');
                        resolve(response);
                    } else {
                        switch(res.statusCode) {
                            case 401:
                                reject(new Error(t('errors.invalidApiKey', 'Mistral')));
                                break;
                            case 429:
                                reject(new Error(t('errors.rateLimit', 'Mistral')));
                                break;
                            case 500:
                            case 502:
                            case 503:
                                reject(new Error(t('errors.serverUnavailable', 'Mistral')));
                                break;
                            default:
                                reject(new Error(t('errors.apiErrorWithCode', 'Mistral', res.statusCode, parsedData.error?.message || t('errors.unknownError'))));
                        }
                    }
                } catch (e) {
                    reject(new Error(t('errors.parseError', 'Mistral')));
                }
            });
        });

        req.on('error', (e) => {
            clearTimeout(timeout);
            reject(handleNetworkError(e));
        });

        req.write(data);
        req.end();
    });
}

// ========================================
// NETWORK ERROR HANDLING
// ========================================

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

// ========================================
// CODE ANALYSIS FUNCTIONS
// ========================================

async function explainCode() {
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
    
    const prompt = t('prompts.explainCode', selectedText);
    
    try {
        const model = AI_MODELS[currentModel];
        await withRetryableProgress(
            t('progress.explaining', model.name),
            async () => {
                const response = await callAI(prompt);
                
                const outputChannel = vscode.window.createOutputChannel(t('output.codeExplanation', model.name));
                outputChannel.clear();
                outputChannel.appendLine(`🤖 ${t('output.explanationFrom', model.name.toUpperCase())}`);
                outputChannel.appendLine('='.repeat(50));
                outputChannel.appendLine('');
                outputChannel.appendLine(response);
                outputChannel.show();
            }
        );
    } catch (error) {
        handleApiError(error);
    }
}

async function improveCode() {
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
    
    // Load saved custom instructions
    const savedInstructions = globalContext.globalState.get('aiduino.customInstructions', '');
    
    // Dialog for custom instructions
    const customInstructions = await vscode.window.showInputBox({
        prompt: t('prompts.customInstructions'),
        placeHolder: t('placeholders.customInstructions'),
        value: savedInstructions,
        ignoreFocusOut: true
    });
    
    // Cancel if user pressed Cancel
    if (customInstructions === undefined) {
        return;
    }
    
    // Save instructions for next time
    globalContext.globalState.update('aiduino.customInstructions', customInstructions);
    
    // Build prompt
    let prompt = t('prompts.improveCode', selectedText);

    // Add custom instructions if provided
    if (customInstructions && customInstructions.trim()) {
        const instructions = customInstructions.split(',').map(s => s.trim()).join('\n- ');
        prompt += '\n\n' + t('prompts.additionalInstructions', instructions);
    }

    prompt += '\n\n' + t('prompts.improveCodeSuffix');
    
    try {
        const model = AI_MODELS[currentModel];
        
        // Get response with progress indicator
        const response = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: t('progress.optimizing', model.name),
            cancellable: false
        }, async () => {
            return await callAI(prompt);
        });
        
        // Remove markdown code block markers and extract code + comments separately
        let cleanedResponse = response;
        let extractedCode = '';
        let aiComments = '';
        
        // Search for pattern ```cpp...``` and extract code and comments
        const codeBlockMatch = cleanedResponse.match(/```(?:cpp|c\+\+|arduino)?\s*\n([\s\S]*?)\n```([\s\S]*)?/);
        if (codeBlockMatch) {
            // Code from block
            extractedCode = codeBlockMatch[1].trim();
            // Comments after block (if present)
            aiComments = codeBlockMatch[2] ? codeBlockMatch[2].trim() : '';
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

        // Create document - WITH comments for display
        try {
            let displayContent = extractedCode;
            if (aiComments) {
                displayContent += '\n\n/* ========== ' + t('labels.aiHints') + ' ==========\n' + aiComments + '\n================================== */';
            }
    
            const doc = await vscode.workspace.openTextDocument({
                content: displayContent,  // Code + comments
                language: 'cpp'
            });
            
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        } catch (docError) {
            console.log('Document display warning (can be ignored):', docError.message);
        }

        // Choice dialog
        const choice = await vscode.window.showInformationMessage(
            t('messages.codeImproved'),
            t('buttons.replaceOriginal'),
            t('buttons.keepBoth')
        );

        if (choice === t('buttons.replaceOriginal')) {
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, extractedCode);  // ONLY the code, without AI comments
            });
            vscode.window.showInformationMessage(t('messages.codeReplaced'));
        }
        
    } catch (error) {
        handleApiError(error);
    }
}

async function addComments() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    
    if (!selectedText.trim()) {
        vscode.window.showWarningMessage(
            t('messages.selectCodeToComment')
        );
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
    let prompt = t('prompts.addComments', selectedText);

    // Add custom instructions if provided
    if (customInstructions && customInstructions.trim()) {
        const instructions = customInstructions.split(',').map(s => s.trim()).join('\n- ');
        prompt += '\n\n' + t('prompts.additionalInstructions', instructions);
    }

    prompt += '\n\n' + t('prompts.addCommentsSuffix');
    
    try {
        const model = AI_MODELS[currentModel];
        
        // Get response with progress indicator
        const response = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: t('progress.addingComments', model.name),
            cancellable: false
        }, async () => {
            return await callAI(prompt);
        });
        
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
        
        // Create and show document
        try {
            const doc = await vscode.workspace.openTextDocument({
                content: extractedCode,
                language: 'cpp'
            });
            
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        } catch (docError) {
            console.log('Document display warning (can be ignored):', docError.message);
        }
        
        // Choice dialog
        const choice = await vscode.window.showInformationMessage(
            t('messages.commentsAdded'),
            t('buttons.replaceCode'),
            t('buttons.keepAsIs')
        );
        
        if (choice === t('buttons.replaceCode')) {
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, extractedCode);
            });
            vscode.window.showInformationMessage(t('messages.codeUpdated'));
        }
        
    } catch (error) {
        handleApiError(error);
    }
}

// ========================================
// ERROR ANALYSIS
// ========================================

async function explainError() {
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
    
    const prompt = t('prompts.explainError', errorInput, line + 1, codeContext);
    
    try {
        const model = AI_MODELS[currentModel];
        await withRetryableProgress(
            t('progress.analyzingError', model.name),
            async () => {
                const response = await callAI(prompt);
                
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
            }
        );
    } catch (error) {
        handleApiError(error);
    }
}

// ========================================
// DEBUG HELP
// ========================================

async function debugHelp() {
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
            prompt = t('prompts.hardwareDebug', hardwareCode);
            break;
            
        case 'debug':
            const debugCode = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
            prompt = t('prompts.addDebugStatements', debugCode);
            break;
            
        case 'timing':
            const timingCode = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
            prompt = t('prompts.analyzeTiming', timingCode);
            break;
    }
    
    if (needsCode && editor.selection.isEmpty) {
        vscode.window.showWarningMessage(
            t('messages.selectRelevantCode')
        );
        return;
    }
    
    try {
        const model = AI_MODELS[currentModel];
        await withRetryableProgress(
            t('progress.analyzingProblem', model.name),
            async () => {
                const response = await callAI(prompt);
                
                const panel = vscode.window.createWebviewPanel(
                    'aiDebug',
                    t('panels.debugHelp'),
                    vscode.ViewColumn.Beside,
                    { enableScripts: true }
                );
                
                panel.webview.html = createDebugHelpHtml(selected.label, response, currentModel);
            }
        );
    } catch (error) {
        handleApiError(error);
    }
}

// ========================================
// HTML GENERATION
// ========================================

function createErrorExplanationHtml(error, line, explanation, modelId) {
    const model = AI_MODELS[modelId];
    const modelBadge = `<span style="background: ${model.color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${model.name}</span>`;
    
    // Replace newlines with <br> for HTML display
    const htmlExplanation = explanation.replace(/\n/g, '<br>');
    
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
                <code>${error}</code>
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
    const model = AI_MODELS[modelId];
    const modelBadge = `<span style="background: ${model.color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${model.name}</span>`;
    
    const htmlContent = content.replace(/\n/g, '<br>');
    
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
            <div class="header">
                <h1>${title}</h1>
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

// ========================================
// OFFLINE HELP
// ========================================

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

// ========================================
// TOKEN STATISTICS
// ========================================

function showTokenStats() {
    let totalCostToday = 0;
    Object.keys(AI_MODELS).forEach(modelId => {
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
    Object.keys(AI_MODELS).forEach(modelId => {
        const model = AI_MODELS[modelId];
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

// ========================================
// ABOUT & INFO
// ========================================

function showAbout() {
    const panel = vscode.window.createWebviewPanel(
        'aiduinoAbout',
        t('panels.about'),
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    
    // Generate model badges
    let modelBadges = '';
    Object.keys(AI_MODELS).forEach(modelId => {
        const model = AI_MODELS[modelId];
        modelBadges += `
            <span class="model-badge" style="background: ${model.color}; margin: 0 5px;">
                ${model.icon} ${model.name}
            </span>
        `;
    });
    
    // Generate feature list for all models
    let modelFeatures = '';
    Object.keys(AI_MODELS).forEach(modelId => {
        const model = AI_MODELS[modelId];
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
            <div class="version">Version 1.3.0</div>
            
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
                    <li>✨ ${t('about.change2')}</li>
                    <li>✨ ${t('about.change3')}</li>
                </ul>
            </div>
        </body>
        </html>
    `;
}

// ========================================
// DEACTIVATION
// ========================================

function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    console.log('AI.duino v1.3.0 deactivated');
}
exports.deactivate = deactivate;

// ========================================
// END OF EXTENSION.JS
// ========================================
