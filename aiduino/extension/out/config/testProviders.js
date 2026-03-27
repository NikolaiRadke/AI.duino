/**
 * AI.duino - Provider Configuration & Connectivity Test
 * 
 * Checks all providers in providerConfigs.js:
 *   1. Syntax: file loads without errors
 *   2. Structure: required fields, types, function signatures
 *   3. Ping: unauthenticated HTTPS request → 4xx = server alive, 5xx/timeout = problem
 *   4. Live (key found in ~/.aiduino/): model list fetch + fallback model validation
 * 
 * CLI providers:  binary existence check via which/where
 * HTTP providers: TCP port check on autoDetectUrls
 * 
 * Usage: node testProviders.js
 */

"use strict";

const https    = require('https');
const net      = require('net');
const fs       = require('fs');
const os       = require('os');
const path     = require('path');
const { execSync } = require('child_process');

// ===== OUTPUT HELPERS =====

const C = {
    reset:  '\x1b[0m',
    bold:   '\x1b[1m',
    red:    '\x1b[31m',
    green:  '\x1b[32m',
    yellow: '\x1b[33m',
    cyan:   '\x1b[36m'
};

const PASS = `${C.green}✔${C.reset}`;
const FAIL = `${C.red}✘${C.reset}`;
const INFO = `${C.cyan}ℹ${C.reset}`;
const SKIP = `${C.yellow}–${C.reset}`;

let totalPass = 0;
let totalFail = 0;
let totalSkip = 0;

function check(label, condition, hint = '') {
    if (condition) {
        console.log(`  ${PASS} ${label}`);
        totalPass++;
    } else {
        console.log(`  ${FAIL} ${label}${hint ? '  (' + hint + ')' : ''}`);
        totalFail++;
    }
}

function info(label) {
    console.log(`  ${INFO} ${label}`);
}

function skip(label) {
    console.log(`  ${SKIP} ${label}`);
    totalSkip++;
}

function section(title) {
    console.log(`\n${C.bold}[ ${title} ]${C.reset}`);
}

function banner(title) {
    console.log(`\n${C.bold}══ ${title} ══${C.reset}`);
}

// ===== NETWORK HELPERS =====

const HTTPS_TIMEOUT_MS = 6000;

/**
 * Makes a GET request over HTTPS and returns status code + parsed JSON body.
 * Resolves even on HTTP error codes; rejects only on network/timeout errors.
 */
function httpsGet(hostname, urlPath, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname,
            path:    urlPath,
            method:  'GET',
            headers: { 'User-Agent': 'AI.duino-test/1.0', ...headers },
            timeout: HTTPS_TIMEOUT_MS
        };

        const req = https.request(options, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                let data = null;
                try { data = JSON.parse(raw); } catch { /* non-JSON response */ }
                resolve({ status: res.statusCode, data });
            });
        });

        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.on('error',   reject);
        req.end();
    });
}

/**
 * TCP connect test — used for HTTP/local providers and hostname reachability.
 * Returns Promise<boolean>.
 */
function tcpPortOpen(host, port, timeoutMs = 2000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let done = false;

        const finish = (result) => {
            if (!done) { done = true; socket.destroy(); resolve(result); }
        };

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
        return {
            host: u.hostname,
            port: parseInt(u.port || (u.protocol === 'https:' ? 443 : 80))
        };
    } catch { return null; }
}

// ===== KEY READER =====

const AIDUINO_DIR = path.join(os.homedir(), '.aiduino');

/** Reads an API key from ~/.aiduino/<keyFile>. Returns null if missing or empty. */
function readKey(keyFile) {
    try {
        const filePath = path.join(AIDUINO_DIR, keyFile);
        if (!fs.existsSync(filePath)) return null;
        // Keys may be stored as "apikey|modelId" — extract key part only
        const key = fs.readFileSync(filePath, 'utf8').trim().split('|')[0].trim();
        return key.length > 0 ? key : null;
    } catch { return null; }
}

// ===== PROVIDER TYPE DETECTION =====

function getProviderType(cfg) {
    if (cfg.type !== 'local') return 'cloud';
    if (cfg.httpConfig)       return 'http';
    return 'cli';
}

