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

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Client with all necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent
    ]
});

// --- SLASH COMMAND DEFINITIONS ---
const commands = [
    // Badge Command
    new SlashCommandBuilder()
        .setName('badge')
        .setDescription('Generate the server stats badge link')
        .addStringOption(option => option.setName('invite').setDescription('Server invite code').setRequired(true)),
    
    // Dice Roll
    new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll a dice')
        .addIntegerOption(option => option.setName('sides').setDescription('Number of sides (default 6)')),

    // User Info
    new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Get info about a user')
        .addUserOption(option => option.setName('target').setDescription('The user to check')),

    // Server Info
    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Displays detailed information about this server'),

    // Ping
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency')
].map(command => command.toJSON());

// --- BOT EVENTS ---
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online and operational!`);
    
    // Set bot status to "Online" explicitly
    client.user.setPresence({ status: 'online', activities: [{ name: 'Server Stats', type: 0 }] });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ All slash commands registered.');
    } catch (e) {
        console.error(e);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    // 1. Badge Command
    if (commandName === 'badge') {
        const invite = options.getString('invite');
        const host = 'server-stats-dlgi.onrender.com';
        await interaction.reply({ 
            content: `🛡️ **Badge Link:**\n\`https://${host}/server?invite=${invite}\``, 
            ephemeral: true 
        });
    }

    // 2. Dice Roll
    if (commandName === 'roll') {
        const sides = options.getInteger('sides') || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        await interaction.reply(`🎲 You rolled a **${result}** (1-${sides})`);
    }

    // 3. User Info
    if (commandName === 'userinfo') {
        const user = options.getUser('target') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);
        
        const embed = new EmbedBuilder()
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
            .setThumbnail(user.displayAvatarURL())
            .setColor('#5865F2')
            .addFields(
                { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: 'Roles', value: member.roles.cache.map(r => r).join(' ').slice(0, 1024) || 'None' }
            );
        await interaction.reply({ embeds: [embed] });
    }

    // 4. Server Info
    if (commandName === 'serverinfo') {
        const { guild } = interaction;
        const embed = new EmbedBuilder()
            .setTitle(guild.name)
            .setThumbnail(guild.iconURL())
            .setColor('#5865F2')
            .addFields(
                { name: 'Total Members', value: `${guild.memberCount}`, inline: true },
                { name: 'Created At', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                { name: 'Boost Level', value: `${guild.premiumTier}`, inline: true }
            );
        await interaction.reply({ embeds: [embed] });
    }

    // 5. Ping
    if (commandName === 'ping') {
        await interaction.reply(`🏓 Latency: **${client.ws.ping}ms**`);
    }
});

// --- WEB SERVER (For Badge & Health Checks) ---
app.get('/server', async (req, res) => {
    const inviteCode = req.query.invite;
    if (!inviteCode) return res.status(400).send('Invite code required.');

    try {
        const invite = await client.fetchInvite(inviteCode, { withCounts: true });
        const name = invite.guild.name.replace(/&/g, '&amp;');
        
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="220" height="20">
            <rect width="90" height="20" fill="#23272A" rx="3"/>
            <rect x="90" width="130" height="20" fill="#5865F2" rx="3"/>
            <g fill="#fff" font-family="Verdana,sans-serif" font-size="11">
                <text x="5" y="14">${name.substring(0, 12)}</text>
                <text x="95" y="14">${invite.presenceCount} Online • ${invite.memberCount} Total</text>
            </g>
        </svg>`;

        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svg);
    } catch (e) {
        res.status(500).send('Invalid Invite');
    }
});

app.get('/', (req, res) => res.send('Bot & Badge Service is Online 🟢'));

client.login(process.env.DISCORD_TOKEN);
app.listen(PORT, '0.0.0.0', () => console.log(`Listening on ${PORT}`));
