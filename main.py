import os
import discord
from discord import app_commands
from discord.ext import commands
from openai import OpenAI
from flask import Flask
from threading import Thread

# --- WEB SERVER SETUP (Render Keep-Alive) ---
app = Flask('')

@app.route('/')
def home():
    return "Chillax Support Bot is online and listening."

def run_web_server():
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# --- AI CONFIGURATION ---
ai_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    default_headers={
        "HTTP-Referer": "https://render.com",
        "X-Title": "Chillax Support AI",
    }
)

SYSTEM_PROMPT = (
    "You are the Chillax Theme Assistant. Chillax is a modern Discord theme for Vencord/BetterDiscord. "
    "When helping with CSS, wrap the code in blocks: ```css ... ```. "
    "Be helpful but keep it concise and 'chill'. "
    "Focus on Vencord-specific theme questions if asked."
)

def ask_ai(user_query, user_name):
    try:
        response = ai_client.chat.completions.create(
            model="openrouter/auto",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"{user_name} asks: {user_query}"}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"⚠️ API Error: {e}"

# --- BOT CLIENT SETUP ---
class ChillaxBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(command_prefix="!", intents=intents)

    async def setup_hook(self):
        # Syncing slash commands
        await self.tree.sync()
        print(f"Synced slash commands for {self.user}")

bot = ChillaxBot()

# --- SLASH COMMANDS ---
@bot.tree.command(name="css", description="Get AI help with a specific CSS tweak for Chillax")
@app_commands.describe(query="What CSS change do you want to make?")
async def css_help(interaction: discord.Interaction, query: str):
    await interaction.response.defer() # Gives AI time to think
    ai_response = ask_ai(f"Provide a CSS snippet for: {query}", interaction.user.name)
    
    if len(ai_response) > 2000:
        await interaction.followup.send(ai_response[:1990] + "...")
    else:
        await interaction.followup.send(ai_response)

# --- AUTO-CHIME & MENTION LOGIC ---
CHILLAX_KEYWORDS = ["theme", "css", "layout", "background", "vencord", "font", "color"]

@bot.event
async def on_message(message):
    if message.author == bot.user:
        return

    content_lower = message.content.lower()
    is_mentioned = bot.user.mentioned_in(message)
    # Check if any keyword is in the message
    has_keyword = any(keyword in content_lower for keyword in CHILLAX_KEYWORDS)

    if is_mentioned or (has_keyword and "chillax" in content_lower):
        async with message.channel.typing():
            # Remove mention from text for cleaner AI query
            clean_text = message.content.replace(f'<@!{bot.user.id}>', '').replace(f'<@{bot.user.id}>', '').strip()
            
            # If they just pinged with no text
            if not clean_text and is_mentioned:
                await message.reply("Yo! Need help with the Chillax theme? Try `/css` or ask me about a specific layout tweak.")
                return

            response = ask_ai(clean_text, message.author.name)
            await message.reply(response)

# --- STARTUP ---
if __name__ == "__main__":
    t = Thread(target=run_web_server)
    t.start()
    
    token = os.getenv("DISCORD_TOKEN")
    if token:
        bot.run(token)
    else:
        print("MISSING DISCORD_TOKEN")