// ===== SHARED STRUCTURAL CHECKS =====

function checkCommonFields(cfg) {
    check('name is a non-empty string',        typeof cfg.name === 'string' && cfg.name.length > 0);
    check('icon is a non-empty string',        typeof cfg.icon === 'string' && cfg.icon.length > 0);
    check('color is a valid hex color',        /^#[0-9A-Fa-f]{6}$/.test(cfg.color));
    check('keyFile is a non-empty string',     typeof cfg.keyFile === 'string' && cfg.keyFile.length > 0);
    check('fallback is a non-empty string',    typeof cfg.fallback === 'string' && cfg.fallback.length > 0);
    check('keyMinLength is a positive number', typeof cfg.keyMinLength === 'number' && cfg.keyMinLength > 0);
    check('prices.input >= 0',                 typeof cfg.prices?.input  === 'number' && cfg.prices.input  >= 0);
    check('prices.output >= 0',                typeof cfg.prices?.output === 'number' && cfg.prices.output >= 0);
}

function checkModelDiscovery(cfg) {
    const md = cfg.modelDiscovery;
    check('modelDiscovery exists',             !!md);
    if (!md) return;

    check('modelDiscovery.enabled is boolean', typeof md.enabled === 'boolean');
    check('staticModels is an array',          Array.isArray(md.staticModels));

    if (!Array.isArray(md.staticModels) || md.staticModels.length === 0) {
        info('staticModels intentionally empty — skipping fallback and model checks');
        return;
    }

    const first = md.staticModels[0];
    check('staticModels[0].id is a string',    typeof first.id   === 'string' && first.id.length   > 0);
    check('staticModels[0].name is a string',  typeof first.name === 'string' && first.name.length > 0);

    // fallback must appear in staticModels
    const fallbackInStatic = md.staticModels.some(m => m.id === cfg.fallback);
    check(`fallback '${cfg.fallback}' present in staticModels`, fallbackInStatic);

    if (typeof md.selectDefault === 'function') {
        try {
            const result = md.selectDefault(md.staticModels);
            check('selectDefault() returns a model', !!result);
        } catch (e) {
            check('selectDefault() does not throw', false, e.message);
        }
    }
}

// ===== CLOUD PROVIDER CHECKS =====

async function checkCloudProvider(key, cfg) {
    // --- Structure ---
    checkCommonFields(cfg);
    check('hostname is defined',  typeof cfg.hostname  === 'string' && cfg.hostname.length  > 0);
    check('apiKeyUrl is defined', typeof cfg.apiKeyUrl === 'string' && cfg.apiKeyUrl.startsWith('http'));
    check('path is defined',      typeof cfg.path      === 'string' && cfg.path.length      > 0);

    if (typeof cfg.headers === 'function') {
        try {
            const h = cfg.headers('TESTKEY');
            check('headers(key) returns an object', typeof h === 'object' && h !== null);
        } catch (e) {
            check('headers(key) does not throw', false, e.message);
        }
    } else {
        check('headers is a function', false);
    }

    const ac = cfg.apiConfig;
    check('apiConfig exists', !!ac);
    if (ac) {
        check('apiConfig.method is POST', ac.method === 'POST');

        if (typeof ac.buildRequest === 'function') {
            try {
                const req = ac.buildRequest('test-model', 'Hello', 'System');
                check('buildRequest() returns an object', typeof req === 'object' && req !== null);
            } catch (e) {
                check('buildRequest() does not throw', false, e.message);
            }
        }

        if (typeof ac.extractResponse === 'function') {
            // Try common response shapes: OpenAI, Anthropic, Gemini, Cohere, HuggingFace
            const dummies = [
                { choices: [{ message: { content: 'ok' } }] },
                { content: [{ text: 'ok' }] },
                { candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] },
                { text: 'ok' },
                [{ generated_text: 'ok' }]
            ];
            let extractOk = false;
            for (const d of dummies) {
                try {
                    const r = ac.extractResponse(d);
                    if (typeof r === 'string' && r.length > 0) { extractOk = true; break; }
                } catch { /* try next shape */ }
            }
            check('extractResponse() handles a known response shape', extractOk);
        }
    }

    checkModelDiscovery(cfg);

    // --- Ping (no key) ---
    // Gemini embeds the key in the URL path — strip it for the anonymous ping
    const pingPath = cfg.path.includes('?key=') ? cfg.path.split('?')[0] : cfg.path;

    let pingStatus = null;
    try {
        const result = await httpsGet(cfg.hostname, pingPath);
        pingStatus = result.status;
    } catch (e) {
        info(`Ping failed: ${e.message}`);
    }

    if (pingStatus !== null) {
        // 200 = public endpoint (e.g. OpenRouter models list)
        // 400/401/403 = auth required but server is alive — expected without key
        // 404/5xx = path wrong or server error
        const alive       = [200, 400, 401, 403].includes(pingStatus);
        const configIssue = pingStatus === 404 || pingStatus >= 500;
        check(
            `Ping ${cfg.hostname} → HTTP ${pingStatus}`,
            alive,
            configIssue ? 'unexpected status — check hostname/path' : ''
        );
    }

    // --- Live model check (key required) ---
    const apiKey = readKey(cfg.keyFile);

    if (!apiKey) {
        skip(`Live model check skipped — no key in ~/.aiduino/${cfg.keyFile}`);
        return;
    }

    info('Key found — running live model check');

    // Gemini appends key to URL; all others use Authorization headers
    const isGemini    = cfg.path.includes('?key=');
    const livePath    = isGemini ? cfg.path + apiKey : cfg.path;
    const liveHeaders = isGemini ? {} : cfg.headers(apiKey);

    let liveStatus = null;
    let liveData   = null;

    try {
        const result  = await httpsGet(cfg.hostname, livePath, liveHeaders);
        liveStatus = result.status;
        liveData   = result.data;
    } catch (e) {
        check('Live request completed', false, e.message);
        return;
    }

    check(
        `Live request HTTP ${liveStatus} (expected 200)`,
        liveStatus === 200,
        liveStatus === 401 ? 'key rejected' :
        liveStatus === 403 ? 'key unauthorized' :
        liveStatus === 429 ? 'rate limited' : ''
    );

    if (liveStatus !== 200 || !liveData) return;

    // Extract model list using provider's own extractor
    let models = [];
    if (typeof cfg.extractModels === 'function') {
        try {
            models = cfg.extractModels(liveData) || [];
        } catch (e) {
            check('extractModels() on live data does not throw', false, e.message);
            return;
        }
    }

    check(`Model list returned at least 1 model (got ${models.length})`, models.length > 0);

    if (models.length > 0) {
        // Models may expose .id, .name, or be plain strings depending on provider
        const fallbackFound = models.some(m =>
            m === cfg.fallback ||
            m.id   === cfg.fallback ||
            m.name === cfg.fallback
        );
        check(
            `Fallback model '${cfg.fallback}' found in live list`,
            fallbackFound,
            fallbackFound ? '' : 'model may have been renamed or removed'
        );

        if (typeof cfg.selectBest === 'function') {
            try {
                const best = cfg.selectBest(models);
                check('selectBest() returns a result on live data', !!best);
            } catch (e) {
                check('selectBest() does not throw on live data', false, e.message);
            }
        }
    }
}

