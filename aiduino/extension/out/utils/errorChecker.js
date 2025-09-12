/*
 * AI.duino - Error Checker Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require("vscode");
const validation = require('./validation');

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
        if (!validation.validateArduinoFile(editor.document.fileName)) {
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
            
            if (!validation.validateArduinoFile(editor.document.fileName)) {
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
