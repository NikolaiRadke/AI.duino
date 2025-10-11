/*
 * AI.duino - Event Manager Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */
"use strict";

const vscode = require("vscode");

/**
 * Manages all extension event listeners and their lifecycle
 * Centralized event handling with proper cleanup and debouncing
 */
class EventManager {
    constructor(context = null) {
        this.context = context;
        // Debounce delays (ms)
        this.DEBOUNCE_DELAYS = {
            CONFIG_CHANGE: context?.settings.get('debounceConfigChange') ?? 300,
            SAVE_OPERATION: context?.settings.get('debounceSaveOperation') ?? 500,
            ERROR_CLEAR: context?.settings.get('debounceErrorClear') ?? 5000
        };

        // Event listeners storage
        this.listeners = {
            configListener: null,
            diagnosticsListener: null
        };
        
        // Timeout management for debouncing
        this.timeouts = {
            configDebounce: null,
            saveTimeout: null,
            errorTimeout: null
        };
        
        // Event callbacks (injected dependencies)
        this.callbacks = {
            onConfigChange: null,
            onDiagnosticsChange: null,
            updateStatusBar: null
        };
    }
    
    /**
     * Initialize event manager with required callbacks
     * @param {Object} callbacks - Event callback functions
     * @param {Function} callbacks.onConfigChange - Called when config changes
     * @param {Function} callbacks.onDiagnosticsChange - Called when diagnostics change
     * @param {Function} callbacks.updateStatusBar - Called to update status bar
     */
    initialize(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }
    
    /**
     * Setup all event listeners with proper cleanup and debouncing
     * @param {vscode.ExtensionContext} context - VS Code extension context
     * @param {Object} dependencies - Required dependencies
     * @param {Function} dependencies.loadLocale - Locale loading function
     * @param {Object} dependencies.errorChecker - Error checker instance
     */
    setupEventListeners(context, dependencies) {
        // Cleanup existing listeners first
        this.disposeEventListeners();
        
        // Configuration change listener with debouncing
        this.listeners.configListener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('aiduino.language')) {
                this.debouncedConfigChange(dependencies.loadLocale);
            }
        });
        
        // Diagnostics listener setup (delegated to ErrorChecker)
        if (dependencies.errorChecker && dependencies.errorChecker.setupDiagnosticListener) {
            this.listeners.diagnosticsListener = dependencies.errorChecker.setupDiagnosticListener(context);
        }
        
        // Add listeners to context subscriptions for automatic cleanup
        if (context && context.subscriptions) {
            context.subscriptions.push(this.listeners.configListener);
        }
    }
    
    /**
     * Debounced configuration change handler
     * @param {Function} loadLocale - Function to reload locale
     */
    debouncedConfigChange(loadLocale) {
        // Clear existing timeout
        this.clearTimeout('configDebounce');
        
        // Set new debounced timeout
        this.timeouts.configDebounce = setTimeout(() => {
            if (loadLocale && typeof loadLocale === 'function') {
                loadLocale();
            }
            
            if (this.callbacks.updateStatusBar) {
                this.callbacks.updateStatusBar();
            }
            
            if (this.callbacks.onConfigChange) {
                this.callbacks.onConfigChange();
            }
            
            this.timeouts.configDebounce = null;
        }, this.DEBOUNCE_DELAYS.CONFIG_CHANGE);
    }
    
    /**
     * Setup debounced save operation (for token usage, etc.)
     * @param {Function} saveOperation - Function to execute for saving
     * @param {string} timeoutKey - Key for timeout management (default: 'saveTimeout')
     */
    debouncedSave(saveOperation, timeoutKey = 'saveTimeout') {
        // Clear existing save timeout
        this.clearTimeout(timeoutKey);
        
        // Set new debounced save timeout
        this.timeouts[timeoutKey] = setTimeout(() => {
            if (saveOperation && typeof saveOperation === 'function') {
                saveOperation();
            }
            this.timeouts[timeoutKey] = null;
        }, this.DEBOUNCE_DELAYS.SAVE_OPERATION);
    }
    
    /**
     * Setup auto-clear timeout for error states
     * @param {Function} clearErrorState - Function to clear error state
     * @param {number} delay - Delay in milliseconds (default: 5000)
     */
    autoErrorClear(clearErrorState, delay = this.DEBOUNCE_DELAYS.ERROR_CLEAR) {
        // Clear existing error timeout
        this.clearTimeout('errorTimeout');
        
        // Set new error clear timeout
        this.timeouts.errorTimeout = setTimeout(() => {
            if (clearErrorState && typeof clearErrorState === 'function') {
                clearErrorState();
            }
            this.timeouts.errorTimeout = null;
        }, delay);
    }
    
    /**
     * Clear specific timeout by key
     * @param {string} timeoutKey - Key of timeout to clear
     */
    clearTimeout(timeoutKey) {
        if (this.timeouts[timeoutKey]) {
            clearTimeout(this.timeouts[timeoutKey]);
            this.timeouts[timeoutKey] = null;
        }
    }
    
    /**
     * Clear all managed timeouts
     */
    clearAllTimeouts() {
        Object.keys(this.timeouts).forEach(key => {
            this.clearTimeout(key);
        });
    }
    
    /**
     * Dispose all event listeners
     */
    disposeEventListeners() {
        // Clear all timeouts first
        this.clearAllTimeouts();
        
        // Dispose listeners
        if (this.listeners.configListener?.dispose) {
            this.listeners.configListener.dispose();
        }
        
        if (this.listeners.diagnosticsListener?.dispose) {
            this.listeners.diagnosticsListener.dispose();
        }
        
        // Reset listener references
        Object.keys(this.listeners).forEach(key => {
            this.listeners[key] = null;
        });
    }
    
    /**
     * Check if event manager is properly initialized
     * @returns {boolean} True if initialized with required callbacks
     */
    isInitialized() {
        return this.callbacks.updateStatusBar !== null;
    }
    
    /**
     * Complete cleanup and disposal
     * Called during extension deactivation
     */
    dispose() {
        // Dispose all listeners and clear timeouts
        this.disposeEventListeners();
        
        // Clear callback references
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = null;
        });
    }
}

module.exports = { EventManager };
