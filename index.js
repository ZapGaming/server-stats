require('dotenv').config();
const { 
    Client, GatewayIntentBits, SlashCommandBuilder, REST, 
    Routes, EmbedBuilder, ActivityType, PermissionFlagsBits 
} = require('discord.js');
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// 1. CLIENT SETUP
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences
    ]
});

// 2. COMPLEX COMMANDS
const commands = [
    new SlashCommandBuilder()
        .setName('badge')
        .setDescription('Create a Chillax server stats badge')
        .addStringOption(o => o.setName('invite').setRequired(true).setDescription('The invite code')),
    
    new SlashCommandBuilder()
        .setName('chillax')
        .setDescription('Chillax Theme Hub')
        .addSubcommand(sub => sub.setName('faq').setDescription('Get help links'))
        .addSubcommand(sub => sub.setName('css').setDescription('Get a common CSS snippet')
            .addStringOption(o => o.setName('type').setRequired(true).setDescription('What to edit?')
                .addChoices(
                    { name: 'Custom Font', value: 'font' },
                    { name: 'Glass Effect', value: 'glass' },
                    { name: 'Hide Help Button', value: 'hidehelp' }
                ))),

    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Detailed bot & theme stats'),

    new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Complex dice roll')
        .addIntegerOption(o => o.setName('amount').setDescription('Number of dice'))
        .addIntegerOption(o => o.setName('sides').setDescription('Sides per dice'))
].map(c => c.toJSON());

// 3. AI & CSS TRAINING SEQUENCE
const CHILLAX_CONTEXT = `
You are the "Chillax AI Assistant". 
Personality: Chill, modern, developer-friendly.
Theme Knowledge: Chillax is a premium Vencord theme. 
FAQ Link: https://chillax.inmoresentum.net/vencordfaq.html
Instruction: If users ask for CSS, provide code blocks. If they ask for help, refer to the FAQ. 
Stay proactive! If a user sounds frustrated, offer a CSS snippet or the FAQ.
`;

const CSS_LIBRARY = {
    font: "/* Chillax Custom Font */\n:root {\n  --font-primary: 'Poppins', sans-serif;\n  --font-display: 'Poppins', sans-serif;\n}",
    glass: "/* Chillax Glass Effect */\n.container_e40c16 {\n  background: rgba(0,0,0,0.4) !important;\n  backdrop-filter: blur(10px);\n}",
    hidehelp: "/* Hide Help Button */\n[aria-label='Help'] {\n  display: none;\n}"
};

async function askAI(prompt, user) {
    try {
        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "google/gemini-2.0-flash-001", 
            messages: [
                { role: "system", content: CHILLAX_CONTEXT },
                { role: "user", content: `User ${user} says: ${prompt}` }
            ]
        }, {
            headers: { 
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://chillax.inmoresentum.net'
            }
        });
        return res.data.choices[0].message.content;
    } catch (e) { return "I'm a bit overwhelmed! Check the FAQ: https://chillax.inmoresentum.net/vencordfaq.html"; }
}

// 4. BOT EVENTS
client.once('ready', async () => {
    console.log(`✅ Chillax Bot is Online: ${client.user.tag}`);
    
    // Set Online Status Immediately
    client.user.setPresence({
        status: 'online',
        activities: [{ name: 'Chillax Vencord Theme', type: ActivityType.Watching }]
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        // INSTANT REGISTRATION: Use this if commands aren't showing!
        // Replace 'YOUR_GUILD_ID' with your actual server ID for instant results.
        if(process.env.TEST_GUILD_ID) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.TEST_GUILD_ID), { body: commands });
            console.log('⚡ Instant Guild Commands Registered');
        }
        
        // Global Registration (Take up to 1hr)
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('🌍 Global Commands Synced');
    } catch (e) { console.error(e); }
});

// AI CHIME-IN & CHAT LOGIC
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();
    
    // Proactive Chime-in (If someone asks "how to" or mentions "chillax")
    if (content.includes('how do i') || content.includes('chillax') || message.mentions.has(client.user)) {
        await message.channel.sendTyping();
        const aiMsg = await askAI(message.content, message.author.username);
        message.reply(aiMsg);
    }
});

// INTERACTION HANDLER
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'chillax') {
        const sub = interaction.options.getSubcommand();
        if (sub === 'faq') {
            return interaction.reply("📖 **Chillax FAQ:** https://chillax.inmoresentum.net/vencordfaq.html");
        }
        if (sub === 'css') {
            const type = interaction.options.getString('type');
            return interaction.reply(`🎨 **Chillax CSS Snippet:**\n\`\`\`css\n${CSS_LIBRARY[type]}\n\`\`\``);
        }
    }

    if (interaction.commandName === 'badge') {
        const inv = interaction.options.getString('invite');
        const badgeUrl = `https://server-stats-dlgi.onrender.com/server?invite=${inv}`;
        const embed = new EmbedBuilder()
            .setTitle("🛡️ Server Stats Badge Generated")
            .setDescription(`URL: \`${badgeUrl}\``)
            .setImage(badgeUrl)
            .setColor('#5865F2');
        await interaction.reply({ embeds: [embed] });
    }

    // Ping, Stats, etc.
    if (interaction.commandName === 'ping') interaction.reply(`🏓 Latency: ${client.ws.ping}ms`);
});

// 5. RENDER WEB SERVER + BADGE
app.get('/server', async (req, res) => {
    const invCode = req.query.invite;
    try {
        const inv = await client.fetchInvite(invCode, { withCounts: true });
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="20">
            <rect width="220" height="20" fill="#1e1e2e" rx="4"/>
            <text x="10" y="14" fill="#cdd6f4" font-family="sans-serif" font-size="11">${inv.guild.name.slice(0,10)}</text>
            <text x="110" y="14" fill="#89b4fa" font-family="sans-serif" font-size="11">● ${inv.presenceCount} | All ${inv.memberCount}</text>
        </svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svg);
    } catch (e) { res.status(404).send('Invalid Invite'); }
});

// Auto-pinger for Render Health Checks
app.get('/', (req, res) => res.send('System Online 🟢'));

client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
    // Optional: Self-ping every 10 mins to stay awake
    setInterval(() => {
        axios.get(`https://server-stats-dlgi.onrender.com/`).catch(() => {});
    }, 600000);
});
