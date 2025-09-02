/*
 * AI.duino - Error Checker Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require("vscode");

/**
 * Error Checker - Handles Arduino compiler error detection and status management
 * 
 * This module manages compiler error detection, throttling, and status bar updates
 * for Arduino-related files (.ino, .cpp, .h, .c)
 */
class ErrorChecker {
    constructor() {
        this.lastDiagnosticsCount = 0;
        this.lastErrorCheck = 0;
        this.lastCheckedUri = null;
        this.errorTimeout = null;
    }

    /**
     * Check if the current file is an Arduino-related file
     * @param {string} fileName - File path to check
     * @returns {boolean} True if Arduino file
     */
    isArduinoFile(fileName) {
        if (!fileName) return false;
        
        const arduinoExtensions = ['.ino', '.cpp', '.h', '.c'];
        return arduinoExtensions.some(ext => fileName.endsWith(ext));
    }

    /**
     * Check for compiler errors in the active editor
     * @param {boolean} silent - If true, don't show status updates  
     * @returns {boolean} True if errors found
     */
    async checkForErrors(silent = true) {
        const now = Date.now();
        
        // Throttling - avoid excessive checks
        if (now - this.lastErrorCheck < 500) {
            return false;
        }
        this.lastErrorCheck = now;
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return false;
        }
        
        // Only check Arduino-related files
        if (!this.isArduinoFile(editor.document.fileName)) {
            return false;
        }
        
        const currentUri = editor.document.uri.toString();
        
        // Reset count for new file
        if (currentUri !== this.lastCheckedUri) {
            this.lastCheckedUri = currentUri;
            this.lastDiagnosticsCount = 0;
        }
        
        try {
            const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
            const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
            const errorCount = errors.length;
            
            // Update internal state
            const hadErrors = this.lastDiagnosticsCount > 0;
            const hasErrors = errorCount > 0;
            this.lastDiagnosticsCount = errorCount;
            
            // Return true if we have errors (status bar logic handled in extension.js)
            return hasErrors;
            
        } catch (error) {
            // Silent error handling - don't break extension
            return false;
        }
    }

    /**
     * Show error status in status bar
     * @param {number} errorCount - Number of errors found
     */
    showErrorStatus(errorCount) {
        // Direct status bar update instead of callback
        // This requires access to statusBarItem and related functions
        // Will be handled by a simpler approach
    }

    /**
     * Clear error status from status bar
     */
    clearErrorStatus() {
        // Direct status bar update instead of callback
        // Will be handled by a simpler approach  
    }

    /**
     * Schedule automatic error status clearing
     * @param {vscode.TextEditor} editor - Current editor
     */
    scheduleErrorStatusClear(editor) {
        // Clear any existing timeout
        if (this.errorTimeout) {
            clearTimeout(this.errorTimeout);
        }
        
        this.errorTimeout = setTimeout(() => {
            try {
                // Re-check errors after timeout
                const currentDiagnostics = vscode.languages.getDiagnostics(editor.document.uri);
                const currentErrors = currentDiagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
                
                if (currentErrors.length === 0) {
                    this.clearErrorStatus();
                }
            } catch (error) {
                // Silent error - just clear status
                this.clearErrorStatus();
            } finally {
                this.errorTimeout = null;
            }
        }, 5000);
    }

    /**
     * Setup diagnostic change listener
     * @param {vscode.ExtensionContext} context - VS Code extension context
     * @returns {vscode.Disposable} Disposable listener
     */
    setupDiagnosticListener(context) {
        const diagnosticsListener = vscode.languages.onDidChangeDiagnostics(e => {
            // Performance: Only process for Arduino-related files
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                return;
            }
            
            if (!this.isArduinoFile(activeEditor.document.fileName)) {
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
            if (this.errorTimeout) {
                clearTimeout(this.errorTimeout);
            }
            
            this.errorTimeout = setTimeout(() => {
                try {
                    this.checkForErrors();
                } catch (error) {
                    // Silent error handling
                } finally {
                    this.errorTimeout = null;
                }
            }, 1000);
        });
        
        // Add to context subscriptions for proper cleanup
        if (context && context.subscriptions) {
            context.subscriptions.push(diagnosticsListener);
        }
        
        return diagnosticsListener;
    }

    /**
     * Set callback for status bar updates (REMOVED - not needed)
     */
    // setStatusCallback() method removed - simpler architecture

    /**
     * Cleanup all timers and listeners
     */
    dispose() {
        if (this.errorTimeout) {
            clearTimeout(this.errorTimeout);
            this.errorTimeout = null;
        }
        
        // Reset state
        this.lastDiagnosticsCount = 0;
        this.lastErrorCheck = 0;
        this.lastCheckedUri = null;
    }
}

module.exports = { ErrorChecker };
