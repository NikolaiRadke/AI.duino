/*
 * AI.duino - Chat Handlers Module
 * Copyright 2026 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const path = require('path');
const shared = require('../../shared');
const featureUtils = require('../featureUtils');
const contextManager = require('../../utils/contextManager');
const fileManager = require('../../utils/fileManager');

/**
 * Get current workspace path
 * @returns {string|null} Workspace path or null
 */
function getWorkspacePath() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return workspaceFolders[0].uri.fsPath;
    }
    
    // Fallback: use active editor's directory
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        return path.dirname(editor.document.uri.fsPath);
    }
    
    return null;
}

/**
 * Handle opening a chat
 * @param {string} chatId - Chat ID to open
 * @param {Object} panel - Webview panel
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object (references to mutable state)
 */
async function handleOpenChat(chatId, panel, context, state) {
    if (state.historyManager.switchChat(chatId)) {
        // Restore sessions from history
        const savedSessions = state.historyManager.loadSessions(chatId);
        state.activeSessions = savedSessions || {};
        
        state.currentView = 'chat';
        state.updatePanelContent(panel, context);
    }
}

/**
 * Handle new chat creation
 * @param {Object} panel - Webview panel
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 */
async function handleNewChat(panel, context, state) {
    const { t } = context;
    
    if (!state.historyManager.canCreateNewChat()) {
        vscode.window.showWarningMessage(t('chat.maxChatsReached'));
        return;
    }
    
    const workspacePath = getWorkspacePath();
    const chatId = state.historyManager.createNewChat('', workspacePath);
    if (chatId) {
        state.currentView = 'chat';
        state.updatePanelContent(panel, context);
    }
}

/**
 * Handle chat deletion
 * @param {string} chatId - Chat ID to delete
 * @param {Object} panel - Webview panel
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 */
async function handleDeleteChat(chatId, panel, context, state) {
    const { t } = context;
    
    const choice = await vscode.window.showWarningMessage(
        t('chat.confirmDelete'),
        t('buttons.yes'),
        t('buttons.no')
    );
    
    if (choice === t('buttons.yes')) {
        if (state.historyManager.deleteChat(chatId)) {
            state.currentView = 'overview';
            state.updatePanelContent(panel, context);
        }
    }
}

