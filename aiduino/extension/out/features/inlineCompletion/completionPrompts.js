/*
 * AI.duino - Completion Prompts Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

/**
 * Build specialized prompt based on trigger type and context
 * @param {Object} contextData - Context information from triggerDetector
 * @returns {string} Formatted prompt for Groq API
 */
function buildCompletionPrompt(contextData, settings = null) {
    const { triggerType, currentLine, previousLines, boardInfo, libraries } = contextData;

    // Base system context
    let prompt = "You are an Arduino code completion assistant. Provide ONLY the code completion, no explanations.\n\n";

    // Add board context if available
    if (boardInfo) {
        prompt += `Target board: ${boardInfo}\n`;
    }

    // Add library context
    if (libraries && libraries.length > 0) {
        prompt += `Included libraries: ${libraries.join(', ')}\n`;
    }

    prompt += "\n";

    // Add previous code context
    if (previousLines && previousLines.length > 0) {
        prompt += "Previous code:\n```cpp\n";
        prompt += previousLines.join('\n');
        prompt += "\n```\n\n";
    }

    // Add trigger-specific instructions
    switch (triggerType) {
        case 'comment':
            return buildCommentTriggerPrompt(prompt, currentLine);
        
        case 'function_declaration':
            return buildFunctionDeclarationPrompt(prompt, currentLine);
        
        case 'arduino_function':
            return buildArduinoFunctionPrompt(prompt, currentLine);
        
        case 'method':
            return buildMethodCompletionPrompt(prompt, currentLine);
        
        case 'empty_line_in_function':
            return buildEmptyLinePrompt(prompt, currentLine, previousLines);
        
        default:
            return buildGenericPrompt(prompt, currentLine);
    }
}

/**
 * Prompt for comment-to-code conversion
 */
function buildCommentTriggerPrompt(basePrompt, currentLine, settings = null) {
    const comment = currentLine.replace(/^\/\/\s*/, '');
    const maxLines = settings?.get('inlineCompletionMaxLinesSimple') ?? 3;
    
    return basePrompt + 
        `Generate Arduino code for the following task:\n` +
        `"${comment}"\n\n` +
        `Provide ONLY the code (max ${maxLines} lines), no comments or explanations.`;
}

/**
 * Prompt for function declaration completion
 */
function buildFunctionDeclarationPrompt(basePrompt, currentLine) {
    return basePrompt +
        `Complete this function declaration:\n` +
        `${currentLine}\n\n` +
        `Provide ONLY the function name and parameters, nothing else. Example: "readSensor(int pin)"`;
}

/**
 * Prompt for Arduino function body
 */
function buildArduinoFunctionPrompt(basePrompt, currentLine) {
    const isSetup = currentLine.includes('setup()');
    const isLoop = currentLine.includes('loop()');

    if (isSetup) {
        return basePrompt +
            `Complete the setup() function body with typical Arduino initialization code.\n` +
            `Provide ONLY the next 1-2 lines of code, no closing brace.`;
    }

    if (isLoop) {
        return basePrompt +
            `Complete the loop() function body with typical Arduino loop code.\n` +
            `Provide ONLY the next 1-2 lines of code, no closing brace.`;
    }

    return buildGenericPrompt(basePrompt, currentLine);
}

/**
 * Prompt for method completion after dot
 */
function buildMethodCompletionPrompt(basePrompt, currentLine) {
    const objectMatch = currentLine.match(/(\w+)\.$/);
    const objectName = objectMatch ? objectMatch[1] : 'object';

    return basePrompt +
        `Complete this method call:\n` +
        `${currentLine}\n\n` +
        `Provide ONLY the method name and parameters for common Arduino ${objectName} methods. Example: "begin(9600)"`;
}

/**
 * Prompt for empty line inside function
 */
function buildEmptyLinePrompt(basePrompt, currentLine, previousLines) {
    // Analyze previous lines to understand context
    const lastFewLines = previousLines.slice(-5).join('\n');

    return basePrompt +
        `Based on the previous code:\n` +
        `\`\`\`cpp\n${lastFewLines}\n\`\`\`\n\n` +
        `Suggest the next logical line of Arduino code. Provide ONLY one line, no explanations.`;
}

/**
 * Generic fallback prompt
 */
function buildGenericPrompt(basePrompt, currentLine) {
    return basePrompt +
        `Complete this Arduino code:\n` +
        `${currentLine}\n\n` +
        `Provide ONLY the completion, no explanations or additional text.`;
}

/**
 * Build system prompt for Groq API
 * Used to set context for all completion requests
 */
function getSystemPrompt() {
    return `You are an expert Arduino code completion assistant. Your role is to:
- Provide concise, accurate code completions
- Follow Arduino coding conventions
- Consider hardware limitations (memory, pins, timing)
- Suggest efficient and safe code patterns
- Return ONLY the completion code, never explanations

Rules:
- Never use delay() in production code without mentioning alternatives
- Prefer non-blocking approaches
- Consider const and PROGMEM for memory optimization
- Use appropriate data types (byte, uint8_t, etc.)
- Follow Arduino naming conventions (camelCase for functions)`;
}

module.exports = {
    buildCompletionPrompt,
    getSystemPrompt
};
