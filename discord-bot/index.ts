// Discord Bot for AquaList - Bot List Website
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  WebhookClient,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  Guild,
  TextChannel,
  Interaction,
  CommandInteraction,
  ButtonInteraction,
  ClientOptions,
  Embed,
  APIEmbed,
  ActivityType,
  PresenceStatusData,
  ChatInputCommandInteraction
} from "discord.js";
import express, { Request, Response } from "express";
import { MongoClient, Db, ObjectId, Filter } from "mongodb";
import config from "./config";

// Define interfaces for bot data
interface Bot {
  _id: ObjectId;
  clientId: string;
  name: string;
  description?: string;
  avatar?: string;
  website?: string;
  supportServer?: string;
  githubRepo?: string;
  tags?: string[];
  servers?: number;
  votes?: number;
  status: "pending" | "approved" | "rejected";
  lastServerCountUpdate?: Date;
  prefix?: string;
  verified?: boolean;
}

interface NotificationPayload {
  type: "bot_submit" | "bot_approve" | "bot_reject" | "bot_vote";
  botId: string;
  botName: string;
  userId: string;
  username: string;
  reason?: string;
  description?: string;
  avatar?: string;
  website?: string;
  supportServer?: string;
  githubRepo?: string;
  tags?: string[];
  voteCount?: number;
}

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Initialize Express server
const app = express();
app.use(express.json());

// MongoDB connection
const mongoClient = new MongoClient(config.mongodb.uri);
let db: Db;
let logChannel: TextChannel | null = null;
let webhookClient: WebhookClient | null = null;

// Connect to MongoDB
async function connectToMongo(): Promise<void> {
  try {
    await mongoClient.connect();
    console.log("Connected to MongoDB");
    db = mongoClient.db("AquaList");

    // Update server counts for all bots periodically
    setInterval(updateAllBotServerCounts, 1000 * 60 * 60); // Every hour
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

// Update server counts for all bots
async function updateAllBotServerCounts(): Promise<void> {
  try {
    const bots = await db
      .collection<Bot>("bots")
      .find({ status: "approved" })
      .toArray();

    console.log(`Updating server counts for ${bots.length} bots...`);

    for (const bot of bots) {
      try {
        // Get bot's guild count using Discord API
        const botGuilds = await client.rest
          .get(`/applications/${bot.clientId}/guilds`)
          .catch((err) => {
            console.error(
              `Failed to get guilds for bot ${bot.name} (${bot.clientId}):`,
              err.message
            );
            return null;
          });

        if (!botGuilds) continue;

        const serverCount = (botGuilds as any[]).length;

        // Update in database
        await db.collection<Bot>("bots").updateOne(
          { _id: bot._id },
          {
            $set: { servers: serverCount, lastServerCountUpdate: new Date() },
          }
        );

        console.log(
          `Updated server count for ${bot.name}: ${serverCount} servers`
        );
      } catch (error: any) {
        console.error(
          `Error updating server count for bot ${bot.clientId}:`,
          error.message
        );
      }
    }
  } catch (error: any) {
    console.error("Error updating bot server counts:", error.message);
  }
}

// Send message to log channel
async function sendLogMessage(embed: EmbedBuilder, botId: string | null = null, botData: Partial<Bot> = {}): Promise<void> {
  try {
    // Check if log channel is available
    if (!logChannel) {
      const guild = client.guilds.cache.get(config.discord.serverId);
      if (!guild) {
        console.error(
          "Guild not found. Make sure the bot is in the server and the server ID is correct."
        );
        return;
      }

      logChannel = guild.channels.cache.get(config.discord.logChannelId) as TextChannel;
      if (!logChannel) {
        console.error(
          "Log channel not found. Make sure the channel ID is correct."
        );
        return;
      }
    }

    // Add description if available
    if (botData.description) {
      embed.addFields({
        name: "Description",
        value:
          botData.description.length > 100
            ? botData.description.substring(0, 100) + "..."
            : botData.description,
        inline: false,
      });
    }

    // Add links if available
    const links: string[] = [];
    if (botData.website) links.push(`[Website](${botData.website})`);
    if (botData.supportServer)
      links.push(`[Support Server](${botData.supportServer})`);
    if (botData.githubRepo) links.push(`[GitHub](${botData.githubRepo})`);

    if (links.length > 0) {
      embed.addFields({
        name: "Links",
        value: links.join(" | "),
        inline: false,
      });
    }

    // Add tags if available
    if (botData.tags && botData.tags.length > 0) {
      embed.addFields({
        name: "Tags",
        value: botData.tags.join(", "),
        inline: false,
      });
    }

    // Create button component if botId is provided
    const components: any[] = [];
    if (botId) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("View on AquaList")
          .setStyle(ButtonStyle.Link)
          .setURL(`${config.website.baseUrl}/bots/${botId}`)
          .setEmoji("🔗"),
        new ButtonBuilder()
          .setLabel("Add to Discord")
          .setStyle(ButtonStyle.Link)
          .setURL(
            `https://discord.com/oauth2/authorize?client_id=${botId}&scope=bot&permissions=0`
          )
          .setEmoji("➕")
      );
      components.push(row);
    }

    // Add thumbnail to embed if it's a bot notification
    if (embed.data.title?.includes("Bot") || embed.data.title?.includes("Vote")) {
      // Try to get the bot's avatar from Discord API
      try {
        const botInfo = await client.rest
          .get(`/applications/${botId}`)
          .catch(() => null);
        if (botInfo && (botInfo as any).icon) {
          const avatarURL = `https://cdn.discordapp.com/app-icons/${botId}/${(botInfo as any).icon}.png?size=256`;
          embed.setThumbnail(avatarURL);
        } else if (botData.avatar) {
          embed.setThumbnail(botData.avatar);
        }
      } catch (error) {
        console.error("Error fetching bot avatar:", error);
        if (botData.avatar) {
          embed.setThumbnail(botData.avatar);
        }
      }
    }

    // Add emoji to title based on notification type
    if (embed.data.title?.includes("New Bot Submission")) {
      embed.setTitle(`📥 ${embed.data.title}`);
    } else if (embed.data.title?.includes("New Vote")) {
      embed.setTitle(`🔼 ${embed.data.title}`);
    } else if (embed.data.title?.includes("Bot Approved")) {
      embed.setTitle(`✅ ${embed.data.title}`);
    } else if (embed.data.title?.includes("Bot Rejected")) {
      embed.setTitle(`❌ ${embed.data.title}`);
    }

    // Send the message with embeds and components
    try {
      await logChannel.send({
        embeds: [embed],
        components: components.length > 0 ? components : undefined,
      });
    } catch (error) {
      console.error("Error sending embed message:", error);

      // Fallback: Try sending without components
      try {
        await logChannel.send({ embeds: [embed] });
      } catch (fallbackError) {
        console.error("Error sending embed without components:", fallbackError);

        // Last resort: Send as plain text
        const plainTextContent = `**${embed.data.title}**\n\n`;
        let fieldsText = "";

        if (embed.data.fields) {
          embed.data.fields.forEach((field) => {
            fieldsText += `**${field.name}:** ${field.value}\n`;
          });
        }

        await logChannel.send(plainTextContent + fieldsText);
      }
    }
  } catch (error) {
    console.error("Error in sendLogMessage:", error);
  }
}

