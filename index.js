require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

// Add Express for Render keep-alive
const express = require('express');
const app = express();

// Health check endpoint for Render
app.get('/', (req, res) => {
    const uptime = Math.floor(process.uptime());
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤖 Athena Guard Bot</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #2c2f33; color: #ffffff; }
                .container { max-width: 600px; margin: 0 auto; }
                .status { background: #43b581; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .info { background: #7289da; padding: 15px; border-radius: 8px; margin: 10px 0; }
                .feature { background: #faa61a; padding: 10px; border-radius: 5px; margin: 5px 0; color: #2c2f33; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Athena Guard Bot Dashboard</h1>
                
                <div class="status">
                    <h2>✅ Status: ONLINE</h2>
                    <p><strong>Uptime:</strong> ${hours}h ${minutes}m ${seconds}s</p>
                    <p><strong>Connected Servers:</strong> ${client.guilds ? client.guilds.cache.size : 0}</p>
                    <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="info">
                    <h3>🛡️ Active Features</h3>
                    <div class="feature">🔍 Dynamic Channel Scanning: ${CONFIG.DYNAMIC_SCAN ? 'ENABLED' : 'DISABLED'}</div>
                    <div class="feature">🛡️ Auto-Guard Mode: ${CONFIG.AUTO_GUARD ? 'ENABLED' : 'DISABLED'}</div>
                    <div class="feature">🔍 Profanity Filter: ${PROFANITY_FILTER.settings.enabled ? 'ENABLED' : 'DISABLED'}</div>
                    <div class="feature">⏱️ Scan Interval: ${CONFIG.SCAN_INTERVAL / 1000} seconds</div>
                </div>
                
                <div class="info">
                    <h3>📊 System Info</h3>
                    <p><strong>Memory Usage:</strong> ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB</p>
                    <p><strong>Node Version:</strong> ${process.version}</p>
                    <p><strong>Platform:</strong> ${process.platform}</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        connectedGuilds: client.guilds ? client.guilds.cache.size : 0,
        features: {
            dynamicScan: CONFIG.DYNAMIC_SCAN,
            autoGuard: CONFIG.AUTO_GUARD,
            profanityFilter: PROFANITY_FILTER.settings.enabled
        },
        timestamp: new Date().toISOString()
    });
});

app.get('/stats', (req, res) => {
    const stats = {
        bot: {
            username: client.user ? client.user.username : 'Not Ready',
            id: client.user ? client.user.id : 'Not Ready',
            guilds: client.guilds ? client.guilds.cache.size : 0,
            uptime: process.uptime()
        },
        system: {
            memory: process.memoryUsage(),
            platform: process.platform,
            nodeVersion: process.version
        },
        config: {
            autoGuard: CONFIG.AUTO_GUARD,
            dynamicScan: CONFIG.DYNAMIC_SCAN,
            scanInterval: CONFIG.SCAN_INTERVAL,
            profanityFilter: PROFANITY_FILTER.settings.enabled
        }
    };
    
    res.json(stats);
});

// Start the web server for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Render web server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    GUARD_CHANNEL_ID: process.env.GUARD_CHANNEL_ID, // Keep this for profanity filter targeting
    BOT_USER_ID: null,
    AUTO_GUARD: true,
    DYNAMIC_SCAN: true, // New feature - scan all channels
    SCAN_INTERVAL: 30000, // Scan every 30 seconds
    EXCLUDED_CHANNELS: [] // Channels to ignore (can be configured)
};

// Load bad words and settings
let PROFANITY_FILTER = {
    badWords: [],
    settings: {
        enabled: true,
        caseSensitive: false,
        warningCount: 3,
        disconnectDuration: 300000,
        logViolations: true
    }
};

const userViolations = new Map();
let scanInterval = null;

// Load profanity filter data
function loadProfanityFilter() {
    try {
        const filePath = path.join(__dirname, 'badwords.json');
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            PROFANITY_FILTER = data;
            console.log(`✅ Loaded ${PROFANITY_FILTER.badWords.length} bad words from badwords.json`);
            console.log(`🛡️ Profanity filter: ${PROFANITY_FILTER.settings.enabled ? 'ENABLED' : 'DISABLED'}`);
        } else {
            console.log('⚠️ badwords.json not found, creating default file...');
            saveProfanityFilter();
        }
    } catch (error) {
        console.error('❌ Error loading profanity filter:', error);
    }
}

