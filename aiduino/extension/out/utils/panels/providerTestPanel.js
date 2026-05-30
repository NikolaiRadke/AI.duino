/*
 * AI.duino - Provider Test Panel
 * Copyright 2026 Monster Maker
 *
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

const vscode           = require('vscode');
const https            = require('https');
const net              = require('net');
const fs               = require('fs');
const os               = require('os');
const path             = require('path');
const { execSync }     = require('child_process');
const { getSharedCSS } = require('./sharedStyles');
const panelManager     = require('../panelManager');

const AIDUINO_DIR   = path.join(os.homedir(), '.aiduino');
const HTTPS_TIMEOUT = 6000;

// ===== NETWORK HELPERS =====

function httpsGet(hostname, urlPath, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname,
            path:    urlPath,
            method:  'GET',
            headers: { 'User-Agent': 'AI.duino-test/1.0', ...headers },
            timeout: HTTPS_TIMEOUT
        }, (res) => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                let data = null;
                try { data = JSON.parse(raw); } catch { /* non-JSON */ }
                resolve({ status: res.statusCode, data });
            });
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.on('error', reject);
        req.end();
    });
}

function tcpPortOpen(host, port, timeoutMs = 2000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let done = false;
        const finish = (r) => { if (!done) { done = true; socket.destroy(); resolve(r); } };
        socket.setTimeout(timeoutMs);
        socket.on('connect', () => finish(true));
        socket.on('error',   () => finish(false));
        socket.on('timeout', () => finish(false));
        socket.connect(port, host);
    });
}

function parseUrl(url) {
    try {
        const u = new URL(url);
        return { host: u.hostname, port: parseInt(u.port || (u.protocol === 'https:' ? 443 : 80)) };
    } catch { return null; }
}

// ===== KEY READER =====

function readKey(keyFile) {
    try {
        const p = path.join(AIDUINO_DIR, keyFile);
        if (!fs.existsSync(p)) return null;
        // Keys may be stored as "apikey|modelId" — extract key part only
        const key = fs.readFileSync(p, 'utf8').trim().split('|')[0].trim();
        return key.length > 0 ? key : null;
    } catch { return null; }
}

// ===== PROVIDER TYPE DETECTION =====

function getProviderType(cfg) {
    if (cfg.type !== 'local') return 'cloud';
    if (cfg.httpConfig)       return 'http';
    return 'cli';
}

// ===== CHECK HELPERS =====
// Each check function returns an array of result objects:
// { type: 'pass'|'fail'|'info'|'skip', label: string, hint?: string }

