/*
 * AI.duino - Completion Cache Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

/**
 * Simple in-memory cache for code completions
 * Reduces API calls for frequently used patterns
 */
class CompletionCache {
    constructor() {
        this.cache = new Map();
        this.maxSize = 100;
        this.maxAge = 3600000; // 1 hour in milliseconds
        
        // Start cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // 5 minutes
    }

    /**
     * Get cached completion
     * @param {string} key - Cache key
     * @returns {string|null} Cached completion or null
     */
    get(key) {
        if (!key) return null;

        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if expired
        if (Date.now() - entry.timestamp > this.maxAge) {
            this.cache.delete(key);
            return null;
        }

        // Update access time
        entry.lastAccess = Date.now();
        entry.hitCount++;

        return entry.completion;
    }

    /**
     * Store completion in cache
     * @param {string} key - Cache key
     * @param {string} completion - Completion text
     */
    set(key, completion) {
        if (!key || !completion) return;

        // Enforce max size - remove least recently used
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        this.cache.set(key, {
            completion,
            timestamp: Date.now(),
            lastAccess: Date.now(),
            hitCount: 0
        });
    }

    /**
     * Evict least recently used entry
     */
    evictLRU() {
        let oldestKey = null;
        let oldestAccess = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccess < oldestAccess) {
                oldestAccess = entry.lastAccess;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const toDelete = [];

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.maxAge) {
                toDelete.push(key);
            }
        }

        for (const key of toDelete) {
            this.cache.delete(key);
        }
    }

    /**
     * Clear entire cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        let totalHits = 0;
        for (const entry of this.cache.values()) {
            totalHits += entry.hitCount;
        }

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            totalHits
        };
    }

    /**
     * Dispose of cache resources
     */
    dispose() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}

// Global cache instance
let cacheInstance = null;

/**
 * Get or create cache instance
 */
function getCache() {
    if (!cacheInstance) {
        cacheInstance = new CompletionCache();
    }
    return cacheInstance;
}

/**
 * Get cached completion
 * @param {string} key - Cache key
 * @returns {string|null}
 */
function getCachedCompletion(key) {
    return getCache().get(key);
}

/**
 * Cache a completion
 * @param {string} key - Cache key
 * @param {string} completion - Completion text
 */
function cacheCompletion(key, completion) {
    getCache().set(key, completion);
}

/**
 * Clear completion cache
 */
function clearCompletionCache() {
    getCache().clear();
}

/**
 * Get cache statistics
 */
function getCacheStats() {
    return getCache().getStats();
}

/**
 * Dispose of cache
 */
function disposeCache() {
    if (cacheInstance) {
        cacheInstance.dispose();
        cacheInstance = null;
    }
}

module.exports = {
    CompletionCache,
    getCachedCompletion,
    cacheCompletion,
    clearCompletionCache,
    getCacheStats,
    disposeCache
};