function saveProfanityFilter() {
    try {
        const filePath = path.join(__dirname, 'badwords.json');
        fs.writeFileSync(filePath, JSON.stringify(PROFANITY_FILTER, null, 2));
        console.log('✅ Profanity filter saved to badwords.json');
    } catch (error) {
        console.error('❌ Error saving profanity filter:', error);
    }
}

function containsProfanity(message) {
    if (!PROFANITY_FILTER.settings.enabled) return { hasProfanity: false };

    const text = PROFANITY_FILTER.settings.caseSensitive ? message : message.toLowerCase();
    const badWords = PROFANITY_FILTER.settings.caseSensitive ?
        PROFANITY_FILTER.badWords :
        PROFANITY_FILTER.badWords.map(word => word.toLowerCase());

    const foundWords = [];

    for (const badWord of badWords) {
        if (text.includes(badWord)) {
            foundWords.push(badWord);
        }
    }

    return {
        hasProfanity: foundWords.length > 0,
        foundWords: foundWords
    };
}

async function disconnectUserFromVoice(guild, userId, reason = 'Profanity violation') {
    try {
        const member = await guild.members.fetch(userId);
        if (member.voice.channel) {
            await member.voice.disconnect(reason);
            console.log(`🚫 Disconnected ${member.user.tag} from voice channel: ${reason}`);
            return true;
        } else {
            console.log(`⚠️ ${member.user.tag} is not in a voice channel`);
            return false;
        }
    } catch (error) {
        console.error('❌ Error disconnecting user:', error);
        return false;
    }
}

async function handleProfanityViolation(message, foundWords) {
    const userId = message.author.id;
    const guild = message.guild;

    if (!userViolations.has(userId)) {
        userViolations.set(userId, {
            count: 0,
            lastViolation: null,
            isDisconnected: false
        });
    }

    const userViolation = userViolations.get(userId);
    userViolation.count++;
    userViolation.lastViolation = new Date();

    console.log(`\n🚨 PROFANITY VIOLATION DETECTED!`);
    console.log(`👤 User: ${message.author.tag}`);
    console.log(`📝 Message: "${message.content}"`);
    console.log(`🔍 Bad words found: ${foundWords.join(', ')}`);
    console.log(`⚠️ Violation count: ${userViolation.count}/${PROFANITY_FILTER.settings.warningCount}`);

    try {
        await message.delete();
        console.log('🗑️ Deleted offensive message');
    } catch (error) {
        console.error('❌ Could not delete message:', error);
    }

    let warningMessage = `🚨 **${message.author.username}**, your message contained inappropriate language and has been deleted.\n`;
    warningMessage += `⚠️ Warning ${userViolation.count}/${PROFANITY_FILTER.settings.warningCount}\n`;

    if (userViolation.count >= PROFANITY_FILTER.settings.warningCount) {
        const disconnected = await disconnectUserFromVoice(guild, userId, 'Multiple profanity violations');

        if (disconnected) {
            userViolation.isDisconnected = true;
            warningMessage += `🚫 You have been disconnected from voice channels for ${PROFANITY_FILTER.settings.disconnectDuration / 60000} minutes due to repeated violations.`;

            setTimeout(() => {
                if (userViolations.has(userId)) {
                    const violation = userViolations.get(userId);
                    violation.isDisconnected = false;
                    violation.count = 0;
                    console.log(`✅ ${message.author.tag} violation timeout expired - reset violation count`);
                }
            }, PROFANITY_FILTER.settings.disconnectDuration);
        } else {
            warningMessage += `⚠️ Could not disconnect you from voice channel, but you have reached the maximum warnings.`;
        }
    } else {
        warningMessage += `💡 Please keep the chat clean. Further violations will result in voice disconnection.`;
    }

    try {
        await message.channel.send(warningMessage);
    } catch (error) {
        console.error('❌ Could not send warning message:', error);
    }

    if (PROFANITY_FILTER.settings.logViolations) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            userId: userId,
            username: message.author.tag,
            channelId: message.channel.id,
            channelName: message.channel.name,
            message: message.content,
            foundWords: foundWords,
            violationCount: userViolation.count,
            disconnected: userViolation.isDisconnected
        };

        try {
            const logPath = path.join(__dirname, 'profanity_violations.log');
            fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
        } catch (error) {
            console.error('❌ Error logging violation:', error);
        }
    }
}

