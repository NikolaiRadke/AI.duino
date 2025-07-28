@echo off
REM AI.duino v1.0 - Windows - Easy Install
REM Copyright 2025 Monster Maker
REM Licensed under Apache License 2.0

setlocal enabledelayedexpansion

echo.
echo ===============================================
echo    AI.duino v1.0 - Windows Installer
echo ===============================================
echo.

REM Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Administrator-Rechte benoetigt!
    echo.
    echo Bitte Rechtsklick auf die Datei und
    echo "Als Administrator ausfuehren" waehlen.
    echo.
    pause
    exit /b 1
)

REM Find Arduino IDE installation
echo [1/4] Suche Arduino IDE 2.x Installation...

set "PLUGIN_DIR="
set "FOUND_PATH="

REM Check common installation paths
for %%p in (
    "%ProgramFiles%\Arduino IDE\resources\app\plugins"
    "%ProgramFiles(x86)%\Arduino IDE\resources\app\plugins"
    "%LocalAppData%\Programs\Arduino IDE\resources\app\plugins"
    "%LocalAppData%\Arduino IDE\resources\app\plugins"
    "C:\Program Files\Arduino IDE\resources\app\plugins"
    "D:\Program Files\Arduino IDE\resources\app\plugins"
) do (
    if exist "%%~p" (
        set "PLUGIN_DIR=%%~p"
        set "FOUND_PATH=%%~p"
        goto :found
    )
)

:notfound
echo.
echo [ERROR] Arduino IDE 2.x nicht gefunden!
echo.
echo Bitte installiere Arduino IDE 2.x von:
echo https://www.arduino.cc/en/software
echo.
echo Falls bereits installiert, kopiere das Plugin manuell nach:
echo [Arduino IDE]\resources\app\plugins\aiduino
echo.
pause
exit /b 1

:found
echo [OK] Arduino IDE gefunden in:
echo      %FOUND_PATH%
echo.

REM Create plugin directory
echo [2/4] Erstelle Plugin-Verzeichnis...
set "TARGET=%PLUGIN_DIR%\aiduino"

REM Remove old version if exists
if exist "%TARGET%" (
    echo      Entferne alte Version...
    rmdir /s /q "%TARGET%" 2>nul
)

REM Create directories
mkdir "%TARGET%" 2>nul
mkdir "%TARGET%\extension" 2>nul
mkdir "%TARGET%\extension\out" 2>nul

if %errorLevel% neq 0 (
    echo [ERROR] Konnte Verzeichnis nicht erstellen!
    echo        Pruefe Schreibrechte fuer: %TARGET%
    pause
    exit /b 1
)

echo [OK] Plugin-Verzeichnis erstellt
echo.

REM Create package.json
echo [3/4] Erstelle package.json...
(
REM ===== PACKAGE.JSON START =====
{
  "name": "aiduino",
  "displayName": "AI.duino",
  "description": "KI-gestützte Hilfe für Arduino mit Claude und ChatGPT: Code verbessern, Fehler erklären, Debug-Hilfe",
  "version": "1.0.0",
  "publisher": "Monster Maker",
  "engines": {
    "vscode": "^1.60.0"
  },
  "categories": ["Other", "Debuggers", "Education"],
  "keywords": ["arduino", "ai", "claude", "chatgpt", "debug", "fehler", "hilfe"],
  "activationEvents": [
    "onLanguage:cpp",
    "onLanguage:c",
    "onLanguage:ino"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "aiduino.quickMenu",
        "title": "Quick-Menü öffnen",
        "category": "AI.duino",
        "icon": "$(robot)"
      },
      {
        "command": "aiduino.switchModel",
        "title": "AI-Modell wechseln",
        "category": "AI.duino",
        "icon": "$(sync)"
      },
      {
        "command": "aiduino.setApiKey",
        "title": "API Key eingeben",
        "category": "AI.duino",
        "icon": "$(key)"
      },
      {
        "command": "aiduino.improveCode",
        "title": "Code verbessern",
        "category": "AI.duino",
        "icon": "$(symbol-method)"
      },
      {
        "command": "aiduino.explainCode",
        "title": "Code erklären",
        "category": "AI.duino",
        "icon": "$(comment-discussion)"
      },
      {
        "command": "aiduino.addComments",
        "title": "Kommentare hinzufügen",
        "category": "AI.duino",
        "icon": "$(edit)"
      },
      {
        "command": "aiduino.explainError",
        "title": "Fehler erklären",
        "category": "AI.duino",
        "icon": "$(error)"
      },
      {
        "command": "aiduino.debugHelp",
        "title": "Debug-Hilfe",
        "category": "AI.duino",
        "icon": "$(bug)"
      },
      {
        "command": "aiduino.about",
        "title": "Über AI.duino...",
        "category": "AI.duino",
        "icon": "$(info)"
      }
    ],
    "keybindings": [
      {
        "command": "aiduino.quickMenu",
        "key": "ctrl+shift+c",
        "mac": "cmd+shift+c",
        "when": "editorTextFocus && resourceExtname == .ino"
      },
      {
        "command": "aiduino.explainCode",
        "key": "ctrl+shift+e",
        "mac": "cmd+shift+e",
        "when": "editorTextFocus && resourceExtname == .ino"
      }
    ],
    "menus": {
  "editor/context": [
    {
      "submenu": "aiduino",
      "group": "1_modification"   
    }
  ],
  "aiduino": [
    {
      "command": "aiduino.explainCode"
    },
    {
      "command": "aiduino.improveCode"   
    },
    {
      "command": "aiduino.addComments"
    },
    {
      "command": "aiduino.explainError"
    },
    {
      "command": "aiduino.debugHelp"
    },
    {
      "command": "aiduino.quickMenu"
    },
    {
      "command": "aiduino.about"
    }
  ]
},
"submenus": [
  {
    "id": "aiduino",
    "label": "🤖 AI.duino"
  }
],
    "configuration": {
      "title": "AI.duino",
      "properties": {
        "aiduino.showWelcomeOnStartup": {
          "type": "boolean",
          "default": true,
          "description": "Willkommensnachricht beim Start anzeigen"
        },
        "aiduino.autoDetectErrors": {
          "type": "boolean",
          "default": true,
          "description": "Automatisch auf Compiler-Fehler hinweisen"
        },
        "aiduino.defaultModel": {
          "type": "string",
          "enum": ["claude", "chatgpt"],
          "default": "claude",
          "description": "Standard AI-Modell beim Start"
        }
      }
    }
  },
  "author": {
    "name": "Monster Maker"
  },
  "license": "Apache-2.0"
}
REM ===== PACKAGE.JSON END =====
) > "%TARGET%\extension\package.json"

