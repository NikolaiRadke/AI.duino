/*
 * AI.duino - Prompt Manager Module
 * Copyright 2025 Monster Maker
 *
 * Licensed under the Apache License, Version 2.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Built-in semantic anchors.
// - group: 'basic' (everyday, shown by default) | 'pro' (advanced code style) | 'agentic' (agent workflow)
// - labelKey: localized UI label (locale files)
// - expansion: English directive sent to the model (language-invariant, lives in code)
// - defaultEnabled: applies when the user has never toggled the anchor
const BUILTIN_ANCHORS = {
    // Basic code-style anchors
    'no-magic-numbers':  { group: 'basic', labelKey: 'anchors.noMagicNumbers',   expansion: 'No magic numbers',                      defaultEnabled: true },
    'beginner-comments': { group: 'basic', labelKey: 'anchors.beginnerComments', expansion: 'Beginner-friendly comments',            defaultEnabled: false },
    'non-blocking':      { group: 'basic', labelKey: 'anchors.nonBlocking',      expansion: 'Non-blocking code (avoid delay())',     defaultEnabled: true },
    'low-ram':           { group: 'basic', labelKey: 'anchors.lowRam',           expansion: 'Low memory footprint (SRAM-efficient)', defaultEnabled: true },
    'defensive':         { group: 'basic', labelKey: 'anchors.defensive',        expansion: 'Defensive programming',                 defaultEnabled: true },

    // Pro code-style anchors (advanced; default off, opt-in)
    'isr-safe':          { group: 'pro', labelKey: 'anchors.isrSafe',         expansion: 'Interrupt-safe: keep ISRs short, use volatile for shared variables, no Serial or delay inside interrupts', defaultEnabled: false },
    'no-dynamic-memory': { group: 'pro', labelKey: 'anchors.noDynamicMemory', expansion: 'Avoid dynamic memory allocation (no String, new or malloc); use fixed-size buffers', defaultEnabled: false },
    'fault-tolerant':    { group: 'pro', labelKey: 'anchors.faultTolerant',   expansion: 'Fault-tolerant: use timeouts and a watchdog, recover from hangs',                    defaultEnabled: false },
    'state-machine':     { group: 'pro', labelKey: 'anchors.stateMachine',    expansion: 'Structure logic as an explicit state machine instead of nested flags',               defaultEnabled: false },
    'fixed-width-types': { group: 'pro', labelKey: 'anchors.fixedWidthTypes', expansion: 'Use fixed-width integer types (uint8_t, int16_t, ...) instead of int',               defaultEnabled: false },
    'low-power':         { group: 'pro', labelKey: 'anchors.lowPower',        expansion: 'Power-efficient: use sleep modes and disable unused peripherals',                    defaultEnabled: false },
    'integer-math':      { group: 'pro', labelKey: 'anchors.integerMath',     expansion: 'Prefer integer math; avoid floating point where possible',                           defaultEnabled: false },

    // Agentic workflow anchors (only injected in agentic mode)
    'minimal-diff':      { group: 'agentic', labelKey: 'anchors.minimalDiff',    expansion: 'Make minimal, surgical changes; do not touch unrelated code',            defaultEnabled: false },
    'preserve-style':    { group: 'agentic', labelKey: 'anchors.preserveStyle',  expansion: 'Preserve the existing code formatting and conventions; do not reformat', defaultEnabled: false },
    'explain-changes':   { group: 'agentic', labelKey: 'anchors.explainChanges', expansion: 'End with a short summary of what was changed and why',                   defaultEnabled: false },
    'no-new-deps':       { group: 'agentic', labelKey: 'anchors.noNewDeps',      expansion: 'Do not add new libraries unless strictly necessary',                     defaultEnabled: false },
    'ask-first':         { group: 'agentic', labelKey: 'anchors.askFirst',       expansion: 'Ask before making large or destructive changes',                         defaultEnabled: false }
};

// Groups that apply to ordinary (non-agentic) code generation
const DEFAULT_GROUPS = ['basic', 'pro'];

class PromptManager {
    constructor() {
        this.currentLocale = 'en';
        this.customPromptsFile = null;
        this.backupFile = null;
        this.updateFilePaths();

        // Semantic anchors live in one locale-independent file (state only; expansions are in code)
        this.anchorsFile = path.join(os.homedir(), '.aiduino/.aiduino-anchors.json');
        this.anchorState = {};
        this.loadAnchors();
    }

    updateFilePaths() {
        this.customPromptsFile = path.join(os.homedir(), `.aiduino/.aiduino-custom-prompts-${this.currentLocale}.json`);
    }

    initialize(i18n, locale = 'en') {
        this.currentLocale = locale;
        this.updateFilePaths();
        this.defaultPrompts = i18n.prompts || {};
        this.customPrompts = null;
        this.loadCustomPrompts();
    }

    /**
     * Load custom prompts from file or create default structure
     */
    loadCustomPrompts() {
        if (!fs.existsSync(this.customPromptsFile)) {
            this.customPrompts = null;
            return false;
        }

        const content = fs.readFileSync(this.customPromptsFile, 'utf8');
        this.customPrompts = JSON.parse(content);

        // Validate structure and add missing prompts
        this.validateAndUpdateStructure();
        return true;
    }

    /**
     * Validate custom prompts structure and add missing default prompts
     */
    validateAndUpdateStructure() {
        if (!this.customPrompts || typeof this.customPrompts !== 'object') {
            this.customPrompts = {};
        }

        let updated = false;

        // Add missing prompts from defaults
        Object.keys(this.defaultPrompts).forEach(key => {
            if (!this.customPrompts.hasOwnProperty(key)) {
                this.customPrompts[key] = this.defaultPrompts[key];
                updated = true;
            }
        });

        // Save if updated
        if (updated) {
            this.saveCustomPrompts();
        }
    }

    /**
     * Get prompt - custom if available, otherwise default
     * @param {string} key - Prompt key
     * @param {...any} args - Arguments for string replacement
     * @returns {string} The prompt text
     */
    getPrompt(key, ...args) {
        let prompt = this.customPrompts?.[key] || this.defaultPrompts?.[key] || key;

        // Replace placeholders {0}, {1}, etc.
        if (typeof prompt === 'string' && args.length > 0) {
            prompt = prompt.replace(/{(\d+)}/g, (match, index) => {
                return args[parseInt(index)] || match;
            });
        }

        return prompt;
    }

    /**
     * Save custom prompts to file
     */
    saveCustomPrompts() {
        // Add metadata
        const dataToSave = {
            _metadata: {
                version: '1.0',
                created: new Date().toISOString(),
                description: 'AI.duino Custom Prompts - Edit with caution'
            },
            ...this.customPrompts
        };

        const content = JSON.stringify(dataToSave, null, 2);
        const tempFile = this.customPromptsFile + '.tmp';
        fs.writeFileSync(tempFile, content, { mode: 0o600 });
        fs.renameSync(tempFile, this.customPromptsFile);
        return true;
    }

    /**
     * Update a specific prompt
     * @param {string} key - Prompt key
     * @param {string} value - New prompt value
     */
    updatePrompt(key, value) {
        if (!this.customPrompts) {
            this.customPrompts = { ...this.defaultPrompts };
        }

        this.customPrompts[key] = value;
        this.saveCustomPrompts();
    }

    /**
     * Get all prompts for editor
     * @returns {Object} All prompts with metadata
     */
    getAllPrompts() {
        const prompts = this.customPrompts || this.defaultPrompts;
        return {
            isCustom: !!this.customPrompts,
            prompts: prompts || {},
            defaults: this.defaultPrompts || {}
        };
    }

    /**
     * Check if all custom prompts match defaults and delete file if so
     */
    cleanupIfUnchanged() {
        if (!this.customPrompts) return;

        const hasModifiedPrompts = Object.keys(this.customPrompts)
            .filter(k => k !== '_metadata')
            .some(k => this.customPrompts[k] !== this.defaultPrompts[k]);

        if (!hasModifiedPrompts) {
            // All prompts match defaults - delete file
            if (fs.existsSync(this.customPromptsFile)) {
                fs.unlinkSync(this.customPromptsFile);
            }
            this.customPrompts = null;
        }
    }

    // ===== SEMANTIC ANCHORS =====

    /**
     * Load anchor state (user overrides and custom anchors) from file
     */
    loadAnchors() {
        this.anchorState = {};
        try {
            if (fs.existsSync(this.anchorsFile)) {
                const data = JSON.parse(fs.readFileSync(this.anchorsFile, 'utf8'));
                this.anchorState = data.anchors || {};
            }
        } catch (error) {
            // Corrupt anchor file - fall back to built-in defaults
            this.anchorState = {};
        }
    }

    /**
     * Save anchor state to file (atomic write)
     */
    saveAnchors() {
        const dir = path.dirname(this.anchorsFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const dataToSave = {
            _metadata: {
                version: '1.0',
                description: 'AI.duino Semantic Anchors - user overrides and custom anchors'
            },
            anchors: this.anchorState
        };
        const tempFile = this.anchorsFile + '.tmp';
        fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), { mode: 0o600 });
        fs.renameSync(tempFile, this.anchorsFile);
        return true;
    }

    /**
     * Get merged anchor list (built-ins + custom) for UI and prompt building.
     * Built-in label is resolved via t(); expansion comes from code (English).
     * An untouched built-in falls back to its defaultEnabled value.
     * @param {Function} t - Translation function (optional)
     * @returns {Array<Object>}
     */
    getAnchors(t) {
        const list = [];

        // Built-in anchors
        Object.keys(BUILTIN_ANCHORS).forEach(key => {
            const def = BUILTIN_ANCHORS[key];
            const state = this.anchorState[key] || {};
            const enabled = (state.enabled === undefined)
                ? (def.defaultEnabled === true)
                : (state.enabled === true);
            list.push({
                key: key,
                group: def.group,
                label: t ? t(def.labelKey) : def.labelKey,
                expansion: state.expansion || def.expansion,
                enabled: enabled,
                custom: false,
                modified: typeof state.expansion === 'string'
            });
        });

        // Custom anchors
        Object.keys(this.anchorState).forEach(key => {
            if (BUILTIN_ANCHORS[key]) return;
            const state = this.anchorState[key];
            if (!state || !state.custom) return;
            list.push({
                key: key,
                group: state.group || 'basic',
                label: state.label || key,
                expansion: state.expansion || '',
                enabled: state.enabled === true,
                custom: true,
                modified: false
            });
        });

        return list;
    }

    /**
     * Concatenated English expansions of all active anchors in the given groups.
     * Returns '' when none are active.
     * @param {Function} t - Translation function
     * @param {string[]} groups - Which anchor groups to include
     * @returns {string}
     */
    getActiveAnchorText(t, groups = DEFAULT_GROUPS) {
        const active = this.getAnchors(t).filter(a =>
            a.enabled && a.expansion && groups.includes(a.group)
        );
        if (active.length === 0) return '';
        return active.map(a => '- ' + a.expansion).join('\n');
    }

    /**
     * Apply active semantic anchors to a finished prompt.
     * If the prompt contains a {anchors} placeholder, the directives are inserted there.
     * Otherwise, when append is true, they are appended at the end (used by the chat).
     * Returns the prompt unchanged when no anchors apply.
     * @param {string} prompt - The built prompt
     * @param {Function} t - Translation function
     * @param {boolean} append - Append directives when no {anchors} placeholder is present
     * @param {string[]} groups - Which anchor groups to include
     * @returns {string}
     */
    applyAnchors(prompt, t, append = false, groups = DEFAULT_GROUPS) {
        const anchorText = this.getActiveAnchorText(t, groups);
        const block = anchorText ? 'Follow these coding directives:\n' + anchorText : '';

        if (prompt.includes('{anchors}')) {
            return prompt.replace('{anchors}', block).replace(/\n{3,}/g, '\n\n');
        }

        if (append && block) {
            return prompt + '\n\n' + block;
        }

        return prompt;
    }

    /**
     * Enable or disable an anchor (built-in or custom)
     */
    toggleAnchor(key, enabled) {
        if (!this.anchorState[key]) {
            this.anchorState[key] = {};
        }
        this.anchorState[key].enabled = enabled === true;
        this.saveAnchors();
    }

    /**
     * Add a custom anchor. Generates a safe unique key from the label.
     * @returns {string} the generated key
     */
    addAnchor(label, expansion, group = 'basic') {
        const base = 'custom-' + String(label).toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        let key = base || 'custom';
        let i = 2;
        while (this.anchorState[key] || BUILTIN_ANCHORS[key]) {
            key = base + '-' + i++;
        }
        this.anchorState[key] = {
            custom: true,
            group: group,
            label: label,
            expansion: expansion,
            enabled: true
        };
        this.saveAnchors();
        return key;
    }

    /**
     * Override an expansion. For built-ins this stores a delta; for custom it edits in place.
     */
    overrideAnchorExpansion(key, expansion) {
        if (!this.anchorState[key]) {
            this.anchorState[key] = {};
        }
        this.anchorState[key].expansion = expansion;
        this.saveAnchors();
    }

    /**
     * Remove a custom anchor entirely, or clear a built-in's stored state.
     */
    removeAnchor(key) {
        if (this.anchorState[key]) {
            delete this.anchorState[key];
            this.saveAnchors();
        }
    }

    /**
     * Reset a built-in anchor's expansion override back to its default.
     * Keeps the enabled state. No effect on custom anchors.
     */
    resetAnchor(key) {
        const state = this.anchorState[key];
        if (state && !state.custom && typeof state.expansion === 'string') {
            delete state.expansion;
            if (Object.keys(state).length === 0) {
                delete this.anchorState[key];
            }
            this.saveAnchors();
        }
    }
}

module.exports = {
    PromptManager
};