// ===== CLI PROVIDER CHECKS =====

function checkCliProvider(key, cfg) {
    checkCommonFields(cfg);

    const pc = cfg.processConfig;
    check('processConfig exists',             !!pc);
    if (!pc) return;

    check('processConfig.command is defined', typeof pc.command === 'string' && pc.command.length > 0);

    // Binary availability — not a hard failure (may simply not be installed on this machine)
    if (typeof pc.command === 'string') {
        let found = false;
        try {
            const cmd = process.platform === 'win32' ? `where ${pc.command}` : `which ${pc.command}`;
            execSync(cmd, { stdio: 'ignore' });
            found = true;
        } catch { /* not installed */ }

        if (found) {
            console.log(`  ${PASS} Binary '${pc.command}' found on PATH`);
            totalPass++;
        } else {
            info(`Binary '${pc.command}' not found on PATH — not installed?`);
        }
    }

    if (typeof pc.buildArgs === 'function') {
        try {
            const args = pc.buildArgs('test prompt', {}, cfg.fallback);
            check('buildArgs() returns a non-empty array', Array.isArray(args) && args.length > 0);
        } catch (e) {
            check('buildArgs() does not throw', false, e.message);
        }
    } else {
        check('buildArgs is a function', false);
    }

    if (typeof pc.buildPrompt === 'function') {
        try {
            const p = pc.buildPrompt('test', {});
            check('buildPrompt() returns a string', typeof p === 'string');
        } catch (e) {
            check('buildPrompt() does not throw', false, e.message);
        }
    }

    checkModelDiscovery(cfg);
}