echo [OK] package.json erstellt
echo.

REM Create extension.js
echo [4/4] Erstelle extension.js...
(
REM ===== EXTENSION.JS START =====
/*
 * AI.duino v1.0
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

let statusBarItem;
let apiKey = '';
let openaiApiKey = '';
let currentModel = 'claude'; // 'claude' oder 'chatgpt'
const API_KEY_FILE = path.join(os.homedir(), '.aiduino-claude-api-key');
const OPENAI_KEY_FILE = path.join(os.homedir(), '.aiduino-openai-api-key');
const MODEL_FILE = path.join(os.homedir(), '.aiduino-model');

let tokenUsage = {
    claude: { input: 0, output: 0, cost: 0 },
    chatgpt: { input: 0, output: 0, cost: 0 },
    daily: new Date().toDateString()
};
const TOKEN_USAGE_FILE = path.join(os.homedir(), '.aiduino-token-usage.json');

// Token-Preise (Stand 2025)
const TOKEN_PRICES = {
    claude: {
        input: 0.003 / 1000,   // $3 per 1M input tokens
        output: 0.015 / 1000   // $15 per 1M output tokens
    },
    chatgpt: {
        input: 0.03 / 1000,    // $30 per 1M input tokens (GPT-4)
        output: 0.06 / 1000    // $60 per 1M output tokens (GPT-4)
    }
};

function activate(context) {
    console.log('🤖 AI.duino v1.0 aktiviert!');
    
    // API Keys und Model beim Start laden
    loadApiKeys();
    loadSelectedModel();
    loadTokenUsage();
    
    // Status Bar mit Tooltip
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    updateStatusBar();
    statusBarItem.command = "aiduino.quickMenu";
    statusBarItem.show();
    
    // Commands registrieren
    context.subscriptions.push(
        vscode.commands.registerCommand('aiduino.quickMenu', showQuickMenu),
        vscode.commands.registerCommand('aiduino.switchModel', switchModel),
        vscode.commands.registerCommand('aiduino.setApiKey', setApiKey),
        vscode.commands.registerCommand('aiduino.explainCode', explainCode),
        vscode.commands.registerCommand('aiduino.improveCode', improveCode),
        vscode.commands.registerCommand('aiduino.addComments', addComments),
        vscode.commands.registerCommand('aiduino.explainError', explainError),
        vscode.commands.registerCommand('aiduino.debugHelp', debugHelp),
        vscode.commands.registerCommand('aiduino.showTokenStats', showTokenStats),
        vscode.commands.registerCommand('aiduino.about', showAbout),
        vscode.commands.registerCommand('aiduino.resetTokenStats', resetTokenStats),
        statusBarItem
    );
    
    // Willkommensnachricht
    if (!apiKey && !openaiApiKey) {
        setTimeout(() => {
            showWelcomeMessage();
        }, 1000);
    }
    
    // Auto-Fehler-Erkennung
    let errorTimeout;
    vscode.languages.onDidChangeDiagnostics(e => {
        clearTimeout(errorTimeout);
        errorTimeout = setTimeout(() => checkForErrors(), 1000);
    });
}
exports.activate = activate;

function loadApiKeys() {
    try {
        if (fs.existsSync(API_KEY_FILE)) {
            apiKey = fs.readFileSync(API_KEY_FILE, 'utf8').trim();
            console.log('✅ Claude API Key geladen');
        }
        if (fs.existsSync(OPENAI_KEY_FILE)) {
            openaiApiKey = fs.readFileSync(OPENAI_KEY_FILE, 'utf8').trim();
            console.log('✅ OpenAI API Key geladen');
        }
    } catch (error) {
        console.log('❌ Fehler beim Laden der API Keys:', error);
    }
}

function loadSelectedModel() {
    try {
        if (fs.existsSync(MODEL_FILE)) {
            currentModel = fs.readFileSync(MODEL_FILE, 'utf8').trim();
            console.log('✅ Ausgewähltes Model:', currentModel);
        }
    } catch (error) {
        console.log('❌ Fehler beim Laden des Models:', error);
    }
}

function loadTokenUsage() {
    try {
        const currentDate = new Date();
        const today = currentDate.toDateString();
        
        console.log('=== TOKEN USAGE LADEN ===');
        console.log('Aktuelles Datum:', today);
        console.log('Timestamp:', currentDate.toISOString());
        
        if (fs.existsSync(TOKEN_USAGE_FILE)) {
            const fileContent = fs.readFileSync(TOKEN_USAGE_FILE, 'utf8');
            console.log('Datei-Inhalt:', fileContent);
            
            const data = JSON.parse(fileContent);
            console.log('Gespeichertes Datum:', data.daily);
            console.log('Datum-Vergleich:', data.daily === today);
            
            // Prüfe ob es der gleiche Tag ist
            if (data.daily === today) {
                // Gleicher Tag - Daten übernehmen
                tokenUsage = data;
                console.log('✅ Token-Statistik vom gleichen Tag geladen');
                console.log('Geladene Werte:', {
                    claude: data.claude,
                    chatgpt: data.chatgpt
                });
            } else {
                // Anderer Tag - Reset
                console.log('🔄 Neuer Tag erkannt - Reset der Statistik');
                console.log('Alt:', data.daily, 'Neu:', today);
                
                tokenUsage = {
                    claude: { input: 0, output: 0, cost: 0 },
                    chatgpt: { input: 0, output: 0, cost: 0 },
                    daily: today
                };
                saveTokenUsage();
            }
        } else {
            // Keine Datei vorhanden
            console.log('📄 Keine Token-Datei gefunden - erstelle neue');
            tokenUsage = {
                claude: { input: 0, output: 0, cost: 0 },
                chatgpt: { input: 0, output: 0, cost: 0 },
                daily: today
            };
            saveTokenUsage();
        }
        
        // Nach dem Laden StatusBar aktualisieren
        if (statusBarItem) {
            updateStatusBar();
        }
        
    } catch (error) {
        console.error('❌ Fehler beim Laden der Token-Statistik:', error);
        
        // Bei Fehler mit leeren Werten starten
        tokenUsage = {
            claude: { input: 0, output: 0, cost: 0 },
            chatgpt: { input: 0, output: 0, cost: 0 },
            daily: new Date().toDateString()
        };
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
    // Verbesserte Schätzung basierend auf OpenAI's Faustregel
    // Berücksichtigt auch Code-Strukturen
    
    if (!text) return 0;
    
    // Basis: ~4 Zeichen = 1 Token für normalen Text
    let tokens = text.length / 4;
    
    // Code hat oft mehr Tokens wegen Syntax
    const codeIndicators = text.match(/[{}()\[\];,.<>]/g);
    if (codeIndicators) {
        tokens += codeIndicators.length * 0.3;
    }
    
    // Neue Zeilen zählen auch als Tokens
    const newlines = text.match(/\n/g);
    if (newlines) {
        tokens += newlines.length;
    }
    
    return Math.ceil(tokens);
}

function updateTokenUsage(model, inputText, outputText) {
    const inputTokens = estimateTokens(inputText);
    const outputTokens = estimateTokens(outputText);
    
    tokenUsage[model].input += inputTokens;
    tokenUsage[model].output += outputTokens;
    
    // Kosten berechnen
    const inputCost = inputTokens * TOKEN_PRICES[model].input;
    const outputCost = outputTokens * TOKEN_PRICES[model].output;
    tokenUsage[model].cost += (inputCost + outputCost);
    
    saveTokenUsage();
    updateStatusBar();
}

function saveSelectedModel() {
    try {
        fs.writeFileSync(MODEL_FILE, currentModel, { mode: 0o600 });
    } catch (error) {
        console.log('❌ Fehler beim Speichern des Models:', error);
    }
}

function updateStatusBar() {
    const hasApiKey = (currentModel === 'claude' && apiKey) || (currentModel === 'chatgpt' && openaiApiKey);
    const modelIcon = currentModel === 'claude' ? '🤖' : '🧠';
    const modelName = currentModel === 'claude' ? 'Claude' : 'GPT-4';
    
    // Kosten für heute
    const todayCost = tokenUsage[currentModel].cost.toFixed(3);
    const costDisplay = todayCost > 0 ? ` ($${todayCost})` : '';
    
    if (hasApiKey) {
        statusBarItem.text = `${modelIcon} AI.duino${costDisplay}`;
        statusBarItem.tooltip = `AI.duino v1.0: ${modelName}\n` +
            `Heute: ${tokenUsage[currentModel].input + tokenUsage[currentModel].output} Tokens${costDisplay}\n` +
            `Input: ${tokenUsage[currentModel].input} | Output: ${tokenUsage[currentModel].output}\n` +
            `Klick für Menü • Strg+Shift+C • Rechtsklick zum Wechseln`;
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = `${modelIcon} AI.duino $(warning)`;
        statusBarItem.tooltip = `${modelName} API Key fehlt! • Klick zum Einrichten`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

async function switchModel() {
    const items = [
        {
            label: '🤖 Claude (Anthropic)',
            description: currentModel === 'claude' ? '✓ Aktiv' : 'Claude-3.5-Sonnet',
            value: 'claude'
        },
        {
            label: '🧠 ChatGPT (OpenAI)',
            description: currentModel === 'chatgpt' ? '✓ Aktiv' : 'GPT-4',
            value: 'chatgpt'
        }
    ];
    
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Wähle das AI-Modell'
    });
    
    if (selected) {
        currentModel = selected.value;
        saveSelectedModel();
        updateStatusBar();
        
        // Prüfe ob API Key vorhanden
        const hasKey = (currentModel === 'claude' && apiKey) || (currentModel === 'chatgpt' && openaiApiKey);
        if (!hasKey) {
            const choice = await vscode.window.showWarningMessage(
                `${selected.label} benötigt einen API Key`,
                'Jetzt eingeben',
                'Später'
            );
            if (choice === 'Jetzt eingeben') {
                await setApiKey();
            }
        } else {
            vscode.window.showInformationMessage(`✅ Gewechselt zu ${selected.label}`);
        }
    }
}

async function showWelcomeMessage() {
    const message = '👋 Willkommen! AI.duino v1.0 unterstützt Claude und ChatGPT!';
    const choice = await vscode.window.showInformationMessage(
        message,
        'AI-Modell wählen',
        'Später'
    );
    
    if (choice === 'AI-Modell wählen') {
        await switchModel();
    }
}

async function showQuickMenu() {
    const hasApiKey = (currentModel === 'claude' && apiKey) || (currentModel === 'chatgpt' && openaiApiKey);
    
    if (!hasApiKey) {
        const modelName = currentModel === 'claude' ? 'Claude' : 'ChatGPT';
        const choice = await vscode.window.showWarningMessage(
            `🔑 Zuerst brauchst du einen ${modelName} API Key`,
            'Jetzt einrichten',
            'Modell wechseln',
            'Abbrechen'
        );
        if (choice === 'Jetzt einrichten') {
            await setApiKey();
        } else if (choice === 'Modell wechseln') {
            await switchModel();
        }
        return;
    }
    
    const editor = vscode.window.activeTextEditor;
    const hasSelection = editor && !editor.selection.isEmpty;
    const hasErrors = await checkForErrors(false);
    
    const items = [
        {
            label: '$(symbol-method) Code verbessern',
            description: hasSelection ? 'Ausgewählten Code optimieren' : 'Erst Code markieren',
            command: 'aiduino.improveCode',
            enabled: true
        },
        {
            label: '$(comment-discussion) Code erklären',
            description: hasSelection ? 'Ausgewählten Code erklären' : 'Erst Code markieren',
            command: 'aiduino.explainCode',
            enabled: true
        },
        {
            label: '$(edit) Kommentare hinzufügen',
            description: hasSelection ? 'Code kommentieren' : 'Erst Code markieren',
            command: 'aiduino.addComments',
            enabled: true
        },
        {
            label: '$(error) Fehler erklären',
            description: hasErrors ? '🔴 Compiler-Fehler gefunden' : 'Keine Fehler',
            command: 'aiduino.explainError',
            enabled: true
        },
        {
            label: '$(bug) Debug-Hilfe',
            description: 'Hilfe bei der Fehlersuche',
            command: 'aiduino.debugHelp',
            enabled: true
        },
        {
            label: '$(sync) AI-Modell wechseln',
            description: `Aktuell: ${currentModel === 'claude' ? 'Claude' : 'ChatGPT'}`,
            command: 'aiduino.switchModel',
            enabled: true
        },
        {
            label: '$(key) API Key ändern',
            description: `${currentModel === 'claude' ? 'Claude' : 'ChatGPT'} Key`,
            command: 'aiduino.setApiKey',
            enabled: true
        },
        {
            label: '$(graph) Token-Statistik',
            description: `Heute: $${tokenUsage.claude.cost.toFixed(3)} (Claude) | $${tokenUsage.chatgpt.cost.toFixed(3)} (GPT)`,
            command: 'aiduino.showTokenStats',
            enabled: true
        }
    ].filter(item => item.enabled);
    
    if (items.length === 0) {
        vscode.window.showInformationMessage(
            '💡 Markiere Arduino-Code um AI-Funktionen zu nutzen!'
        );
        return;
    }
    
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Was möchtest du tun?',
        title: `🤖 AI.duino v1.0 (${currentModel === 'claude' ? 'Claude' : 'ChatGPT'})`
    });
    
    if (selected) {
        vscode.commands.executeCommand(selected.command);
    }
}

async function setApiKey() {
    const modelName = currentModel === 'claude' ? 'Claude' : 'OpenAI';
    const prefix = currentModel === 'claude' ? 'sk-ant-' : 'sk-';
    const minLength = currentModel === 'claude' ? 50 : 40;
    
    const input = await vscode.window.showInputBox({
        prompt: `${modelName} API Key eingeben`,
        placeHolder: currentModel === 'claude' ? 'sk-ant-api-...' : 'sk-...',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value) return 'API Key erforderlich';
            if (!value.startsWith(prefix)) return `Muss mit "${prefix}" beginnen`;
            if (value.length < minLength) return 'Key scheint zu kurz';
            return null;
        }
    });
    
    if (input) {
        try {
            if (currentModel === 'claude') {
                apiKey = input;
                fs.writeFileSync(API_KEY_FILE, apiKey, { mode: 0o600 });
            } else {
                openaiApiKey = input;
                fs.writeFileSync(OPENAI_KEY_FILE, openaiApiKey, { mode: 0o600 });
            }
            updateStatusBar();
            vscode.window.showInformationMessage(
                `✅ ${modelName} API Key gespeichert!`
            );
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(
                '❌ Fehler beim Speichern: ' + error.message
            );
            return false;
        }
    }
    return false;
}

// Erweiterte API-Aufruf-Funktion für beide Modelle
function callAI(prompt) {
    if (currentModel === 'claude') {
        return callClaudeAPI(prompt);
    } else {
        return callChatGPTAPI(prompt);
    }
}

function callClaudeAPI(prompt) {
    return new Promise((resolve, reject) => {
        if (!apiKey) {
            reject(new Error('Kein Claude API Key gesetzt'));
            return;
        }

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
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    
                    if (res.statusCode === 200) {
                        const response = parsedData.content[0].text;
                        
                        // Token-Tracking hinzufügen
                        updateTokenUsage('claude', prompt, response);
                        console.log('Claude tokens tracked:', estimateTokens(prompt), 'in,', estimateTokens(response), 'out');
                        
                        resolve(response);
                    } else {
                        if (res.statusCode === 401) {
                            reject(new Error('Claude API Key ungültig'));
                        } else {
                            reject(new Error(`Claude API Error (${res.statusCode}): ${parsedData.error?.message || 'Unbekannter Fehler'}`));
                        }
                    }
                } catch (e) {
                    reject(new Error('Fehler beim Parsen der Claude-Antwort'));
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error('Netzwerkfehler: ' + e.message));
        });

        req.write(data);
        req.end();
    });
}


function callChatGPTAPI(prompt) {
    return new Promise((resolve, reject) => {
        if (!openaiApiKey) {
            reject(new Error('Kein OpenAI API Key gesetzt'));
            return;
        }

        const data = JSON.stringify({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "Du bist ein hilfreicher Arduino-Programmier-Assistent. Antworte immer auf Deutsch und erkläre Arduino-Code verständlich."
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
                'Authorization': `Bearer ${openaiApiKey}`
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    
                    if (res.statusCode === 200) {
                        const response = parsedData.choices[0].message.content;
                        
                        // Token-Tracking hinzufügen
                        updateTokenUsage('chatgpt', prompt, response);
                        console.log('ChatGPT tokens tracked:', estimateTokens(prompt), 'in,', estimateTokens(response), 'out');
                        
                        resolve(response);
                    } else {
                        if (res.statusCode === 401) {
                            reject(new Error('OpenAI API Key ungültig'));
                        } else {
                            reject(new Error(`OpenAI API Error (${res.statusCode}): ${parsedData.error?.message || 'Unbekannter Fehler'}`));
                        }
                    }
                } catch (e) {
                    reject(new Error('Fehler beim Parsen der ChatGPT-Antwort'));
                }
            });
        });
        req.on('error', (e) => {
            reject(new Error('Netzwerkfehler: ' + e.message));
        });

        req.write(data);
        req.end();
    });
}

// Alle anderen Funktionen verwenden jetzt callAI statt callClaudeAPI
async function explainError() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.ino')) {
        vscode.window.showWarningMessage('Öffne eine .ino Datei');
        return;
    }
    
    // Bei Arduino-Dateien direkt nach Fehler fragen
    const errorInput = await vscode.window.showInputBox({
        prompt: 'Kopiere den Fehler aus dem Arduino-Ausgabefenster (rote Zeile mit "error:")',
        placeHolder: "error: 'xc' was not declared in this scope",
        ignoreFocusOut: true
    });
    
    if (!errorInput) return;
    
    // Hole Code-Kontext um die aktuelle Cursor-Position
    const line = editor.selection.active.line;
    const startLine = Math.max(0, line - 5);
    const endLine = Math.min(editor.document.lineCount - 1, line + 5);
    const codeContext = editor.document.getText(
        new vscode.Range(startLine, 0, endLine, Number.MAX_VALUE)
    );
    
    const prompt = `Arduino Compiler-Fehler erklären und lösen:

Fehler: ${errorInput}

Code-Kontext (um Zeile ${line + 1}):
\`\`\`cpp
${codeContext}
\`\`\`

Bitte erkläre:
1. Was bedeutet dieser Fehler?
2. Warum tritt er auf?
3. Wie behebe ich ihn?
4. Zeige den korrigierten Code

Erkläre einfach und verständlich auf Deutsch.`;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${currentModel === 'claude' ? 'Claude' : 'ChatGPT'} analysiert den Fehler...`,
            cancellable: false
        }, async () => {
            const response = await callAI(prompt);
            
            const panel = vscode.window.createWebviewPanel(
                'aiError',
                '🔧 Fehler-Erklärung',
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );
            
            panel.webview.html = createErrorExplanationHtml(
                errorInput,
                line + 1,
                response,
                currentModel
            );
        });
    } catch (error) {
        handleApiError(error);
    }
}

async function explainCode() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Kein Code-Editor aktiv');
        return;
    }
    
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    
    if (!selectedText.trim()) {
        vscode.window.showWarningMessage('Bitte markiere den Code, den du erklärt haben möchtest');
        return;
    }
    
    const prompt = `Erkläre diesen Arduino-Code auf Deutsch in einfacher, verständlicher Sprache:

\`\`\`cpp
${selectedText}
\`\`\`

Erkläre:
- Was der Code macht
- Wie er funktioniert
- Welche Hardware er ansteuert
- Wichtige Konzepte für Anfänger

Sei freundlich und ausführlich.`;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${currentModel === 'claude' ? 'Claude' : 'ChatGPT'} erklärt den Code...`,
            cancellable: false
        }, async () => {
            const response = await callAI(prompt);
            
            const outputChannel = vscode.window.createOutputChannel(`${currentModel === 'claude' ? 'Claude' : 'ChatGPT'} Erklärung`);
            outputChannel.clear();
            outputChannel.appendLine(`🤖 CODE-ERKLÄRUNG VON ${currentModel === 'claude' ? 'CLAUDE' : 'CHATGPT'}`);
            outputChannel.appendLine('='.repeat(50));
            outputChannel.appendLine('');
            outputChannel.appendLine(response);
            outputChannel.show();
        });
    } catch (error) {
        handleApiError(error);
    }
}

async function improveCode() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Kein Code-Editor aktiv');
        return;
    }
    
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    
    if (!selectedText.trim()) {
        vscode.window.showWarningMessage('Bitte markiere den Code, den du verbessern möchtest');
        return;
    }
    
    const prompt = `Verbessere diesen Arduino-Code:

\`\`\`cpp
${selectedText}
\`\`\`

Optimiere für:
- Non-blocking Code (millis statt delay)
- Speicher-Effizienz
- Bessere Lesbarkeit
- Arduino Best Practices
- Robustheit

Gib nur den verbesserten Code zurück mit kurzen deutschen Kommentaren bei Änderungen.`;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${currentModel === 'claude' ? 'Claude' : 'ChatGPT'} optimiert den Code...`,
            cancellable: false
        }, async () => {
            const response = await callAI(prompt);
            
            const doc = await vscode.workspace.openTextDocument({
                content: response,
                language: 'cpp'
            });
            
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            
            const choice = await vscode.window.showInformationMessage(
                '✅ Code verbessert! Was möchtest du tun?',
                'Original ersetzen',
                'Beide behalten'
            );
            
            if (choice === 'Original ersetzen') {
                await editor.edit(editBuilder => {
                    editBuilder.replace(selection, response);
                });
                vscode.window.showInformationMessage('✅ Code wurde ersetzt!');
            }
        });
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
            '💡 Markiere den Code, den du kommentieren möchtest'
        );
        return;
    }
    
    const prompt = `Füge hilfreiche deutsche Kommentare zu diesem Arduino-Code hinzu:

\`\`\`cpp
${selectedText}
\`\`\`

Regeln:
- Erkläre was jede wichtige Zeile macht
- Kommentiere Funktionen und ihre Parameter
- Erkläre Hardware-Interaktionen
- Nutze // für einzeilige und /* */ für mehrzeilige Kommentare
- Kommentare sollen Anfängern helfen

Gib NUR den kommentierten Code zurück, keine Erklärungen drumherum.`;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${currentModel === 'claude' ? 'Claude' : 'ChatGPT'} fügt Kommentare hinzu...`,
            cancellable: false
        }, async () => {
            const response = await callAI(prompt);
            
            const preview = await vscode.workspace.openTextDocument({
                content: response,
                language: 'cpp'
            });
            
            await vscode.window.showTextDocument(preview, vscode.ViewColumn.Beside);
            
            const choice = await vscode.window.showInformationMessage(
                'Kommentare hinzugefügt! Was möchtest du tun?',
                'Code ersetzen',
                'So lassen'
            );
            
            if (choice === 'Code ersetzen') {
                await editor.edit(editBuilder => {
                    editBuilder.replace(selection, response);
                });
                vscode.window.showInformationMessage('✅ Code wurde aktualisiert!');
            }
        });
    } catch (error) {
        handleApiError(error);
    }
}

