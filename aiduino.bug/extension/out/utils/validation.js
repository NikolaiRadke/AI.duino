/*
 * AI.duino - Validation Utilities Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

/**
 * Validates API key format and requirements
 * @param {string} value - The API key to validate
 * @param {string} keyPrefix - Required prefix (e.g., 'sk-ant-', 'sk-', 'AIza')
 * @param {number} minLength - Minimum key length (default: 15)
 * @param {function} t - Translation function
 * @returns {string|null} Error message or null if valid
 */
function validateApiKey(value, keyPrefix, minLength = 15, t) {
    if (!value) {
        return t('validation.apiKeyRequired');
    }
    
    if (!value.startsWith(keyPrefix)) {
        return t('validation.apiKeyPrefix', keyPrefix);
    }
    
    if (value.length < minLength) {
        return t('validation.apiKeyTooShort');
    }
    
    return null; // Valid
}

/**
 * Validates if model ID exists in available providers
 * @param {string} modelId - Model ID to validate
 * @param {object} providers - Available providers object
 * @returns {boolean} True if valid
 */
function validateModelId(modelId, providers) {
    return modelId && providers && providers.hasOwnProperty(modelId);
}

/**
 * Validates locale code
 * @param {string} locale - Locale to validate (e.g., 'en', 'de')
 * @param {Array} availableLocales - Array of available locale codes
 * @returns {boolean} True if valid
 */
function validateLocale(locale, availableLocales) {
    return locale && Array.isArray(availableLocales) && availableLocales.includes(locale);
}

/**
 * Validates if text input is not empty
 * @param {string} text - Text to validate
 * @param {string} fieldName - Field name for error message
 * @param {function} t - Translation function
 * @returns {string|null} Error message or null if valid
 */
function validateTextInput(text, fieldName, t) {
    if (!text || text.trim().length === 0) {
        return t('validation.fieldRequired', fieldName);
    }
    return null;
}

/**
 * Validates file extension for Arduino files
 * @param {string} fileName - File name to check
 * @returns {boolean} True if valid Arduino file
 */
function validateArduinoFile(fileName) {
    if (!fileName) return false;
    
    const validExtensions = ['.ino', '.cpp', '.h', '.c'];
    return validExtensions.some(ext => fileName.endsWith(ext));
}

/**
 * Validates number range
 * @param {number} value - Number to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} True if in range
 */
function validateNumberRange(value, min, max) {
    return typeof value === 'number' && value >= min && value <= max;
}

/**
 * Validates temperature setting for AI models
 * @param {number} temperature - Temperature value (0-1)
 * @returns {boolean} True if valid
 */
function validateTemperature(temperature) {
    return validateNumberRange(temperature, 0, 1);
}

/**
 * Validates max tokens setting
 * @param {number} maxTokens - Maximum tokens value
 * @returns {boolean} True if valid
 */
function validateMaxTokens(maxTokens) {
    return validateNumberRange(maxTokens, 100, 8000);
}

/**
 * Sanitizes user input to prevent injection
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }
    
    // Remove potentially harmful characters for file paths and commands
    return input
        .replace(/[<>:"|?*]/g, '') // Windows forbidden chars
        .replace(/\.\./g, '')      // Path traversal
        .replace(/[\x00-\x1f]/g, '') // Control characters
        .trim();
}

module.exports = {
    validateApiKey,
    validateModelId,
    validateLocale,
    validateTextInput,
    validateArduinoFile,
    validateNumberRange,
    validateTemperature,
    validateMaxTokens,
    sanitizeInput
};