/**
 * Handle user message
 * @param {string} userText - User message text
 * @param {Object} panel - Webview panel
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 */
async function handleUserMessage(userText, panel, context, state) {
    if (!userText?.trim() && !state.attachedContext) return;

    const messageText = userText?.trim() || '';
    const actualCurrentModel = fileManager.loadSelectedModel(context.minimalModelManager.providers) || context.currentModel;
    
    if (state.lastUsedProvider && state.lastUsedProvider !== actualCurrentModel) {
        state.activeSessions = {}; // Clear all sessions
    }

    state.lastUsedProvider = actualCurrentModel;
    state.historyManager.addMessage('user', messageText, state.attachedContext);
    state.updatePanelContent(panel, context);

    const chatHistory = state.historyManager.getActiveChat();
    const chatId = state.historyManager.getActiveChatId();
    const sessionKey = `${chatId}-${actualCurrentModel}`;
    const provider = context.minimalModelManager.providers[actualCurrentModel];
    const isAgentic = !!provider?.agentModule;

    // Show processing message for agentic mode
    if (state.agenticMode && isAgentic) {
        state.historyManager.addMessage('system', '⏳ ' + context.t('progress.processing'));
        state.updatePanelContent(panel, context);
    }

    const hadNoSession = isAgentic 
        ? !context.agenticClient?.hasSession(actualCurrentModel)
        : !state.activeSessions[sessionKey];
    
    let prompt;

    if (state.attachedContext) {
        state.lastUsedContext = state.attachedContext;
        prompt = buildChatPromptWithAttachments(messageText, state.attachedContext, context, state);
        state.attachedContext = null;
        panel.webview.postMessage({ command: 'contextAttached', badge: '' });
    } else {
        let selectionContext = null;
        const editor = vscode.window.activeTextEditor;
        if (editor && !editor.selection.isEmpty) {
            if (editor && !editor.selection.isEmpty) {
                const selectedText = editor.document.getText(editor.selection);
                if (selectedText.trim()) {
                    selectionContext = selectedText;
                }
            }
        }
        prompt = buildChatPrompt(userText, chatHistory, actualCurrentModel, context.minimalModelManager, chatId, context, state, selectionContext);
    }
    
    try {
        // For agentic providers, use chat's stored workspace
        const currentProvider = context.minimalModelManager.providers[actualCurrentModel];
        if (currentProvider?.type === 'agentic') {
            context.workspacePath = state.historyManager.getWorkspacePath(chatId);
        }
    
        let result;
        
        if (state.agenticMode && isAgentic && context.agenticClient) {
            // Agentic mode with compile loop
            const sketchPath = state.historyManager.getWorkspacePath(chatId) || getWorkspacePath();
            result = await context.agenticClient.callAgentWithCompile(
                actualCurrentModel,
                prompt,
                context,
                { sketchPath, maxRetries: 3, panel }
            );

            // Remove processing message first
            state.historyManager.removeLastMessageIfStartsWith('⏳');
            
            // Handle agentic result
            if (result.compileResult) {
                const status = result.compileResult.success ? '✅' : '❌';
                const iterations = result.iterations > 1 ? ` (${result.iterations} iterations)` : '';
                state.historyManager.addMessage('system', 
                    `${status} Compile ${result.compileResult.success ? 'successful' : 'failed'}${iterations}`,
                    null, actualCurrentModel
                );
            }
            result = result.response;
        } else {
            result = await featureUtils.callAIWithProgress(
                prompt, 
                'progress.askingAI', 
                context,
                { useCodeTemperature: state.chatCodeMode }
            );
        }
        
        // For agentic providers, session is managed by agenticClient
        // For API providers, use local activeSessions
        if (!isAgentic) {
            const newSessionId = context.sessionId || null;      
            const gotNewSession = provider?.persistent && hadNoSession && newSessionId;
        
            if (gotNewSession) {
                state.activeSessions[sessionKey] = newSessionId;
                // Removed: No need to announce new persistent sessions to user
                // state.historyManager.addMessage('system', context.t('chat.newSessionStarted'), null, actualCurrentModel);
            } else if (provider?.persistent && newSessionId) {
                state.activeSessions[sessionKey] = newSessionId;
            }

            if (provider?.persistent) {
                state.historyManager.saveSessions(
                    state.historyManager.getActiveChatId(), 
                    state.activeSessions
                );
            }
        } else if (isAgentic && hadNoSession && context.agenticClient?.hasSession(actualCurrentModel)) {
            // New agentic session started - no need to announce to user
            // state.historyManager.addMessage('system', context.t('chat.newSessionStarted'), null, actualCurrentModel);
        }
    
        state.historyManager.addMessage('ai', result, null, actualCurrentModel);

        state.updatePanelContent(panel, context);
    } catch (error) {
        throw error;
    }
}

/**
 * Build chat prompt with history context
 * @param {string} newMessage - New user message
 * @param {Array} history - Chat history
 * @param {string} currentModel - Current model ID
 * @param {Object} minimalModelManager - Model manager
 * @param {string} chatId - Chat ID
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 * @returns {string} Complete prompt
 */
