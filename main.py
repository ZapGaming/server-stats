import discord
import os
import asyncio

# Retrieve bot token from environment variables
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")

# Check for environment variables
if not DISCORD_TOKEN:
    print("Error: DISCORD_TOKEN environment variable is not set.")
    exit(1)

# Define the intents for the bot
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

# Create the bot client and sync commands to the guild
bot = discord.Client(intents=intents)
tree = discord.app_commands.CommandTree(bot)

@bot.event
async def on_ready():
    """
    Event that runs when the bot is connected to Discord.
    It synchronizes the command tree globally.
    """
    print(f'Logged in as {bot.user}')
    # Sync the command tree globally. This can take up to an hour to appear.
    await tree.sync()
    print('Commands synced globally.')

@tree.command(
    name="shutup",
    description="Makes the bot mention the specified user 100 times."
)
@discord.app_commands.checks.has_permissions(manage_messages=True)
async def shutup(interaction: discord.Interaction, user: discord.Member):
    """
    A slash command to mention a user 100 times.
    This command can only be used by users with the "Manage Messages" permission.

    Args:
        interaction: The interaction object.
        user: The user to be mentioned.
    """
    # Defer the interaction response so the user knows the command is being processed
    await interaction.response.defer(ephemeral=True)
    
    # Loop 100 times to send the mention
    for _ in range(100):
        # A small delay to prevent rate-limiting
        await asyncio.sleep(1)
        # Send the mention
        await interaction.channel.send(f"{user.mention}")

# Error handler for the command
@shutup.error
async def on_shutup_error(interaction: discord.Interaction, error: discord.app_commands.AppCommandError):
    if isinstance(error, discord.app_commands.MissingPermissions):
        await interaction.response.send_message(
            "You don't have permission to use this command. You need the 'Manage Messages' permission.", 
            ephemeral=True
        )
    else:
        await interaction.response.send_message(f"An error occurred: {error}", ephemeral=True)

# Run the bot with the token from the environment variable
bot.run(DISCORD_TOKEN)
