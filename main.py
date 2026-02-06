import os
import asyncio
import discord
from discord import app_commands
from discord.ext import commands
from openai import OpenAI
from flask import Flask
from threading import Thread

# --- 1. WEB SERVER SETUP (Fixes Render "Offline" / Port Binding) ---
app = Flask('')

@app.route('/')
def home():
    return "Chillax Bot is active and binding to the Render port."

def run_web_server():
    # Render requires binding to a port for Web Services to show as "Online"
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# --- 2. AI CONFIGURATION (OpenRouter) ---
ai_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    default_headers={
        "HTTP-Referer": "https://render.com",
        "X-Title": "Chillax Support AI",
    }
)

# --- 3. SUPPORT INTENT ALGORITHM ---
# Improved scoring-based detection to prevent spam while staying helpful
CHILLAX_KEYWORDS = {
    "theme": 1, "css": 2, "vencord": 2, "broken": 1, "fix": 1, 
    "how": 1, "help": 1, "layout": 2, "background": 1, "custom": 1,
    "install": 2, "client": 1, "plugin": 1
}

def analyze_intent(content: str, is_mention: bool):
    """
    Algorithm to decide if the bot should chime in.
    Score >= 3 triggers a support response.
    """
    content = content.lower()
    score = 0
    
    if is_mention: score += 5
    if "chillax" in content: score += 2
    
    for word, weight in CHILLAX_KEYWORDS.items():
        if word in content:
            score += weight
            
    return score >= 3

# --- 4. BOT CLASS & COMMANDS ---
class ChillBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True  # Required to read messages for support
        super().__init__(command_prefix="!", intents=intents)

    async def setup_hook(self):
        # Syncing globally for Slash Commands to show up
        await self.tree.sync()
        print(f"✅ Logged in as {self.user} and synced Slash Commands.")

bot = ChillBot()

def get_ai_response(query, user_name):
    try:
        completion = ai_client.chat.completions.create(
            model="openrouter/auto",
            messages=[
                {"role": "system", "content": (
                    "You are the Chillax Theme Specialist. "
                    "You help users with the Chillax Discord theme on Vencord or BetterDiscord. "
                    "Provide valid CSS snippets when asked. Be chill, concise, and professional. "
                    "Always use ```css ... ``` for code blocks."
                )},
                {"role": "user", "content": f"{user_name} asks: {query}"}
            ]
        )
        return completion.choices[0].message.content
    except Exception as e:
        return f"⚠️ OpenRouter Error: {e}"

@bot.tree.command(name="css", description="Get AI-generated CSS tweaks for the Chillax theme")
@app_commands.describe(query="What do you want to change? (e.g., 'Make the sidebar purple')")
async def css(interaction: discord.Interaction, query: str):
    await interaction.response.defer() # Prevents timeout (OpenRouter can be slow)
    answer = get_ai_response(f"Provide a CSS snippet for: {query}", interaction.user.name)
    await interaction.followup.send(answer)

@bot.event
async def on_message(message):
    if message.author == bot.user:
        return

    # Algorithm check: Should we chime in?
    is_mentioned = bot.user.mentioned_in(message)
    if analyze_intent(message.content, is_mentioned):
        async with message.channel.typing():
            # Clean the mention from the prompt
            clean_text = message.content.replace(f'<@!{bot.user.id}>', '').replace(f'<@{bot.user.id}>', '').strip()
            
            if not clean_text and is_mentioned:
                await message.reply("Yo! Need help with Chillax? Try `/css` or ask me a specific theme question.")
                return

            response = get_ai_response(clean_text, message.author.name)
            
            # Split response if it exceeds Discord's 2000 char limit
            if len(response) > 2000:
                for i in range(0, len(response), 2000):
                    await message.reply(response[i:i+2000])
            else:
                await message.reply(response)

    await bot.process_commands(message)

# --- 5. EXECUTION ---
if __name__ == "__main__":
    # Start the keep-alive server
    Thread(target=run_web_server).start()
    
    # Start the Discord Bot
    token = os.getenv("DISCORD_TOKEN")
    if token:
        bot.run(token)
    else:
        print("❌ CRITICAL: No DISCORD_TOKEN found in Environment Variables.")
