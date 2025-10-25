/*
 * AI.duino - Offline Code Analysis Feature Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode = require('vscode');
const path = require('path');
const codeAnalyzer = require('../utils/codeAnalyzer');
const featureUtils = require('./featureUtils');
const shared = require('../shared');
const { getSharedCSS } = require('../utils/panels/sharedStyles');
const panelManager = require('../utils/panelManager');

/**
 * Main entry point - Analyze code offline (no AI required)
 * @param {Object} context - Extension context with dependencies
 */
async function analyzeCodeOffline(context) {
    const { t } = context;
    
    // 1. Validate editor and Arduino file
    const editor = featureUtils.validateEditorAndFile(context);
    if (!editor) return;
    
    const document = editor.document;
    const code = document.getText();
    const fileName = path.basename(document.fileName);
    
    // 2. Perform offline analysis (no AI call)
    const analysis = performAnalysis(code, t);
    
    // 3. Create or reveal panel
    const panel = panelManager.getOrCreatePanel({
        id: 'aiduinoCodeAnalysis',
        title: `📊 ${t('commands.analyzeCode')}`,
        viewColumn: vscode.ViewColumn.Two,
        webviewOptions: { enableScripts: true }
    });
    
    // If panel was just revealed, return early
    if (panel.webview.html) {
        return;
    }
    
    // 4. Generate and set HTML
    panel.webview.html = createAnalysisHtml(analysis, fileName, t, context);
}

/**
 * Perform complete code analysis using codeAnalyzer utilities
 * @param {string} code - Source code
 * @returns {Object} Analysis results
 */
function performAnalysis(code, t) {
    return {
        pins: codeAnalyzer.extractPinConfiguration(code, t),
        ports: codeAnalyzer.extractPortManipulation(code, t),
        libraries: codeAnalyzer.extractLibraries(code),
        functions: codeAnalyzer.extractFunctionSignatures(code),
        constants: codeAnalyzer.extractConstants(code),
        globals: codeAnalyzer.extractGlobalVariables(code),
        structures: codeAnalyzer.extractDataStructures(code)
    };
}

/**
 * Create HTML for analysis panel
 * @param {Object} analysis - Analysis results
 * @param {string} fileName - File name being analyzed
 * @param {Function} t - Translation function
 * @returns {string} HTML content
 */
function createAnalysisHtml(analysis, fileName, t, context) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${t('commands.analyzeCode')}</title>
            ${getSharedCSS(context.settings.get('cardStyle'))}
            <style>
                /* Additional styles specific to code analysis */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .stat-card {
                    padding: 15px;
                    background: var(--vscode-editor-selectionBackground);
                    border-radius: 6px;
                    text-align: center;
                    border: 1px solid var(--vscode-panel-border);
                }
                
                .stat-number {
                    font-size: 32px;
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                    line-height: 1;
                }
                
                .stat-label {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .panel-section {
                    margin: 25px 0;
                }
                
                .analysis-item {
                    padding: 10px 14px;
                    margin: 8px 0;
                    background: var(--vscode-input-background);
                    border-radius: 4px;
                    font-family: 'Courier New', Consolas, monospace;
                    font-size: 13px;
                    line-height: 1.5;
                    border: 1px solid var(--vscode-input-border);
                }
            </style>
        </head>
        <body>
            <h1>📊 ${t('commands.analyzeCode')}</h1>
            
            <div class="info-badge">
                <strong>${t('analyzeCode.analyzedFile')}:</strong> ${shared.escapeHtml(fileName)}
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${analysis.pins.length}</div>
                    <div class="stat-label">${t('analyzeCode.pinsUsed')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${analysis.libraries.length}</div>
                    <div class="stat-label">${t('analyzeCode.libraries')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${analysis.functions.length}</div>
                    <div class="stat-label">${t('analyzeCode.functions')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${analysis.constants.length}</div>
                    <div class="stat-label">${t('analyzeCode.constants')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${analysis.globals.length}</div>
                    <div class="stat-label">${t('analyzeCode.globalVars')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${analysis.structures.length}</div>
                    <div class="stat-label">${t('analyzeCode.structures')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${analysis.ports.length}</div>
                    <div class="stat-label">${t('analyzeCode.portManipulation')}</div>
                </div>
            </div>   

            ${generateSection('📌', t('analyzeCode.pinConfig'), analysis.pins, t)}
            ${generateSection('📚', t('analyzeCode.usedLibraries'), analysis.libraries, t)}
            ${generateSection('🔧', t('analyzeCode.functionList'), analysis.functions, t)}
            ${generateSection('🔢', t('analyzeCode.constantsList'), analysis.constants, t)}
            ${generateSection('🌐', t('analyzeCode.globalVarsList'), analysis.globals, t)}
            ${generateSection('📦', t('analyzeCode.dataStructures'), analysis.structures, t)}
            ${generateSection('⚡', t('analyzeCode.portManipulation'), analysis.ports, t)}

        </body>
        </html>
    `;
}

/**
 * Generate HTML for analysis section
 * @param {string} icon - Section icon emoji
 * @param {string} title - Section title
 * @param {Array} items - Items to display
 * @param {Function} t - Translation function
 * @returns {string} HTML for section
 */
function generateSection(icon, title, items, t) {
    const isEmpty = !items || items.length === 0;
    
    let content = '';
    if (isEmpty) {
        content = `<p class="empty-state">${t('analyzeCode.noneFound')}</p>`;
    } else {
        content = items.map(item => 
            `<div class="analysis-item">${shared.escapeHtml(item)}</div>`
        ).join('');
    }
    
    return `
        <div class="panel-section">
            <h3>${icon} ${title}</h3>
            ${content}
        </div>
    `;
}

module.exports = {
    analyzeCodeOffline
};
