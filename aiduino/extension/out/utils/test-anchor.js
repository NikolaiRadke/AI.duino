const { PromptManager } = require('./promptManager');
const pm = new PromptManager();

pm.toggleAnchor('non-blocking', true);
const key = pm.addAnchor('My style', 'Use camelCase for all variables.');
pm.toggleAnchor(key, true);

console.log('Active text:\n' + pm.getActiveAnchorText());

// Reload from disk to verify persistence
const pm2 = new PromptManager();
console.log('\nPersisted anchors:', pm2.getAnchors().filter(a => a.enabled).map(a => a.key));
