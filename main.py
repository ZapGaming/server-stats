import os
import discord
from discord.ext import commands
from openai import OpenAI
from flask import Flask
from threading import Thread

# --- WEB SERVER SETUP (For Render Keep-Alive) ---
app = Flask('')

@app.route('/')
def home():
    return "Chillax Support Bot is running."

def run_web_server():
    # Render assigns a PORT env variable automatically
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)

# --- AI CONFIGURATION (OpenRouter) ---
ai_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    default_headers={
        "HTTP-Referer": "https://render.com",
        "X-Title": "Chillax Support AI",
    }
)

def ask_ai(user_query, user_name):
    try:
        response = ai_client.chat.completions.create(
            model="openrouter/auto", # Automatically picks the best/cheapest model
            messages=[
                {"role": "system", "content": (
                    "You are the official support AI for the 'Chillax' Discord theme. "
                    "Chillax is a clean, aesthetic theme used with Vencord or BetterDiscord. "
                    "Your goal is to help users with CSS snippets, installation, and Vencord settings. "
                    "Be concise, tech-savvy, and helpful. Use code blocks for CSS snippets."
                )},
                {"role": "user", "content": f"User {user_name} asks: {user_query}"}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"⚠️ Error fetching AI response: {e}"

# --- DISCORD BOT SETUP ---
intents = discord.Intents.default()
intents.message_content = True  # CRITICAL: Enable this in Discord Dev Portal

bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f'✅ Connected to Discord as {bot.user}')
    await bot.change_presence(activity=discord.Game(name="Customizing Chillax"))

@bot.event
async def on_message(message):
    # Don't respond to ourselves
    if message.author == bot.user:
        return

    # Trigger AI if the bot is mentioned or if "Chillax" is mentioned
    if bot.user.mentioned_in(message) or "chillax" in message.content.lower():
        async with message.channel.typing():
            # Clean the message content (remove the bot mention)
            clean_content = message.content.replace(f'<@!{bot.user.id}>', '').replace(f'<@{bot.user.id}>', '').strip()
            
            if not clean_content:
                clean_content = "Tell me about the Chillax theme."

            answer = ask_ai(clean_content, message.author.name)
            
            # Send the response (handling Discord's 2000 char limit)
            if len(answer) > 2000:
                chunks = [answer[i:i+1900] for i in range(0, len(answer), 1900)]
                for chunk in chunks:
                    await message.reply(chunk)
            else:
                await message.reply(answer)

    # Process other commands (like !ping)
    await bot.process_commands(message)

# --- BOT COMMANDS ---
@bot.command()
async def ping(ctx):
    await ctx.send(f"🏓 Pong! Latency: {round(bot.latency * 1000)}ms")

# --- EXECUTION ---
if __name__ == "__main__":
    # Start the Flask thread
    t = Thread(target=run_web_server)
    t.start()
    
    # Run the Discord Bot
    token = os.getenv("DISCORD_TOKEN")
    if token:
        bot.run(token)
    else:
        print("❌ FATAL: DISCORD_TOKEN not found in Environment Variables.")
