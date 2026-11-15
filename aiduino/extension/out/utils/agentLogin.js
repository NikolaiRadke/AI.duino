/*
 * AI.duino - Agent Login
 * Copyright 2026 Monster Maker
 *
 * Licensed under the Apache License, Version 2.0
 *
 * Recognizes expired or missing logins of CLI agents and offers to run the
 * agent's login command in the system terminal (the Arduino IDE has none).
 * Patterns and terminal handling taken from Agentuino.
 */

"use strict";

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const IS_WINDOWS = process.platform === 'win32';

// Login errors per agent module. Only checked when a run already failed.
const AUTH_PATTERNS = {
    claudeCode: /\/login|not logged in|login expired|oauth|authentication_(error|failed)|invalid api key/i,
    codexCli: /401|unauthori[sz]ed|not logged in|login required|api key|oauth|refresh|expired/i,
    mistralVibe: /401|unauthori[sz]ed|api key|setup|credential|login/i,
    openCode: /401|unauthori[sz]ed|api key|authenticat|oauth|credential|log ?in|ProviderAuthError/i,
    geminiCli: /401|unauthori[sz]ed|api key|authenticat|oauth|credential|log ?in/i
};

// Arguments of the login command per agent module (claude and gemini log in interactively)
const LOGIN_ARGS = {
    claudeCode: [],
    codexCli: ['login'],
    mistralVibe: ['--setup'],
    openCode: ['auth', 'login'],
    geminiCli: []
};

// ===== CONSTANTS =====

// Linux terminals in order of preference, each with the option after which the
// rest of the line is the command. x-terminal-emulator comes last: what its -e
// takes depends on the terminal it points to.
const LINUX_TERMINALS = [
    { name: 'gnome-terminal', run: ['--'] },
    { name: 'konsole', run: ['-e'] },
    { name: 'xfce4-terminal', run: ['-x'] },
    { name: 'mate-terminal', run: ['-x'] },
    { name: 'kitty', run: [] },
    { name: 'alacritty', run: ['-e'] },
    { name: 'xterm', run: ['-e'] },
    { name: 'x-terminal-emulator', run: ['-e'] }
];
const OSASCRIPT = '/usr/bin/osascript';

// ===== HELPERS =====

/**
 * Quote an argument for a POSIX shell
 * @param {string} arg - Argument
 * @returns {string} Quoted argument
 */
function quotePosix(arg) {
    return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${String(arg).replace(/'/g, `'\\''`)}'`;
}

/**
 * Find an executable in PATH
 * @param {string} name - Executable name
 * @returns {string|null} Full path
 */
function findInPath(name) {
    for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
        const file = path.join(dir, name);
        try {
            fs.accessSync(file, fs.constants.X_OK);
            return file;
        } catch { /* not here */ }
    }
    return null;
}

/**
 * Start a detached process, report whether it could be started
 * @param {string} command - Executable
 * @param {string[]} args - Arguments
 * @param {Object} options - spawn() options
 * @returns {Promise<boolean>} Started
 */
function launch(command, args, options) {
    return new Promise(resolve => {
        try {
            const child = spawn(command, args, { ...options, detached: true, stdio: 'ignore' });
            child.once('error', () => resolve(false));
            child.once('spawn', () => {
                child.unref();
                resolve(true);
            });
        } catch {
            resolve(false);
        }
    });
}

// ===== PUBLIC =====

/**
 * Open the system terminal in a folder and run a command in it
 * @param {string} toolPath - Executable of the agent (full path or name)
 * @param {string[]} args - Arguments, e.g. ['login']
 * @param {string} cwd - Folder for the terminal
 * @returns {Promise<boolean>} A terminal was opened
 */
async function openInTerminal(toolPath, args, cwd) {
    if (IS_WINDOWS) {
        // The outer quotes keep cmd /k from stripping the quotes of the path
        const line = [toolPath, ...args].map(a => (/[\s&()^|<>"]/.test(a) ? `"${a}"` : a)).join(' ');
        return launch('cmd.exe', ['/d', '/c', `start "" cmd /k "${line}"`], { cwd, windowsVerbatimArguments: true });
    }

    const line = [toolPath, ...args].map(quotePosix).join(' ');
    if (process.platform === 'darwin') {
        const script = `cd ${quotePosix(cwd)} && ${line}`.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return launch(OSASCRIPT, [
            '-e', `tell application "Terminal" to do script "${script}"`,
            '-e', 'tell application "Terminal" to activate'
        ], { cwd });
    }

    // Keep the terminal open after the agent ends, so messages stay readable
    const shell = process.env.SHELL || '/bin/sh';
    const script = `${line}; exec ${quotePosix(shell)}`;
    for (const terminal of LINUX_TERMINALS) {
        const found = findInPath(terminal.name);
        if (found && await launch(found, [...terminal.run, shell, '-c', script], { cwd })) return true;
    }
    return false;
}

/**
 * Check whether an error message of a failed run means a missing or expired login
 * @param {string} agentModule - Agent module name from providerConfigs.js
 * @param {string} message - Error message
 * @returns {boolean}
 */
function isAuthError(agentModule, message) {
    const pattern = AUTH_PATTERNS[agentModule];
    return Boolean(pattern && message && pattern.test(message));
}

/**
 * Tell the user the agent needs a login and offer to open it in a terminal.
 * Does not wait for the user.
 * @param {Object} context - Extension context (t)
 * @param {Object} provider - Provider config
 * @param {string} toolPath - Agent executable
 * @param {string|null} cwd - Sketch folder
 */
function offerLogin(context, provider, toolPath, cwd) {
    const { t } = context;
    const args = LOGIN_ARGS[provider.agentModule] || [];
    const command = [toolPath, ...args].join(' ');
    const button = t('buttons.loginTerminal');

    vscode.window.showErrorMessage(t('errors.agentLogin', provider.name), button).then(async choice => {
        if (choice !== button) return;
        const folder = cwd && fs.existsSync(cwd) ? cwd : require('os').homedir();
        const opened = await openInTerminal(toolPath, args, folder);
        if (!opened) {
            // No terminal found: give the command to copy
            await vscode.env.clipboard.writeText(command);
            vscode.window.showInformationMessage(t('messages.loginCommandCopied', command));
        }
    });
}

module.exports = {
    isAuthError,
    offerLogin,
    openInTerminal
};