// Discord bot ready event
client.once("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  // Set bot status and activity
  try {
    await client.user?.setPresence({
      status: 'online',
      activities: [{
        name: 'AquaList.xyz | /help',
        type: ActivityType.Watching
      }]
    });
    console.log("Bot presence set successfully");
  } catch (error) {
    console.error("Error setting bot presence:", error);
  }

  // Get the log channel
  try {
    const guild = client.guilds.cache.get(config.discord.serverId);
    if (guild) {
      logChannel = guild.channels.cache.get(config.discord.logChannelId) as TextChannel;
      if (logChannel) {
        console.log(`Log channel found: ${logChannel.name}`);
      } else {
        console.error(
          "Log channel not found. Make sure the channel ID is correct."
        );
      }
    } else {
      console.error(
        "Guild not found. Make sure the bot is in the server and the server ID is correct."
      );
    }
  } catch (error) {
    console.error("Error finding log channel:", error);
  }

  // Register slash commands
  try {
    const commands = [
      new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Show statistics about the bot list"),
      new SlashCommandBuilder()
        .setName("bot")
        .setDescription("Get information about a specific bot")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("The ID of the bot")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("approve")
        .setDescription("Approve a bot (Admin only)")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("The ID of the bot")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("reject")
        .setDescription("Reject a bot (Admin only)")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("The ID of the bot")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("The reason for rejection")
            .setRequired(true)
        ),
    ];

    const rest = new REST({ version: "10" }).setToken(config.discord.botToken);

    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(client.user!.id), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error("Error registering slash commands:", error);
  }

  connectToMongo();
});

