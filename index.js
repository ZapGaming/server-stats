require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder 
} = require('discord.js'); // Correct Library Import
const express = require('express');
const axios = require('axios');

// --- RENDER WEB SERVER ---
// Render will kill the bot if it doesn't see a web server on port 10000
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Chillax Bot Status: Online 🟢'));
app.listen(PORT, '0.0.0.0', () => console.log(`Web server active on port ${PORT}`));

// --- DISCORD BOT SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- COMMAND DEFINITIONS ---
const commands = [
    new SlashCommandBuilder()
        .setName('chillax')
        .setDescription('Get CSS help for Chillax theme')
        .addStringOption(option => 
            option.setName('query')
                .setDescription('What do you want to edit?')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('faq')
        .setDescription('View the Chillax FAQ link')
].map(command => command.toJSON());

// --- AI LOGIC (OpenRouter) ---
async function getAIResponse(userMessage) {
    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "google/gemini-2.0-flash-001",
            messages: [
                { 
                    role: "system", 
                    content: "You are the Chillax Theme Expert. Provide Vencord CSS snippets. FAQ: https://chillax.inmoresentum.net/vencordfaq.html" 
                },
                { role: "user", content: userMessage }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
        });
        return response.data.choices[0].message.content;
    } catch (e) {
        return "Check the FAQ: https://chillax.inmoresentum.net/vencordfaq.html";
    }
}

// --- BOT EVENTS ---
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is ready!`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        // Registers commands globally
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Slash commands registered.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'chillax') {
        await interaction.deferReply();
        const query = interaction.options.getString('query');
        const aiReply = await getAIResponse(query);
        await interaction.editReply(aiReply);
    }

    if (interaction.commandName === 'faq') {
        await interaction.reply('📖 **Official FAQ:** https://chillax.inmoresentum.net/vencordfaq.html');
    }
});

// Auto-reply when users mention the bot or ask about Chillax
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    if (message.mentions.has(client.user) || message.content.toLowerCase().includes('chillax help')) {
        message.channel.sendTyping();
        const reply = await getAIResponse(message.content);
        message.reply(reply);
    }
});

client.login(process.env.DISCORD_TOKEN);
