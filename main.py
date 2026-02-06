import os
import asyncio
import discord
from discord import app_commands
from openai import OpenAI
from flask import Flask
from threading import Thread

# --- 1. WEB SERVER SETUP (For Gunicorn/Render) ---
app = Flask(__name__)

@app.route('/')
def health_check():
    """Health check endpoint for Render to monitor the service."""
    return "Chillax Bot is online and running via Gunicorn.", 200

# --- 2. AI CONFIGURATION (OpenRouter) ---
ai_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    default_headers={
        "HTTP-Referer": "https://render.com",
        "X-Title": "Chillax Theme Assistant",
    }
)

def get_ai_response(query, user_name):
    """Fetches a response from OpenRouter using the Chillax persona."""
    try:
        completion = ai_client.chat.completions.create(
            model="openrouter/auto",
            messages=[
                {"role": "system", "content": (
                    "You are the Chillax Theme Specialist. Chillax is a modern, clean Discord theme "
                    "for Vencord and BetterDiscord. You help users with CSS snippets, "
                    "Vencord settings, and troubleshooting. Be chill and tech-savvy. "
                    "Always wrap CSS code in blocks: ```css ... ```."
                )},
                {"role": "user", "content": f"{user_name} asks: {query}"}
            ]
        )
        return completion.choices[0].message.content
    except Exception as e:
        return f"⚠️ AI Error: {e}"

# --- 3. BOT INITIALIZATION (Based on your bot.py) ---
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
if not DISCORD_TOKEN:
    print("Error: DISCORD_TOKEN environment variable is not set.")
    exit(1)

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = discord.Client(intents=intents)
tree = app_commands.CommandTree(bot)

# --- 4. CHIME-IN ALGORITHM ---
SUPPORT_KEYWORDS = ["theme", "css", "vencord", "fix", "help", "install", "background", "color"]

def should_chime_in(text, is_mention):
    """Algorithm to detect if the bot should provide support."""
    text = text.lower()
    # Trigger if mentioned or if 'chillax' is paired with a support keyword
    has_keyword = any(k in text for k in SUPPORT_KEYWORDS)
    return is_mention or ("chillax" in text and has_keyword)

# --- 5. EVENTS & COMMANDS ---
@bot.event
async def on_ready():
    """Syncs commands globally on startup."""
    print(f'Logged in as {bot.user}')
    await tree.sync()
    print('Commands synced globally.')

@bot.event
async def on_message(message):
    if message.author == bot.user:
        return

    is_mention = bot.user.mentioned_in(message)
    
    # AI Chime-in Logic
    if should_chime_in(message.content, is_mention):
        async with message.channel.typing():
            clean_text = message.content.replace(f'<@!{bot.user.id}>', '').replace(f'<@{bot.user.id}>', '').strip()
            
            if not clean_text and is_mention:
                await message.reply("Yo! Need help with Chillax? Use `/css` or ask me about theme tweaks.")
                return

            response = get_ai_response(clean_text, message.author.name)
            
            # Send in chunks if over Discord's 2000 char limit
            for i in range(0, len(response), 2000):
                await message.reply(response[i:i+2000])

@tree.command(name="css", description="Get AI-generated CSS tweaks for the Chillax theme")
async def css(interaction: discord.Interaction, query: str):
    """Slash command for specific CSS help."""
    await interaction.response.defer()
    answer = get_ai_response(f"Provide a CSS snippet for: {query}", interaction.user.name)
    await interaction.followup.send(answer)

@tree.command(name="shutup", description="Makes the bot mention the specified user 100 times.")
@app_commands.checks.has_permissions(manage_messages=True)
async def shutup(interaction: discord.Interaction, user: discord.Member):
    """Ported from your original bot.py."""
    await interaction.response.defer(ephemeral=True)
    for _ in range(100):
        await asyncio.sleep(1)
        await interaction.channel.send(f"{user.mention}")

# --- 6. EXECUTION ---
def run_discord_bot():
    bot.run(DISCORD_TOKEN)

if __name__ == "__main__":
    # Start the Discord bot in a background thread
    Thread(target=run_discord_bot).start()
    
    # Run Flask for local testing (Gunicorn will ignore this and use 'app')
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)
