/*
 * AI.duino - Compile Checker
 * Copyright 2026 Monster Maker
 *
 * Licensed under the Apache License, Version 2.0
 *
 * Compiles the sketch with arduino-cli (asynchronously, the IDE stays responsive)
 * after an agent run and reports errors plus flash and RAM usage.
 * Taken from Agentuino. Pure Node, no VS Code API.
 */

"use strict";

const path = require('path');
const { spawn, execFile } = require('child_process');

const IS_WINDOWS = process.platform === 'win32';

// ===== CONSTANTS =====


const COMPILE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_SHOWN_ERRORS = 5;
const MAX_ERROR_TEXT = 4000;
const EXTRA_ENV = { ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false' };
// Section names arduino-cli reports for program storage and global variables
const FLASH_SECTION = 'text';
const RAM_SECTION = 'data';
// Above this share the Arduino IDE warns about low memory; percentages are truncated like the IDE does
const RAM_WARNING_PERCENT = 75;
// 'FATAL' stops the build, e.g. a missing header (library not installed)
const ERROR_SEVERITIES = new Set(['ERROR', 'FATAL']);
// "Foo.h: No such file or directory" for an #include <...>: a library is missing
const MISSING_HEADER_PATTERN = /^(\S+): No such file or directory\s*\n\s*#\s*include\s*</;

/**
 * Environment with the arduino-cli folder in front of PATH
 * @param {string} toolPath - arduino-cli path
 * @param {Object} extra - Additional variables
 * @returns {Object} Environment
 */
function buildEnv(toolPath, extra = {}) {
    const env = { ...process.env, ...extra };
    const dir = toolPath && path.dirname(toolPath);
    if (!dir || dir === '.') return env;
    // Windows names it 'Path'; keep the existing key instead of adding a second one
    const key = Object.keys(env).find(k => k.toUpperCase() === 'PATH') || 'PATH';
    const parts = (env[key] || '').split(path.delimiter).filter(part => part && part !== dir);
    env[key] = [dir, ...parts].join(path.delimiter);
    return env;
}

/**
 * Parse the JSON output of arduino-cli (may be preceded by other lines)
 * @param {string} stdout - Output
 * @returns {Object|null} Parsed object
 */
function parseOutput(stdout) {
    const text = (stdout || '').trim();
    const start = text.indexOf('{');
    if (start < 0) return null;
    try {
        return JSON.parse(text.slice(start));
    } catch {
        return null;
    }
}

/**
 * Get used and maximum size of one section
 * @param {Array} sections - executable_sections_size
 * @param {string} name - Section name
 * @returns {{used: number, max: number, percent: number|null}|null} Size
 */
function getSection(sections, name) {
    const section = (sections || []).find(s => s.name === name);
    if (!section) return null;
    const used = Number(section.size) || 0;
    const max = Number(section.max_size) || 0;
    return { used, max, percent: max > 0 ? Math.floor(used * 100 / max) : null };
}

/**
 * Show a path relative to the sketch, other files (libraries, cores) by name
 * @param {string} file - File path
 * @param {string} sketchPath - Sketch folder
 * @returns {string} Short path
 */
function shortPath(file, sketchPath) {
    if (!file) return '';
    const rel = path.relative(sketchPath, file);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : path.basename(file);
}

/**
 * Turn compiler messages into short lines for the chat
 * @param {Array} diagnostics - builder_result.diagnostics
 * @param {string} sketchPath - Sketch folder
 * @returns {string[]} Lines like "Blink.ino:3:5: 'foo' was not declared in this scope"
 */
function describeDiagnostics(diagnostics, sketchPath) {
    return (diagnostics || [])
        .filter(d => ERROR_SEVERITIES.has(d.severity))
        .map(d => {
            const where = [shortPath(d.file, sketchPath), d.line, d.column].filter(Boolean).join(':');
            const message = String(d.message || '').split('\n')[0];
            return where ? `${where}: ${message}` : message;
        });
}

/**
 * Headers of libraries that are not installed. Only #include <...> counts,
 * a missing "local.h" is a mistake in the sketch the agent can fix.
 * @param {Array} diagnostics - builder_result.diagnostics
 * @returns {string[]|null} Header names if every error is a missing library, else null
 */
function findMissingLibraries(diagnostics) {
    const errors = (diagnostics || []).filter(d => ERROR_SEVERITIES.has(d.severity));
    const headers = errors.map(d => String(d.message || '').match(MISSING_HEADER_PATTERN)?.[1]);
    if (headers.length === 0 || headers.some(h => !h)) return null;
    return [...new Set(headers)];
}

/**
 * Full compiler error output for the agent, absolute sketch paths shortened
 * @param {Object} data - Parsed output
 * @param {string} stderr - Raw stderr
 * @param {string} sketchPath - Sketch folder
 * @returns {string} Error text
 */
function buildErrorText(data, stderr, sketchPath) {
    let text = (data && (data.compiler_err || data.error)) || stderr || '';
    text = text.split(sketchPath + path.sep).join('').trim();
    // The end holds the summary, so cut from the front
    return text.length > MAX_ERROR_TEXT ? '…' + text.slice(-MAX_ERROR_TEXT) : text;
}

/**
 * Evaluate a finished compile run
 * @param {Object} data - Parsed output or null
 * @param {number} exitCode - Exit code
 * @param {string} stderr - Raw stderr
 * @param {string} sketchPath - Sketch folder
 * @returns {Object} {ok, output, flash, ram, ramWarning, errors, moreErrors, errorText, missingLibraries}
 */
function evaluate(data, exitCode, stderr, sketchPath) {
    const ok = Boolean(data && data.success) && exitCode === 0;
    const builder = (data && data.builder_result) || {};
    // Plain compiler text as the IDE shows it, for the output panel
    const output = [data?.compiler_out, data?.compiler_err, data?.error, stderr]
        .filter(Boolean).join('\n').trim();
    if (ok) {
        const ram = getSection(builder.executable_sections_size, RAM_SECTION);
        return {
            ok,
            output,
            flash: getSection(builder.executable_sections_size, FLASH_SECTION),
            ram,
            ramWarning: Boolean(ram && ram.percent !== null && ram.percent > RAM_WARNING_PERCENT)
        };
    }
    const lines = describeDiagnostics(builder.diagnostics, sketchPath);
    const errorText = buildErrorText(data, stderr, sketchPath);
    // Without compiler messages (e.g. unknown board) the last line says what went wrong
    const errors = lines.length > 0
        ? lines.slice(0, MAX_SHOWN_ERRORS)
        : [errorText.split('\n').filter(Boolean).pop() || `exit code ${exitCode}`];
    return {
        ok,
        output,
        errors,
        moreErrors: Math.max(0, lines.length - MAX_SHOWN_ERRORS),
        errorText,
        missingLibraries: findMissingLibraries(builder.diagnostics)
    };
}

class CompileChecker {
    constructor() {
        this.child = null;
        this.stopRequested = false;
    }

    get isRunning() {
        return this.child !== null;
    }

    /**
     * Compile a sketch
     * @param {Object} options - {cliPath, configFile, fqbn, sketchPath}
     * @returns {Promise<Object>} Result, see evaluate(); {stopped: true} when stopped
     */
    compile({ cliPath, configFile, fqbn, sketchPath }) {
        const args = ['compile', '--fqbn', fqbn, '--format', 'json'];
        if (configFile) args.push('--config-file', configFile);
        args.push(sketchPath);
        this.stopRequested = false;

        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            try {
                this.child = spawn(cliPath, args, {
                    cwd: sketchPath,
                    env: buildEnv(cliPath, EXTRA_ENV),
                    windowsHide: true,
                    detached: !IS_WINDOWS
                });
            } catch (err) {
                reject(err);
                return;
            }
            const timer = setTimeout(() => this.stop(), COMPILE_TIMEOUT_MS);

            this.child.stdout.on('data', chunk => { stdout += chunk; });
            this.child.stderr.on('data', chunk => { stderr += chunk; });
            this.child.on('error', err => {
                clearTimeout(timer);
                this.child = null;
                reject(err);
            });
            this.child.on('close', code => {
                clearTimeout(timer);
                this.child = null;
                if (this.stopRequested) {
                    resolve({ stopped: true });
                    return;
                }
                resolve(evaluate(parseOutput(stdout), code, stderr, sketchPath));
            });
        });
    }

    /**
     * Stop a running compile including the compiler processes
     */
    stop() {
        if (!this.child) return;
        this.stopRequested = true;
        const pid = this.child.pid;
        if (IS_WINDOWS) {
            execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => {});
            return;
        }
        try {
            process.kill(-pid, 'SIGTERM');
        } catch {
            this.child.kill('SIGTERM');
        }
    }
}

module.exports = { CompileChecker, evaluate, parseOutput };
