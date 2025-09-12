/*
 * AI.duino - Event Manager
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

const vscode = require("vscode");

/**
 * Manages all extension event listeners and their lifecycle
 * Centralized event handling with proper cleanup and debouncing
 */
class EventManager {
    constructor() {
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
        
        // Debounce delays (ms)
        this.DEBOUNCE_DELAYS = {
            CONFIG_CHANGE: 300,
            SAVE_OPERATION: 500,
            ERROR_CLEAR: 5000
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
            // diagnosticsListener already added by errorChecker.setupDiagnosticListener
        }
        
        console.log('AI.duino EventManager: Event listeners setup complete');
    }
    
    /**
     * Debounced configuration change handler
     * Prevents rapid-fire config changes from overwhelming the system
     * @param {Function} loadLocale - Function to reload locale
     */
    debouncedConfigChange(loadLocale) {
        // Clear existing timeout
        this.clearTimeout('configDebounce');
        
        // Set new debounced timeout
        this.timeouts.configDebounce = setTimeout(() => {
            try {
                if (loadLocale && typeof loadLocale === 'function') {
                    loadLocale();
                }
                
                if (this.callbacks.updateStatusBar) {
                    this.callbacks.updateStatusBar();
                }
                
                if (this.callbacks.onConfigChange) {
                    this.callbacks.onConfigChange();
                }
            } catch (error) {
                // Silent error handling - config changes shouldn't crash extension
                console.log('AI.duino EventManager: Config change error:', error.message);
            } finally {
                this.timeouts.configDebounce = null;
            }
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
            try {
                if (saveOperation && typeof saveOperation === 'function') {
                    saveOperation();
                }
            } catch (error) {
                // Silent error - saving is not critical for extension operation
                console.log('AI.duino EventManager: Save operation error:', error.message);
            } finally {
                this.timeouts[timeoutKey] = null;
            }
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
            try {
                if (clearErrorState && typeof clearErrorState === 'function') {
                    clearErrorState();
                }
            } catch (error) {
                // Silent error
            } finally {
                this.timeouts.errorTimeout = null;
            }
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
     * Dispose all event listeners with comprehensive error handling
     * Safe to call multiple times
     */
    disposeEventListeners() {
        // Clear all timeouts first
        this.clearAllTimeouts();
        
        // Dispose listeners with error handling
        const listenersToDispose = [
            { listener: this.listeners.configListener, name: 'configListener' },
            { listener: this.listeners.diagnosticsListener, name: 'diagnosticsListener' }
        ];
        
        listenersToDispose.forEach(({ listener, name }) => {
            if (listener && typeof listener.dispose === 'function') {
                try {
                    listener.dispose();
                    console.log(`AI.duino EventManager: Disposed ${name}`);
                } catch (error) {
                    // Silent disposal error - don't block cleanup
                    console.log(`AI.duino EventManager: Error disposing ${name}:`, error.message);
                }
            }
        });
        
        // Reset listener references
        Object.keys(this.listeners).forEach(key => {
            this.listeners[key] = null;
        });
    }
    
    /**
     * Get current state of event manager for debugging
     * @returns {Object} Current state information
     */
    getDebugState() {
        const activeListeners = Object.entries(this.listeners)
            .filter(([key, listener]) => listener !== null)
            .map(([key]) => key);
            
        const activeTimeouts = Object.entries(this.timeouts)
            .filter(([key, timeout]) => timeout !== null)
            .map(([key]) => key);
            
        return {
            activeListeners,
            activeTimeouts,
            listenerCount: activeListeners.length,
            timeoutCount: activeTimeouts.length,
            hasCallbacks: Object.values(this.callbacks).filter(cb => cb !== null).length
        };
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
        console.log('AI.duino EventManager: Starting disposal...');
        
        // Dispose all listeners and clear timeouts
        this.disposeEventListeners();
        
        // Clear callback references
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = null;
        });
        
        console.log('AI.duino EventManager: Disposal complete');
    }
}

module.exports = { EventManager };