// Handle API requests from website
app.post("/api/discord-bot/notify", async (req: Request, res: Response) => {
  try {
    // Parse the request body
    const payload = await req.json() as NotificationPayload;
    const { type, botId, botName, userId, username } = payload;

    if (type === "bot_submit") {
      // Bot submission notification
      const embed = new EmbedBuilder()
        .setTitle("New Bot Submission")
        .addFields(
          { name: "Bot Name", value: botName, inline: true },
          { name: "Bot ID", value: botId, inline: true },
          { name: "Submitted By", value: username, inline: true }
        )
        .setColor("#3498db")
        .setTimestamp();

      await sendLogMessage(embed, botId);
    } else if (type === "bot_approve") {
      // Bot approval notification
      const embed = new EmbedBuilder()
        .setTitle("Bot Approved")
        .addFields(
          { name: "Bot Name", value: botName, inline: true },
          { name: "Bot ID", value: botId, inline: true },
          { name: "Approved By", value: username, inline: true }
        )
        .setColor("#27ae60")
        .setTimestamp();

      await sendLogMessage(embed, botId);
    } else if (type === "bot_reject") {
      // Bot rejection notification
      const embed = new EmbedBuilder()
        .setTitle("Bot Rejected")
        .addFields(
          { name: "Bot Name", value: botName, inline: true },
          { name: "Bot ID", value: botId, inline: true },
          { name: "Rejected By", value: username, inline: true },
          {
            name: "Reason",
            value: payload.reason || "No reason provided",
            inline: false,
          }
        )
        .setColor("#e74c3c")
        .setTimestamp();

      await sendLogMessage(embed, botId);
    } else if (type === "bot_vote") {
      // Bot vote notification
      const embed = new EmbedBuilder()
        .setTitle("New Bot Vote")
        .addFields(
          { name: "Bot Name", value: botName, inline: true },
          { name: "Bot ID", value: botId, inline: true },
          { name: "Voted By", value: username, inline: true },
          { name: "Total Votes", value: payload.voteCount?.toString() || "1", inline: true }
        )
        .setColor("#9b59b6")
        .setTimestamp();

      await sendLogMessage(embed, botId);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error handling notification:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Handle slash commands
client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const commandInteraction = interaction as ChatInputCommandInteraction;

  try {
    if (commandName === "stats") {
      await commandInteraction.deferReply();

      const botsCount = await db
        .collection("bots")
        .countDocuments({ status: "approved" });
      const usersCount = await db.collection("users").countDocuments();
      const votesCount = await db.collection("votes").countDocuments();

      const embed = new EmbedBuilder()
        .setTitle("AquaList Statistics")
        .setDescription("Current statistics for our bot list website")
        .addFields(
          { name: "Total Bots", value: botsCount.toString(), inline: true },
          { name: "Total Users", value: usersCount.toString(), inline: true },
          { name: "Total Votes", value: votesCount.toString(), inline: true }
        )
        .setColor("#9b59b6")
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Visit Website")
          .setStyle(ButtonStyle.Link)
          .setURL(config.website.baseUrl)
          .setEmoji("🌐")
      );

      await commandInteraction.editReply({ embeds: [embed], components: [row] });
    } else if (commandName === "bot") {
      await commandInteraction.deferReply();

      const botId = commandInteraction.options.getString("id");
      if (!botId) {
        await commandInteraction.editReply("Bot ID is required");
        return;
      }
      
      const bot = await db.collection<Bot>("bots").findOne({ clientId: botId });

      if (!bot) {
        await commandInteraction.editReply(`No bot found with ID ${botId}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(bot.name)
        .setDescription(bot.description || "No description provided")
        .addFields(
          { name: "Prefix", value: bot.prefix || "Unknown", inline: true },
          {
            name: "Servers",
            value: (bot.servers || 0).toString(),
            inline: true,
          },
          { name: "Votes", value: (bot.votes || 0).toString(), inline: true },
          { name: "Status", value: bot.status, inline: true },
          {
            name: "Tags",
            value: bot.tags?.join(", ") || "None",
            inline: false,
          }
        )
        .setColor("#3498db")
        .setTimestamp();

      if (bot.website) {
        embed.addFields({
          name: "Website",
          value: bot.website,
          inline: false,
        });
      }

      // Add bot avatar if available
      if (bot.avatar) {
        embed.setThumbnail(bot.avatar);
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("View on AquaList")
          .setStyle(ButtonStyle.Link)
          .setURL(`${config.website.baseUrl}/bots/${bot.clientId}`)
          .setEmoji("🔗"),
        new ButtonBuilder()
          .setLabel("Add to Discord")
          .setStyle(ButtonStyle.Link)
          .setURL(
            `https://discord.com/oauth2/authorize?client_id=${bot.clientId}&scope=bot&permissions=0`
          )
          .setEmoji("➕")
      );

      await commandInteraction.editReply({ embeds: [embed], components: [row] });
    } else if (commandName === "approve") {
      // Check if user has admin permissions
      if (
        !commandInteraction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await commandInteraction.reply({
          content: "You don't have permission to use this command.",
          ephemeral: true,
        });
        return;
      }

      await commandInteraction.deferReply();

      const botId = commandInteraction.options.getString("id");
      if (!botId) {
        await commandInteraction.editReply("Bot ID is required");
        return;
      }
      
      const bot = await db.collection<Bot>("bots").findOne({ clientId: botId });

      if (!bot) {
        await commandInteraction.editReply(`No bot found with ID ${botId}`);
        return;
      }

      if (bot.status === "approved") {
        await commandInteraction.editReply(`Bot ${bot.name} is already approved.`);
        return;
      }

      // Update bot status
      await db
        .collection<Bot>("bots")
        .updateOne(
          { clientId: botId },
          { $set: { status: "approved", approvedAt: new Date() } }
        );

      const embed = new EmbedBuilder()
        .setTitle("Bot Approved")
        .setDescription(`Bot ${bot.name} has been approved.`)
        .setColor("#27ae60")
        .setTimestamp();

      await commandInteraction.editReply({ embeds: [embed] });

      // Send notification
      const notificationEmbed = new EmbedBuilder()
        .setTitle("Bot Approved")
        .addFields(
          { name: "Bot", value: bot.name, inline: true },
          { name: "Bot ID", value: botId!, inline: true },
          {
            name: "Approved By",
            value: commandInteraction.user.tag,
            inline: true,
          }
        )
        .setColor("#27ae60")
        .setTimestamp();

      await sendLogMessage(notificationEmbed, botId, bot);
    } else if (commandName === "reject") {
      // Check if user has admin permissions
      if (
        !commandInteraction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await commandInteraction.reply({
          content: "You don't have permission to use this command.",
          ephemeral: true,
        });
        return;
      }

      await commandInteraction.deferReply();

      const botId = commandInteraction.options.getString("id");
      const reason = commandInteraction.options.getString("reason");
      
      if (!botId) {
        await commandInteraction.editReply("Bot ID is required");
        return;
      }
      
      if (!reason) {
        await commandInteraction.editReply("Rejection reason is required");
        return;
      }
      
      const bot = await db.collection<Bot>("bots").findOne({ clientId: botId });

      if (!bot) {
        await commandInteraction.editReply(`No bot found with ID ${botId}`);
        return;
      }

      if (bot.status === "rejected") {
        await commandInteraction.editReply(`Bot ${bot.name} is already rejected.`);
        return;
      }

      // Update bot status
      await db.collection<Bot>("bots").updateOne(
        { clientId: botId },
        {
          $set: {
            status: "rejected",
            rejectedAt: new Date(),
            rejectionReason: reason,
          },
        }
      );

      const embed = new EmbedBuilder()
        .setTitle("Bot Rejected")
        .setDescription(`Bot ${bot.name} has been rejected.`)
        .addFields({ name: "Reason", value: reason!, inline: false })
        .setColor("#e74c3c")
        .setTimestamp();

      await commandInteraction.editReply({ embeds: [embed] });

      // Send notification
      const notificationEmbed = new EmbedBuilder()
        .setTitle("Bot Rejected")
        .addFields(
          { name: "Bot", value: bot.name, inline: true },
          { name: "Bot ID", value: botId!, inline: true },
          {
            name: "Rejected By",
            value: commandInteraction.user.tag,
            inline: true,
          },
          {
            name: "Reason",
            value: reason!,
            inline: false,
          }
        )
        .setColor("#e74c3c")
        .setTimestamp();

      await sendLogMessage(notificationEmbed, botId, bot);
    }
  } catch (error: any) {
    console.error(`Error handling command ${commandName}:`, error);
    try {
      if (!commandInteraction.replied && !commandInteraction.deferred) {
        await commandInteraction.reply({
          content: "An error occurred while processing your command.",
          ephemeral: true
        });
      } else {
        await commandInteraction.editReply("An error occurred while processing your command.");
      }
    } catch (replyError) {
      console.error("Error sending error reply:", replyError);
    }
  }
});

// Start Express server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Discord bot API server running on port ${PORT}`);
});

// Login to Discord
client.login(config.discord.botToken); 