// 🔍 DYNAMIC CHANNEL SCANNER - This is the new main feature!
async function scanAllChannelsForMembers() {
    if (!CONFIG.DYNAMIC_SCAN || !CONFIG.AUTO_GUARD) return;

    console.log('\n🔍 === DYNAMIC CHANNEL SCAN ===');

    for (const guild of client.guilds.cache.values()) {
        const voiceChannels = guild.channels.cache.filter(channel =>
            channel.type === 2 && // Voice channel
            !CONFIG.EXCLUDED_CHANNELS.includes(channel.id) // Not excluded
        );

        let foundActiveChannel = null;
        let maxMembers = 0;

        console.log(`🏠 Scanning ${guild.name}:`);

        // Find the channel with the most human members
        voiceChannels.forEach(channel => {
            const humanMembers = channel.members.filter(member => !member.user.bot);
            const totalMembers = channel.members.size;

            console.log(`   🔊 ${channel.name} - ${humanMembers.size} humans, ${totalMembers} total`);

            if (humanMembers.size > 0) {
                console.log(`      👥 Members: ${humanMembers.map(m => m.user.username).join(', ')}`);

                if (humanMembers.size > maxMembers) {
                    maxMembers = humanMembers.size;
                    foundActiveChannel = channel;
                }
            }
        });

        // Check current connection
        const currentConnection = getVoiceConnection(guild.id);
        const currentChannelId = currentConnection?.joinConfig?.channelId;

        if (foundActiveChannel) {
            console.log(`\n🎯 Most active channel: ${foundActiveChannel.name} (${maxMembers} humans)`);

            // Join if not already in this channel
            if (currentChannelId !== foundActiveChannel.id) {
                console.log(`🚀 Switching to active channel: ${foundActiveChannel.name}`);
                await autoJoinChannel(guild, foundActiveChannel.id, 'dynamic_scan');
            } else {
                console.log(`✅ Already in the most active channel`);
            }
        } else {
            console.log(`❌ No active channels found`);

            // Leave if currently connected and no one is around
            if (currentConnection) {
                const currentChannel = guild.channels.cache.get(currentChannelId);
                if (currentChannel) {
                    const humanMembers = currentChannel.members.filter(member => !member.user.bot);
                    if (humanMembers.size === 0) {
                        console.log(`🚪 Leaving empty channel: ${currentChannel.name}`);
                        await autoLeaveChannel(guild.id);
                    }
                }
            }
        }
    }

    console.log('🔍 Dynamic scan complete\n');
}

// Start dynamic scanning
function startDynamicScanning() {
    if (scanInterval) {
        clearInterval(scanInterval);
    }

    if (CONFIG.DYNAMIC_SCAN && CONFIG.AUTO_GUARD) {
        console.log(`🔄 Starting dynamic channel scanning every ${CONFIG.SCAN_INTERVAL / 1000} seconds`);
        scanInterval = setInterval(scanAllChannelsForMembers, CONFIG.SCAN_INTERVAL);
    }
}

// Stop dynamic scanning
function stopDynamicScanning() {
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
        console.log('⏹️ Stopped dynamic channel scanning');
    }
}

loadProfanityFilter();

