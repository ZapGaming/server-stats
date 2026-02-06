require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActivityType 
} = require('discord.js');
const express = require('express');
const axios = require('axios');

/**
 * 1. RENDER WEB SERVER (CRITICAL)
 * Render kills any process that doesn't bind to a port within 90s.
 */
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.status(200).send('Chillax Core: Online'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RENDER] Health check active on port ${PORT}`);
});

/**
 * 2. BOT INITIALIZATION
 */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // Needed for AI auto-replies
    ]
});

/**
 * 3. COMMAND BUILDER
 * Every option MUST have a description to pass v14 validation.
 */
const commands = [
    new SlashCommandBuilder()
        .setName('chillax')
        .setDescription('Theme resources and installation help'),
    new SlashCommandBuilder()
        .setName('css')
        .setDescription('Get specific Vencord CSS snippets')
        .addStringOption(opt => 
            opt.setName('element')
                .setDescription('Element to theme (e.g. search, nitro, font)')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask the AI about theme development')
        .addStringOption(opt => 
            opt.setName('query')
                .setDescription('Your question')
                .setRequired(true))
].map(cmd => cmd.toJSON());

/**
 * 4. AI ENGINE (OpenRouter)
 */
async function getAIResponse(prompt, user) {
    try {
        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "google/gemini-2.0-flash-001",
            messages: [
                { 
                    role: "system", 
                    content: "You are the Chillax Theme Assistant. Provide Vencord-compatible CSS. Use selectors like .container_e40c16 or [aria-label='User Settings']. FAQ: https://chillax.inmoresentum.net/vencordfaq.html" 
                },
                { role: "user", content: `${user} asks: ${prompt}` }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
        });
        return res.data.choices[0].message.content;
    } catch (e) {
        return "⚠️ Assistant offline. Visit: https://chillax.inmoresentum.net/vencordfaq.html";
    }
}

/**
 * 5. EVENTS & REGISTRATION
 */
client.once('ready', async () => {
    console.log(`[BOT] Logged in as ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        // Register to specific Guild if ID exists (Instant sync)
        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
                { body: commands }
            );
            console.log(`[BOT] Guild commands synced to ${process.env.GUILD_ID}`);
        }
        
        // Register Global commands (1-hour delay)
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[BOT] Global commands registered.');
    } catch (err) {
        console.error('[ERR] Registration failed:', err);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'chillax') {
        const embed = new EmbedBuilder()
            .setTitle('Chillax Vencord Theme')
            .setColor('#2ECC71')
            .setDescription('The ultimate clean Discord experience.')
            .addFields(
                { name: 'Import URL', value: '`https://inmoresentum.github.io/Chillax/chillax.css`' },
                { name: 'Official FAQ', value: 'https://chillax.inmoresentum.net/vencordfaq.html' }
            );
        return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'css') {
        const element = interaction.options.getString('element').toLowerCase();
        
        // FIXED: Using backticks (`) for multi-line strings
        let snippet = `/* Chillax Snippet: ${element} */\n`;
        
        if (element.includes('search')) {
            snippet += `.searchBar_f0963d { display: none; }`;
        } else if (element.includes('nitro')) {
            snippet += `[aria-label="Send a gift"] { display: none; }`;
        } else {
            snippet += `/* No direct snippet found. Try using /ask for specific CSS. */`;
        }

        return interaction.reply(`\`\`\`css\n${snippet}\n\`\`\``);
    }

    if (interaction.commandName === 'ask') {
        await interaction.deferReply();
        const reply = await getAIResponse(interaction.options.getString('query'), interaction.user.username);
        await interaction.editReply(reply);
    }
});

client.login(process.env.DISCORD_TOKEN);
