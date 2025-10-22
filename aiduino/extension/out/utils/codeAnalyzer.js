/*
 * AI.duino - Code Analyzer Utility
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

/**
 * Extract comprehensive pin configuration from code
 * Analyzes pinMode, digitalWrite, digitalRead, analogWrite, analogRead, interrupts
 * @param {string} code - Source code
 * @returns {Array} Pin configurations with usage details
 */
function extractPinConfiguration(code) {
    const pins = new Map();
    
    // pinMode declarations
    const pinModeRegex = /pinMode\s*\(\s*(\w+|\d+)\s*,\s*(INPUT|OUTPUT|INPUT_PULLUP)\s*\)/g;
    let match;
    while ((match = pinModeRegex.exec(code)) !== null) {
        const pin = match[1];
        const mode = match[2];
        if (!pins.has(pin)) {
            pins.set(pin, { modes: [], operations: [] });
        }
        pins.get(pin).modes.push(mode);
    }
    
    // digitalWrite operations
    const digitalWriteRegex = /digitalWrite\s*\(\s*(\w+|\d+)\s*,\s*(HIGH|LOW|[01])\s*\)/g;
    while ((match = digitalWriteRegex.exec(code)) !== null) {
        const pin = match[1];
        const value = match[2];
        if (!pins.has(pin)) {
            pins.set(pin, { modes: ['OUTPUT (inferred)'], operations: [] });
        }
        pins.get(pin).operations.push(`writes ${value}`);
    }
    
    // digitalRead operations
    const digitalReadRegex = /digitalRead\s*\(\s*(\w+|\d+)\s*\)/g;
    while ((match = digitalReadRegex.exec(code)) !== null) {
        const pin = match[1];
        if (!pins.has(pin)) {
            pins.set(pin, { modes: ['INPUT (inferred)'], operations: [] });
        }
        pins.get(pin).operations.push('reads digital');
    }
    
    // analogWrite (PWM)
    const analogWriteRegex = /analogWrite\s*\(\s*(\w+|\d+)\s*,\s*(\d+|\w+)\s*\)/g;
    while ((match = analogWriteRegex.exec(code)) !== null) {
        const pin = match[1];
        const value = match[2];
        if (!pins.has(pin)) {
            pins.set(pin, { modes: ['PWM'], operations: [] });
        }
        pins.get(pin).operations.push(`PWM (value: ${value})`);
    }
    
    // analogRead
    const analogReadRegex = /analogRead\s*\(\s*(\w+|\d+)\s*\)/g;
    while ((match = analogReadRegex.exec(code)) !== null) {
        const pin = match[1];
        if (!pins.has(pin)) {
            pins.set(pin, { modes: ['ANALOG_INPUT'], operations: [] });
        }
        pins.get(pin).operations.push('reads analog (0-1023)');
    }
    
    // Interrupts
    const interruptRegex = /attachInterrupt\s*\(\s*digitalPinToInterrupt\s*\(\s*(\w+|\d+)\s*\)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)/g;
    while ((match = interruptRegex.exec(code)) !== null) {
        const pin = match[1];
        const isr = match[2];
        const mode = match[3];
        if (!pins.has(pin)) {
            pins.set(pin, { modes: ['INTERRUPT'], operations: [] });
        }
        pins.get(pin).operations.push(`interrupt ${mode} → ${isr}()`);
    }
    
    // Servo
    const servoAttachRegex = /(\w+)\.attach\s*\(\s*(\w+|\d+)\s*\)/g;
    while ((match = servoAttachRegex.exec(code)) !== null) {
        const servoName = match[1];
        const pin = match[2];
        // Only if it looks like a servo object
        if (code.includes('Servo') && code.includes(servoName)) {
            if (!pins.has(pin)) {
                pins.set(pin, { modes: ['SERVO'], operations: [] });
            }
            pins.get(pin).operations.push(`servo (${servoName})`);
        }
    }
    
    // Format output
    const result = [];
    for (const [pin, data] of pins.entries()) {
        const modes = [...new Set(data.modes)].join(', ');
        const ops = [...new Set(data.operations)].join(', ');
        result.push(`Pin ${pin}: ${modes}${ops ? ` → ${ops}` : ''}`);
    }
    
    return result;
}

/**
 * Extract library includes from code
 * @param {string} code - Source code
 * @returns {Array} Library names
 */
function extractLibraries(code) {
    const includeRegex = /#include\s+[<"]([^>"]+)[>"]/g;
    const libraries = [];
    let match;

    while ((match = includeRegex.exec(code)) !== null) {
        libraries.push(match[1]);
    }

    return libraries;
}

/**
 * Extract function signatures from code
 * @param {string} code - Source code
 * @returns {Array} Function signatures
 */
function extractFunctionSignatures(code) {
    const functionRegex = /^\s*(?:void|int|float|double|bool|String|char|long|byte|unsigned\s+\w+)\s+(\w+)\s*\([^)]*\)/gm;
    const functions = [];
    let match;

    while ((match = functionRegex.exec(code)) !== null) {
        functions.push(match[0].trim());
    }

    return functions;
}