client.once('ready', async () => {
    console.log(`✅ Athena is ready! Logged in as ${client.user.tag}`);
    CONFIG.BOT_USER_ID = client.user.id;
    console.log(`🛡️ Primary guard channel ID: ${CONFIG.GUARD_CHANNEL_ID}`);
    console.log(`🤖 Auto-guard mode: ${CONFIG.AUTO_GUARD ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🔍 Dynamic scanning: ${CONFIG.DYNAMIC_SCAN ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🔍 Profanity filter: ${PROFANITY_FILTER.settings.enabled ? 'ENABLED' : 'DISABLED'}`);

    // Register slash commands
    try {
        const commands = [
            {
                name: 'athena-join',
                description: 'Make Athena join the primary guarded voice channel'
            },
            {
                name: 'athena-leave',
                description: 'Make Athena leave the voice channel'
            },
            {
                name: 'athena-status',
                description: 'Check Athena\'s voice connection and scanning status'
            },
            {
                name: 'athena-follow',
                description: 'Make Athena join your current voice channel'
            },
            {
                name: 'athena-guard',
                description: 'Toggle auto-guard mode on/off'
            },
            {
                name: 'athena-scan',
                description: 'Toggle dynamic channel scanning on/off'
            },
            {
                name: 'athena-filter',
                description: 'Toggle profanity filter on/off'
            },
            {
                name: 'athena-violations',
                description: 'Check violation status of users'
            },
            {
                name: 'athena-force-scan',
                description: 'Force an immediate channel scan'
            }
        ];

        await client.application.commands.set(commands);
        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('❌ Failed to register slash commands:', error);
    }

    // Initial channel scan and display
    console.log('\n📋 Initial channel scan...');
    client.guilds.cache.forEach(guild => {
        console.log(`\n🏠 Server: ${guild.name}`);
        const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2);
        voiceChannels.forEach(channel => {
            const humanMembers = channel.members.filter(member => !member.user.bot);
            const totalMembers = channel.members.size;

            console.log(`   🔊 ${channel.name} - ID: ${channel.id} (${humanMembers.size} humans, ${totalMembers} total)`);

            if (channel.id === CONFIG.GUARD_CHANNEL_ID) {
                console.log('   ⭐ THIS IS THE PRIMARY GUARD CHANNEL!');
            }

            if (humanMembers.size > 0) {
                console.log(`   👥 Active members: ${humanMembers.map(m => m.user.username).join(', ')}`);
            }
        });
    });

    console.log('\n🎯 Athena will dynamically scan and join channels with members!');
    console.log('🎯 Athena will automatically switch to the most active channel!');
    console.log('🔍 Profanity filter monitors messages from voice channel users!\n');

    // Start dynamic scanning
    startDynamicScanning();

    setTimeout(() => {
        scanAllChannelsForMembers();
    }, 3000);
});

// Monitor messages for profanity (only from users in voice channels)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!PROFANITY_FILTER.settings.enabled) return;

    const member = message.member;
    if (!member || !member.voice.channel) {
        return; // Only monitor messages from users in ANY voice channel
    }

    const profanityCheck = containsProfanity(message.content);
    if (profanityCheck.hasProfanity) {
        await handleProfanityViolation(message, profanityCheck.foundWords);
    }
});

// Enhanced voice state monitoring
client.on('voiceStateUpdate', (oldState, newState) => {
    if (!CONFIG.AUTO_GUARD) return;

    // Someone joined ANY voice channel
    const someoneJoinedVoice = (
        newState.channelId &&
        oldState.channelId !== newState.channelId &&
        newState.member.id !== CONFIG.BOT_USER_ID
    );

    // Someone left ANY voice channel
    const someoneLeftVoice = (
        oldState.channelId &&
        newState.channelId !== oldState.channelId &&
        oldState.member.id !== CONFIG.BOT_USER_ID
    );

    if (someoneJoinedVoice) {
        const channel = newState.guild.channels.cache.get(newState.channelId);
        console.log(`\n🔔 ${newState.member.user.tag} joined voice channel: ${channel?.name || 'Unknown'}`);

        if (CONFIG.DYNAMIC_SCAN) {
            console.log('🔍 Triggering immediate scan due to voice activity...');
            // Trigger scan after a short delay to let Discord update
            setTimeout(() => {
                scanAllChannelsForMembers();
            }, 2000);
        }
    }

    if (someoneLeftVoice) {
        const channel = oldState.guild.channels.cache.get(oldState.channelId);
        console.log(`\n👋 ${oldState.member.user.tag} left voice channel: ${channel?.name || 'Unknown'}`);

        if (CONFIG.DYNAMIC_SCAN) {
            console.log('🔍 Triggering immediate scan due to voice activity...');
            // Trigger scan after a short delay
            setTimeout(() => {
                scanAllChannelsForMembers();
            }, 2000);
        }
    }
});

