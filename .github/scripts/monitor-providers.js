#!/usr/bin/env node
/*
 * AI.duino - Provider Monitoring Script
 * Copyright 2026 Monster Maker
 * 
 * Monitors AI provider APIs for new models and changes
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const MONITOR_CONFIG = {
    providers: {
        openai: {
            name: 'ChatGPT/OpenAI',
            priority: 'high',
            endpoints: {
                models: 'https://api.openai.com/v1/models',
                blog: 'https://openai.com/blog/rss'
            },
            checkModels: true,
            checkBlog: true
        },
        anthropic: {
            name: 'Claude/Anthropic',
            priority: 'high',
            endpoints: {
                changelog: 'https://docs.anthropic.com/en/release-notes/api',
                blog: 'https://www.anthropic.com/news'
            },
            checkModels: false,  // Requires API key
            checkBlog: true
        },
        google: {
            name: 'Gemini/Google',
            priority: 'high',
            endpoints: {
                models: 'https://generativelanguage.googleapis.com/v1/models',
                blog: 'https://developers.googleblog.com/feeds/posts/default/-/Gemini%20API'
            },
            checkModels: false,  // Requires API key
            checkBlog: true
        },
        mistral: {
            name: 'Mistral',
            priority: 'medium',
            endpoints: {
                blog: 'https://mistral.ai/news'
            },
            checkModels: false,
            checkBlog: true
        },
        groq: {
            name: 'Groq',
            priority: 'medium',
            endpoints: {
                docs: 'https://console.groq.com/docs/models'
            },
            checkModels: false,
            checkBlog: false
        }
    }
};

const CACHE_FILE = 'provider-monitor-cache.json';
const RESULTS_FILE = 'monitor-results.json';
const LOG_FILE = 'monitor-log.txt';

// Logging
const log = [];
function logInfo(message) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] INFO: ${message}`;
    console.log(entry);
    log.push(entry);
}

function logError(message, error) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ERROR: ${message}${error ? ': ' + error.message : ''}`;
    console.error(entry);
    log.push(entry);
}

// Load cache
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        }
    } catch (error) {
        logError('Failed to load cache', error);
    }
    return {};
}

// Save cache
function saveCache(cache) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (error) {
        logError('Failed to save cache', error);
    }
}

// Fetch with retry
async function fetchWithRetry(url, headers = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, {
                headers,
                timeout: 10000,
                validateStatus: (status) => status < 500
            });
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// Check OpenAI models
async function checkOpenAI() {
    logInfo('Checking OpenAI models...');
    try {
        const response = await fetchWithRetry('https://api.openai.com/v1/models', {
            'User-Agent': 'AI.duino-Monitor/1.0'
        });
        
        if (response.status === 200 && response.data.data) {
            const models = response.data.data
                .filter(m => m.id.startsWith('gpt-'))
                .filter(m => {
                    const exclude = ['tts', 'whisper', 'dall-e', 'instruct', 'davinci', 'curie', 'babbage', 'ada', 'base'];
                    return !exclude.some(pattern => m.id.includes(pattern));
                })
                .map(m => m.id)
                .sort();
            
            logInfo(`Found ${models.length} OpenAI chat models`);
            return { success: true, models };
        }
    } catch (error) {
        logError('OpenAI check failed', error);
    }
    return { success: false, models: [] };
}

// Check RSS feed for recent updates
async function checkRSSFeed(url, providerName) {
    logInfo(`Checking RSS feed for ${providerName}...`);
    try {
        const Parser = require('rss-parser');
        const parser = new Parser();
        const feed = await parser.parseURL(url);
        
        if (feed.items && feed.items.length > 0) {
            // Get items from last 14 days
            const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
            const recentItems = feed.items.filter(item => {
                const itemDate = new Date(item.pubDate || item.isoDate);
                return itemDate.getTime() > twoWeeksAgo;
            });
            
            logInfo(`Found ${recentItems.length} recent items in ${providerName} feed`);
            return {
                success: true,
                items: recentItems.map(item => ({
                    title: item.title,
                    link: item.link,
                    date: item.pubDate || item.isoDate
                }))
            };
        }
    } catch (error) {
        logError(`RSS feed check failed for ${providerName}`, error);
    }
    return { success: false, items: [] };
}

// Compare results with cache
function detectChanges(current, cached, providerKey) {
    const changes = {
        newModels: [],
        removedModels: [],
        newBlogPosts: []
    };
    
    if (current.models && cached.models) {
        const currentSet = new Set(current.models);
        const cachedSet = new Set(cached.models);
        
        changes.newModels = [...currentSet].filter(m => !cachedSet.has(m));
        changes.removedModels = [...cachedSet].filter(m => !currentSet.has(m));
    }
    
    if (current.blogItems && cached.blogItems) {
        const cachedTitles = new Set(cached.blogItems.map(i => i.title));
        changes.newBlogPosts = current.blogItems.filter(i => !cachedTitles.has(i.title));
    }
    
    return changes;
}

// Generate GitHub issue body
function generateIssueBody(results) {
    let body = '## 🔔 AI Provider Updates Detected\n\n';
    body += `**Monitoring Date:** ${new Date().toISOString().split('T')[0]}\n\n`;
    
    let hasContent = false;
    
    // High priority providers first
    const priorities = ['high', 'medium', 'low'];
    
    for (const priority of priorities) {
        const providersInPriority = Object.entries(results).filter(
            ([key, data]) => MONITOR_CONFIG.providers[key]?.priority === priority
        );
        
        if (providersInPriority.length === 0) continue;
        
        for (const [providerKey, data] of providersInPriority) {
            const config = MONITOR_CONFIG.providers[providerKey];
            if (!data.changes) continue;
            
            const { newModels, removedModels, newBlogPosts } = data.changes;
            const hasChanges = newModels.length > 0 || removedModels.length > 0 || newBlogPosts.length > 0;
            
            if (!hasChanges) continue;
            
            hasContent = true;
            body += `### ${config.name}\n\n`;
            
            if (newModels.length > 0) {
                body += `#### ✨ New Models (${newModels.length})\n`;
                newModels.forEach(model => {
                    body += `- \`${model}\`\n`;
                });
                body += '\n';
            }
            
            if (removedModels.length > 0) {
                body += `#### ⚠️ Removed Models (${removedModels.length})\n`;
                removedModels.forEach(model => {
                    body += `- \`${model}\`\n`;
                });
                body += '\n';
            }
            
            if (newBlogPosts.length > 0) {
                body += `#### 📰 Recent Blog Posts (${newBlogPosts.length})\n`;
                newBlogPosts.forEach(post => {
                    body += `- [${post.title}](${post.link}) (${new Date(post.date).toLocaleDateString()})\n`;
                });
                body += '\n';
            }
        }
    }
    
    if (!hasContent) {
        body += '_No significant changes detected._\n\n';
    }
    
    body += '---\n\n';
    body += '### 📋 Next Steps\n\n';
    body += '1. Review new models and update `providerConfigs.js`\n';
    body += '2. Check pricing information if available\n';
    body += '3. Update `selectBest` and `fallback` configurations\n';
    body += '4. Update `staticModels` in `modelDiscovery`\n';
    body += '5. Test new models if you have API access\n\n';
    body += '_This issue was automatically created by the Provider Monitor workflow._';
    
    return body;
}

// Main monitoring function
async function monitor() {
    logInfo('Starting provider monitoring...');
    
    const cache = loadCache();
    const results = {};
    let hasAnyChanges = false;
    
    // Check each provider
    for (const [providerKey, config] of Object.entries(MONITOR_CONFIG.providers)) {
        logInfo(`Processing ${config.name}...`);
        
        const current = {
            timestamp: Date.now()
        };
        
        // Check models if enabled
        if (config.checkModels && providerKey === 'openai') {
            const modelResult = await checkOpenAI();
            if (modelResult.success) {
                current.models = modelResult.models;
            }
        }
        
        // Check blog/RSS if enabled
        if (config.checkBlog && config.endpoints.blog) {
            const blogResult = await checkRSSFeed(config.endpoints.blog, config.name);
            if (blogResult.success) {
                current.blogItems = blogResult.items;
            }
        }
        
        // Detect changes
        const cached = cache[providerKey] || {};
        const changes = detectChanges(current, cached, providerKey);
        
        if (changes.newModels.length > 0 || changes.removedModels.length > 0 || changes.newBlogPosts.length > 0) {
            hasAnyChanges = true;
            logInfo(`Changes detected for ${config.name}`);
        }
        
        results[providerKey] = {
            current,
            changes
        };
        
        // Update cache
        cache[providerKey] = current;
    }
    
    // Save results
    saveCache(cache);
    
    const output = {
        hasChanges: hasAnyChanges,
        timestamp: new Date().toISOString(),
        issueBody: generateIssueBody(results),
        results
    };
    
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(output, null, 2));
    fs.writeFileSync(LOG_FILE, log.join('\n'));
    
    logInfo(`Monitoring complete. Changes detected: ${hasAnyChanges}`);
    
    return output;
}

// Run
if (require.main === module) {
    monitor()
        .then(() => {
            logInfo('Monitor finished successfully');
            process.exit(0);
        })
        .catch(error => {
            logError('Monitor failed', error);
            process.exit(1);
        });
}

module.exports = { monitor };
