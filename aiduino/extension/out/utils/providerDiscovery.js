/*
 * AI.duino - Provider Discovery Module
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 * 
 * Automatically discovers installed AI providers on the system
 */

"use strict";

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Find an executable in system PATH or common locations
 * @param {string} name - Executable name (e.g., 'claude', 'vibe', 'gemini')
 * @returns {string|null} Path to executable or null if not found
 */
function findExecutable(name) {
    const isWindows = process.platform === 'win32';
    
    // 1. Try system PATH first
    try {
        const command = isWindows ? `where ${name}` : `which ${name}`;
        const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n')[0];
        if (result && fs.existsSync(result)) {
            return result;
        }
    } catch (e) {
        // Not in PATH, continue searching
    }
    
    // 2. Check common installation locations
    const commonPaths = getCommonInstallPaths(name);
    for (const testPath of commonPaths) {
        if (fs.existsSync(testPath)) {
            return testPath;
        }
    }
    
    return null;
}

/**
 * Get common installation paths for a given executable
 * @param {string} name - Executable name
 * @returns {Array<string>} List of possible paths
 */
function getCommonInstallPaths(name) {
    const homeDir = os.homedir();
    const isWindows = process.platform === 'win32';
    const paths = [];
    
    // Platform-specific paths
    if (isWindows) {
        paths.push(
            path.join(homeDir, 'AppData', 'Roaming', 'npm', `${name}.cmd`),
            path.join(homeDir, 'AppData', 'Local', 'Programs', name, `${name}.exe`),
            path.join(homeDir, '.local', 'bin', `${name}.exe`)
        );
        
        // uv tools path for Mistral Vibe on Windows
        if (name === 'vibe') {
            paths.push(
                path.join(homeDir, 'AppData', 'Roaming', 'uv', 'tools', 'mistral-vibe', 'Scripts', 'vibe.exe'),
                path.join(homeDir, 'AppData', 'Local', 'uv', 'tools', 'mistral-vibe', 'Scripts', 'vibe.exe')
            );
        }
    } else {
        // Unix/Linux/macOS paths
        paths.push(
            path.join(homeDir, '.local', 'bin', name),
            path.join(homeDir, `.${name}`, 'bin', name),
            `/usr/local/bin/${name}`,
            `/usr/bin/${name}`
        );
        
        // uv tools path for Mistral Vibe on Unix (specific location)
        if (name === 'vibe') {
            paths.push(path.join(homeDir, '.local', 'share', 'uv', 'tools', 'mistral-vibe', 'bin', name));
        }
    }
    
    // Check npm global locations
    const npmPaths = getNpmGlobalPaths();
    for (const npmPath of npmPaths) {
        const exe = isWindows ? `${name}.cmd` : name;
        paths.push(path.join(npmPath, exe));
    }
    
    // Check nvm locations (for npm packages)
    const nvmPaths = getNvmNodePaths();
    for (const nvmPath of nvmPaths) {
        const exe = isWindows ? `${name}.cmd` : name;
        paths.push(path.join(nvmPath, 'bin', exe));
    }
    
    return paths;
}

/**
 * Get npm global bin paths
 * @returns {Array<string>} List of npm global bin directories
 */
