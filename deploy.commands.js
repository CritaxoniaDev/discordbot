require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('athena-join')
        .setDescription('Make Athena join the guarded voice channel'),
    
    new SlashCommandBuilder()
        .setName('athena-leave')
        .setDescription('Make Athena leave the voice channel'),
    
    new SlashCommandBuilder()
        .setName('athena-status')
        .setDescription('Check Athena\'s voice connection status'),
    
    new SlashCommandBuilder()
        .setName('athena-follow')
        .setDescription('Make Athena join your current voice channel'),
    
    new SlashCommandBuilder()
        .setName('athena-guard')
        .setDescription('Toggle auto-guard mode on/off'),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log('🔄 Started refreshing application (/) commands.');

        // Replace YOUR_CLIENT_ID and YOUR_GUILD_ID with your actual IDs
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('✅ Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();