async function debugHelp() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    const options = [
        {
            label: '$(search) Serial Monitor Ausgabe analysieren',
            description: 'Hilfe bei der Interpretation von Debug-Ausgaben',
            value: 'serial'
        },
        {
            label: '$(circuit-board) Hardware-Problem diagnostizieren',
            description: 'Mögliche Hardware-Ursachen für Probleme',
            value: 'hardware'
        },
        {
            label: '$(watch) Debug-Code hinzufügen',
            description: 'Serial.print() Statements strategisch platzieren',
            value: 'debug'
        },
        {
            label: '$(pulse) Timing-Probleme finden',
            description: 'Hilfe bei delay(), millis() und Timing-Bugs',
            value: 'timing'
        }
    ];
    
    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Wobei brauchst du Hilfe?'
    });
    
    if (!selected) return;
    
    let prompt = '';
    let needsCode = true;
    
    switch (selected.value) {
        case 'serial':
            const serialOutput = await vscode.window.showInputBox({
                prompt: 'Füge deine Serial Monitor Ausgabe ein',
                placeHolder: 'z.B. "Sensor value: -1"',
                ignoreFocusOut: true
            });
            if (!serialOutput) return;
            
            prompt = `Analysiere diese Arduino Serial Monitor Ausgabe und erkläre was sie bedeutet:

Serial Output:
${serialOutput}

${editor.selection.isEmpty ? '' : `Relevanter Code:
\`\`\`cpp
${editor.document.getText(editor.selection)}
\`\`\``}

