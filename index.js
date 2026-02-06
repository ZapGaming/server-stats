require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Discord Client
// Note: GuildPresences intent is required for accurate online counts
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildPresences 
    ]
});

// --- DISCORD BOT LOGIC ---
client.once('ready', async () => {
    console.log(`✅ Badge Bot Active: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('badge')
            .setDescription('Get the badge link for this server')
            .addStringOption(option => 
                option.setName('invite')
                    .setDescription('The server invite code (e.g., discord-developers)')
                    .setRequired(true))
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    } catch (e) {
        console.error('❌ Slash Command Error:', e);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'badge') {
        const invite = interaction.options.getString('invite');
        const host = 'server-stats-dlgi.onrender.com';
        const badgeUrl = `https://${host}/server?invite=${invite}`;

        await interaction.reply({
            content: `🛡️ **Your Server Stats Badge:**\n\`${badgeUrl}\``,
            ephemeral: true
        });
    }
});

// --- BADGE GENERATOR ENDPOINT ---
app.get('/server', async (req, res) => {
    const inviteCode = req.query.invite;
    if (!inviteCode) return res.status(400).send('Missing invite code.');

    try {
        // Fetch data directly from Discord
        const invite = await client.fetchInvite(inviteCode, { withCounts: true });
        
        const guildName = invite.guild.name;
        const online = invite.presenceCount || 0;
        const total = invite.memberCount || 0;

        // Clean name for SVG (escapes characters like &)
        const safeName = guildName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Shield-style SVG Badge
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="220" height="20" viewBox="0 0 220 20">
            <linearGradient id="g" x2="0" y2="100%">
                <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
                <stop offset="1" stop-opacity=".1"/>
            </linearGradient>
            <mask id="m">
                <rect width="220" height="20" rx="3" fill="#fff"/>
            </mask>
            <g mask="url(#m)">
                <rect width="90" height="20" fill="#2C2F33"/>
                <rect x="90" width="130" height="20" fill="#5865F2"/>
                <rect width="220" height="20" fill="url(#g)"/>
            </g>
            <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
                <text x="45" y="15" fill="#010101" fill-opacity=".3">${safeName.substring(0, 12)}</text>
                <text x="45" y="14">${safeName.substring(0, 12)}</text>
                <text x="155" y="15" fill="#010101" fill-opacity=".3">${online} Online • ${total} Total</text>
                <text x="155" y="14">${online} Online • ${total} Total</text>
            </g>
        </svg>`;

        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(svg);

    } catch (err) {
        console.error('Fetch Error:', err.message);
        res.status(500).send('Error fetching server data. Check if the invite is valid.');
    }
});

// Health check for Render
app.get('/', (req, res) => res.send('Badge Service Online'));

client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
