require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    SlashCommandBuilder, 
    REST, 
    Routes, 
    EmbedBuilder 
} = require('discord.js');
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// --- DISCORD BOT LOGIC ---

client.once('ready', async () => {
    console.log(`🚀 Authenticated as ${client.user.tag}`);

    // Register the slash command
    const commands = [
        new SlashCommandBuilder()
            .setName('generate-badge')
            .setDescription('Get the dynamic badge link for this server')
            .addStringOption(option => 
                option.setName('invite')
                    .setDescription('The invite code (e.g., "discord-gg-xyz")')
                    .setRequired(true))
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Successfully registered slash commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'generate-badge') {
        const invite = interaction.options.getString('invite');
        const baseUrl = process.env.RENDER_EXTERNAL_URL || `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`;
        const badgeUrl = `${baseUrl}/server?invite=${invite}`;

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Server Stats Badge')
            .setColor('#5865F2')
            .setDescription(`Here is your dynamic badge URL:\n\`\`\`${badgeUrl}\`\`\``)
            .addFields({ name: 'Preview', value: `[Click to view](${badgeUrl})` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// --- EXPRESS WEB SERVER LOGIC ---

app.get('/server', async (req, res) => {
    const inviteCode = req.query.invite;

    if (!inviteCode) {
        return res.status(400).send('Missing invite parameter.');
    }

    try {
        // 1. Fetch Discord Server Data
        const invite = await client.fetchInvite(inviteCode, { withCounts: true });
        const guild = invite.guild;
        const totalMembers = invite.memberCount;
        const onlineMembers = invite.presenceCount;

        // 2. Fetch Owner Status via Lanyard
        let ownerStatus = 'offline';
        try {
            const lanyardRes = await axios.get(`https://api.lanyard.rest/v1/users/${guild.ownerId}`);
            ownerStatus = lanyardRes.data.data.discord_status;
        } catch (e) {
            // Fails gracefully if owner isn't on Lanyard
            ownerStatus = 'offline';
        }

        // 3. Generate SVG
        const statusColors = {
            online: '#43b581',
            idle: '#faa61a',
            dnd: '#f04747',
            offline: '#747f8d'
        };

        const color = statusColors[ownerStatus] || statusColors.offline;
        const guildName = guild.name.replace(/&/g, '&amp;');

        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="320" height="20" viewBox="0 0 320 20">
            <linearGradient id="b" x2="0" y2="100%">
                <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
                <stop offset="1" stop-opacity=".1"/>
            </linearGradient>
            <mask id="a">
                <rect width="320" height="20" rx="3" fill="#fff"/>
            </mask>
            <g mask="url(#a)">
                <rect width="120" height="20" fill="#555"/>
                <rect x="120" width="130" height="20" fill="#5865F2"/>
                <rect x="250" width="70" height="20" fill="${color}"/>
                <rect width="320" height="20" fill="url(#b)"/>
            </g>
            <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
                <text x="60" y="15" fill="#010101" fill-opacity=".3">${guildName}</text>
                <text x="60" y="14">${guildName}</text>
                <text x="185" y="15" fill="#010101" fill-opacity=".3">Members: ${onlineMembers}/${totalMembers}</text>
                <text x="185" y="14">Members: ${onlineMembers}/${totalMembers}</text>
                <text x="285" y="15" fill="#010101" fill-opacity=".3">Owner</text>
                <text x="285" y="14">Owner</text>
            </g>
        </svg>`;

        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'max-age=60'); // Cache for 1 minute
        res.send(svg);

    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching server stats. Ensure the invite code is valid.');
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, () => {
    console.log(`Web server listening on port ${PORT}`);
});
