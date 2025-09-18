/*
 * AI.duino - Locale Utilities Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { getLanguageInfo } = require('../config/languageMetadata');

/**
 * Locale Utilities - Runtime locale detection and management
 * 
 * Handles dynamic locale discovery and current language information
 * Cache removed for better reliability and simpler maintenance
 */
class LocaleUtils {
    constructor() {
        // No cache needed - locale operations are infrequent
    }

    /**
     * Get all available locales from the locales directory
     * @returns {Array<string>} Array of available locale codes
     */
    getAvailableLocales() {
        const localesDir = path.join(__dirname, '..', '..', 'locales');
        
        if (!fs.existsSync(localesDir)) {
            // Return minimum supported locales if directory doesn't exist
            return ['en', 'de'];
        }
        
        const files = fs.readdirSync(localesDir);
        const availableLocales = [];
        
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const locale = file.replace('.json', '');
                availableLocales.push(locale);
            }
        });
        
        // Return minimum if no files found
        if (availableLocales.length === 0) {
            return ['en', 'de'];
        }
        
        // Ensure 'en' is first, then sort the rest
        const result = ['en', ...availableLocales.filter(l => l !== 'en').sort()];
        return result;
    }

    /**
     * Get current language display name
     * @param {string} currentLocale - Current locale code
     * @param {string} userLanguageChoice - User's language setting ('auto' or specific locale)
     * @param {Function} t - Translation function
     * @returns {string} Display name for current language
     */
    getCurrentLanguageName(currentLocale, userLanguageChoice, t) {
        const info = getLanguageInfo(currentLocale);
        
        if (userLanguageChoice === 'auto') {
            return `Auto (${info.name})`;
        }
        
        return info.name;
    }

    /**
     * Build language selection items for QuickPick
     * @param {string} currentLocale - Current active locale
     * @param {string} userLanguageChoice - User's setting ('auto' or specific locale)
     * @param {Function} t - Translation function
     * @returns {Array} QuickPick items for language selection
     */
    buildLanguagePickItems(currentLocale, userLanguageChoice, t) {
        const supportedLocales = this.getAvailableLocales();
        const availableLanguages = [];

        // Add auto-detect option
        availableLanguages.push({ 
            label: `🌐 ${t('language.autoDetect')}`, 
            // description: t('language.autoDetect'), 
            value: 'auto' 
        });
        
        // Add all supported locales
        supportedLocales.forEach(locale => {
            const info = getLanguageInfo(locale);
            availableLanguages.push({
                label: `${info.flag} ${info.name}`,
                description: info.region,
                value: locale
            });
        });
        
        // Mark active selection
        const activeValue = userLanguageChoice === 'auto' ? 'auto' : currentLocale;
        
        availableLanguages.forEach(lang => {
            if (lang.value === activeValue) {
                if (activeValue === 'auto') {
                    const info = getLanguageInfo(currentLocale);
                    lang.description = `✓ ${info.region}`;
                } else {
                    lang.description = `✓ `;
                }
            }
        });
        
        return availableLanguages;
    }

    /**
     * Auto-detect locale from VS Code settings
     * @param {string} vscodeLocale - VS Code's locale setting
     * @returns {string} Detected locale code
     */
    autoDetectLocale(vscodeLocale) {
        const detectedLang = (vscodeLocale || 'en').substring(0, 2);
        const supportedLocales = this.getAvailableLocales();
        
        return supportedLocales.includes(detectedLang) ? detectedLang : 'en';
    }

    /**
     * Get locale statistics (for debugging)
     * @param {Function} t - Translation function (optional)
     * @returns {Object} Locale information
     */
    getLocaleStats(t) {
        const available = this.getAvailableLocales();
        return {
            totalLocales: available.length,
            availableLocales: available,
            cacheStatus: 'disabled (no cache)'
        };
    }
}

module.exports = { LocaleUtils };
