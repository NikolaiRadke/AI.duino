/*
 * AI.duino - Inline Completion Provider Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');
const { shouldTriggerCompletion, extractContext } = require('./triggerDetector');
const { getCachedCompletion, cacheCompletion } = require('./completionCache');
const { buildCompletionPrompt } = require('./completionPrompts');

/**
 * Inline Completion Provider for Arduino code
 * Uses Groq API for fast completions
 */
class ArduinoCompletionProvider {
    constructor(context) {
        this.context = context;
        this.isEnabled = false;
        this.lastCompletionTime = 0;
        this.minDelayMs = context.settings?.get('inlineCompletionDelay') ?? 500;
        this.disposables = [];
    }

    /**
     * Initialize and register the completion provider
     */
    async initialize() {
        const config = vscode.workspace.getConfiguration('aiduino');
        this.isEnabled = config.get('inlineCompletionEnabled', false);
        const provider = vscode.languages.registerInlineCompletionItemProvider(
            [
                { language: 'cpp', pattern: '**/*.ino' },
                { language: 'cpp', pattern: '**/*.cpp' },
                { language: 'c', pattern: '**/*.c' },
                { language: 'cpp', pattern: '**/*.h' }
            ],
            this
        );

        this.disposables.push(provider);
    
        // Listen for config changes
        const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('aiduino.inlineCompletionEnabled')) {
                this.updateConfiguration();
            }
        });

        this.disposables.push(configWatcher);
    }

    /**
     * Update configuration when settings change
     */
    updateConfiguration() {
        const config = vscode.workspace.getConfiguration('aiduino');
        const newEnabled = config.get('inlineCompletionEnabled', false);

        if (newEnabled !== this.isEnabled) {
            this.isEnabled = newEnabled;
            const { t } = this.context;
            if (newEnabled) {
                vscode.window.showInformationMessage(t('messages.inlineCompletionEnabled'));
            } else {
                vscode.window.showInformationMessage(t('messages.inlineCompletionDisabled'));
            }
        }
    }

    /**
     * VS Code calls this method to get inline completions
     * @param {vscode.TextDocument} document 
     * @param {vscode.Position} position 
     * @param {vscode.InlineCompletionContext} context 
     * @param {vscode.CancellationToken} token 
     */
    async provideInlineCompletionItems(document, position, context, token) {
        if (!this.isEnabled) {
            return [];
        }

        // Check rate limiting
        const now = Date.now();
        if (now - this.lastCompletionTime < this.minDelayMs) {
            return [];
        }

        // Check if completion should be triggered
        const triggerResult = shouldTriggerCompletion(document, position, this.context);
        if (!triggerResult.shouldTrigger) {
            return [];
        }

        // Check cache first
        const cachedCompletion = getCachedCompletion(triggerResult.cacheKey);
        if (cachedCompletion) {
            return [new vscode.InlineCompletionItem(cachedCompletion)];
        }

        // Get completion from Groq
        try {
            this.lastCompletionTime = now;
            const completion = await this.fetchCompletion(document, position, triggerResult);

            if (completion && !token.isCancellationRequested) {
                // Cache the result
                cacheCompletion(triggerResult.cacheKey, completion);
    
                // For comment triggers
                if (triggerResult.triggerType === 'comment') {
                    return [new vscode.InlineCompletionItem(completion)];
                }
    
                return [new vscode.InlineCompletionItem(completion)];
            }
        } catch (error) {
            // Silent fail for completions - don't annoy user
        }

        return [];
    }

    /**
     * Fetch completion from API using currently selected model
     */
    async fetchCompletion(document, position, triggerResult) {
        const { apiClient, minimalModelManager, settings } = this.context;

        // Build prompt with context
        const contextData = extractContext(document, position, triggerResult, this.context);
        const prompt = buildCompletionPrompt(contextData, settings);

        // Get inline completion provider from settings
        const config = vscode.workspace.getConfiguration('aiduino');
        const inlineProvider = config.get('inlineCompletionProvider', 'groq');
    
        const provider = minimalModelManager.providers[inlineProvider];
        
        // Don't count inline completions for support hints
        const contextWithFlag = { ...this.context, skipSupportHint: true };

        // Make API call with user's selected model
        const response = await apiClient.callAPI('groq', prompt, contextWithFlag);

        // Extract and clean the completion
        return this.cleanCompletion(response, contextData);
    }   

    /**
     * Clean and format the completion text
     */
    cleanCompletion(response, contextData) {
        const { settings } = this.context;  
        let completion = response.trim();

        // Remove markdown code blocks if present
        completion = completion.replace(/```(?:cpp|c\+\+|arduino|c)?\s*\n/g, '');
        completion = completion.replace(/```\s*$/g, '');
    
        // Only return the next line(s), not full function rewrites
        const lines = completion.split('\n');
    
        // For comment triggers, return complete code block
        if (contextData.triggerType === 'comment') {
            const maxLines = settings?.get('inlineCompletionMaxLinesComment') ?? 15;  
            return '\n' + lines.slice(0, maxLines).join('\n');
        }

        // For other triggers, return single line
        return lines[0];
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}

/**
 * Toggle inline completion with cost warning
 * @param {Object} context - Extension context with dependencies
 */
async function toggleInlineCompletion(context) {
    // Open settings panel and jump to inline completion section
    const { showSettings } = require('../../utils/panels/settingsPanel');
    showSettings(context, 'inlineCompletion');
}

/**
 * Register inline completion feature
 */
async function registerInlineCompletion(context) {
    const provider = new ArduinoCompletionProvider(context);
    await provider.initialize();
    context.subscriptions.push(provider);
    return provider;
}

module.exports = {
    ArduinoCompletionProvider,
    registerInlineCompletion,
    toggleInlineCompletion
};