Erkläre:
- Was die Ausgabe bedeutet
- Mögliche Probleme
- Lösungsvorschläge`;
            needsCode = false;
            break;
            
        case 'hardware':
            prompt = `Hilf bei der Hardware-Fehlersuche für diesen Arduino-Code:

\`\`\`cpp
${editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection)}
\`\`\`

Bitte prüfe:
- Typische Verdrahtungsfehler
- Pin-Konflikte
- Stromversorgungsprobleme
- Pull-up/Pull-down Widerstände
- Kompatibilitätsprobleme`;
            break;
            
        case 'debug':
            prompt = `Füge strategische Debug-Ausgaben zu diesem Arduino-Code hinzu:

\`\`\`cpp
${editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection)}
\`\`\`

Füge Serial.print() Statements hinzu um:
- Variablenwerte zu überwachen
- Programmfluss zu verfolgen
- Timing zu messen
- Fehler zu finden`;
            break;
            
        case 'timing':
            prompt = `Analysiere Timing-Probleme in diesem Arduino-Code:

\`\`\`cpp
${editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection)}
\`\`\`

Prüfe auf:
- Blocking delays
- millis() overflow
- Race conditions
- Interrupt-Konflikte

Zeige verbesserten non-blocking Code.`;
            break;
    }
    
    if (needsCode && editor.selection.isEmpty) {
        vscode.window.showWarningMessage(
            '💡 Markiere relevanten Code für bessere Debug-Hilfe'
        );
        return;
    }
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${currentModel === 'claude' ? 'Claude' : 'ChatGPT'} analysiert das Problem...`,
            cancellable: false
        }, async () => {
            const response = await callAI(prompt);
            
            const panel = vscode.window.createWebviewPanel(
                'aiDebug',
                '🔍 Debug-Hilfe',
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );
            
            panel.webview.html = createDebugHelpHtml(selected.label, response, currentModel);
        });
    } catch (error) {
        handleApiError(error);
    }
}

function createErrorExplanationHtml(error, line, explanation, model) {
    const modelBadge = model === 'claude' ? 
        '<span style="background: #6B46C1; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Claude</span>' :
        '<span style="background: #10A37F; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">ChatGPT</span>';
    
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
                <h1>🔧 Fehler-Erklärung</h1>
                ${modelBadge}
            </div>
            
            <div class="error-box">
                <div class="error-title">Fehler in Zeile ${line}:</div>
                <code>${error}</code>
            </div>
            
            <div class="explanation">
                ${explanation.replace(/\n/g, '<br>')}
            </div>
            
            <br>
            <button onclick="copyToClipboard()">📋 Lösung kopieren</button>
            
            <script>
                function copyToClipboard() {
                    const text = document.querySelector('.explanation').innerText;
                    navigator.clipboard.writeText(text).then(() => {
                        alert('In Zwischenablage kopiert!');
                    });
                }
            </script>
        </body>
        </html>
    `;
}

