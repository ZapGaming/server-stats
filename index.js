require('dotenv').config();
const { 
    Client, GatewayIntentBits, SlashCommandBuilder, REST, 
    Routes, EmbedBuilder, ActivityType, Collection 
} = require('discord.js');
const express = require('express');
const axios = require('axios');

// --- RENDER WEB SERVER (Required to stay online) ---
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Chillax Theme Bot: Online 🟢'));
app.listen(PORT, '0.0.0.0', () => console.log(`Web Server listening on ${PORT}`));

// --- DISCORD BOT SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// --- COMMAND DEFINITIONS ---
const commands = [
    new SlashCommandBuilder()
        .setName('chillax')
        .setDescription('Get help with the Chillax theme')
        .addSubcommand(sub => sub.setName('faq').setDescription('Links to the official FAQ'))
        .addSubcommand(sub => sub.setName('css').setDescription('Get a specific CSS snippet for Vencord')
            .addStringOption(opt => opt.setName('target').setDescription('What to change?').setRequired(true)
                .addChoices(
                    { name: 'Fonts', value: 'fonts' },
                    { name: 'Transparency', value: 'transparency' },
                    { name: 'Animations', value: 'animations' }
                ))),
    new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask the AI anything about Vencord or Chillax')
        .addStringOption(opt => opt.setName('question').setDescription('Your question').setRequired(true)),
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency')
].map(c => c.toJSON());

// --- AI LOGIC (OpenRouter) ---
async function getAIResponse(prompt, user) {
    try {
        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "google/gemini-2.0-flash-001",
            messages: [
                { 
                    role: "system", 
                    content: "You are the Chillax Theme Expert. Chillax is a Vencord theme. FAQ: https://chillax.inmoresentum.net/vencordfaq.html. Provide clean CSS code blocks. Be helpful but brief." 
                },
                { role: "user", content: `User ${user}: ${prompt}` }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
        });
        return res.data.choices[0].message.content;
    } catch (e) {
        return "I'm having trouble connecting to my brain. Check the FAQ: https://chillax.inmoresentum.net/vencordfaq.html";
    }
}

// --- BOT EVENTS ---
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'Vencord | /chillax', type: ActivityType.Watching }],
        status: 'online'
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        // Registering to a specific server (TEST_GUILD_ID) makes it INSTANT
        if (process.env.TEST_GUILD_ID) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.TEST_GUILD_ID), { body: commands });
            console.log('⚡ Guild Commands Synced (Instant)');
        }
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('🌍 Global Commands Synced (Can take 1hr)');
    } catch (err) { console.error(err); }
});

// --- PROACTIVE AI CHAT ---
client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    // Chimes in if mentioned or if "Chillax" is in a question
    const botMentioned = msg.mentions.has(client.user);
    const isHelpfulContext = msg.content.toLowerCase().includes('chillax') && (msg.content.includes('?') || msg.content.includes('help'));

    if (botMentioned || isHelpfulContext) {
        await msg.channel.sendTyping();
        const response = await getAIResponse(msg.content, msg.author.username);
        msg.reply(response);
    }
});

// --- SLASH COMMAND HANDLER ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'chillax') {
        const sub = interaction.options.getSubcommand();
        if (sub === 'faq') {
            return interaction.reply("📖 **Chillax Official FAQ:** https://chillax.inmoresentum.net/vencordfaq.html");
        }
        if (sub === 'css') {
            const target = interaction.options.getString('target');
            const snippets = {
                fonts: "/* Change Main Font */\n:root {\n  --font-primary: 'GG Sans', 'Noto Sans';\n}",
                transparency: "/* Glass Effect */\n.container_e40c16 { background: rgba(0,0,0,0.5) !important; backdrop-filter: blur(5px); }",
                animations: "/* Smooth Transitions */\n* { transition: all 0.2s ease-in-out; }"
            };
            return interaction.reply(`🎨 **Chillax CSS Snippet (${target}):**\n\`\`\`css\n${snippets[target]}\n\`\`\``);
        }
    }

    if (interaction.commandName === 'ask') {
        await interaction.deferReply();
        const reply = await getAIResponse(interaction.options.getString('question'), interaction.user.username);
        await interaction.editReply(reply);
    }

    if (interaction.commandName === 'ping') {
        await interaction.reply(`🏓 **Pong!** Latency: ${client.ws.ping}ms`);
    }
});

client.login(process.env.DISCORD_TOKEN);