// Generic auto-join function for any channel
async function autoJoinChannel(guild, channelId, reason = 'unknown') {
    try {
        console.log(`🚀 === AUTO-JOIN SEQUENCE (${reason.toUpperCase()}) ===`);

        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            console.error('❌ Target channel not found!');
            return;
        }

        console.log(`✅ Target channel: ${channel.name}`);

        const humanMembers = channel.members.filter(member => !member.user.bot);
        const botMembers = channel.members.filter(member => member.user.bot);

        console.log(`👤 Humans (${humanMembers.size}): ${humanMembers.map(m => m.user.username).join(', ')}`);
        console.log(`🤖 Bots (${botMembers.size}): ${botMembers.map(m => m.user.username).join(', ')}`);

        const existingConnection = getVoiceConnection(guild.id);
        if (existingConnection && existingConnection.joinConfig.channelId === channelId) {
            console.log('🔗 Already connected to this channel');
            return;
        }

        if (existingConnection) {
            console.log('🔄 Disconnecting from current channel...');
            existingConnection.destroy();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const permissions = channel.permissionsFor(guild.members.me);
        if (!permissions.has('Connect')) {
            console.error('❌ No permission to connect to this channel!');
            return;
        }

        console.log('🎵 Joining voice channel...');

        const connection = joinVoiceChannel({
            channelId: channelId,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false,
        });

        console.log(`🛡️ Athena joined ${channel.name} (${reason})!`);

        connection.on('stateChange', (oldState, newState) => {
            console.log(`🔄 Connection: ${oldState.status} -> ${newState.status}`);
            if (newState.status === VoiceConnectionStatus.Ready) {
                console.log('✅ Successfully connected and guarding!');
            }
        });

        connection.on('error', (error) => {
            console.error('❌ Connection error:', error);
        });

    } catch (error) {
        console.error('❌ Auto-join failed:', error);
    }
}

