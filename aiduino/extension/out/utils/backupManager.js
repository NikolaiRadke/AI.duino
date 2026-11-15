/*
 * AI.duino - Backup Manager
 * Copyright 2026 Monster Maker
 *
 * Licensed under the Apache License, Version 2.0
 *
 * Keeps exactly one snapshot per sketch: the code files before the last
 * agent run that changed code. Restoring brings back changed and deleted files
 * and removes files the agent created. Only code files are saved (sketch root
 * and src/). Snapshots live in ~/.aiduino/backups, outside the agent's reach.
 * Taken from Agentuino. Pure Node.js.
 */

"use strict";

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ===== CONSTANTS =====

const BACKUP_ROOT = path.join(os.homedir(), '.aiduino', 'backups');
const SNAPSHOT_DIR = 'snapshot';
// Kept during a run; comes back if the run changes no code
const PREVIOUS_DIR = 'previous';
const SNAPSHOT_FILES_DIR = 'files';
const SNAPSHOT_META = 'snapshot.json';
const SRC_DIR = 'src';
const JSON_INDENT = 2;
const FINGERPRINT_ALGORITHM = 'sha1';

// Files the Arduino build uses
const CODE_EXTENSIONS = new Set([
    '.ino', '.pde', '.h', '.hh', '.hpp', '.c', '.cc', '.cpp', '.cxx', '.s', '.tpp', '.ipp'
]);

// ===== HELPERS =====

/**
 * Get snapshot paths of a sketch
 * @param {string} sketchPath - Sketch folder
 * @returns {{dir: string, files: string, meta: string}} Paths
 */
function getSnapshotPaths(sketchPath) {
    // One folder per sketch, named after a hash of its path
    const id = crypto.createHash(FINGERPRINT_ALGORITHM).update(path.resolve(sketchPath)).digest('hex').slice(0, 16);
    const backups = path.join(BACKUP_ROOT, id);
    const dir = path.join(backups, SNAPSHOT_DIR);
    return {
        dir,
        previous: path.join(backups, PREVIOUS_DIR),
        files: path.join(dir, SNAPSHOT_FILES_DIR),
        meta: path.join(dir, SNAPSHOT_META)
    };
}

/**
 * Check whether a file name is a code file
 * @param {string} name - File name
 * @returns {boolean} True for code files
 */
function isCodeFile(name) {
    return CODE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

/**
 * Collect code files of a sketch: root (not recursive) and src/ (recursive)
 * @param {string} sketchPath - Sketch folder
 * @returns {string[]} Paths relative to the sketch folder (forward slashes)
 */
function collectCodeFiles(sketchPath) {
    const result = [];

    for (const entry of fs.readdirSync(sketchPath, { withFileTypes: true })) {
        if (entry.isFile() && isCodeFile(entry.name)) result.push(entry.name);
    }

    const walk = (dir, rel) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const entryRel = `${rel}/${entry.name}`;
            if (entry.isDirectory()) {
                walk(path.join(dir, entry.name), entryRel);
            } else if (entry.isFile() && isCodeFile(entry.name)) {
                result.push(entryRel);
            }
        }
    };
    const srcDir = path.join(sketchPath, SRC_DIR);
    if (fs.existsSync(srcDir)) walk(srcDir, SRC_DIR);

    return result.sort();
}

/**
 * Fingerprint of all code files (names and contents), to tell whether a run changed code
 * @param {string} sketchPath - Sketch folder
 * @returns {string} Hash
 */
function getCodeFingerprint(sketchPath) {
    const hash = crypto.createHash(FINGERPRINT_ALGORITHM);
    for (const rel of collectCodeFiles(sketchPath)) {
        hash.update(rel).update('\0');
        try {
            hash.update(fs.readFileSync(resolveRel(sketchPath, rel)));
        } catch {
            // A file deleted in the meantime counts as changed content
        }
        hash.update('\0');
    }
    return hash.digest('hex');
}

/**
 * Convert a relative path with forward slashes to an absolute path
 * @param {string} base - Base folder
 * @param {string} rel - Relative path
 * @returns {string} Absolute path
 */
function resolveRel(base, rel) {
    return path.join(base, ...rel.split('/'));
}

/**
 * Remove empty folders below src/ after deleting a file
 * @param {string} sketchPath - Sketch folder
 * @param {string} filePath - Deleted file
 */