// ===== HTTP PROVIDER CHECKS =====

async function checkHttpProvider(key, cfg) {
    checkCommonFields(cfg);

    check('httpConfig exists',               !!cfg.httpConfig);
    check('httpConfig.endpoint is defined',  typeof cfg.httpConfig?.endpoint === 'string');
    check('autoDetectUrls is a non-empty array',
          Array.isArray(cfg.autoDetectUrls) && cfg.autoDetectUrls.length > 0);

    checkModelDiscovery(cfg);

    // TCP port check for each candidate URL
    if (Array.isArray(cfg.autoDetectUrls)) {
        for (const url of cfg.autoDetectUrls) {
            const parsed = parseUrl(url);
            if (!parsed) {
                check(`parseUrl(${url})`, false, 'could not parse URL');
                continue;
            }
            const open = await tcpPortOpen(parsed.host, parsed.port);
            if (open) {
                console.log(`  ${PASS} ${url} — port ${parsed.port} reachable`);
                totalPass++;
            } else {
                info(`${url} — port ${parsed.port} not reachable (service not running?)`);
            }
        }
    }
}

// ===== MAIN =====

async function runTests() {
    console.log(`${C.bold}\nAI.duino Provider Test${C.reset}`);
    console.log('════════════════════════════════════════');

    // --- Syntax check ---
    let PROVIDER_CONFIGS;
    try {
        ({ PROVIDER_CONFIGS } = require('./providerConfigs.js'));
        console.log(`${PASS} providerConfigs.js loaded successfully`);
        totalPass++;
    } catch (e) {
        console.log(`${FAIL} providerConfigs.js failed to load: ${e.message}`);
        totalFail++;
        process.exitCode = 1;
        return;
    }

    // --- Classify ---
    const cloud = [], cli = [], http = [];
    for (const [k, cfg] of Object.entries(PROVIDER_CONFIGS)) {
        switch (getProviderType(cfg)) {
            case 'cloud': cloud.push([k, cfg]); break;
            case 'cli':   cli.push([k, cfg]);   break;
            case 'http':  http.push([k, cfg]);  break;
        }
    }

    // --- Run ---
    banner('Cloud Providers');
    for (const [k, cfg] of cloud) {
        section(`${cfg.icon}  ${cfg.name}  (${k})`);
        await checkCloudProvider(k, cfg);
    }

    banner('CLI / Agentic Providers');
    for (const [k, cfg] of cli) {
        section(`${cfg.icon}  ${cfg.name}  (${k})`);
        checkCliProvider(k, cfg);
    }

    banner('HTTP / Local Providers');
    for (const [k, cfg] of http) {
        section(`${cfg.icon}  ${cfg.name}  (${k})`);
        await checkHttpProvider(k, cfg);
    }

    // --- Summary ---
    const total = totalPass + totalFail;
    console.log('\n════════════════════════════════════════');
    console.log(`${C.bold}Results: ${totalPass}/${total} checks passed` +
                (totalSkip > 0 ? `, ${totalSkip} skipped` : '') + C.reset);

    if (totalFail > 0) {
        console.log(`${C.red}${totalFail} check(s) failed.${C.reset}`);
        process.exitCode = 1;
    } else {
        console.log(`${C.green}All checks passed.${C.reset}`);
    }
    console.log('');
}

runTests().catch(err => {
    console.error('Test runner crashed:', err);
    process.exit(1);
});