function createDebugHelpHtml(title, content, model) {
    const modelBadge = model === 'claude' ? 
        '<span style="background: #6B46C1; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Claude</span>' :
        '<span style="background: #10A37F; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">ChatGPT</span>';
    
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
            <div class="content">${content.replace(/\n/g, '<br>')}</div>
            
            <button onclick="copyToClipboard()">📋 Kopieren</button>
            <button onclick="window.close()">✓ Schließen</button>
            
            <script>
                function copyToClipboard() {
                    const text = document.querySelector('.content').innerText;
                    navigator.clipboard.writeText(text).then(() => {
                        alert('In Zwischenablage kopiert!');
                    });
                }
            </script>
        </body>
        </html>
    `;
}

async function checkForErrors(silent = true) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith('.ino')) {
        return false;
    }
    
    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
    
    if (errors.length > 0 && !silent) {
        const modelIcon = currentModel === 'claude' ? '🤖' : '🧠';
        statusBarItem.text = `${modelIcon} AI.duino $(error)`;
        statusBarItem.tooltip = `${errors.length} Fehler gefunden • Klick für Hilfe`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        
        setTimeout(() => updateStatusBar(), 5000);
    }
    
    return errors.length > 0;
}

function showTutorial() {
    const panel = vscode.window.createWebviewPanel(
        'aiTutorial',
        '📚 AI.duino Tutorial',
        vscode.ViewColumn.One,
        {}
    );
    
    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 { color: #2196F3; }
                .shortcut {
                    background: #f0f0f0;
                    padding: 3px 6px;
                    border-radius: 3px;
                    font-family: monospace;
                }
                .feature {
                    margin: 20px 0;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border-left: 4px solid #2196F3;
                }
                .tip {
                    background: #e3f2fd;
                    padding: 10px;
                    border-radius: 4px;
                    margin: 10px 0;
                }
                .model-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: bold;
                    margin: 0 5px;
                }
                .claude {
                    background: #6B46C1;
                    color: white;
                }
                .chatgpt {
                    background: #10A37F;
                    color: white;
                }
            </style>
        </head>
        <body>
            <h1>🤖 AI.duino v1.0</h1>
            
            <div class="tip">
                <strong>Schnellzugriff:</strong> <span class="shortcut">Strg+Shift+C</span> 
                oder klicke auf AI.duino in der Statusleiste
            </div>
            
            <h2>🆕 Zwei AI-Modelle zur Auswahl!</h2>
            <p>
                Du kannst zwischen zwei KI-Assistenten wählen:
                <span class="model-badge claude">Claude</span> und 
                <span class="model-badge chatgpt">ChatGPT</span>
            </p>
            <ul>
                <li><strong>Claude:</strong> Anthropics fortschrittliches Modell - besonders gut für komplexe Code-Analysen</li>
                <li><strong>ChatGPT:</strong> OpenAIs GPT-4 - vielseitig und kreativ</li>
            </ul>
            
            <div class="feature">
                <h3>🔄 Modell wechseln</h3>
                <p>Rechtsklick auf die Statusleiste oder wähle "AI-Modell wechseln" im Menü</p>
            </div>
            
            <h2>Die wichtigsten Features:</h2>
            
            <div class="feature">
                <h3>🔧 Code verbessern</h3>
                <p>Markiere deinen Arduino-Code und lass die AI ihn optimieren:</p>
                <ul>
                    <li>Non-blocking Code statt delay()</li>
                    <li>Speicher-Optimierungen</li>
                    <li>Best Practices für Arduino</li>
                </ul>
            </div>
            
            <div class="feature">
                <h3>📝 Automatische Kommentare</h3>
                <p>AI fügt hilfreiche deutsche Kommentare hinzu:</p>
                <ul>
                    <li>Erklärt was jede Zeile macht</li>
                    <li>Dokumentiert Funktionen</li>
                    <li>Perfekt für Anfänger</li>
                </ul>
            </div>
            
            <div class="feature">
                <h3>❌ Fehler verstehen</h3>
                <p>Compiler-Fehler? Kein Problem!</p>
                <ul>
                    <li>AI erklärt was der Fehler bedeutet</li>
                    <li>Zeigt die Lösung</li>
                    <li>Verhindert häufige Fehler</li>
                </ul>
            </div>
            
            <div class="feature">
                <h3>🐛 Debug-Hilfe</h3>
                <p>Probleme mit deinem Projekt?</p>
                <ul>
                    <li>Serial Monitor Ausgaben verstehen</li>
                    <li>Hardware-Probleme diagnostizieren</li>
                    <li>Timing-Bugs finden</li>
                </ul>
            </div>
            
            <h2>💡 Tipps:</h2>
            <ul>
                <li>Markiere immer den relevanten Code-Teil</li>
                <li>Je spezifischer die Auswahl, desto besser die Hilfe</li>
                <li>Beide AIs kennen alle Arduino-Bibliotheken</li>
                <li>Frage ruhig auf Deutsch!</li>
                <li>Probiere beide Modelle aus - manchmal liefern sie unterschiedliche Perspektiven</li>
            </ul>
            
            <div class="tip">
                <strong>Neu hier?</strong> Starte mit "Code erklären" - 
                markiere einfach Code und die AI erklärt dir was er macht!
            </div>
        </body>
        </html>
    `;
}