function getNpmGlobalPaths() {
    const paths = [];
    const isWindows = process.platform === 'win32';
    
    try {
        // npm config get prefix
        const prefix = execSync('npm config get prefix', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        paths.push(path.join(prefix, isWindows ? '' : 'bin'));
    } catch (e) {
        // Fallback to common locations
        const homeDir = os.homedir();
        if (isWindows) {
            paths.push(path.join(homeDir, 'AppData', 'Roaming', 'npm'));
        } else {
            paths.push('/usr/local/bin');
            paths.push(path.join(homeDir, '.npm-global', 'bin'));
        }
    }
    
    return paths;
}

/**
 * Get nvm node installation paths (sorted by version, newest first)
 * @returns {Array<string>} List of nvm node installation directories
 */
function getNvmNodePaths() {
    const homeDir = os.homedir();
    const paths = [];
    
    const nvmDirs = [
        path.join(homeDir, '.nvm', 'versions', 'node'), // Unix
        path.join(homeDir, 'AppData', 'Roaming', 'nvm'), // Windows nvm-windows
    ];
    
    for (const nvmDir of nvmDirs) {
        if (!fs.existsSync(nvmDir)) continue;
        
        try {
            const versions = fs.readdirSync(nvmDir)
                .filter(v => v.startsWith('v'))
                .map(v => ({
                    path: path.join(nvmDir, v),
                    major: parseInt(v.slice(1).split('.')[0])
                }))
                .sort((a, b) => b.major - a.major); // Newest first
            
            paths.push(...versions.map(v => v.path));
        } catch (e) {
            // Skip this directory
        }
    }
    
    return paths;
}

/**
 * Find Node.js v20+ on the system
 * @returns {string|null} Path to Node.js v20+ or null if not found
 */
function findNodeV20Plus() {
    const isWindows = process.platform === 'win32';
    
    try {
        // Try system Node.js
        const version = execSync('node --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        const major = parseInt(version.slice(1).split('.')[0]);
        
        if (major >= 20) {
            const command = isWindows ? 'where node' : 'which node';
            const nodePath = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n')[0];
            return nodePath;
        }
    } catch (e) {
        // System Node.js not v20+ or not found
    }
    
    // Check nvm locations for v20+
    const nvmPaths = getNvmNodePaths();
    for (const nvmPath of nvmPaths) {
        try {
            const nodeExe = isWindows ? 'node.exe' : 'node';
            const nodePath = path.join(nvmPath, isWindows ? '' : 'bin', nodeExe);
            
            if (!fs.existsSync(nodePath)) continue;
            
            const version = execSync(`"${nodePath}" --version`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
            const major = parseInt(version.slice(1).split('.')[0]);
            
            if (major >= 20) {
                return nodePath;
            }
        } catch (e) {
            continue;
        }
    }
    
    return null;
}

/**
 * Discover a specific provider
 * @param {string} providerId - Provider ID (e.g., 'claudecode', 'geminicli')
 * @param {Object} providerConfig - Provider configuration from providerConfigs.js
 * @returns {Object|null} { path: string, nodePath?: string } or null if not found
 */
function discoverProvider(providerId, providerConfig) {
    // Map provider IDs to executable names
    const executableNames = {
        'claudecode': 'claude',
        'mistralvibe': 'vibe',
        'opencode': 'opencode',
        'geminicli': 'gemini',
        'codexcli': 'codex',
        'groqcode': 'groq'
    };
    
    const execName = executableNames[providerId];
    if (!execName) {
        return null;
    }
    
    // Find the executable
    const execPath = findExecutable(execName);
    if (!execPath) {
        return null;
    }
    
    // Special handling for Gemini CLI (needs Node.js v20+)
    if (providerId === 'geminicli') {
        const nodePath = findNodeV20Plus();
        if (!nodePath) {
            console.log('Gemini CLI found but Node.js v20+ not found');
            return null; // Gemini CLI requires Node.js v20+
        }
        return { path: execPath, nodePath: nodePath };
    }

    // Special handling for Groq Code CLI (needs Node.js v22+)
    if (providerId === 'groqcode') {
        const nodePath = findNodeV20Plus();
        if (!nodePath) {
            console.log('Groq Code CLI found but Node.js v22+ not found');
            return null;
        }
        return { path: execPath, nodePath: nodePath };
    }
    
    return { path: execPath };
}

/**
 * Discover all available providers
 * @param {Object} providers - All provider configs from providerConfigs.js
 * @returns {Object} Map of provider IDs to their discovery results
 */
function discoverAllProviders(providers) {
    const discovered = {};
    
    for (const [providerId, config] of Object.entries(providers)) {
        // Only auto-discover local providers
        if (config.type !== 'local') continue;
        
        const result = discoverProvider(providerId, config);
        if (result) {
            discovered[providerId] = result;
        }
    }
    
    return discovered;
}

module.exports = {
    findExecutable,
    findNodeV20Plus,
    discoverProvider,
    discoverAllProviders
};