// Generic auto-leave function
async function autoLeaveChannel(guildId) {
    try {
        console.log(`🚪 === AUTO-LEAVE SEQUENCE ===`);

        const connection = getVoiceConnection(guildId);
        if (!connection) {
            console.log('❌ No connection to leave');
            return;
        }

        console.log('🚪 Athena is leaving voice channel...');
        connection.destroy();

        console.log('✅ Successfully left voice channel');

    } catch (error) {
        console.error('❌ Auto-leave failed:', error);
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        await interaction.deferReply();

        switch (interaction.commandName) {
            case 'athena-join':
                console.log(`🎮 Manual join command from ${interaction.user.tag}`);
                const joinResult = await manualJoinChannel(interaction.guild, CONFIG.GUARD_CHANNEL_ID);
                await interaction.editReply(joinResult.message);
                break;

            case 'athena-leave':
                console.log(`🎮 Manual leave command from ${interaction.user.tag}`);
                const leaveResult = await manualLeaveChannel(interaction.guild.id);
                await interaction.editReply(leaveResult.message);
                break;

            case 'athena-status':
                const connection = getVoiceConnection(interaction.guild.id);
                const currentChannelId = connection?.joinConfig?.channelId;
                const currentChannel = currentChannelId ? interaction.guild.channels.cache.get(currentChannelId) : null;

                let statusMessage = `🤖 **Athena Dynamic Guard Status**\n\n`;
                statusMessage += `🛡️ Auto-guard: **${CONFIG.AUTO_GUARD ? 'ENABLED' : 'DISABLED'}**\n`;
                statusMessage += `🔍 Dynamic scanning: **${CONFIG.DYNAMIC_SCAN ? 'ENABLED' : 'DISABLED'}**\n`;
                statusMessage += `🔍 Profanity filter: **${PROFANITY_FILTER.settings.enabled ? 'ENABLED' : 'DISABLED'}**\n`;
                statusMessage += `🔗 Voice connection: **${connection ? 'CONNECTED' : 'DISCONNECTED'}**\n`;

                if (currentChannel) {
                    const humanMembers = currentChannel.members.filter(m => !m.user.bot);
                    statusMessage += `🎯 Current channel: **${currentChannel.name}**\n`;
                    statusMessage += `👥 Humans in current channel: **${humanMembers.size}**\n`;

                    if (humanMembers.size > 0) {
                        statusMessage += `\n👤 Current members:\n`;
                        humanMembers.forEach(member => {
                            statusMessage += `   - ${member.user.username}\n`;
                        });
                    }
                } else {
                    statusMessage += `🎯 Current channel: **None**\n`;
                }

                statusMessage += `\n⏱️ Scan interval: **${CONFIG.SCAN_INTERVAL / 1000} seconds**`;

                await interaction.editReply(statusMessage);
                break;

            case 'athena-follow':
                const userChannel = interaction.member.voice.channel;
                if (!userChannel) {
                    await interaction.editReply('❌ You need to be in a voice channel for me to follow you!');
                    return;
                }

                console.log(`🎮 Follow command: ${interaction.user.tag} -> ${userChannel.name}`);
                const followResult = await manualJoinChannel(interaction.guild, userChannel.id);
                await interaction.editReply(`🏃‍♀️ Following you to **${userChannel.name}**!\n${followResult.message}`);
                break;

            case 'athena-guard':
                CONFIG.AUTO_GUARD = !CONFIG.AUTO_GUARD;
                console.log(`🎮 Auto-guard toggled: ${CONFIG.AUTO_GUARD ? 'ON' : 'OFF'}`);

                if (CONFIG.AUTO_GUARD) {
                    startDynamicScanning();
                } else {
                    stopDynamicScanning();
                }

                let guardMessage = `🛡️ Auto-guard mode is now **${CONFIG.AUTO_GUARD ? 'ENABLED' : 'DISABLED'}**\n\n`;

                if (CONFIG.AUTO_GUARD) {
                    guardMessage += `✅ Athena will dynamically scan all voice channels\n`;
                    guardMessage += `✅ Athena will automatically join channels with members\n`;
                    guardMessage += `✅ Athena will switch to the most active channel\n`;
                    guardMessage += `✅ Athena will leave when all channels are empty`;
                } else {
                    guardMessage += `❌ Athena will NOT automatically join/leave\n`;
                    guardMessage += `❌ Dynamic scanning is stopped\n`;
                    guardMessage += `💡 Use manual commands to control Athena`;
                }

                await interaction.editReply(guardMessage);
                break;

            case 'athena-scan':
                CONFIG.DYNAMIC_SCAN = !CONFIG.DYNAMIC_SCAN;
                console.log(`🎮 Dynamic scanning toggled: ${CONFIG.DYNAMIC_SCAN ? 'ON' : 'OFF'}`);

                if (CONFIG.DYNAMIC_SCAN && CONFIG.AUTO_GUARD) {
                    startDynamicScanning();
                } else {
                    stopDynamicScanning();
                }

                let scanMessage = `🔍 Dynamic channel scanning is now **${CONFIG.DYNAMIC_SCAN ? 'ENABLED' : 'DISABLED'}**\n\n`;

                if (CONFIG.DYNAMIC_SCAN) {
                    scanMessage += `✅ Scanning all voice channels every ${CONFIG.SCAN_INTERVAL / 1000} seconds\n`;
                    scanMessage += `✅ Automatically joining channels with members\n`;
                    scanMessage += `✅ Switching to most active channels\n`;
                    scanMessage += `✅ Responding to voice state changes instantly`;
                } else {
                    scanMessage += `❌ Not scanning channels automatically\n`;
                    scanMessage += `💡 Athena will stay in current channel`;
                }

                await interaction.editReply(scanMessage);
                break;

            case 'athena-force-scan':
                console.log(`🎮 Force scan command from ${interaction.user.tag}`);
                await interaction.editReply('🔍 **Forcing immediate channel scan...**');

                await scanAllChannelsForMembers();

                const connection2 = getVoiceConnection(interaction.guild.id);
                const currentChannelId2 = connection2?.joinConfig?.channelId;
                const currentChannel2 = currentChannelId2 ? interaction.guild.channels.cache.get(currentChannelId2) : null;

                let scanResult = '✅ **Scan completed!**\n\n';
                if (currentChannel2) {
                    const humanMembers2 = currentChannel2.members.filter(m => !m.user.bot);
                    scanResult += `🎯 Athena is now in: **${currentChannel2.name}**\n`;
                    scanResult += `👥 Humans in channel: **${humanMembers2.size}**`;
                } else {
                    scanResult += `🎯 Athena is not in any voice channel\n`;
                    scanResult += `❌ No active channels found`;
                }

                await interaction.editReply(scanResult);
                break;

            case 'athena-filter':
                PROFANITY_FILTER.settings.enabled = !PROFANITY_FILTER.settings.enabled;
                saveProfanityFilter();
                console.log(`🎮 Profanity filter toggled: ${PROFANITY_FILTER.settings.enabled ? 'ON' : 'OFF'}`);

                let filterMessage = `🔍 Profanity filter is now **${PROFANITY_FILTER.settings.enabled ? 'ENABLED' : 'DISABLED'}**\n\n`;

                if (PROFANITY_FILTER.settings.enabled) {
                    filterMessage += `✅ Monitoring messages from users in ANY voice channel\n`;
                    filterMessage += `✅ Bad words will be deleted and users warned\n`;
                    filterMessage += `✅ Users will be disconnected after ${PROFANITY_FILTER.settings.warningCount} violations\n`;
                    filterMessage += `📊 Loaded ${PROFANITY_FILTER.badWords.length} bad words`;
                } else {
                    filterMessage += `❌ Not monitoring messages for profanity\n`;
                    filterMessage += `💡 Users can say anything without consequences`;
                }

                await interaction.editReply(filterMessage);
                break;

            case 'athena-violations':
                let violationsMessage = `📊 **User Violation Status**\n\n`;

                if (userViolations.size === 0) {
                    violationsMessage += `✅ No violations recorded yet!`;
                } else {
                    violationsMessage += `⚠️ Users with violations:\n\n`;

                    for (const [userId, violation] of userViolations.entries()) {
                        try {
                            const user = await interaction.client.users.fetch(userId);
                            violationsMessage += `👤 **${user.username}**\n`;
                            violationsMessage += `   - Violations: ${violation.count}/${PROFANITY_FILTER.settings.warningCount}\n`;
                            violationsMessage += `   - Last violation: ${violation.lastViolation ? violation.lastViolation.toLocaleString() : 'Never'}\n`;
                            violationsMessage += `   - Status: ${violation.isDisconnected ? '🚫 Disconnected' : '✅ Active'}\n\n`;
                        } catch (error) {
                            violationsMessage += `👤 **Unknown User (${userId})**\n`;
                            violationsMessage += `   - Violations: ${violation.count}/${PROFANITY_FILTER.settings.warningCount}\n\n`;
                        }
                    }
                }

                await interaction.editReply(violationsMessage);
                break;
        }
    } catch (error) {
        console.error('❌ Command error:', error);
        if (interaction.deferred) {
            await interaction.editReply('❌ Command failed - check console for details');
        }
    }
});