function showTokenStats() {
    const totalCostToday = tokenUsage.claude.cost + tokenUsage.chatgpt.cost;
    
    const panel = vscode.window.createWebviewPanel(
        'tokenStats',
        '📊 Token-Statistik',
        vscode.ViewColumn.One,
        { enableScripts: true }
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
                .claude { color: #6B46C1; }
                .chatgpt { color: #10A37F; }
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
            <h1>📊 Token-Verbrauch für ${new Date().toLocaleDateString('de-DE')}</h1>
            
            <div class="total">
                <h2>Gesamtkosten heute: <span class="cost">$${totalCostToday.toFixed(3)}</span></h2>
            </div>
            
            <div class="stat-card">
                <div class="model-name claude">🤖 Claude-3.5-Sonnet</div>
                <div class="stat-row">
                    <span>Input Tokens:</span>
                    <span>${tokenUsage.claude.input.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span>Output Tokens:</span>
                    <span>${tokenUsage.claude.output.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span>Kosten:</span>
                    <span class="cost">$${tokenUsage.claude.cost.toFixed(3)}</span>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="model-name chatgpt">🧠 GPT-4</div>
                <div class="stat-row">
                    <span>Input Tokens:</span>
                    <span>${tokenUsage.chatgpt.input.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span>Output Tokens:</span>
                    <span>${tokenUsage.chatgpt.output.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span>Kosten:</span>
                    <span class="cost">$${tokenUsage.chatgpt.cost.toFixed(3)}</span>
                </div>
            </div>
            
            <div class="tip">
                💡 <strong>Tipp:</strong> Die Token-Zählung ist eine Schätzung. 
                Die tatsächlichen Kosten können leicht abweichen.
            </div>
            
            <button class="reset-btn" onclick="if(confirm('Statistik wirklich zurücksetzen?')) { window.location.href = 'command:aiduino.resetTokenStats'; }">
                Statistik zurücksetzen
            </button>
        </body>
        </html>
    `;
}

function showAbout() {
    const panel = vscode.window.createWebviewPanel(
        'aiduinoAbout',
        'Über AI.duino',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    
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
            </style>
        </head>
        <body>
            <div class="logo">🤖</div>
            <h1>AI.duino</h1>
            <div class="version">Version 1.0.0</div>
            
            <p><strong>KI-gestützte Arduino-Entwicklung</strong></p>
            
            <div class="info-box">
                <h3>Features:</h3>
                <div class="feature">Claude 3.5 Sonnet Integration</div>
                <div class="feature">ChatGPT-4 Integration</div>
                <div class="feature">Code-Verbesserung und Optimierung</div>
                <div class="feature">Fehler-Erklärung auf Deutsch</div>
                <div class="feature">Automatische Code-Kommentierung</div>
                <div class="feature">Debug-Hilfe und Hardware-Diagnose</div>
                <div class="feature">Token-Verbrauch Tracking</div>
            </div>
            
            <div class="license">
                <strong>Lizenz:</strong> Apache License 2.0<br>
                Copyright © 2025 Monster Maker
            </div>
            
            <div class="info-box">
                <h3>Tastenkürzel:</h3>
                <p><kbd>Strg+Shift+C</kbd> - Quick-Menü öffnen</p>
                <p><kbd>Strg+Shift+E</kbd> - Fehler erklären</p>
            </div>
            
            <div class="credits">
                <p><strong>Publisher:</strong> Monster Maker</p>
                <p><strong>Repository:</strong> <a href="https://github.com/NikolaiRadke/AI.duino">GitHub</a></p>
                <p><strong>Fehler melden:</strong> <a href="https://github.com/NikolaiRadke/AI.duino/issues">Issue Tracker</a></p>
                <br>
                <p><em>Entwickelt mit 💙 für die Arduino-Community</em></p>
            </div>
        </body>
        </html>
    `;
}

// Command zum Zurücksetzen:
function resetTokenStats() {
    tokenUsage = {
        claude: { input: 0, output: 0, cost: 0 },
        chatgpt: { input: 0, output: 0, cost: 0 },
        daily: new Date().toDateString()
    };
    saveTokenUsage();
    updateStatusBar();
    vscode.window.showInformationMessage('✅ Token-Statistik zurückgesetzt!');
}

function handleApiError(error) {
    const modelName = currentModel === 'claude' ? 'Claude' : 'ChatGPT';
    
    if (error.message.includes('API Key')) {
        vscode.window.showErrorMessage(
            `🔑 ${error.message}`,
            'API Key eingeben',
            'Modell wechseln'
        ).then(selection => {
            if (selection === 'API Key eingeben') {
                vscode.commands.executeCommand('aiduino.setApiKey');
            } else if (selection === 'Modell wechseln') {
                vscode.commands.executeCommand('aiduino.switchModel');
            }
        });
    } else {
        vscode.window.showErrorMessage(`❌ ${modelName} Fehler: ${error.message}`);
    }
}

function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    console.log('AI.duino v1.0 deaktiviert');
}
exports.deactivate = deactivate;
REM ===== EXTENSION.JS END =====
) > "%TARGET%\extension\out\extension.js"

echo [OK] extension.js erstellt
echo.

REM Create manifest
(
echo ^<?xml version="1.0" encoding="utf-8"?^>
echo ^<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"^>
echo   ^<Metadata^>
echo     ^<Identity Language="en-US" Id="aiduino" Version="1.0.0" Publisher="Monster Maker"/^>
echo     ^<DisplayName^>AI.duino^</DisplayName^>
echo     ^<Description xml:space="preserve"^>KI-Hilfe fuer Arduino mit Fehler-Erklaerung und Debug-Support^</Description^>
echo   ^</Metadata^>
echo   ^<Installation^>
echo     ^<InstallationTarget Id="Microsoft.VisualStudio.Code"/^>
echo   ^</Installation^>
echo   ^<Assets^>
echo     ^<Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/^>
echo   ^</Assets^>
echo ^</PackageManifest^>
) > "%TARGET%\extension.vsixmanifest"

REM Create LICENSE
(
echo                                  Apache License
echo                            Version 2.0, January 2004
echo                         http://www.apache.org/licenses/
echo.
echo    TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
echo.
echo    1. Definitions.
echo.
echo       "License" shall mean the terms and conditions for use, reproduction,
echo       and distribution as defined by Sections 1 through 9 of this document.
echo.
echo       "Licensor" shall mean the copyright owner or entity authorized by
echo       the copyright owner that is granting the License.
echo.
echo       "Legal Entity" shall mean the union of the acting entity and all
echo       other entities that control, are controlled by, or are under common
echo       control with that entity. For the purposes of this definition,
echo       "control" means ^(i^) the power, direct or indirect, to cause the
echo       direction or management of such entity, whether by contract or
echo       otherwise, or ^(ii^) ownership of fifty percent ^(50%%^) or more of the
echo       outstanding shares, or ^(iii^) beneficial ownership of such entity.
echo.
echo       "You" ^(or "Your"^) shall mean an individual or Legal Entity
echo       exercising permissions granted by this License.
echo.
echo    [... Rest der Apache 2.0 Lizenz ...]
echo.
echo    Copyright 2025 Monster Maker
echo.
echo    Licensed under the Apache License, Version 2.0 ^(the "License"^);
echo    you may not use this file except in compliance with the License.
echo    You may obtain a copy of the License at
echo.
echo        http://www.apache.org/licenses/LICENSE-2.0
echo.
echo    Unless required by applicable law or agreed to in writing, software
echo    distributed under the License is distributed on an "AS IS" BASIS,
echo    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
echo    See the License for the specific language governing permissions and
echo    limitations under the License.
) > "%TARGET%\LICENSE"

echo.
echo ===============================================
echo    Installation erfolgreich!
echo ===============================================
echo.
echo AI.duino v1.0 wurde installiert!
echo.
echo Naechste Schritte:
echo 1. Arduino IDE neu starten
echo 2. Druecke Strg+Shift+C oder Rechtsklick -^> AI.duino
echo 3. Gib deinen Claude oder ChatGPT API Key ein
echo.
echo Schnellstart: Markiere Code und druecke Strg+Shift+C!
echo.
echo API Keys:
echo    Claude: https://console.anthropic.com/api-keys
echo    ChatGPT: https://platform.openai.com/api-keys
echo.
echo Lizenz: Apache 2.0 - siehe %TARGET%\LICENSE
echo.
pause
