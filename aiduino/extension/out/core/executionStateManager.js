/*
 * AI.duino - Execution State Manager Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

/**
 * Manages execution states to prevent duplicate operations
 * Prevents multiple concurrent API calls of the same type
 */
class ExecutionStateManager {
    constructor() {
        this.states = new Map();
        this.OPERATIONS = {
            EXPLAIN: 'explain',
            IMPROVE: 'improve',
            COMMENTS: 'comments',
            DEBUG: 'debug',
            ASK: 'ask',
            ERROR: 'error',
            SET_API_KEY: 'setApiKey',
            SWITCH_MODEL: 'switchModel',
            SWITCH_LANGUAGE: 'switchLanguage'
        };
    }
    
    /**
     * Check if operation is currently running
     * @param {string} operation - Operation to check
     * @returns {boolean} True if operation is running
     */
    isRunning(operation) {
        return this.states.has(operation) && this.states.get(operation) === true;
    }
    
    /**
     * Start an operation if not already running
     * @param {string} operation - Operation to start
     * @returns {boolean} True if operation was started, false if already running
     */
    start(operation) {
        if (this.isRunning(operation)) {
            return false; // Already running
        }
        this.states.set(operation, true);
        return true;
    }
    
    /**
     * Stop/complete an operation
     * @param {string} operation - Operation to stop
     */
    stop(operation) {
        this.states.delete(operation);
    }
    
    /**
     * Clear all running operations (for cleanup)
     */
    clearAll() {
        this.states.clear();
    }
    
    /**
     * Get list of currently running operations
     * @returns {Array} Array of running operation names
     */
    getRunningOperations() {
        return Array.from(this.states.keys()).filter(op => this.states.get(op) === true);
    }
    
    /**
     * Get count of running operations
     * @returns {number} Number of running operations
     */
    getRunningCount() {
        return this.getRunningOperations().length;
    }
    
    /**
     * Debug helper: Show current state
     * @returns {object} Current states object
     */
    debugShowStates() {
        const runningOps = this.getRunningOperations();
        return {
            running: runningOps,
            count: runningOps.length,
            allStates: Object.fromEntries(this.states)
        };
    }
}

module.exports = { ExecutionStateManager };
