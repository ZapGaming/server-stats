require('dotenv').config();
const { 
    Client, GatewayIntentBits, SlashCommandBuilder, REST, 
    Routes, EmbedBuilder, ActivityType 
} = require('discord.js');
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences
    ]
});

// --- FIXED COMMAND DEFINITIONS ---
const commands = [
    new SlashCommandBuilder()
        .setName('badge')
        .setDescription('Generate a high-res server stats badge')
        .addStringOption(o => o.setName('invite').setDescription('The invite code to track').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask the Chillax AI for theme help or CSS')
        .addStringOption(o => o.setName('query').setDescription('What do you need help with?').setRequired(true)),

    new SlashCommandBuilder()
        .setName('server')
        .setDescription('Displays detailed information about this server'),

    new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll multi-sided dice')
        .addIntegerOption(o => o.setName('sides').setDescription('How many sides (default 6)').setRequired(false))
        .addIntegerOption(o => o.setName('count').setDescription('How many dice to roll').setRequired(false)),
        
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot heartrate')
].map(c => c.toJSON());

// --- AI LOGIC (OPENROUTER) ---
async function getAIResponse(prompt, user) {
    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "google/gemini-2.0-flash-001",
            messages: [
                { 
                    role: "system", 
                    content: "You are the Chillax Assistant. Help users with the Chillax Vencord Theme. FAQ: https://chillax.inmoresentum.net/vencordfaq.html. Give CSS in code blocks." 
                },
                { role: "user", content: `User ${user} asks: ${prompt}` }
            ]
        }, {
            headers: { 
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://chillax.inmoresentum.net'
            }
        });
        return response.data.choices[0].message.content;
    } catch (e) {
        return "I'm having trouble thinking. Visit the FAQ: https://chillax.inmoresentum.net/vencordfaq.html";
    }
}

// --- EVENTS ---
client.once('ready', async () => {
    console.log(`✅ Chillax Bot Loaded: ${client.user.tag}`);
    client.user.setPresence({ 
        status: 'online', 
        activities: [{ name: 'Chillax Vencord UI', type: ActivityType.Watching }] 
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Global Commands Registered Successfully');
    } catch (e) { console.error('❌ Registration Error:', e); }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content.toLowerCase();
    
    // Auto chime-in for help/css keywords
    if (content.includes('chillax help') || content.includes('how do i css') || message.mentions.has(client.user)) {
        await message.channel.sendTyping();
        const reply = await getAIResponse(message.content, message.author.username);
        message.reply(reply);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'badge') {
        const invite = interaction.options.getString('invite') || 'NONE';
        const url = `https://server-stats-dlgi.onrender.com/badge?id=${interaction.guildId}&invite=${invite}`;
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Chillax Badge Link')
            .setDescription(`**Embed URL:** \`${url}\`\n\n*Copy this into your README or website!*`)
            .setImage(url)
            .setColor('#5865F2');
        await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'ask') {
        await interaction.deferReply();
        const reply = await getAIResponse(interaction.options.getString('query'), interaction.user.username);
        await interaction.editReply(reply);
    }

    if (interaction.commandName === 'ping') {
        await interaction.reply(`🏓 Latency: **${client.ws.ping}ms**`);
    }
});

// --- THE MASTER BADGE API ---
app.get('/badge', async (req, res) => {
    const guildId = req.query.id;
    const invite = req.query.invite;

    try {
        let name = "Chillax Server";
        let online = "Live";
        let total = "N/A";

        const guild = client.guilds.cache.get(guildId);
        if (guild) {
            name = guild.name;
            total = guild.memberCount;
        } else if (invite && invite !== 'NONE') {
            const invData = await client.fetchInvite(invite, { withCounts: true });
            name = invData.guild.name;
            online = invData.presenceCount;
            total = invData.memberCount;
        }

        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">
            <rect width="400" height="120" rx="20" fill="#111214"/>
            <rect width="12" height="120" rx="0" fill="#5865F2"/>
            <text x="35" y="45" fill="#ffffff" font-family="Arial" font-size="22" font-weight="bold">${name.slice(0,22)}</text>
            <text x="35" y="80" fill="#b5bac1" font-family="Arial" font-size="16">Online: ${online} • Total: ${total}</text>
            <text x="290" y="105" fill="#5865F2" font-family="Arial" font-size="12" font-weight="bold">CHILLAX UI</text>
        </svg>`;

        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(svg);
    } catch (e) {
        res.status(404).send('Invalid Guild or Invite');
    }
});

app.get('/', (req, res) => res.send('Chillax System Active 🟢'));

client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, '0.0.0.0', () => console.log(`API Listening on ${PORT}`));
