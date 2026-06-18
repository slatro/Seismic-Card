const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const CONTENT_CHANNEL_ID = process.env.CONTENT_CHANNEL_ID || 'YOUR_CONTENT_CHANNEL_ID';
const STATS_CHANNEL_ID = process.env.STATS_CHANNEL_ID || 'YOUR_STATS_CHANNEL_ID';
const GUILD_ID = process.env.GUILD_ID || '1343751435711414362';
const PORT = process.env.PORT || 3000;

// Database path
const DB_PATH = path.join(__dirname, 'database.json');

// Initialize database helper
function loadDb() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({}));
    }
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch (e) {
        console.error('Failed to load database.json, starting fresh', e);
        return {};
    }
}

function saveDb(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getUserStats(userId) {
    const db = loadDb();
    if (!db[userId]) {
        db[userId] = {
            messages: 0,
            tweets: 0,
            events: 0,
            arts: 0
        };
        saveDb(db);
    }
    return db[userId];
}

function updateUserStats(userId, updates) {
    const db = loadDb();
    if (!db[userId]) {
        db[userId] = { messages: 0, tweets: 0, events: 0, arts: 0 };
    }
    db[userId] = { ...db[userId], ...updates };
    saveDb(db);
    return db[userId];
}

// ─── Discord Bot Initialization ─────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`[Seismic Bot] Logged in as ${client.user.tag}!`);
    console.log(`[Seismic Bot] Content channel: ${CONTENT_CHANNEL_ID}`);
    console.log(`[Seismic Bot] Stats channel: ${STATS_CHANNEL_ID}`);
});

// Message listener to track user activity
client.on('messageCreate', (message) => {
    if (message.author.bot) {
        // If it's a bot message in the stats channel, check if it's the other bot posting user stats
        if (message.channelId === STATS_CHANNEL_ID) {
            parseStatsBotMessage(message);
        }
        return;
    }

    const userId = message.author.id;
    const stats = getUserStats(userId);

    // 1. Increment total messages
    stats.messages++;

    // 2. Increment tweet/content count if sent in #content channel
    if (message.channelId === CONTENT_CHANNEL_ID) {
        stats.tweets++;
    }

    updateUserStats(userId, stats);
});

// Parse other bot's stats output inside #stats channel
function parseStatsBotMessage(message) {
    // Look for user ID in the message content, embeds, or author mentions
    let targetUserId = null;

    // 1. Check if user is mentioned or ID is in content
    const mentionMatch = message.content.match(/<@!?(\d+)>/) || message.content.match(/\b(\d{17,19})\b/);
    if (mentionMatch) {
        targetUserId = mentionMatch[1];
    }

    // 2. Check embeds
    let textToSearch = message.content || '';
    if (message.embeds && message.embeds.length > 0) {
        message.embeds.forEach(embed => {
            if (embed.description) textToSearch += '\n' + embed.description;
            if (embed.title) textToSearch += '\n' + embed.title;
            if (embed.author && embed.author.name) textToSearch += '\n' + embed.author.name;
            
            // Check for mentions or raw IDs in fields
            if (embed.fields) {
                embed.fields.forEach(field => {
                    textToSearch += `\n${field.name} ${field.value}`;
                });
            }
        });
    }

    // Try to find mentioned user ID in embed content
    if (!targetUserId) {
        const embedIdMatch = textToSearch.match(/<@!?(\d+)>/) || textToSearch.match(/\b(\d{17,19})\b/);
        if (embedIdMatch) {
            targetUserId = embedIdMatch[1];
        }
    }

    if (!targetUserId) return; // Could not determine who the stats belong to

    // Regex parsing to capture stats
    // Example: "Events Joined: 12" or "Events: 12"
    const eventsMatch = textToSearch.match(/events?\s*(?:joined|completed)?\s*[:\-=]?\s*(\d+)/i);
    // Example: "Arts: 4" or "Art Count: 4"
    const artsMatch = textToSearch.match(/arts?\s*(?:count|created)?\s*[:\-=]?\s*(\d+)/i);
    // Example: "Total Messages: 1540" or "Messages: 1540" (in case they have it)
    const messagesMatch = textToSearch.match(/(?:total\s*)?messages?\s*[:\-=]?\s*(\d+)/i);

    const updates = {};
    if (eventsMatch) updates.events = parseInt(eventsMatch[1], 10);
    if (artsMatch) updates.arts = parseInt(artsMatch[1], 10);
    if (messagesMatch) updates.messages = parseInt(messagesMatch[1], 10);

    if (Object.keys(updates).length > 0) {
        console.log(`[Seismic Bot] Parsed stats for user ${targetUserId}:`, updates);
        updateUserStats(targetUserId, updates);
    }
}

// ─── Express API Server ─────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