function buildChatPrompt(newMessage, history, currentModel, minimalModelManager, chatId, context, state, selectionContext = null) {
    const { t } = context;
    const provider = minimalModelManager.providers[currentModel];
    const isAgentic = !!provider?.agentModule;
    
    // For agentic providers, check session via agenticClient
    // For API providers, use local activeSessions
    let hasActiveSession = false;
    if (isAgentic && context.agenticClient) {
        // Use chat's stored workspace, not current workspace
        const chatWorkspace = state.historyManager.getWorkspacePath(chatId);
        hasActiveSession = context.agenticClient.hasSession(currentModel, chatWorkspace);
    } else {
        const sessionKey = `${chatId}-${currentModel}`;
        hasActiveSession = provider?.persistent && state.activeSessions[sessionKey];
    }
    
    if (hasActiveSession) {
        let prompt = state.arduinoMode ? 
            t('prompts.systemPrompt') + "\n\n" :
            "You are a helpful AI assistant.\n\n";
        if (selectionContext) {
            prompt += `Selected code:\n\`\`\`cpp\n${selectionContext}\n\`\`\`\n\n`;
        }
        prompt += `User: ${newMessage}\n\n`;
        if (state.arduinoMode) {
            prompt += shared.getBoardContext();
        }
        if (!isAgentic) {
            prompt += "\n\nWhen writing code, always show the complete code in markdown code blocks (```cpp, ```python, etc.) in your response, not just file references.";
        }
        if (isAgentic && state.arduinoMode) {
            if (selectionContext) {
                prompt += `\n\nThe user has selected the following code:\n\`\`\`cpp\n${selectionContext}\n\`\`\`\nFocus your response on this selected code.`;
            }
            prompt += "\n\nYou are working in agentic mode with access to the sketch folder. When asked about code, proactively search for and read .ino files in the current directory. IMPORTANT: Only edit the existing .ino file. Do not create new files or rename the sketch.";
        }
        return prompt;
    }
    
    if (history.length === 0) {
        let prompt = state.arduinoMode ? 
            t('prompts.systemPrompt') + "\n\n" :
            "You are a helpful AI assistant.\n\n";
        if (selectionContext) {
            prompt += `Selected code:\n\`\`\`cpp\n${selectionContext}\n\`\`\`\n\n`;
        }
        if (selectionContext) {
            prompt += `Selected code:\n\`\`\`cpp\n${selectionContext}\n\`\`\`\n\n`;
        }
        prompt += `User: ${newMessage}\n\n`;
        if (state.arduinoMode) {
            prompt += shared.getBoardContext();
        }
        if (!isAgentic) {
            prompt += "\n\nWhen writing code, always show the complete code in markdown code blocks (```cpp, ```python, etc.) in your response, not just file references.";
        }
        if (isAgentic && state.arduinoMode) {
            if (selectionContext) {
                prompt += `\n\nThe user has selected the following code:\n\`\`\`cpp\n${selectionContext}\n\`\`\`\nFocus your response on this selected code.`;
            }
            prompt += "\n\nYou are working in agentic mode with access to the sketch folder. When asked about code, proactively search for and read .ino files in the current directory. IMPORTANT: Only edit the existing .ino file. Do not create new files or rename the sketch.";
        }
        return prompt;
    }
    
    let prompt = state.arduinoMode ?
        t('prompts.systemPrompt') + " Previous conversation:\n\n" :
        "You are a helpful AI assistant. Previous conversation:\n\n";
    
    const maxHistory = context.settings.get('chatHistoryLength') || 20;
    const recentHistory = history.slice(-maxHistory, -1);  // Exclude last (current) message
    recentHistory.forEach(msg => {
        const role = msg.sender === 'user' ? 'User' : 'Assistant';
        prompt += `${role}: ${msg.text}\n\n`;
    });
    
    prompt += `User: ${newMessage}\n\n`;
    if (state.arduinoMode) {
        prompt += shared.getBoardContext();
    }
    if (!isAgentic) {
        prompt += "\n\nWhen writing code, always show the complete code in markdown code blocks (```cpp, ```python, etc.) in your response, not just file references.";
    }
    if (isAgentic && state.arduinoMode) {
        if (selectionContext) {
            prompt += `\n\nThe user has selected the following code:\n\`\`\`cpp\n${selectionContext}\n\`\`\`\nFocus your response on this selected code.`;
        }
        prompt += "\n\nYou are working in agentic mode with access to the sketch folder. When asked about code, proactively search for and read .ino files in the current directory. IMPORTANT: Only edit the existing .ino file. Do not create new files or rename the sketch.";
        }
    prompt += "\n\nPlease respond as the AI assistant:";
    
    return prompt;
}

/**
 * Build chat prompt with attachments (Arduino files and/or external files)
 * @param {string} messageText - User message
 * @param {Object} attachedContext - Context with contextData and externalFiles
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 * @returns {string} Complete prompt
 */
