require('dotenv').config();
const { 
    Client, GatewayIntentBits, SlashCommandBuilder, REST, 
    Routes, EmbedBuilder, ActivityType, Collection 
} = require('discord.js');
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// 1. ADVANCED CLIENT SETUP
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences
    ]
});

// 2. THEME KNOWLEDGE BASE (Training Data)
const CHILLAX_DATA = {
    faq: "https://chillax.inmoresentum.net/vencordfaq.html",
    repo: "https://github.com/InMoreSentum/Chillax",
    base_css: "@import url('https://inmoresentum.github.io/Chillax/chillax.css');",
    colors: {
        accent: "#5865F2",
        bg: "#111214",
        text: "#dbdee1"
    }
};

// 3. AI LOGIC - DYNAMIC & CONTEXT-AWARE
async function askAI(prompt, history = []) {
    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "google/gemini-2.0-flash-001",
            messages: [
                { 
                    role: "system", 
                    content: `You are the Chillax Master AI. You support the Chillax Vencord theme. 
                    - If users ask for CSS: generate valid Vencord-compatible CSS code blocks.
                    - Knowledge: FAQ at ${CHILLAX_DATA.faq}, GitHub at ${CHILLAX_DATA.repo}.
                    - Tone: Smart, helpful, witty, and 'chill'.
                    - If they ask for a badge, tell them to use /badge.` 
                },
                ...history,
                { role: "user", content: prompt }
            ]
        }, {
            headers: { 
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://chillax.inmoresentum.net'
            }
        });
        return response.data.choices[0].message.content;
    } catch (e) {
        return "The AI engine stalled. Check the docs here: " + CHILLAX_DATA.faq;
    }
}

// 4. SLASH COMMAND REGISTRATION
const commands = [
    new SlashCommandBuilder().setName('badge').setDescription('Generate stats badge').addStringOption(o => o.setName('invite').setRequired(true)),
    new SlashCommandBuilder().setName('ai-css').setDescription('AI-generated CSS for Chillax').addStringOption(o => o.setName('request').setRequired(true).setDescription('e.g. "make the sidebar pink"')),
    new SlashCommandBuilder().setName('status').setDescription('Live health of Chillax services'),
    new SlashCommandBuilder().setName('inspect').setDescription('Get technical info of a user').addUserOption(o => o.setName('target').setRequired(true))
].map(c => c.toJSON());

// 5. BOT EVENTS
client.once('ready', async () => {
    console.log(`🚀 Chillax Bot V2 Online: ${client.user.tag}`);
    
    // Set Dynamic Activity
    client.user.setPresence({
        status: 'online',
        activities: [{ name: 'Vencord Theme Support', type: ActivityType.Competing }]
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        // Register for specific guild (instant) AND global
        if(process.env.TEST_GUILD_ID) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.TEST_GUILD_ID), { body: commands });
        }
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Commands Synced');
    } catch (e) { console.error(e); }
});

// 6. SMART MESSAGE HANDLING
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Smart Chime-in (Probability based or Direct Mention)
    const shouldReply = message.mentions.has(client.user) || 
                        (message.content.toLowerCase().includes('chillax') && Math.random() > 0.7);

    if (shouldReply) {
        await message.channel.sendTyping();
        const response = await askAI(message.content, []);
        message.reply(response);
    }
});

// 7. INTERACTION HANDLER
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'ai-css') {
        await i.deferReply();
        const request = i.options.getString('request');
        const cssResponse = await askAI(`Generate only the CSS code for: ${request}. Wrap in code block.`, []);
        await i.editReply({ content: `🎨 **Custom Chillax CSS Snippet:**\n${cssResponse}` });
    }

    if (i.commandName === 'badge') {
        const inv = i.options.getString('invite');
        const url = `https://server-stats-dlgi.onrender.com/server?invite=${inv}`;
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Dynamic Stats Badge')
            .setColor(CHILLAX_DATA.colors.accent)
            .setDescription(`\`${url}\``)
            .setImage(url);
        await i.reply({ embeds: [embed] });
    }

    if (i.commandName === 'status') {
        const embed = new EmbedBuilder()
            .setTitle('📊 Service Status')
            .addFields(
                { name: 'Bot Latency', value: `\`${client.ws.ping}ms\``, inline: true },
                { name: 'FAQ Site', value: '[Online](https://chillax.inmoresentum.net/)', inline: true },
                { name: 'Theme CDN', value: '🟢 Operational', inline: true }
            )
            .setColor('#43b581');
        await i.reply({ embeds: [embed] });
    }
});

// 8. RENDER BADGE API
app.get('/server', async (req, res) => {
    const code = req.query.invite;
    try {
        const inv = await client.fetchInvite(code, { withCounts: true });
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="240" height="26">
            <rect width="240" height="26" fill="${CHILLAX_DATA.colors.bg}" rx="6"/>
            <path d="M0 6a6 6 0 0 1 6-6h74v26H6a6 6 0 0 1-6-6V6z" fill="#313338"/>
            <text x="10" y="17" fill="#fff" font-family="Arial,sans-serif" font-size="11" font-weight="bold">${inv.guild.name.slice(0,10)}</text>
            <text x="90" y="17" fill="${CHILLAX_DATA.colors.accent}" font-family="Arial,sans-serif" font-size="11" font-weight="bold">${inv.presenceCount} ONLINE / ${inv.memberCount} TOTAL</text>
        </svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svg);
    } catch (e) { res.status(404).send('Invalid'); }
});

app.get('/', (req, res) => res.send('Chillax Core System Active.'));

client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on ${PORT}`);
    // Keep-alive ping
    setInterval(() => axios.get('https://server-stats-dlgi.onrender.com/').catch(() => {}), 600000);
});
