require('dotenv').config();
const { 
    Client, GatewayIntentBits, REST, Routes, 
    SlashCommandBuilder, EmbedBuilder 
} = require('discord.js');
const express = require('express');
const axios = require('axios');

// --- RENDER PORT BINDING ---
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Bot is Online! 🚀'));
app.listen(PORT, '0.0.0.0', () => console.log(`Health check listening on port ${PORT}`));

// --- BOT CONFIG ---
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

const commands = [
    // 1. Chillax Theme Help
    new SlashCommandBuilder()
        .setName('chillax')
        .setDescription('Get info and download links for the Chillax Vencord theme.'),
    
    // 2. CSS Snippets for Vencord
    new SlashCommandBuilder()
        .setName('css')
        .setDescription('Quick CSS snippets for Vencord theme development.'),

    // 3. AI Command (OpenRouter)
    new SlashCommandBuilder()
        .setName('ai')
        .setDescription('Ask the AI a question')
        .addStringOption(option => 
            option.setName('prompt')
                .setDescription('Your question for the AI')
                .setRequired(true)),

    // 4. Utility: Ping
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency.')
].map(command => command.toJSON());

// --- COMMAND REGISTRATION ---
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Refreshing slash commands...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        console.log('Successfully reloaded slash commands.');
    } catch (error) {
        console.error('Registration Error:', error);
    }
})();

// --- INTERACTIONS ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'ping') {
        await interaction.reply(`🏓 Latency: ${client.ws.ping}ms`);
    }

    if (commandName === 'chillax') {
        const embed = new EmbedBuilder()
            .setTitle('🍃 Chillax Theme Resources')
            .setColor('#7289da')
            .setDescription('The ultimate modern, clean, and customizable theme for Vencord.')
            .addFields(
                { name: 'GitHub', value: '[Chillax Repo](https://github.com/warrayquipsome/Chillax)', inline: true },
                { name: 'Docs', value: '[Installation Guide](https://github.com/Chillax-ORG/chillaxdocs)', inline: true }
            )
            .setFooter({ text: 'Vencord Theme Development' });
        await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'css') {
        const snippet = "
http://googleusercontent.com/immersive_entry_chip/0

---

### 3. Setting it up on Render
1.  **Environment Variables:** In the Render dashboard, add:
    * `DISCORD_TOKEN`: Your bot token.
    * `CLIENT_ID`: Your bot's Application ID.
    * `OPENROUTER_API_KEY`: Get one for free at [openrouter.ai](https://openrouter.ai/).
2.  **Build Command:** `npm install`
3.  **Start Command:** `npm start`
4.  **Auto-Ping (Optional):** Since you're on the Free tier, Render services sleep after 15 minutes of inactivity. Use a free service like [Cron-job.org](https://cron-job.org/) to ping your Render URL (`https://your-app.onrender.com/`) every 14 minutes to keep it awake.

### Existing Bots for Reference
* **[Venbot](https://github.com/Vencord/venbot):** The official bot for the Vencord server. Great for seeing how they handle user reporting and theme updates.
* **[ChillBot](https://github.com/Chillax-ORG/ChillBot):** The official Python bot for the Chillax organization (though yours is now the Node.js alternative!).

Would you like me to add a **Theme Preview** command that lets users upload a `.css` file and have the bot check it for common syntax errors?
