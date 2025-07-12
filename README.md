# Discord Guard Bot

A Discord bot that automatically joins a specific voice channel when someone else joins it, acting as a "guard" for that channel.

## Features

- 🛡️ Automatically joins a specified voice channel when users enter
- 🚪 Optionally leaves when the channel becomes empty
- 🎛️ Slash commands for manual control
- 🔧 Easy configuration
- 📝 Comprehensive logging

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create a Discord Application:**
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to the "Bot" section and create a bot
   - Copy the bot token

3. **Get Required IDs:**
   - **Bot Token:** From the Discord Developer Portal
   - **Voice Channel ID:** Right-click on the voice channel → Copy ID
   - **Client ID:** From Discord Developer Portal → General Information
   - **Guild ID:** Right-click on your server → Copy ID

4. **Configure the bot:**
   - Copy `.env.example` to `.env`
   - Fill in your actual values in `index.js` CONFIG object

5. **Invite the bot to your server:**
   - Go to Discord Developer Portal → OAuth2 → URL Generator
   - Select scopes: `bot`, `applications.commands`
   - Select permissions: `Connect`, `Speak`, `Use Voice Activity`
   - Use the generated URL to invite the bot

6. **Deploy slash commands (optional):**
   ```bash
   node deploy-commands.js
   ```

7. **Run the bot:**
   ```bash
   npm start
   ```

## Configuration

Edit the `CONFIG` object in `index.js`:

```javascript
const CONFIG = {
    TOKEN: 'your_bot_token_here',
    GUARD_CHANNEL_ID: 'your_voice_channel_id_here',
    BOT_USER_ID: null // Auto-filled when bot starts
};
```

## Commands

- `/guard-join` - Manually make the bot join the guarded voice channel
- `/guard-leave` - Make the bot leave the voice channel

## Required Permissions

The bot needs these permissions:
- Connect (to join voice channels)
- Speak (to maintain voice connection)
- Use Voice Activity (for voice features)
- Use Slash Commands (for manual controls)

## How It Works

1. The bot listens for voice state changes
2. When someone joins the specified voice channel, the bot automatically joins
3. When the channel becomes empty, the bot leaves (optional feature)
4. The bot ignores its own voice state changes to prevent loops
```

Now let me create the installation script:

```bash
mkdir -p discord-bot && cd discord-bot
```

```bash
npm init -y
```

```bash
npm install discord.js @discordjs/voice
```

```bash
npm install --save-dev nodemon
```

## Setup Instructions:

1. **Get your bot token:**
   - Go to https://discord.com/developers/applications
   - Create a new application and bot
   - Copy the bot token

2. **Get the voice channel ID:**
   - Enable Developer Mode in Discord
   - Right-click on the voice channel you want to guard
   - Click "Copy ID"

3. **Configure the bot:**
   - Replace `YOUR_BOT_TOKEN_HERE` with your actual bot token
   - Replace `YOUR_VOICE_CHANNEL_ID_HERE` with the voice channel ID

4. **Invite the bot to your server with these permissions:**
   - Connect
   - Speak  
   - Use Voice Activity
   - Use Slash Commands

5. **Run the bot:**

```bash
node index.js