function buildChatPrompt(newMessage, history, currentModel, minimalModelManager, chatId, context, state, selectionContext = null) {
    const { t } = context;
    const provider = minimalModelManager.providers[currentModel];
    const isAgentic = !!provider?.agentModule;
    
    let hasActiveSession = false;
    if (isAgentic && context.agenticClient) {
        const chatWorkspace = state.historyManager.getWorkspacePath(chatId);
        hasActiveSession = context.agenticClient.hasSession(currentModel, chatWorkspace);
    } else {
        const sessionKey = `${chatId}-${currentModel}`;
        hasActiveSession = provider?.persistent && state.activeSessions[sessionKey];
    }
    
    // Base prompt
    let prompt = state.arduinoMode ?
        t('prompts.systemPrompt') :
        "You are a helpful AI assistant.";
    
    // Add history if available and no active session
    if (!hasActiveSession && history.length > 0) {
        prompt += " Previous conversation:\n\n";
        const maxHistory = context.settings.get('chatHistoryLength') || 20;
        const recentHistory = history.slice(-maxHistory, -1);
        recentHistory.forEach(msg => {
            const role = msg.sender === 'user' ? 'User' : 'Assistant';
            prompt += `${role}: ${msg.text}\n\n`;
        });
    } else {
        prompt += "\n\n";
    }
    
    // Add selected code if present (non-agentic only - agentic handles it separately)
    if (selectionContext && !isAgentic) {
        prompt += `Selected code:\n\`\`\`cpp\n${selectionContext}\n\`\`\`\n\n`;
    }
    
    prompt += `User: ${newMessage}\n\n`;
    
    if (state.arduinoMode) {
        prompt += shared.getBoardContext();
    }
    
    if (!isAgentic) {
        prompt += "\n\nWhen writing code, always show the complete code in markdown code blocks (```cpp, ```python, etc.) in your response, not just file references.";
    }
    
    if (isAgentic && state.arduinoMode) {
        if (selectionContext) {
            prompt += `\n\nThe user has selected the following code:\n\`\`\`cpp\n${selectionContext}\n\`\`\`\nFocus your response on this selected code.`;
        }
        prompt += "\n\nYou are working in agentic mode with access to the sketch folder. When asked about code, proactively search for and read .ino files in the current directory. IMPORTANT: Only edit the existing .ino file. Do not create new files or rename the sketch.";
    }
    
    if (!hasActiveSession && history.length > 0) {
        prompt += "\n\nPlease respond as the AI assistant:";
    }
    
    return prompt;
}

/**
 * Handle attaching context - shows menu with 3 options
 * @param {Object} panel - Webview panel
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 */
async function handleAttachContext(panel, context, state) {
    const { t, currentModel, minimalModelManager } = context;
    const editor = vscode.window.activeTextEditor;
    const provider = minimalModelManager.providers[currentModel];
    const isAgentic = !!provider?.agentModule;
    
    // Build options
    const options = [];
    
    // Only show code options if Arduino file is open AND not using agentic provider
    // Agentic providers (Claude Code) have direct project access
    if (!isAgentic && editor && context.validation.validateArduinoFile(editor.document.fileName)) {
        options.push({
            label: '📂 ' + t('context.currentFile'),
            description: t('context.currentFileDetailNoSelection'),
            value: 'currentFile'
        });
        
        options.push({
            label: '📂 ' + t('context.fullSketch'),
            description: t('context.fullSketchDetailNoSelection'),
            value: 'fullSketch'
        });
    }
    
    // Always show external files option
    options.push({
        label: '📂 ' + t('customAgent.additionalFiles'),
        description: t('customAgent.additionalFilesDesc'),
        value: 'externalFiles'
    });
    
    const choice = await vscode.window.showQuickPick(options, {
        placeHolder: t('chat.attachFile'),
        ignoreFocusOut: true
    });
    
    if (!choice) return;
    
    // Handle choice
    if (choice.value === 'externalFiles') {
        await handleAttachExternalFiles(panel, context, state);
    } else {
        // currentFile or fullSketch
        const contextData = contextManager.buildContextData(
            choice.value,
            editor,
            contextManager.getSketchFiles(path.dirname(editor.document.uri.fsPath)),
            ''
        );
        
        // Store in new structure
        if (!state.attachedContext) {
            state.attachedContext = {
                contextData: null,
                externalFiles: []
            };
        }
        
        state.attachedContext.contextData = contextData;
        state.lastUsedContext = { ...state.attachedContext };
        state.updateAttachmentButtons(panel, context);

        vscode.window.showInformationMessage(t('messages.contextAttachedInfo'));
    }
}

/**
 * Handle attaching external files
 * @param {Object} panel - Webview panel
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 */
async function handleAttachExternalFiles(panel, context, state) {
    const { t } = context;
    
    const existingFiles = state.attachedContext?.externalFiles || [];
    
    const newFiles = await fileManager.pickAdditionalFiles(existingFiles.map(f => f.path), {
        title: t('customAgent.selectAdditionalFiles'),
        openLabel: t('customAgent.addFiles')
    });
    
    if (!newFiles || newFiles.length === 0) return;
    
    const filesData = await fileManager.readAdditionalFiles(newFiles);
    
    if (!state.attachedContext) {
        state.attachedContext = {
            contextData: null,
            externalFiles: []
        };
    }
    
    state.attachedContext.externalFiles = [
        ...state.attachedContext.externalFiles,
        ...filesData.filter(f => !f.error)
    ];
    
    state.lastUsedContext = { ...state.attachedContext };
    state.updateAttachmentButtons(panel, context);
    
    const count = filesData.filter(f => !f.error).length;
    vscode.window.showInformationMessage(
        count === 1 
            ? t('chat.externalFileAttached')
            : t('chat.externalFilesAttached', count)
    );
}

