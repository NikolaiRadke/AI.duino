/*
 * AI.duino - Shared Styles for Webview Panels
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

const vscode = require('vscode');

function getSharedCSS(cardStyle = 'arduino-green') {
    const themeKind = vscode.window.activeColorTheme.kind;
    const isDarkTheme = themeKind === vscode.ColorThemeKind.Dark || 
                        themeKind === vscode.ColorThemeKind.HighContrast;
    const prismTheme = isDarkTheme ? 'prism-tomorrow' : 'prism-coy';
    
    return `
    <!-- Prism.js Syntax Highlighting -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/${prismTheme}.min.css">
    
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 20px;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        
        /* Card style will be set via data-card-style="${cardStyle}" attribute */
        .logo {
            font-size: 72px;
            margin: 20px 0;
        }
        h1 { 
            color: var(--vscode-textLink-foreground); 
            margin: 0;
        }
        h3 { 
            color: var(--vscode-textLink-foreground); 
            margin-top: 0; 
        }
        .version {
            font-size: 24px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 30px;
        }
        .info-box {
            background: var(--vscode-editor-selectionBackground);
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .feature {
            margin: 10px 0;
            padding-left: 25px;
            position: relative;
        }
        .feature:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #4CAF50;
            font-weight: bold;
        }
        .credits {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .license {
            background: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            font-family: monospace;
            font-size: 14px;
        }
        .model-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            color: white;
        }
        .tutorial {
            background: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: left;
        }
        .shortcut {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 3px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        .tip {
            background: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .warning {
            background: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 10px;
            text-align: center;
        }
        code {
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 5px;
            border-radius: 3px;
        }
        pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
        }

        /* === SUPPORT ME DESIGN IN ABOUT === */
        .support-box {
            background: linear-gradient(135deg, var(--vscode-textBlockQuote-background), var(--vscode-editor-selectionBackground));
            border: 2px solid var(--vscode-textLink-foreground);
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            text-align: center;
        }
        .support-box h3 {
            margin-top: 0;
            font-size: 24px;
        }
        .button-container {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 20px;
        }
        .support-button {
            display: inline-block;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: bold;
            text-decoration: none;
            transition: transform 0.2s, opacity 0.2s;
        }
        .support-button:hover {
            transform: translateY(-2px);
            opacity: 0.9;
            text-decoration: none;
        }
        .support-button.kofi {
            background: #FF5E5B;
            color: white;
        }
        .support-button.github {
            background: #ea4aaa;
            color: white;
        }

        /* === UNIFIED BUTTON SYSTEM === */
        /* Base button - standard actions */
        button, .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        
        button:hover, .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        /* Large panel button - primary call-to-action */
        .panel-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            margin: 0 10px;
        }
        
        .panel-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        /* Secondary button - less prominent actions */
        .btn-secondary, .code-btn, .action-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-panel-border);
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            margin: 0;
        }
        
        .btn-secondary:hover, .code-btn:hover, .action-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        /* === UNIFIED INPUT SYSTEM === */
        .input-base, textarea, input[type="text"] {
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: 13px;
        }
        
        .input-base:focus, textarea:focus, input[type="text"]:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }
        
        .info-badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        
        .question-box {
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
        }
        
        .code-context {
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        /* === CODE BLOCK STYLING === */
        .code-block {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin: 15px 0;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .code-header {
            background: var(--vscode-panel-background);
            padding: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .code-content {
            padding: 15px;
            white-space: pre-wrap;
            overflow-x: auto;
            line-height: 1.4;
        }
        
        .code-actions {
            display: flex;
            gap: 8px;
        }
        
        .code-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .code-btn.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            font-weight: bold;
        }
        
        .code-btn.primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        /* === PRISM.JS INTEGRATION === */
        /* Override Prism defaults für alle Code-Bereiche */
        .code-content pre,
        .original-code pre,
        .code-context pre {
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
        }
        
        .code-content code,
        .original-code code,
        .code-context code {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }
        
        /* === PANEL SPECIFIC STYLING === */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .error-box {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .error-title {
            color: var(--vscode-inputValidation-errorForeground);
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .original-code {
            background: var(--vscode-editor-selectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .instructions-box {
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .info-section, .panel-section {
            margin: 20px 0;
            padding: 15px;
            border-radius: 8px;
        }
        
        .board-info {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
            margin-top: 20px;
            text-align: center;
            padding: 10px;
            background: var(--vscode-badge-background);
            border-radius: 4px;
        }
        
        .solution {
            background: var(--vscode-debugConsole-infoForeground);
            border-left: 4px solid var(--vscode-debugConsole-sourceForeground);
            padding: 15px;
            margin: 15px 0;
        }
        
        .explanation {
            line-height: 1.6;
        }

        .centered-panel {
            text-align: center;
        }

        .centered-panel .info-box,
        .centered-panel .tip {
            text-align: left;
        }

        /* === CONTEXT MENU === */
        .context-menu {
            position: fixed;
            background: var(--vscode-menu-background);
            border: 1px solid var(--vscode-menu-border);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            z-index: 10000;
            min-width: 180px;
            border-radius: 6px;
            overflow: hidden;
            display: none;
        }
        
        .context-menu-item {
            padding: 10px 16px;
            cursor: pointer;
            color: var(--vscode-menu-foreground);
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .context-menu-item:hover {
            background: var(--vscode-menu-selectionBackground);
            color: var(--vscode-menu-selectionForeground);
        }

        .context-menu-item.disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        
        .context-menu-item.disabled:hover {
            background: var(--vscode-menu-background);
            color: var(--vscode-menu-foreground);
        }
        
        /* === CARD SYSTEM (for chatPanel + customAgents) === */
        /* Arduino Green Card Style */
        .card.style-arduino-green {
            background: var(--vscode-editor-selectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .card.style-arduino-green:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
            transform: translateX(5px);
        }
        
        /* White with Green Border Card Style */
        .card.style-white-border {
            background: var(--vscode-editor-background);
            border: 2px solid #00979D;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .card.style-white-border:hover {
            background: var(--vscode-editor-background);
            border-color: #00C8D0;
            box-shadow: 0 2px 8px rgba(0, 151, 157, 0.3);
            transform: translateX(5px);
        }
        
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .card-title {
            font-size: 16px;
            font-weight: bold;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .card-delete {
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 16px;
            opacity: 0.6;
            transition: opacity 0.2s;
            padding: 5px;
        }
        
        .card-delete:hover {
            opacity: 1;
        }
        
        .card-info {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }

        /* === MESSAGE STYLES (for chat responses) === */
        /* Arduino Green Message Style */
        .ai-message.style-arduino-green {
            background: var(--vscode-editor-selectionBackground);
            margin-right: auto;
            border-left: 3px solid #4CAF50;
        }
        
        /* White with Green Border Message Style */
        .ai-message.style-white-border {
            background: var(--vscode-editor-background);
            margin-right: auto;
            border-left: 3px solid #00979D;
        }

        /* === RESPONSE BLOCK STYLES (for feature AI outputs) === */
        /* Arduino Green Style - for AI response containers */
        .info-section.style-arduino-green,
        .panel-section.style-arduino-green {
            background: var(--vscode-editor-selectionBackground);
            border-left: 3px solid #4CAF50;
        }
        
        .question-box.style-arduino-green,
        .instructions-box.style-arduino-green {
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid #4CAF50;
        }
        
        .code-context.style-arduino-green {
            background: var(--vscode-editor-selectionBackground);
            border: 1px solid var(--vscode-panel-border);
        }
        
        /* White with Green Border Style - for AI response containers */
        .info-section.style-white-border,
        .panel-section.style-white-border {
            background: var(--vscode-editor-background);
            border-left: 3px solid #00979D;
        }
        
        .question-box.style-white-border,
        .instructions-box.style-white-border {
            background: var(--vscode-editor-background);
            border-left: 4px solid #00979D;
        }
        
        .code-context.style-white-border {
            background: var(--vscode-editor-background);
            border: 2px solid #00979D;
        }
        
        /* === OVERVIEW LAYOUT (for chatPanel + customAgents) === */
        .overview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }
        
        .overview-title {
            font-size: 24px;
            font-weight: bold;
        }
        
        .item-counter {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
            margin-left: 10px;
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--vscode-descriptionForeground);
        }
        
        .empty-state h2 {
            font-size: 32px;
            margin-bottom: 10px;
        }
        
        /* === BUTTON STATE EXTENSIONS === */
        button.disabled, .btn.disabled, .panel-btn.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        button:disabled, .btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }

        /* === CONTEXT BADGE (for all features) === */
        .context-badge {
            display: inline-block;
            padding: 4px 12px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 12px;
            font-size: 0.9em;
            margin: 8px 0;
         }
        
        /* === FORM SYSTEM (for customAgents) === */
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        
        .form-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
                
        /* === RESPONSIVE DESIGN === */
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .header {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
            }
            
            .code-actions {
                flex-wrap: wrap;
                gap: 5px;
            }
            
            .code-btn {
                font-size: 11px;
                padding: 4px 8px;
            }
            
            .panel-btn {
                margin: 5px;
                padding: 10px 16px;
                font-size: 14px;
            }
            
            .card {
                transform: none;
            }
            
            .card:hover {
                transform: translateX(2px);
            }
        }
        /* Disable empty context menu in Arduino IDE */
        * {
            -webkit-context-menu: none;
        }
    </style> 
    <script>
        // Inject card style setting from VS Code
        window.AIDUINO_CARD_STYLE = '${cardStyle}';
    </script>
    <script>
        // Block native context menu in panels without custom menu
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Auto-apply card style to AI response blocks
        window.addEventListener('DOMContentLoaded', () => {
            // Get card style from VS Code settings (injected via data attribute)
            const cardStyle = window.AIDUINO_CARD_STYLE || 'arduino-green';
            const styleClass = 'style-' + cardStyle;
            
            // Apply style to all AI response containers
            const selectors = [
                '.info-section',
                '.panel-section',
                '.question-box',
                '.instructions-box',
                '.code-context'
            ];
            
            selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(element => {
                    element.classList.add(styleClass);
                });
            });
        });
    </script>
    `;
}
/**
 * Get Prism.js scripts for syntax highlighting
 * Must be placed before closing </body> tag
 * @returns {string} Prism.js script tags
 */
function getPrismScripts() {
    return `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-c.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-cpp.min.js"></script>`;
}

/**
 * Get Prism.js CSS with automatic theme detection
 * @returns {string} Prism CSS link tag with appropriate theme
 */

module.exports = { 
    getSharedCSS, 
    getPrismScripts
 };