function removeEmptyParents(sketchPath, filePath) {
    const srcDir = path.join(sketchPath, SRC_DIR);
    let dir = path.dirname(filePath);
    while (dir.startsWith(srcDir + path.sep) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
    }
}

// ===== PUBLIC API =====

/**
 * Save the current code files. The previous snapshot is kept aside until
 * settleSnapshot() knows whether the run changed code.
 * @param {string} sketchPath - Sketch folder
 * @param {Object} owner - Information about the run (stored with the snapshot)
 */
function createSnapshot(sketchPath, owner = {}) {
    const paths = getSnapshotPaths(sketchPath);
    fs.rmSync(paths.previous, { recursive: true, force: true });
    if (fs.existsSync(paths.dir)) fs.renameSync(paths.dir, paths.previous);

    const files = collectCodeFiles(sketchPath);
    for (const rel of files) {
        const target = resolveRel(paths.files, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(resolveRel(sketchPath, rel), target);
    }

    const meta = { ...owner, sketchPath: path.resolve(sketchPath), created: Date.now(), files };
    fs.mkdirSync(paths.dir, { recursive: true });
    fs.writeFileSync(paths.meta, JSON.stringify(meta, null, JSON_INDENT) + '\n', 'utf8');
}

/**
 * After a run: keep the new snapshot if code changed, otherwise bring back
 * the previous one, so a mere question does not lose the reset of the last change
 * @param {string} sketchPath - Sketch folder
 * @returns {boolean} True if the new snapshot was kept
 */
function settleSnapshot(sketchPath) {
    const paths = getSnapshotPaths(sketchPath);
    const plan = planRestore(sketchPath);
    const changed = !plan || plan.restore.length > 0 || plan.remove.length > 0;
    if (changed) {
        fs.rmSync(paths.previous, { recursive: true, force: true });
        return true;
    }
    fs.rmSync(paths.dir, { recursive: true, force: true });
    if (fs.existsSync(paths.previous)) fs.renameSync(paths.previous, paths.dir);
    return false;
}

/**
 * Get information about the snapshot
 * @param {string} sketchPath - Sketch folder
 * @returns {Object|null} {chatId, messageTime, created, files} or null
 */
function getSnapshot(sketchPath) {
    try {
        return JSON.parse(fs.readFileSync(getSnapshotPaths(sketchPath).meta, 'utf8'));
    } catch {
        return null;
    }
}

/**
 * Compare the current files with the snapshot
 * @param {string} sketchPath - Sketch folder
 * @returns {{restore: string[], remove: string[]}|null} Changed/deleted files to restore,
 *   new files to remove; null without snapshot
 */
function planRestore(sketchPath) {
    const meta = getSnapshot(sketchPath);
    if (!meta) return null;
    const paths = getSnapshotPaths(sketchPath);
    const current = collectCodeFiles(sketchPath);

    const restore = meta.files.filter(rel => {
        const file = resolveRel(sketchPath, rel);
        if (!fs.existsSync(file)) return true;
        return !fs.readFileSync(file).equals(fs.readFileSync(resolveRel(paths.files, rel)));
    });
    const remove = current.filter(rel => !meta.files.includes(rel));
    return { restore, remove };
}

/**
 * Restore the snapshot and delete it afterwards
 * @param {string} sketchPath - Sketch folder
 * @returns {{restore: string[], remove: string[]}|null} What was done
 */
function restoreSnapshot(sketchPath) {
    const plan = planRestore(sketchPath);
    if (!plan) return null;
    const paths = getSnapshotPaths(sketchPath);

    for (const rel of plan.restore) {
        const target = resolveRel(sketchPath, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(resolveRel(paths.files, rel), target);
    }
    for (const rel of plan.remove) {
        const target = resolveRel(sketchPath, rel);
        fs.unlinkSync(target);
        removeEmptyParents(sketchPath, target);
    }

    deleteSnapshot(sketchPath);
    return plan;
}

/**
 * Delete the snapshot
 * @param {string} sketchPath - Sketch folder
 */
function deleteSnapshot(sketchPath) {
    const paths = getSnapshotPaths(sketchPath);
    fs.rmSync(paths.dir, { recursive: true, force: true });
    fs.rmSync(paths.previous, { recursive: true, force: true });
}

module.exports = {
    createSnapshot,
    settleSnapshot,
    getSnapshot,
    planRestore,
    getCodeFingerprint,
    restoreSnapshot,
    deleteSnapshot
};
