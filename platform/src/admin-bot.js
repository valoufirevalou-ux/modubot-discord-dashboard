import {
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionsBitField,
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";
import {
  addEvent,
  getGuildLogChannels,
  getUser,
  saveGuildLogChannel
} from "./store.js";
import { runtimeCount } from "./runtime.js";

let adminClient;
const DEFAULT_LOG_CHANNEL_ID = "1563843691326476450";

function fixedLogChannelId() {
  const configured = process.env.DISCORD_LOG_CHANNEL_ID?.trim();
  return configured?.toLowerCase() === "database" ? "" : configured || DEFAULT_LOG_CHANNEL_ID;
}

const adminCommands = [
  new SlashCommandBuilder().setName("configurer-journal").setDescription("Choisir le salon privé des événements ModuBot.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addChannelOption((option) => option.setName("salon").setDescription("Salon réservé aux responsables").addChannelTypes(ChannelType.GuildText).setRequired(true)),
  new SlashCommandBuilder().setName("tester-journal").setDescription("Vérifier l’envoi dans le salon de journal.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
  new SlashCommandBuilder().setName("statut-modubot").setDescription("Voir l’état du service ModuBot.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
].map((command) => command.toJSON());

function isModerator(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)
    || interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator));
}

export async function notifyAdmin({ type = "site_event", title, summary, userId }) {
  if (!adminClient?.isReady()) return false;
  const fixedChannelId = fixedLogChannelId();
  const channels = fixedChannelId
    ? [{ guild_id: "configured", log_channel_id: fixedChannelId }]
    : getGuildLogChannels();
  const embed = new EmbedBuilder()
    .setColor(type.startsWith("payment") ? 0xf0b95c : 0x8a73ff)
    .setTitle(String(title || type).slice(0, 240))
    .setDescription(String(summary || "Événement du site").slice(0, 1500))
    .setTimestamp(new Date());
  if (userId) {
    const user = getUser(userId);
    const username = String(user?.username || "Utilisateur Discord").replace(/[`*_~|]/g, "").slice(0, 80);
    embed.addFields({ name: "Compte Discord", value: `**${username}**\n\`${userId}\``, inline: true });
  }
  const results = await Promise.all(channels.map(async ({ guild_id: guildId, log_channel_id: channelId }) => {
    const channel = adminClient.channels.cache.get(channelId)
      || await adminClient.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || !channel.guild) {
      console.error(`Admin log delivery skipped (${guildId}): channel unavailable or not a server text channel.`);
      return false;
    }
    const everyonePermissions = channel.permissionsFor(channel.guild.roles.everyone);
    if (!everyonePermissions || everyonePermissions.has(PermissionFlagsBits.ViewChannel)) {
      console.error(`Admin log delivery skipped (${guildId}): log channel must be private to @everyone.`);
      return false;
    }
    const botMember = channel.guild.members.me || await channel.guild.members.fetchMe().catch(() => null);
    const botPermissions = botMember && channel.permissionsFor(botMember);
    if (!botPermissions?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks
    ])) {
      console.error(`Admin log delivery skipped (${guildId}): bot needs view, send, and embed permissions.`);
      return false;
    }
    try {
      await channel.send({
        embeds: [embed],
        components: [],
        allowedMentions: { parse: [] }
      });
      return true;
    } catch (error) {
      console.error(`Admin log delivery failed (${guildId}):`, error?.code || error?.name || "error");
      return false;
    }
  }));
  return results.some(Boolean);
}