async function fetchStatsFromChannelHistory(userId) {
    try {
        const statsChannel = await client.channels.fetch(STATS_CHANNEL_ID).catch(() => null);
        if (!statsChannel || !statsChannel.isTextBased()) return null;
        
        // Fetch last 100 messages to search for user's stats embed
        const messages = await statsChannel.messages.fetch({ limit: 100 });
        for (const msg of messages.values()) {
            if (!msg.author.bot) continue;
            
            let textToSearch = msg.content || '';
            if (msg.embeds && msg.embeds.length > 0) {
                msg.embeds.forEach(embed => {
                    if (embed.description) textToSearch += '\n' + embed.description;
                    if (embed.title) textToSearch += '\n' + embed.title;
                    if (embed.author && embed.author.name) textToSearch += '\n' + embed.author.name;
                    if (embed.fields) {
                        embed.fields.forEach(field => {
                            textToSearch += `\n${field.name} ${field.value}`;
                        });
                    }
                });
            }
            
            // Check if the stats embed belongs to this user ID
            if (textToSearch.includes(userId)) {
                const eventsMatch = textToSearch.match(/events?\s*(?:joined|completed)?\s*[:\-=]?\s*(\d+)/i);
                const artsMatch = textToSearch.match(/arts?\s*(?:count|created)?\s*[:\-=]?\s*(\d+)/i);
                const messagesMatch = textToSearch.match(/(?:total\s*)?messages?\s*[:\-=]?\s*(\d+)/i);
                
                const parsed = {};
                if (eventsMatch) parsed.events = parseInt(eventsMatch[1], 10);
                if (artsMatch) parsed.arts = parseInt(artsMatch[1], 10);
                if (messagesMatch) parsed.messages = parseInt(messagesMatch[1], 10);
                
                if (Object.keys(parsed).length > 0) {
                    return parsed;
                }
            }
        }
    } catch (err) {
        console.error('[Seismic Bot] Error scanning stats channel history:', err);
    }
    return null;
}

async function countUserTweetsFromHistory(userId) {
    try {
        const contentChannel = await client.channels.fetch(CONTENT_CHANNEL_ID).catch(() => null);
        if (!contentChannel || !contentChannel.isTextBased()) return 0;
        
        let count = 0;
        const messages = await contentChannel.messages.fetch({ limit: 100 });
        for (const msg of messages.values()) {
            if (msg.author.id === userId) {
                count++;
            }
        }
        return count;
    } catch (err) {
        console.error('[Seismic Bot] Error counting tweets from channel history:', err);
    }
    return 0;
}

// API route to get user stats
app.get('/api/stats/:userId', async (req, res) => {
    const userId = req.params.userId;
    const stats = getUserStats(userId);
    
    // Attempt to pull events, arts, and messages from stats channel embeds history
    const scannedStats = await fetchStatsFromChannelHistory(userId);
    if (scannedStats) {
        if (scannedStats.messages !== undefined) stats.messages = scannedStats.messages;
        if (scannedStats.events !== undefined) stats.events = scannedStats.events;
        if (scannedStats.arts !== undefined) stats.arts = scannedStats.arts;
    }
    
    // Count user messages in the content channel history as tweets
    const tweetCount = await countUserTweetsFromHistory(userId);
    if (tweetCount > 0) {
        stats.tweets = Math.max(stats.tweets || 0, tweetCount);
    }
    
    updateUserStats(userId, stats);
    res.json(stats);
});

// API route to get user member details and resolve role dynamically by name
app.get('/api/member/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }
        
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            return res.status(404).json({ error: 'Member not found in guild' });
        }
        
        // Find highest role by name/permissions
        let detectedRole = null;
        const roles = member.roles.cache.map(r => ({ id: r.id, name: r.name }));
        
        // 1. Check Administrator
        const hasAdmin = member.permissions.has('Administrator') || roles.some(r => r.name.toLowerCase() === 'administrator' || r.name.toLowerCase() === 'admin');
        if (hasAdmin) {
            detectedRole = 'administrator';
        }
        
        // 2. Check Leader
        if (!detectedRole) {
            const hasLeader = roles.some(r => r.name.toLowerCase() === 'leader');
            if (hasLeader) {
                detectedRole = 'leader';
            }
        }
        
        // 3. Check Magnitude roles (Magnitude 9.0 down to Magnitude 1.0)
        if (!detectedRole) {
            for (let i = 9; i >= 1; i--) {
                const searchName = `magnitude ${i}`;
                const hasMag = roles.some(r => {
                    const nameLower = r.name.toLowerCase();
                    return nameLower.includes(searchName) || nameLower === `mag ${i}` || nameLower === `magnitude${i}`;
                });
                if (hasMag) {
                    detectedRole = `mag${i}`;
                    break;
                }
            }
        }
        
        res.json({
            id: member.id,
            username: member.user.username,
            displayName: member.displayName,
            detectedRole: detectedRole,
            roles: roles
        });
    } catch (err) {
        console.error('Error fetching member details:', err);
        res.status(500).json({ error: err.message });
    }
});

// API route to manually update/reset a user's stats (for admin convenience)
app.post('/api/stats/:userId', (req, res) => {
    const userId = req.params.userId;
    const { messages, tweets, events, arts } = req.body;
    
    const updates = {};
    if (messages !== undefined) updates.messages = parseInt(messages, 10);
    if (tweets !== undefined) updates.tweets = parseInt(tweets, 10);
    if (events !== undefined) updates.events = parseInt(events, 10);
    if (arts !== undefined) updates.arts = parseInt(arts, 10);
    
    const stats = updateUserStats(userId, updates);
    res.json(stats);
});

app.listen(PORT, () => {
    console.log(`[Seismic Bot] HTTP API Server running on port ${PORT}`);
});

// Login bot (if token is provided)
if (TOKEN && TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
    client.login(TOKEN).catch(err => {
        console.error('Failed to log in to Discord client', err);
    });
} else {
    console.warn('[Seismic Bot] DISCORD_TOKEN is missing or not set. Running API Server only.');
}