async function manualJoinChannel(guild, channelId) {
    try {
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            return { success: false, message: '❌ Voice channel not found!' };
        }

        const existingConnection = getVoiceConnection(guild.id);
        if (existingConnection) {
            existingConnection.destroy();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const connection = joinVoiceChannel({
            channelId: channelId,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false,
        });

        return {
            success: true,
            message: `🎵 Manually joined **${channel.name}**!`
        };

    } catch (error) {
        console.error('❌ Manual join error:', error);
        return {
            success: false,
            message: '❌ Failed to join voice channel!'
        };
    }
}

async function manualLeaveChannel(guildId) {
    try {
        const connection = getVoiceConnection(guildId);
        if (!connection) {
            return {
                success: false,
                message: '❌ Not connected to any voice channel!'
            };
        }

        connection.destroy();

        return {
            success: true,
            message: '🚪 Manually left the voice channel!'
        };

    } catch (error) {
        console.error('❌ Manual leave error:', error);
        return {
            success: false,
            message: '❌ Failed to leave voice channel!'
        };
    }
}

client.on('error', console.error);
client.on('warn', console.warn);

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Athena...');
    stopDynamicScanning();
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Athena...');
    stopDynamicScanning();
    client.destroy();
    process.exit(0);
});

console.log('🚀 Starting Athena Dynamic Guard Bot...');
console.log('🔍 Features: Dynamic Channel Scanning + Profanity Filter');
client.login(CONFIG.TOKEN);