/**
 * Handle managing attachments via QuickPick
 * @param {Object} panel - Webview panel
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 */
async function handleManageAttachments(panel, context, state) {
    const { t } = context;
    
    if (!state.attachedContext) return;
    
    const items = [];
    
    if (state.attachedContext.contextData && state.attachedContext.contextData.contextFiles) {
        state.attachedContext.contextData.contextFiles.forEach(file => {
            items.push({
                label: `📂 ${file.name}`,
                description: t('context.currentFile'),
                filePath: `context:${file.name}`,
                type: 'context'
            });
        });
    }
    
    if (state.attachedContext.externalFiles) {
        state.attachedContext.externalFiles.forEach(file => {
            items.push({
                label: `📂 ${file.name}`,
                description: '(extern)',
                filePath: file.path,
                type: 'external'
            });
        });
    }
    
    if (items.length === 0) return;
    
    const choice = await vscode.window.showQuickPick(items, {
        placeHolder: t('chat.removeFilePrompt', t('buttons.remove') + '?'),
        ignoreFocusOut: true
    });
    
    if (!choice) return;
    
    if (choice.type === 'context') {
        const fileName = choice.filePath.replace('context:', '');
        if (state.attachedContext.contextData && state.attachedContext.contextData.contextFiles) {
            state.attachedContext.contextData.contextFiles = state.attachedContext.contextData.contextFiles.filter(
                f => f.name !== fileName
            );
            
            if (state.attachedContext.contextData.contextFiles.length === 0) {
                state.attachedContext.contextData = null;
            }
        }
    } else {
        state.attachedContext.externalFiles = state.attachedContext.externalFiles.filter(
            f => f.path !== choice.filePath
        );
    }
    
    if (!state.attachedContext.contextData && state.attachedContext.externalFiles.length === 0) {
        state.attachedContext = null;
        state.lastUsedContext = null;
    }

    state.updateAttachmentButtons(panel, context);
}

/**
 * Build chat prompt with attachments (Arduino files and/or external files)
 * @param {string} messageText - User message
 * @param {Object} attachedContext - Context with contextData and externalFiles
 * @param {Object} context - Extension context
 * @param {Object} state - Chat state object
 * @returns {string} Complete prompt
 */
function buildChatPromptWithAttachments(messageText, attachedContext, context, state) {
    const { t } = context;
    let prompt = state.arduinoMode ?
        t('prompts.systemPrompt') + "\n\n" :
        "You are a helpful AI assistant.\n\n";

    prompt += `User question: ${messageText}\n\n`;

    if (attachedContext.contextData && attachedContext.contextData.contextFiles) {
        const files = attachedContext.contextData.contextFiles;

        if (files.length === 1) {
            const file = files[0];
            prompt += `Code file (${file.name}):\n\`\`\`cpp\n${file.content}\n\`\`\`\n\n`;
        } else if (files.length > 1) {
            prompt += `Complete Arduino Sketch:\n\n`;
            for (const file of files) {
                prompt += `// ========== ${file.name} ==========\n`;
                prompt += `\`\`\`cpp\n${file.content}\n\`\`\`\n\n`;
            }
        }
    }

    if (attachedContext.externalFiles && attachedContext.externalFiles.length > 0) {
        prompt += `\n=== Additional External Files ===\n`;
        for (const file of attachedContext.externalFiles) {
            prompt += `\n// ========== ${file.name} ==========\n`;
            prompt += `\`\`\`\n${file.content}\n\`\`\`\n`;
        }
    }

    if (state.arduinoMode) {
        prompt += '\n\n' + shared.getBoardContext();
    }
    prompt += "\n\nWhen writing code, always show the complete code in markdown code blocks (```cpp, ```python, etc.) in your response, not just file references.";
    return prompt;
}

module.exports = {
    handleOpenChat,
    handleNewChat,
    handleDeleteChat,
    handleUserMessage,
    handleAttachContext,
    handleManageAttachments,
    getWorkspacePath
};