export async function startAdminBot() {
  const token = process.env.PLATFORM_BOT_TOKEN;
  if (!token) {
    console.warn("PLATFORM_BOT_TOKEN is empty; private Discord logs and approval commands are offline.");
    return null;
  }
  adminClient = new Client({ intents: [GatewayIntentBits.Guilds] });
  adminClient.once(Events.ClientReady, async (client) => {
    try {
      await Promise.all(client.guilds.cache.map((guild) => guild.commands.set(adminCommands).catch(() => null)));
      console.log("Private ModuBot Discord bot is ready.");
      await notifyAdmin({ type: "service_ready", title: "Bot opérateur connecté", summary: "Les notifications générales du site sont actives." });
    } catch (error) {
      console.error("Could not register ModuBot slash commands:", error?.code || error?.name || "error");
    }
  });
  adminClient.on(Events.GuildCreate, (guild) => guild.commands.set(adminCommands).catch((error) => {
    console.error(`Could not register commands in guild ${guild.id}:`, error?.code || error?.name || "error");
  }));
  adminClient.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isButton()) {
        if (interaction.customId.startsWith("mb_approve:") || interaction.customId.startsWith("mb_reject:")) {
          return interaction.reply({ content: `Les validations PayPal se font maintenant dans l’espace admin : ${process.env.APP_BASE_URL}/admin`, ephemeral: true });
        }
      }
      if (!interaction.isChatInputCommand()) return;
      if (!isModerator(interaction)) return interaction.reply({ content: "Cette commande demande la permission Gérer le serveur.", ephemeral: true });
      if (interaction.commandName === "configurer-journal") {
        const channel = interaction.options.getChannel("salon");
        const fixedChannelId = fixedLogChannelId();
        if (fixedChannelId && channel.id !== fixedChannelId) {
          return interaction.reply({ content: `Le salon de journal est fixé dans la configuration de l’hébergement : <#${fixedChannelId}>.`, ephemeral: true });
        }
        const everyonePermissions = channel.permissionsFor(interaction.guild.roles.everyone);
        if (everyonePermissions?.has(PermissionFlagsBits.ViewChannel)) {
          return interaction.reply({ content: "Ce salon est visible par @everyone. Rends-le privé avant de le choisir.", ephemeral: true });
        }
        const botPermissions = channel.permissionsFor(interaction.guild.members.me);
        if (!botPermissions?.has(PermissionFlagsBits.ViewChannel)
          || !botPermissions.has(PermissionFlagsBits.SendMessages)
          || !botPermissions.has(PermissionFlagsBits.EmbedLinks)) {
          return interaction.reply({ content: "Donne au bot l’accès au salon, l’envoi de messages et l’intégration des liens.", ephemeral: true });
        }
        saveGuildLogChannel(interaction.guildId, channel.id);
        await interaction.reply({ content: `Les événements du site seront envoyés dans ${channel}. Vérifie que seuls les responsables du service ont accès à ce salon.`, ephemeral: true });
        return notifyAdmin({ type: "logging_configured", title: "Journal ModuBot configuré", summary: `Salon : #${channel.name}`, userId: interaction.user.id });
      }
      if (interaction.commandName === "tester-journal") {
        const sent = await notifyAdmin({
          type: "journal_test",
          title: "Test du journal ModuBot",
          summary: `Test demandé par ${interaction.user.username}. Les événements du site doivent apparaître ici.`,
          userId: interaction.user.id
        });
        return interaction.reply({
          content: sent ? "Message test envoyé dans le salon de journal." : "Envoi impossible. Vérifie le token du bot, l’identifiant du salon, sa confidentialité et les droits du bot.",
          ephemeral: true
        });
      }
      if (interaction.commandName === "statut-modubot") {
        const logChannel = fixedLogChannelId() || `${getGuildLogChannels().length} salon(s) configuré(s)`;
        return interaction.reply({ content: `Service actif · ${runtimeCount()} bot(s) en ligne · capacité configurée : ${Math.max(1, Number.parseInt(process.env.MAX_HOSTED_BOTS || "1", 10) || 1)} · journal : ${fixedLogChannelId() ? `<#${logChannel}>` : logChannel}.`, ephemeral: true });
      }
    } catch (error) {
      console.error("Admin Discord interaction failed:", error?.code || error?.name || "error");
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "L’action n’a pas abouti. Réessaie dans un instant.", ephemeral: true }).catch(() => null);
      }
    }
  });
  try {
    await adminClient.login(token);
  } catch (error) {
    adminClient.destroy();
    adminClient = null;
    console.error("Private ModuBot Discord bot could not connect:", error?.code || error?.name || "error");
  }
  return adminClient;
}

export async function stopAdminBot() {
  if (!adminClient) return;
  adminClient.destroy();
  adminClient = null;
}
