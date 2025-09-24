/*
 * AI.duino - Shared Styles for Webview Panels
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

/**
 * Shared CSS styles for all AI.duino webview panels
 * Provides consistent styling across About, Token Stats, Offline Help, etc.
 * @returns {string} Complete CSS style block
 */
function getSharedCSS() {
    return `
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 20px;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        .logo {
            font-size: 72px;
            margin: 20px 0;
        }
        h1 { color: #2196F3; }
        .version {
            font-size: 24px;
            color: #666;
            margin-bottom: 30px;
        }
        .info-box {
            background: #f5f5f5;
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
            border-top: 1px solid #e0e0e0;
        }
        a {
            color: #2196F3;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .license {
            background: #e3f2fd;
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
            background: #e8f5e9;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: left;
        }
        .shortcut {
            background: #f0f0f0;
            padding: 3px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        .tip {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        code {
            background: #f5f5f5;
            padding: 2px 5px;
            border-radius: 3px;
        }
        pre {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
        }
    </style>`;
}

module.exports = { getSharedCSS };