/**
 * Extract constants and defines
 * @param {string} code - Source code
 * @returns {Array} Constants with values
 */
function extractConstants(code) {
    const constants = [];
    
    // #define macros
    const defineRegex = /#define\s+(\w+)\s+(.+?)(?:\r?\n|$)/g;
    let match;
    while ((match = defineRegex.exec(code)) !== null) {
        constants.push(`#define ${match[1]} ${match[2].trim()}`);
    }
    
    // const declarations
    const constRegex = /const\s+(\w+)\s+(\w+)\s*=\s*([^;]+);/g;
    while ((match = constRegex.exec(code)) !== null) {
        constants.push(`const ${match[1]} ${match[2]} = ${match[3].trim()}`);
    }
    
    // constexpr (C++11+)
    const constexprRegex = /constexpr\s+(\w+)\s+(\w+)\s*=\s*([^;]+);/g;
    while ((match = constexprRegex.exec(code)) !== null) {
        constants.push(`constexpr ${match[1]} ${match[2]} = ${match[3].trim()}`);
    }
    
    return constants;
}

/**
 * Extract global variables
 * @param {string} code - Source code
 * @returns {Array} Global variable declarations
 */
function extractGlobalVariables(code) {
    const globals = [];
    
    // Remove function bodies to avoid local variables
    let cleanCode = code.replace(/\{[^{}]*\}/g, '');
    
    // Match global variable declarations (outside functions)
    const globalRegex = /^(?!#|\/\/)(\w+(?:\s+\w+)?)\s+(\w+)(?:\s*=\s*[^;]+)?;/gm;
    let match;
    
    while ((match = globalRegex.exec(cleanCode)) !== null) {
        const type = match[1].trim();
        const name = match[2].trim();
        
        // Filter out function declarations and common non-variables
        if (!type.includes('(') && !['if', 'for', 'while', 'return', 'case'].includes(type)) {
            globals.push(`${type} ${name}`);
        }
    }
    
    return globals;
}

/**
 * Extract comments only
 * @param {string} code - Source code
 * @returns {Array} Comments (line and block)
 */
function extractComments(code) {
    const comments = [];
    
    // Single-line comments
    const lineCommentRegex = /\/\/(.+?)(?:\r?\n|$)/g;
    let match;
    while ((match = lineCommentRegex.exec(code)) !== null) {
        const comment = match[1].trim();
        if (comment) {
            comments.push(`// ${comment}`);
        }
    }
    
    // Multi-line comments
    const blockCommentRegex = /\/\*[\s\S]*?\*\//g;
    while ((match = blockCommentRegex.exec(code)) !== null) {
        comments.push(match[0].trim());
    }
    
    return comments;
}

/**
 * Extract data structures (struct, class, enum)
 * @param {string} code - Source code
 * @returns {Array} Data structure definitions
 */
function extractDataStructures(code) {
    const structures = [];
    
    // struct definitions
    const structRegex = /struct\s+(\w+)\s*\{[^}]*\}/g;
    let match;
    while ((match = structRegex.exec(code)) !== null) {
        structures.push(match[0].trim());
    }
    
    // class definitions (simple - just signature)
    const classRegex = /class\s+(\w+)(?:\s*:\s*public\s+\w+)?\s*\{/g;
    while ((match = classRegex.exec(code)) !== null) {
        structures.push(`class ${match[1]} { ... }`);
    }
    
    // enum definitions
    const enumRegex = /enum\s+(?:class\s+)?(\w+)\s*\{[^}]*\}/g;
    while ((match = enumRegex.exec(code)) !== null) {
        structures.push(match[0].trim());
    }
    
    return structures;
}

/**
 * Get project file structure
 * @param {Array} files - Array of file paths
 * @returns {string} Formatted file tree
 */
function formatFileStructure(files) {
    if (!files || files.length === 0) return '';
    
    const tree = [];
    files.forEach(file => {
        const parts = file.split('/');
        const indent = '  '.repeat(parts.length - 1);
        tree.push(`${indent}${parts[parts.length - 1]}`);
    });
    
    return tree.join('\n');
}

/**
 * Comprehensive code analysis
 * Returns all available information about the code
 * @param {string} code - Source code
 * @returns {Object} Analysis results
 */
function analyzeCode(code) {
    return {
        pins: extractPinConfiguration(code),
        libraries: extractLibraries(code),
        functions: extractFunctionSignatures(code),
        constants: extractConstants(code),
        globals: extractGlobalVariables(code),
        comments: extractComments(code),
        structures: extractDataStructures(code)
    };
}

module.exports = {
    extractPinConfiguration,
    extractLibraries,
    extractFunctionSignatures,
    extractConstants,
    extractGlobalVariables,
    extractComments,
    extractDataStructures,
    formatFileStructure,
    analyzeCode
};
