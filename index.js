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

// --- SLASH COMMANDS ---
const commands = [
    new SlashCommandBuilder().setName('badge').setDescription('Generate Chillax server badge').addStringOption(o => o.setName('invite').setRequired(true).setDescription('Invite code')),
    new SlashCommandBuilder().setName('faq').setDescription('Quick links to Chillax help'),
    new SlashCommandBuilder().setName('dice').setDescription('Roll a 3D-style dice').addIntegerOption(o => o.setName('sides').setDescription('Sides')),
    new SlashCommandBuilder().setName('ping').setDescription('Check bot heartbeat'),
    new SlashCommandBuilder().setName('themeinfo').setDescription('Details about Chillax Vencord theme'),
    new SlashCommandBuilder().setName('clear').setDescription('Purge messages (Staff Only)').addIntegerOption(o => o.setName('amount').setRequired(true).setDescription('1-100'))
].map(c => c.toJSON());

// --- AI LOGIC (OPENROUTER) ---
async function getAIResponse(userMessage, userName) {
    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "google/gemini-2.0-flash-001", // Very fast and usually free/cheap on OpenRouter
            messages: [
                { 
                    role: "system", 
                    content: `You are the Chillax Assistant for the Chillax Vencord Theme. 
                    Your goal is to help users with theme installation and CSS issues. 
                    ALWAYS refer people to the official FAQ: https://chillax.inmoresentum.net/vencordfaq.html 
                    Be cool, concise, and helpful. User's name is ${userName}.` 
                },
                { role: "user", content: userMessage }
            ]
        }, {
            headers: { 
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': `https://server-stats-dlgi.onrender.com`, // Required by OpenRouter
                'Content-Type': 'application/json' 
            }
        });
        return response.data.choices[0].message.content;
    } catch (e) {
        console.error("OpenRouter Error:", e.response?.data || e.message);
        return "I'm having trouble thinking right now. Please check the Chillax FAQ here: https://chillax.inmoresentum.net/vencordfaq.html";
    }
}

// --- BOT EVENTS ---
client.once('ready', async () => {
    console.log(`✨ Chillax Bot Online | Serving: ${client.guilds.cache.size} servers`);
    
    // Set Status
    client.user.setPresence({ 
        activities: [{ name: 'with Chillax Theme', type: ActivityType.Playing }], 
        status: 'online' 
    });

    // Register Commands
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        // Registering globally (can take up to 1 hour to appear)
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Commands Registered Globally');
    } catch (e) { console.error(e); }
});

// --- MESSAGE AUTO-REPLY ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Trigger AI if bot is mentioned or someone says "chillax help"
    const isMentioned = message.mentions.has(client.user);
    const isHelpRequest = message.content.toLowerCase().includes('chillax help');

    if (isMentioned || isHelpRequest) {
        await message.channel.sendTyping();
        const reply = await getAIResponse(message.content, message.author.username);
        message.reply(reply);
    }
});

// --- COMMAND HANDLING ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'badge') {
        const inv = interaction.options.getString('invite');
        await interaction.reply({ 
            content: `🛡️ **Chillax Stats Badge:**\n\`https://server-stats-dlgi.onrender.com/server?invite=${inv}\``, 
            ephemeral: true 
        });
    }

    if (commandName === 'faq') {
        const embed = new EmbedBuilder()
            .setTitle('Chillax Help & FAQ')
            .setURL('https://chillax.inmoresentum.net/vencordfaq.html')
            .setColor('#7289da')
            .setDescription('Need help? Our FAQ covers installation, plugins, and custom CSS!')
            .setFooter({ text: 'Chillax Vencord Theme' });
        await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'themeinfo') {
        await interaction.reply({
            content: "💜 **Chillax** is a modern, performance-focused Vencord theme. \nGet it here: <https://chillax.inmoresentum.net/>",
            ephemeral: false
        });
    }

    if (commandName === 'dice') {
        const s = interaction.options.getInteger('sides') || 6;
        await interaction.reply(`🎲 **${interaction.user.username}** rolled a **${Math.floor(Math.random()*s)+1}**`);
    }

    if (commandName === 'ping') {
        await interaction.reply(`🏓 **Pong!** (${client.ws.ping}ms)`);
    }

    if (commandName === 'clear') {
        if (!interaction.member.permissions.has('ManageMessages')) {
            return interaction.reply({ content: "You don't have permission to clear messages!", ephemeral: true });
        }
        const amt = interaction.options.getInteger('amount');
        await interaction.channel.bulkDelete(amt, true);
        await interaction.reply({ content: `🧹 Cleared **${amt}** messages.`, ephemeral: true });
    }
});

// --- RENDER WEB SERVER ---
app.get('/server', async (req, res) => {
    const code = req.query.invite;
    if (!code) return res.status(400).send('Invite code missing');
    
    try {
        const inv = await client.fetchInvite(code, { withCounts: true });
        const name = inv.guild.name.replace(/&/g, '&amp;');
        
        // Vencord-style dark themed SVG
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="240" height="22">
            <rect width="240" height="22" fill="#111214" rx="5"/>
            <rect width="80" height="22" fill="#313338" rx="5"/>
            <text x="10" y="15" fill="#dbdee1" font-family="Arial" font-size="11" font-weight="bold">${name.slice(0,10)}</text>
            <text x="90" y="15" fill="#949ba4" font-family="Arial" font-size="11">Online: ${inv.presenceCount} | Total: ${inv.memberCount}</text>
        </svg>`;

        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(svg);
    } catch (e) {
        res.status(404).send('Invalid Invite');
    }
});

app.get('/', (req, res) => res.send('Chillax Bot & Badge Service Online! 🚀'));

client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, '0.0.0.0', () => console.log(`Express listening on ${PORT}`));
