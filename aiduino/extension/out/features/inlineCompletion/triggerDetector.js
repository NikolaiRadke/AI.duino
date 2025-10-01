/*
 * AI.duino - Trigger Detector Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');

/**
 * Determine if inline completion should be triggered
 * @param {vscode.TextDocument} document 
 * @param {vscode.Position} position 
 * @param {Object} context - Extension context
 * @returns {Object} { shouldTrigger: boolean, triggerType: string, cacheKey: string }
 */
function shouldTriggerCompletion(document, position, context) {
    const line = document.lineAt(position.line);
    const textBeforeCursor = line.text.substring(0, position.character);
    const textAfterCursor = line.text.substring(position.character);

    // Don't trigger if user is still typing on the same line
    if (textAfterCursor.trim().length > 0) {
        return { shouldTrigger: false };
    }

    // Don't trigger inside strings or comments (except for special comment triggers)
    if (isInsideString(textBeforeCursor) || (isInsideComment(textBeforeCursor) && !textBeforeCursor.trim().startsWith('//'))) {
        return { shouldTrigger: false };
    }

    return detectSmartTrigger(document, position, textBeforeCursor);
}

/**
 * Detect smart trigger points
 */
function detectSmartTrigger(document, position, textBeforeCursor) {
    const trimmed = textBeforeCursor.trim();

   // 1. After comment ending with : (generate code from comment)
    if (trimmed.startsWith('//')) {
        // Only trigger if comment ends with colon
        if (trimmed.endsWith(':') && trimmed.length > 4) {
            return {
                shouldTrigger: true,
                triggerType: 'comment',
                cacheKey: `comment:${trimmed}`
            };
        }
        // Don't trigger for normal comments
        return { shouldTrigger: false };
    }
    
    // 2. After function keywords
    const functionKeywords = ['void', 'int', 'bool', 'float', 'char', 'String', 'byte'];
    for (const keyword of functionKeywords) {
        if (trimmed.endsWith(keyword + ' ') || trimmed === keyword) {
            return {
                shouldTrigger: true,
                triggerType: 'function_declaration',
                cacheKey: `func:${keyword}`
            };
        }
    }

    // 3. After Arduino function names
    const arduinoFunctions = ['setup()', 'loop()'];
    for (const func of arduinoFunctions) {
        if (trimmed.includes(func) && trimmed.endsWith('{')) {
            return {
                shouldTrigger: true,
                triggerType: 'arduino_function',
                cacheKey: `arduino:${func}`
            };
        }
    }

    // 4. After dot (method completion)
    if (trimmed.endsWith('.')) {
        const objectMatch = trimmed.match(/(\w+)\.$/);
        if (objectMatch) {
            return {
                shouldTrigger: true,
                triggerType: 'method',
                cacheKey: `method:${objectMatch[1]}`
            };
        }
    }

    // 5. Empty line inside function body
    if (trimmed === '' && isInsideFunctionBody(document, position)) {
        return {
            shouldTrigger: true,
            triggerType: 'empty_line_in_function',
            cacheKey: null // Context-dependent, no caching
        };
    }

    return { shouldTrigger: false };
}

/**
 * Check if cursor is inside a string literal
 */
function isInsideString(text) {
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < text.length; i++) {
        if (escapeNext) {
            escapeNext = false;
            continue;
        }
        
        if (text[i] === '\\') {
            escapeNext = true;
            continue;
        }
        
        if (text[i] === '"' || text[i] === "'") {
            inString = !inString;
        }
    }
    
    return inString;
}

/**
 * Check if cursor is inside a comment
 */
function isInsideComment(text) {
    // Check for // style comments
    if (text.includes('//')) {
        return true;
    }
    
    // Check for /* style comments (simplified)
    const openCount = (text.match(/\/\*/g) || []).length;
    const closeCount = (text.match(/\*\//g) || []).length;
    
    return openCount > closeCount;
}

/**
 * Check if position is inside a function body
 */
function isInsideFunctionBody(document, position) {
    let braceDepth = 0;
    let inFunction = false;

    // Scan backwards to find function context
    for (let i = position.line; i >= 0; i--) {
        const line = document.lineAt(i).text;
        
        // Count braces
        for (const char of line) {
            if (char === '{') braceDepth++;
            if (char === '}') braceDepth--;
        }

        // Check for function declaration
        if (line.match(/^(void|int|bool|float|char|String|byte)\s+\w+\s*\(/)) {
            inFunction = true;
            break;
        }

        // If we've gone back past the start of a scope, stop
        if (braceDepth < 0) {
            break;
        }
    }

    return inFunction && braceDepth > 0;
}

/**
 * Extract context around cursor position
 */
function extractContext(document, position, triggerResult, context) {
    const currentLine = document.lineAt(position.line).text;
    const previousLines = [];
    
    // Get previous 10 lines for context
    const startLine = Math.max(0, position.line - 10);
    for (let i = startLine; i < position.line; i++) {
        previousLines.push(document.lineAt(i).text);
    }

    // Get board info if available
    let boardInfo = null;
    if (context.arduinoBoardContext) {
        boardInfo = context.arduinoBoardContext.getCurrentBoard();
    }

    // Extract included libraries
    const fullText = document.getText();
    const libraries = [];
    const includeMatches = fullText.matchAll(/#include\s*[<"]([^>"]+)[>"]/g);
    for (const match of includeMatches) {
        libraries.push(match[1]);
    }

    return {
        currentLine: currentLine.trim(),
        previousLines,
        triggerType: triggerResult.triggerType,
        boardInfo,
        libraries,
        cursorPosition: position
    };
}

module.exports = {
    shouldTriggerCompletion,
    extractContext
};