function checkCommonFields(cfg) {
    const results = [];
    const c = (label, condition, hint = '') =>
        results.push({ type: condition ? 'pass' : 'fail', label, hint });

    c('name is a non-empty string',        typeof cfg.name === 'string' && cfg.name.length > 0);
    c('icon is a non-empty string',        typeof cfg.icon === 'string' && cfg.icon.length > 0);
    c('color is a valid hex color',        /^#[0-9A-Fa-f]{6}$/.test(cfg.color));
    c('keyFile is a non-empty string',     typeof cfg.keyFile === 'string' && cfg.keyFile.length > 0);
    c('fallback is a non-empty string',    typeof cfg.fallback === 'string' && cfg.fallback.length > 0);
    c('keyMinLength is a positive number', typeof cfg.keyMinLength === 'number' && cfg.keyMinLength > 0);
    c('prices.input >= 0',                 typeof cfg.prices?.input  === 'number' && cfg.prices.input  >= 0);
    c('prices.output >= 0',                typeof cfg.prices?.output === 'number' && cfg.prices.output >= 0);
    return results;
}

function checkModelDiscovery(cfg) {
    const results = [];
    const md = cfg.modelDiscovery;
    const c    = (label, condition, hint = '') => results.push({ type: condition ? 'pass' : 'fail', label, hint });
    const info = (label) => results.push({ type: 'info', label });

    c('modelDiscovery exists', !!md);
    if (!md) return results;

    c('modelDiscovery.enabled is boolean', typeof md.enabled === 'boolean');
    c('staticModels is an array',          Array.isArray(md.staticModels));

    if (!Array.isArray(md.staticModels) || md.staticModels.length === 0) {
        info('staticModels intentionally empty — skipping model checks');
        return results;
    }

    const first = md.staticModels[0];
    c('staticModels[0].id is a string',   typeof first.id   === 'string' && first.id.length   > 0);
    c('staticModels[0].name is a string', typeof first.name === 'string' && first.name.length > 0);

    // fallback must appear in staticModels
    const fallbackInStatic = md.staticModels.some(m => m.id === cfg.fallback);
    c(`fallback '${cfg.fallback}' present in staticModels`, fallbackInStatic,
        fallbackInStatic ? '' : 'fallback model missing from staticModels');

    if (typeof md.selectDefault === 'function') {
        try {
            const result = md.selectDefault(md.staticModels);
            c('selectDefault() returns a model', !!result);
        } catch (e) {
            c('selectDefault() does not throw', false, e.message);
        }
    }
    return results;
}

async function checkCloudProvider(key, cfg) {
    const results = [...checkCommonFields(cfg), ...checkModelDiscovery(cfg)];
    const ac   = cfg.apiConfig;
    const c    = (label, condition, hint = '') => results.push({ type: condition ? 'pass' : 'fail', label, hint });
    const info = (label) => results.push({ type: 'info', label });
    const skip = (label) => results.push({ type: 'skip', label });

    // --- Structure: top-level fields ---
    c('hostname is defined',  typeof cfg.hostname  === 'string' && cfg.hostname.length  > 0);
    c('apiKeyUrl is defined', typeof cfg.apiKeyUrl === 'string' && cfg.apiKeyUrl.startsWith('http'));
    c('path is defined',      typeof cfg.path      === 'string' && cfg.path.length      > 0);

    if (typeof cfg.headers === 'function') {
        try {
            const h = cfg.headers('TESTKEY');
            c('headers(key) returns an object', typeof h === 'object' && h !== null);
        } catch (e) {
            c('headers(key) does not throw', false, e.message);
        }
    } else {
        c('headers is a function', false);
    }

    // --- Structure: apiConfig ---
    c('apiConfig exists', !!ac);
    if (ac) {
        c('apiConfig.apiPath is defined (string or function)',
            (typeof ac.apiPath === 'string' && ac.apiPath.length > 0) || typeof ac.apiPath === 'function');        
        c('apiConfig.method is defined',         typeof ac.method       === 'string' && ac.method.length > 0);
        c('apiConfig.headers is a function',     typeof ac.headers      === 'function');
        c('apiConfig.buildRequest is a function',typeof ac.buildRequest === 'function');
        c('apiConfig.extractResponse is a func', typeof ac.extractResponse === 'function');
    }

    // --- Unauthenticated ping: 4xx is fine, means server is alive ---
    if (typeof cfg.hostname === 'string' && typeof cfg.path === 'string') {
        try {
            const { status } = await httpsGet(cfg.hostname, cfg.path);
            const alive = (status >= 200 && status < 500);
            c(`Ping ${cfg.hostname} → HTTP ${status}`,
              alive, alive ? '' : 'server unreachable');
        } catch (e) {
            c(`Ping ${cfg.hostname}`, false, e.message);
        }
    }

    // --- Live model check (key required) ---
    const apiKey = readKey(cfg.keyFile);
    if (!apiKey) {
        skip(`Live model check skipped — no key in ~/.aiduino/${cfg.keyFile}`);
        return results;
    }
    info('Key found — running live model check');

    // Gemini appends key to URL; all others use Authorization headers
    const isGemini    = typeof cfg.path === 'string' && cfg.path.includes('?key=');
    const livePath    = isGemini ? cfg.path + apiKey : cfg.path;
    const liveHeaders = isGemini ? {} : (typeof cfg.headers === 'function' ? cfg.headers(apiKey) : {});

    let liveStatus = null, liveData = null;
    try {
        ({ status: liveStatus, data: liveData } = await httpsGet(cfg.hostname, livePath, liveHeaders));
    } catch (e) {
        c('Live request completed', false, e.message);
        return results;
    }

    c(`Live request → HTTP ${liveStatus} (expected 200)`,
      liveStatus === 200,
      liveStatus === 401 ? 'key rejected'      :
      liveStatus === 403 ? 'key unauthorized'  :
      liveStatus === 429 ? 'rate limited'      : '');

    if (liveStatus !== 200 || !liveData) return results;

    if (typeof cfg.extractModels === 'function') {
        let models = [];
        try {
            models = cfg.extractModels(liveData) || [];
        } catch (e) {
            c('extractModels() on live data does not throw', false, e.message);
            return results;
        }
        c(`Model list returned ≥1 model (got ${models.length})`, models.length > 0);
        if (models.length > 0) {
            const fallbackFound = models.some(m =>
                m === cfg.fallback || m.id === cfg.fallback || m.name === cfg.fallback);
            c(`Fallback model '${cfg.fallback}' found in live list`,
              fallbackFound, fallbackFound ? '' : 'model may have been renamed or removed');
            if (typeof cfg.selectBest === 'function') {
                try {
                    const best = cfg.selectBest(models);
                    c('selectBest() returns a result on live data', !!best);
                } catch (e) {
                    c('selectBest() does not throw on live data', false, e.message);
                }
            }
        }
    }
    return results;
}

function checkCliProvider(key, cfg) {
    const results = [...checkCommonFields(cfg), ...checkModelDiscovery(cfg)];
    const pc   = cfg.processConfig;
    const c    = (label, condition, hint = '') => results.push({ type: condition ? 'pass' : 'fail', label, hint });
    const info = (label) => results.push({ type: 'info', label });

    c('processConfig exists',         !!pc);
    if (!pc) return results;
    c('processConfig.command defined', typeof pc.command === 'string' && pc.command.length > 0);

    if (typeof pc.command === 'string') {
        let found = false;
        try {
            execSync(process.platform === 'win32' ? `where ${pc.command}` : `which ${pc.command}`,
                { stdio: 'ignore' });
            found = true;
        } catch { /* not installed */ }
        if (found) {
            results.push({ type: 'pass', label: `Binary '${pc.command}' found on PATH` });
        } else {
            const storedPath = readKey(cfg.keyFile);
            if (storedPath && fs.existsSync(storedPath)) {
                results.push({ type: 'pass', label: `Binary '${pc.command}' found at configured path` });
            } else {
                info(`Binary '${pc.command}' not found on PATH — not installed?`);
            }
        }
    }

    if (typeof pc.buildArgs === 'function') {
        try {
            const args = pc.buildArgs('test prompt', {}, cfg.fallback);
            c('buildArgs() returns a non-empty array', Array.isArray(args) && args.length > 0);
        } catch (e) { c('buildArgs() does not throw', false, e.message); }
    } else {
        c('buildArgs is a function', false);
    }

    if (typeof pc.buildPrompt === 'function') {
        try {
            const p = pc.buildPrompt('test', {});
            c('buildPrompt() returns a string', typeof p === 'string');
        } catch (e) { c('buildPrompt() does not throw', false, e.message); }
    }
    return results;
}

async function checkHttpProvider(key, cfg) {
    const results = [...checkCommonFields(cfg), ...checkModelDiscovery(cfg)];
    const c    = (label, condition, hint = '') => results.push({ type: condition ? 'pass' : 'fail', label, hint });
    const info = (label) => results.push({ type: 'info', label });

    c('httpConfig exists',               !!cfg.httpConfig);
    c('httpConfig.endpoint defined',     typeof cfg.httpConfig?.endpoint === 'string');
    c('autoDetectUrls is a non-empty array',
      Array.isArray(cfg.autoDetectUrls) && cfg.autoDetectUrls.length > 0);

    if (Array.isArray(cfg.autoDetectUrls)) {
        for (const url of cfg.autoDetectUrls) {
            const parsed = parseUrl(url);
            if (!parsed) { c(`parseUrl(${url})`, false, 'could not parse URL'); continue; }
            const open = await tcpPortOpen(parsed.host, parsed.port);
            open
                ? results.push({ type: 'pass', label: `${url} — port ${parsed.port} reachable` })
                : info(`${url} — port ${parsed.port} not reachable (service not running?)`);
        }
    }
    return results;
}

// ===== MAIN TEST RUNNER =====

async function runAllTests() {
    let PROVIDER_CONFIGS;
    try {
        ({ PROVIDER_CONFIGS } = require('../../config/providerConfigs'));
    } catch (e) {
        return { loadError: e.message };
    }

    const cloud = [], cli = [], http = [];
    for (const [k, cfg] of Object.entries(PROVIDER_CONFIGS)) {
        switch (getProviderType(cfg)) {
            case 'cloud': cloud.push([k, cfg]); break;
            case 'cli':   cli.push([k, cfg]);   break;
            case 'http':  http.push([k, cfg]);  break;
        }
    }

    const cloudResults = [];
    for (const [k, cfg] of cloud) {
        cloudResults.push({ key: k, name: cfg.name, icon: cfg.icon, checks: await checkCloudProvider(k, cfg) });
    }
    const cliResults = [];
    for (const [k, cfg] of cli) {
        cliResults.push({ key: k, name: cfg.name, icon: cfg.icon, checks: checkCliProvider(k, cfg) });
    }
    const httpResults = [];
    for (const [k, cfg] of http) {
        httpResults.push({ key: k, name: cfg.name, icon: cfg.icon, checks: await checkHttpProvider(k, cfg) });
    }

    const configCheck  = { type: 'pass', label: 'providerConfigs.js loaded successfully' };
    const allChecks    = [configCheck, ...cloudResults, ...cliResults, ...httpResults].flatMap(r => r.checks || [r]);
    const totalPass    = allChecks.filter(c => c.type === 'pass').length + 1; // +1 for configCheck
    const totalFail    = allChecks.filter(c => c.type === 'fail').length;
    const totalSkip    = allChecks.filter(c => c.type === 'skip').length;

    return { configCheck, cloudResults, cliResults, httpResults, totalPass, totalFail, totalSkip };
}

// ===== HTML RENDERING =====

const ICONS  = { pass: '✔', fail: '✘', info: 'ℹ', skip: '–' };
const CLASSES = { pass: 'r-pass', fail: 'r-fail', info: 'r-info', skip: 'r-skip' };

function renderChecks(checks) {
    return checks.map(c => `
        <div class="check ${CLASSES[c.type] || ''}">
            <span class="ci">${ICONS[c.type] || '?'}</span>
            <span>${c.label}${c.hint ? ` <em>(${c.hint})</em>` : ''}</span>
        </div>`).join('');
}

function renderGroup(providers, title) {
    if (!providers.length) return '';
    return `
        <div class="group">
            <h2>${title}</h2>
            ${providers.map(p => `
                <div class="provider">
                    <div class="ph">${p.icon}&nbsp;&nbsp;${p.name}&nbsp;<span class="pk">(${p.key})</span></div>
                    <div class="pc">${renderChecks(p.checks)}</div>
                </div>`).join('')}
        </div>`;
}

function generateLoadingHTML(t) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">${getSharedCSS()}
        <style>
            body{padding:20px}
            .loading{text-align:center;margin-top:60px;color:var(--vscode-descriptionForeground)}
            .spin{font-size:32px;display:inline-block;animation:s 1s linear infinite}
            @keyframes s{to{transform:rotate(360deg)}}
        </style></head><body>
        <div class="loading"><div class="spin">⟳</div><p>${t('providerTest.running')}</p></div>
        </body></html>`;
}

function generateResultsHTML(results, t) {
    const { configCheck, cloudResults, cliResults, httpResults,
            totalPass, totalFail, totalSkip, loadError } = results;

    if (loadError) {
        return `<!DOCTYPE html><html><head><meta charset="UTF-8">${getSharedCSS()}</head><body>
            <div style="padding:20px;color:var(--vscode-errorForeground)">
                ✘ providerConfigs.js failed to load: ${loadError}
            </div></body></html>`;
    }

    const total       = totalPass + totalFail;
    const hasFail     = totalFail > 0;
    const summaryText = hasFail
        ? t('providerTest.someFailed').replace('{0}', totalFail)
        : t('providerTest.allPassed');
    const passedText  = t('providerTest.passed').replace('{0}', totalPass).replace('{1}', total);
    const skippedText = totalSkip > 0 ? ` · ${t('providerTest.skipped').replace('{0}', totalSkip)}` : '';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${t('providerTest.title')}</title>
${getSharedCSS()}
<style>
    body{padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5}
    h1{margin-bottom:4px}
    .sub{color:var(--vscode-descriptionForeground);font-size:13px;margin-bottom:22px}
    .group h2{font-size:13px;font-weight:bold;border-bottom:1px solid var(--vscode-panel-border);
        padding-bottom:5px;margin:20px 0 10px}
    .provider{border:1px solid var(--vscode-panel-border);border-radius:5px;
        overflow:hidden;margin-bottom:12px}
    .ph{padding:7px 12px;font-weight:bold;font-size:13px;background:var(--vscode-sideBar-background)}
    .pk{font-weight:normal;color:var(--vscode-descriptionForeground);font-size:12px}
    .pc{padding:6px 12px}
    .check{display:flex;gap:8px;align-items:baseline;padding:2px 0;font-size:12px;
        border-bottom:1px solid var(--vscode-widget-border)}
    .check:last-child{border-bottom:none}
    .ci{min-width:14px;text-align:center;font-size:13px}
    .check em{color:var(--vscode-descriptionForeground);font-style:italic}
    .r-pass .ci{color:var(--vscode-testing-iconPassed,#4caf50)}
    .r-fail .ci{color:var(--vscode-testing-iconFailed,#f44336)}
    .r-info .ci{color:var(--vscode-editorInfo-foreground,#4fc3f7)}
    .r-skip .ci{color:var(--vscode-descriptionForeground)}
    .summary{margin-top:24px;padding:13px 16px;border-radius:5px;
        border:1px solid var(--vscode-panel-border)}
    .s-pass{border-color:var(--vscode-testing-iconPassed,#4caf50)}
    .s-fail{border-color:var(--vscode-testing-iconFailed,#f44336)}
    .st{font-weight:bold;font-size:14px;margin-bottom:3px}
    .s-pass .st{color:var(--vscode-testing-iconPassed,#4caf50)}
    .s-fail .st{color:var(--vscode-testing-iconFailed,#f44336)}
    .sd{color:var(--vscode-descriptionForeground);font-size:12px}
</style>
</head>
<body>
    <h1>🔌 ${t('providerTest.title')}</h1>
    <div class="sub">${t('providerTest.description')}</div>

    <div class="check r-pass">
        <span class="ci">✔</span>
        <span>${t('providerTest.configLoaded')}</span>
    </div>

    ${renderGroup(cloudResults, t('providerTest.cloudProviders'))}
    ${renderGroup(cliResults,   t('providerTest.cliProviders'))}
    ${renderGroup(httpResults,  t('providerTest.httpProviders'))}

    <div class="summary ${hasFail ? 's-fail' : 's-pass'}">
        <div class="st">${t('providerTest.summary')}: ${summaryText}</div>
        <div class="sd">${passedText}${skippedText}</div>
    </div>
</body>
</html>`;
}

// ===== PANEL ENTRY POINT =====

/**
 * Show provider test panel — always re-runs tests on open.
 * @param {Object} context - Extension context with dependencies
 */
async function showProviderTestPanel(context) {
    const { t } = context;

    const panel = panelManager.getOrCreatePanel({
        id:         'aiduinoProviderTest',
        title:      `🔌 ${t('providerTest.title')}`,
        viewColumn: vscode.ViewColumn.One
    });

    // Always re-run — no early return on existing panel
    panel.webview.html = generateLoadingHTML(t);

    try {
        const results = await runAllTests();
        panel.webview.html = generateResultsHTML(results, t);
    } catch (err) {
        panel.webview.html = generateResultsHTML({ loadError: err.message }, t);
    }
}

module.exports = { showProviderTestPanel };
