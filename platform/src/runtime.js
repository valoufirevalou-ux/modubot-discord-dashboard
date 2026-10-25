import {
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";
import { MODULES, canUseModule, effectivePlan, findPlan } from "./plans.js";
import {
  addEvent,
  addModerationWarning,
  deleteModerationWarning,
  deleteBot as deleteBotRow,
  getAntiSpamSettings,
  getAllBots,
  getAllUsers,
  getBot,
  getBotsForUser,
  getModerationWarnings,
  getUser,
  setAntiSpamSettings,
  updateBotConfig,
  updateBotStatus
} from "./store.js";
import { decryptToken } from "./secrets.js";

const managedClients = new Map();
const antiSpamMessages = new Map();
const maxHostedBots = () => Math.max(1, Number.parseInt(process.env.MAX_HOSTED_BOTS || "1", 10) || 1);

function clearAntiSpamWindow(botId, guildId) {
  const prefix = `${botId}:${guildId}:`;
  for (const key of antiSpamMessages.keys()) {
    if (key.startsWith(prefix)) antiSpamMessages.delete(key);
  }
}

const commandsFor = (selected) => {
  const commands = [];
  if (selected.includes("utility")) {
    commands.push(
      new SlashCommandBuilder().setName("ping").setDescription("Vérifier que le bot répond."),
      new SlashCommandBuilder().setName("aide").setDescription("Afficher les commandes actives."),
      new SlashCommandBuilder().setName("serveur").setDescription("Afficher les infos de ce serveur."),
      new SlashCommandBuilder().setName("membre").setDescription("Afficher les infos d’un membre.")
        .addUserOption((option) => option.setName("personne").setDescription("Membre à consulter")),
      new SlashCommandBuilder().setName("avatar").setDescription("Afficher un avatar Discord.")
        .addUserOption((option) => option.setName("personne").setDescription("Membre à consulter")),
      new SlashCommandBuilder().setName("botinfo").setDescription("Afficher les informations de ce bot."),
      new SlashCommandBuilder().setName("saloninfo").setDescription("Afficher les informations d’un salon.")
        .addChannelOption((option) => option.setName("salon").setDescription("Salon à consulter")),
      new SlashCommandBuilder().setName("roleinfo").setDescription("Afficher les informations d’un rôle.")
        .addRoleOption((option) => option.setName("role").setDescription("Rôle à consulter").setRequired(true))
    );
  }
  if (selected.includes("moderation")) {
    commands.push(
      new SlashCommandBuilder().setName("vider").setDescription("Supprimer des messages récents.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption((option) => option.setName("nombre").setDescription("Entre 1 et 100").setMinValue(1).setMaxValue(100).setRequired(true)),
      new SlashCommandBuilder().setName("expulser").setDescription("Expulser un membre du serveur.")
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption((option) => option.setName("personne").setDescription("Membre à expulser").setRequired(true))
        .addStringOption((option) => option.setName("raison").setDescription("Motif de la sanction").setMaxLength(400)),
      new SlashCommandBuilder().setName("bannir").setDescription("Bannir un membre du serveur.")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption((option) => option.setName("personne").setDescription("Membre à bannir").setRequired(true))
        .addStringOption((option) => option.setName("raison").setDescription("Motif de la sanction").setMaxLength(400)),
      new SlashCommandBuilder().setName("timeout").setDescription("Mettre un membre en pause temporaire.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption((option) => option.setName("personne").setDescription("Membre concerné").setRequired(true))
        .addIntegerOption((option) => option.setName("minutes").setDescription("Durée, de 1 à 40 320 minutes").setMinValue(1).setMaxValue(40320).setRequired(true))
        .addStringOption((option) => option.setName("raison").setDescription("Motif de la sanction").setMaxLength(400)),
      new SlashCommandBuilder().setName("dire").setDescription("Publier un message sans mentions automatiques.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption((option) => option.setName("message").setDescription("Texte à publier").setMaxLength(1800).setRequired(true)),
      new SlashCommandBuilder().setName("avertir").setDescription("Enregistrer un avertissement pour un membre.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption((option) => option.setName("membre").setDescription("Membre à avertir").setRequired(true))
        .addStringOption((option) => option.setName("raison").setDescription("Motif de l’avertissement").setMaxLength(400).setRequired(true)),
      new SlashCommandBuilder().setName("avertissements").setDescription("Consulter les avertissements d’un membre.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption((option) => option.setName("membre").setDescription("Membre à consulter").setRequired(true)),
      new SlashCommandBuilder().setName("retirer-avertissement").setDescription("Retirer un avertissement enregistré.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption((option) => option.setName("membre").setDescription("Membre concerné").setRequired(true))
        .addIntegerOption((option) => option.setName("id").setDescription("Numéro affiché par /avertissements").setMinValue(1).setRequired(true)),
      new SlashCommandBuilder().setName("retirer-timeout").setDescription("Retirer le timeout d’un membre.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption((option) => option.setName("membre").setDescription("Membre concerné").setRequired(true))
        .addStringOption((option) => option.setName("raison").setDescription("Motif du retrait").setMaxLength(400)),
      new SlashCommandBuilder().setName("debannir").setDescription("Révoquer le bannissement d’un compte Discord.")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption((option) => option.setName("identifiant").setDescription("Identifiant Discord du compte").setMinLength(17).setMaxLength(20).setRequired(true))
        .addStringOption((option) => option.setName("raison").setDescription("Motif du débanissement").setMaxLength(400)),
      new SlashCommandBuilder().setName("pseudo").setDescription("Modifier le surnom d’un membre.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .addUserOption((option) => option.setName("membre").setDescription("Membre concerné").setRequired(true))
        .addStringOption((option) => option.setName("nom").setDescription("Nouveau surnom").setMinLength(1).setMaxLength(32).setRequired(true)),
      new SlashCommandBuilder().setName("role-ajouter").setDescription("Ajouter un rôle à un membre.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption((option) => option.setName("membre").setDescription("Membre concerné").setRequired(true))
        .addRoleOption((option) => option.setName("role").setDescription("Rôle à ajouter").setRequired(true)),
      new SlashCommandBuilder().setName("role-retirer").setDescription("Retirer un rôle à un membre.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption((option) => option.setName("membre").setDescription("Membre concerné").setRequired(true))
        .addRoleOption((option) => option.setName("role").setDescription("Rôle à retirer").setRequired(true))
    );
  }
  if (selected.includes("protection")) {
    commands.push(
      new SlashCommandBuilder().setName("verrouiller").setDescription("Empêcher les membres d’écrire dans ce salon.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
      new SlashCommandBuilder().setName("deverrouiller").setDescription("Rétablir les permissions d’écriture de ce salon.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
      new SlashCommandBuilder().setName("slowmode").setDescription("Régler le délai entre les messages.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addIntegerOption((option) => option.setName("secondes").setDescription("Entre 0 et 21 600").setMinValue(0).setMaxValue(21600).setRequired(true)),
      new SlashCommandBuilder().setName("anti-spam").setDescription("Activer ou régler la protection contre le spam rapide.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addBooleanOption((option) => option.setName("activer").setDescription("Activer la détection automatique").setRequired(true))
        .addIntegerOption((option) => option.setName("seuil").setDescription("Messages avant timeout, de 3 à 12").setMinValue(3).setMaxValue(12).setRequired(true))
        .addIntegerOption((option) => option.setName("fenetre").setDescription("Durée en secondes, de 2 à 30").setMinValue(2).setMaxValue(30).setRequired(true))
    );
  }
  if (selected.includes("community")) {
    commands.push(
      new SlashCommandBuilder().setName("sondage").setDescription("Créer un sondage avec deux réactions.")
        .addStringOption((option) => option.setName("question").setDescription("Question du sondage").setMaxLength(700).setRequired(true)),
      new SlashCommandBuilder().setName("annonce").setDescription("Publier une annonce dans un salon.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption((option) => option.setName("salon").setDescription("Salon de destination").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((option) => option.setName("message").setDescription("Texte de l’annonce").setMaxLength(1800).setRequired(true))
    );
  }
  if (selected.includes("fun")) {
    commands.push(
      new SlashCommandBuilder().setName("de").setDescription("Lancer un dé à six faces."),
      new SlashCommandBuilder().setName("boule-magique").setDescription("Obtenir une réponse amusante à une question.")
        .addStringOption((option) => option.setName("question").setDescription("Ta question").setMaxLength(250).setRequired(true))
    );
  }
  if (selected.includes("support")) {
    commands.push(
      new SlashCommandBuilder().setName("ticket").setDescription("Ouvrir un salon privé de support.")
    );
  }
  return commands.map((command) => command.toJSON());
};

function availableModulesFor(row) {
  const owner = getUser(row.owner_id);
  const plan = effectivePlan(owner);
  return JSON.parse(row.modules_json).filter((id) => canUseModule(plan, id));
}

function statusText(bot) {
  if (bot.status === "running") return "En ligne";
  if (bot.status === "suspended") return "En pause · limite du forfait ou de l’hébergement";
  if (bot.status === "error") return "À vérifier · connexion Discord";
  if (bot.status === "starting") return "Connexion…";
  return "Hors ligne";
}

export function publicBot(bot) {
  return {
    id: bot.id,
    projectName: bot.project_name || bot.bot_username,
    username: bot.bot_username,
    discordId: bot.bot_user_id,
    prefix: bot.prefix,
    modules: JSON.parse(bot.modules_json),
    status: statusText(bot),
    createdAt: bot.created_at
  };
}

export async function validateBotToken(token) {
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${token}` },
    signal: AbortSignal.timeout(10000)
  }).catch(() => null);
  if (!response?.ok) {
    const error = new Error("Discord n’a pas accepté ce token de bot. Vérifie-le dans le portail développeur.");
    error.status = 400;
    throw error;
  }
  const user = await response.json();
  if (!user.bot || !user.id || !user.username) {
    const error = new Error("Ce token ne correspond pas à un compte bot Discord.");
    error.status = 400;
    throw error;
  }
  return user;
}

async function replySafe(interaction, content) {
  const payload = { content, ephemeral: true, allowedMentions: { parse: [] } };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

async function handleBotCommand(client, interaction, row) {
  const command = interaction.commandName;
  const isStaff = (permission) => interaction.memberPermissions?.has(permission);
  const reason = interaction.options.getString("raison") || `Commande /${command}`;
  const commandModule = new Map([
    ["ping", "utility"], ["aide", "utility"], ["serveur", "utility"], ["membre", "utility"], ["avatar", "utility"], ["botinfo", "utility"], ["saloninfo", "utility"], ["roleinfo", "utility"],
    ["de", "fun"], ["boule-magique", "fun"],
    ["vider", "moderation"], ["expulser", "moderation"], ["bannir", "moderation"], ["timeout", "moderation"], ["dire", "moderation"],
    ["avertir", "moderation"], ["avertissements", "moderation"], ["retirer-avertissement", "moderation"], ["retirer-timeout", "moderation"], ["debannir", "moderation"], ["pseudo", "moderation"], ["role-ajouter", "moderation"], ["role-retirer", "moderation"],
    ["verrouiller", "protection"], ["deverrouiller", "protection"], ["slowmode", "protection"], ["anti-spam", "protection"],
    ["sondage", "community"], ["annonce", "community"], ["ticket", "support"]
  ]).get(command);
  const requiredPermission = new Map([
    ["vider", PermissionFlagsBits.ManageMessages], ["dire", PermissionFlagsBits.ManageMessages],
    ["expulser", PermissionFlagsBits.KickMembers], ["bannir", PermissionFlagsBits.BanMembers], ["debannir", PermissionFlagsBits.BanMembers],
    ["timeout", PermissionFlagsBits.ModerateMembers], ["retirer-timeout", PermissionFlagsBits.ModerateMembers],
    ["avertir", PermissionFlagsBits.ModerateMembers], ["avertissements", PermissionFlagsBits.ModerateMembers], ["retirer-avertissement", PermissionFlagsBits.ModerateMembers],
    ["pseudo", PermissionFlagsBits.ManageNicknames], ["role-ajouter", PermissionFlagsBits.ManageRoles], ["role-retirer", PermissionFlagsBits.ManageRoles],
    ["verrouiller", PermissionFlagsBits.ManageChannels], ["deverrouiller", PermissionFlagsBits.ManageChannels], ["slowmode", PermissionFlagsBits.ManageChannels],
    ["anti-spam", PermissionFlagsBits.ManageGuild], ["annonce", PermissionFlagsBits.ManageGuild]
  ]).get(command);
  const owner = getUser(row.owner_id);
  if (commandModule && !canUseModule(effectivePlan(owner), commandModule)) {
    const module = MODULES.find((entry) => entry.id === commandModule);
    return replySafe(interaction, `Cette commande est incluse dans le forfait ${findPlan(module?.requiredPlanId).name}.`);
  }
  if (requiredPermission && !isStaff(requiredPermission)) return replySafe(interaction, "Tu n’as pas la permission Discord requise pour cette commande.");

  if (command === "ping") return replySafe(interaction, `Pong · ${client.ws.ping} ms`);
  if (command === "aide") {
    const selected = JSON.parse(row.modules_json).filter((id) => canUseModule(effectivePlan(owner), id));
    const active = commandsFor(selected).map((item) => `/${item.name}`).join(" · ");
    const embed = new EmbedBuilder().setColor(0x8a73ff).setTitle("Commandes actives").setDescription(active || "Aucune commande active.");
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  if (command === "serveur") {
    const guild = interaction.guild;
    if (!guild) return replySafe(interaction, "Cette commande s’utilise dans un serveur.");
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7c68f6).setTitle(guild.name)
      .setDescription(`Membres : ${guild.memberCount}\nCréé le : <t:${Math.floor(guild.createdTimestamp / 1000)}:D>`)], ephemeral: true });
  }
  if (command === "membre" || command === "avatar") {
    const user = interaction.options.getUser("personne") || interaction.user;
    const embed = new EmbedBuilder().setColor(0x7c68f6).setAuthor({ name: user.username, iconURL: user.displayAvatarURL() });
    if (command === "avatar") embed.setTitle("Avatar Discord").setImage(user.displayAvatarURL({ size: 1024 }));
    else embed.setTitle("Profil du membre").setDescription(`Identifiant : \`${user.id}\`\nCompte créé : <t:${Math.floor(user.createdTimestamp / 1000)}:D>`);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  if (command === "botinfo") {
    const botUser = client.user;
    const embed = new EmbedBuilder().setColor(0x7c68f6).setTitle(botUser.username)
      .setThumbnail(botUser.displayAvatarURL({ size: 256 }))
      .setDescription("Serveurs : " + client.guilds.cache.size + "\nIdentifiant : " + botUser.id + "\nCréé le : <t:" + Math.floor(botUser.createdTimestamp / 1000) + ":D>");
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  if (command === "saloninfo") {
    const channel = interaction.options.getChannel("salon") || interaction.channel;
    if (!channel) return replySafe(interaction, "Salon introuvable.");
    const embed = new EmbedBuilder().setColor(0x7c68f6).setTitle("#" + channel.name)
      .setDescription("Identifiant : " + channel.id + "\nType Discord : " + channel.type);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  if (command === "roleinfo") {
    const role = interaction.options.getRole("role", true);
    const embed = new EmbedBuilder().setColor(role.color || 0x7c68f6).setTitle(role.name)
      .setDescription("Membres : " + role.members.size + "\nPosition : " + role.position + "\nMentionnable : " + (role.mentionable ? "oui" : "non") + "\nIdentifiant : " + role.id);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  if (command === "vider") {
    if (!interaction.channel?.bulkDelete) return replySafe(interaction, "Ce salon ne permet pas de supprimer des messages en bloc.");
    await interaction.deferReply({ ephemeral: true });
    const deleted = await interaction.channel.bulkDelete(interaction.options.getInteger("nombre"), true);
    return interaction.editReply(`${deleted.size} message(s) supprimé(s). Les messages de plus de 14 jours ne sont pas inclus.`);
  }
  if (command === "expulser") {
    const target = interaction.options.getUser("personne");
    const member = await interaction.guild.members.fetch(target.id);
    await member.kick(reason);
    return replySafe(interaction, `${target.username} a été expulsé.`);
  }
  if (command === "bannir") {
    const target = interaction.options.getUser("personne");
    await interaction.guild.members.ban(target.id, { reason });
    return replySafe(interaction, `${target.username} a été banni.`);
  }
  if (command === "timeout") {
    const target = interaction.options.getUser("personne");
    const member = await interaction.guild.members.fetch(target.id);
    const minutes = interaction.options.getInteger("minutes");
    await member.timeout(minutes * 60 * 1000, reason);
    return replySafe(interaction, `${target.username} a été mis en timeout pour ${minutes} minute(s).`);
  }
  if (command === "retirer-timeout") {
    const target = interaction.options.getUser("membre", true);
    const member = await interaction.guild.members.fetch(target.id);
    await member.timeout(null, reason);
    return replySafe(interaction, "Le timeout de " + target.username + " a été retiré.");
  }
  if (command === "debannir") {
    const userId = interaction.options.getString("identifiant", true);
    await interaction.guild.members.unban(userId, reason);
    return replySafe(interaction, "Le bannissement du compte " + userId + " a été révoqué.");
  }
  if (command === "avertir") {
    const target = interaction.options.getUser("membre", true);
    const warningReason = interaction.options.getString("raison", true).trim();
    const warningId = addModerationWarning({ botId: row.id, guildId: interaction.guildId, userId: target.id, moderatorId: interaction.user.id, reason: warningReason });
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const dmSent = member ? await member.send({ embeds: [new EmbedBuilder().setColor(0xe9b95f).setTitle("Avertissement · " + interaction.guild.name).setDescription(warningReason)] }).then(() => true).catch(() => false) : false;
    return replySafe(interaction, "Avertissement #" + warningId + " enregistré" + (dmSent ? " et envoyé au membre en message privé." : " (message privé non disponible)."));
  }
  if (command === "avertissements") {
    const target = interaction.options.getUser("membre", true);
    const warnings = getModerationWarnings(row.id, interaction.guildId, target.id, 8);
    if (!warnings.length) return replySafe(interaction, "Aucun avertissement enregistré pour " + target.username + ".");
    const description = warnings.map((warning) => "#" + warning.id + " · <t:" + Math.floor(Date.parse(warning.created_at) / 1000) + ":d> · modérateur " + warning.moderator_id + "\n" + warning.reason).join("\n\n").slice(0, 3800);
    const embed = new EmbedBuilder().setColor(0xe9b95f).setTitle("Avertissements · " + target.username).setDescription(description);
    return interaction.reply({ embeds: [embed], ephemeral: true, allowedMentions: { parse: [] } });
  }
  if (command === "retirer-avertissement") {
    const target = interaction.options.getUser("membre", true);
    const warningId = interaction.options.getInteger("id", true);
    if (!deleteModerationWarning(row.id, interaction.guildId, target.id, warningId)) return replySafe(interaction, "Aucun avertissement correspondant n’a été trouvé.");
    return replySafe(interaction, "Avertissement #" + warningId + " retiré pour " + target.username + ".");
  }
  if (command === "pseudo") {
    const target = interaction.options.getUser("membre", true);
    const member = await interaction.guild.members.fetch(target.id);
    await member.setNickname(interaction.options.getString("nom", true).trim(), reason);
    return replySafe(interaction, "Le surnom de " + target.username + " a été modifié.");
  }
  if (command === "role-ajouter" || command === "role-retirer") {
    const target = interaction.options.getUser("membre", true);
    const member = await interaction.guild.members.fetch(target.id);
    const role = interaction.options.getRole("role", true);
    if (role.managed || role.id === interaction.guild.id) return replySafe(interaction, "Ce rôle ne peut pas être modifié par une commande.");
    if (command === "role-ajouter") await member.roles.add(role, reason);
    else await member.roles.remove(role, reason);
    return replySafe(interaction, command === "role-ajouter" ? "Rôle " + role.name + " ajouté à " + target.username + "." : "Rôle " + role.name + " retiré à " + target.username + ".");
  }
  if (command === "verrouiller" || command === "deverrouiller") {
    if (!interaction.channel?.permissionOverwrites) return replySafe(interaction, "Cette action demande un salon de serveur.");
    const value = command === "verrouiller" ? false : null;
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: value });
    return replySafe(interaction, command === "verrouiller" ? "Salon verrouillé pour les membres." : "Permission d’écriture rétablie selon les rôles.");
  }
  if (command === "slowmode") {
    const seconds = interaction.options.getInteger("secondes");
    await interaction.channel.setRateLimitPerUser(seconds);
    return replySafe(interaction, seconds ? `Mode lent réglé sur ${seconds} seconde(s).` : "Mode lent désactivé.");
  }
  if (command === "anti-spam") {
    const enabled = interaction.options.getBoolean("activer", true);
    const threshold = interaction.options.getInteger("seuil", true);
    const windowSeconds = interaction.options.getInteger("fenetre", true);
    if (enabled && !interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return replySafe(interaction, "Le bot doit avoir la permission Discord « Modérer les membres » pour appliquer les timeouts anti-spam.");
    }
    setAntiSpamSettings(row.id, interaction.guildId, { enabled, threshold, windowSeconds, timeoutSeconds: 60 });
    clearAntiSpamWindow(row.id, interaction.guildId);
    return replySafe(interaction, enabled
      ? "Anti-spam activé : timeout de 60 secondes après " + threshold + " messages en " + windowSeconds + " secondes."
      : "Anti-spam désactivé pour ce serveur.");
  }
  if (command === "dire") {
    const content = interaction.options.getString("message");
    await interaction.channel.send({ content, allowedMentions: { parse: [] } });
    return replySafe(interaction, "Message publié sans déclencher de mentions.");
  }
  if (command === "annonce") {
    const channel = interaction.options.getChannel("salon");
    await channel.send({ content: interaction.options.getString("message"), allowedMentions: { parse: [] } });
    return replySafe(interaction, `Annonce publiée dans ${channel}.`);
  }
  if (command === "sondage") {
    const question = interaction.options.getString("question");
    await interaction.reply({ content: "Sondage publié.", ephemeral: true });
    const message = await interaction.channel.send({
      embeds: [new EmbedBuilder().setColor(0x62d7bb).setTitle("Sondage").setDescription(question)
        .setFooter({ text: `Proposé par ${interaction.user.username}` })],
      allowedMentions: { parse: [] }
    });
    await message.react("👍");
    await message.react("👎");
    return;
  }
  if (command === "de") return replySafe(interaction, `🎲 ${Math.floor(Math.random() * 6) + 1}`);
  if (command === "boule-magique") {
    const answers = ["Oui, clairement.", "Ça se tente.", "Pas aujourd’hui.", "Les signes sont bons.", "Réessaie plus tard."];
    return replySafe(interaction, answers[Math.floor(Math.random() * answers.length)]);
  }
  if (command === "ticket") {
    const guild = interaction.guild;
    if (!guild) return replySafe(interaction, "Cette commande s’utilise dans un serveur.");
    await interaction.deferReply({ ephemeral: true });
    const base = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 18) || "membre";
    const channel = await guild.channels.create({
      name: `ticket-${base}`,
      type: ChannelType.GuildText,
      topic: `Ticket privé de ${interaction.user.id}`,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
        { id: interaction.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AttachFiles"] },
        { id: client.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels"] }
      ]
    });
    await channel.send({ content: `${interaction.user}, décris ta demande ici.`, allowedMentions: { users: [interaction.user.id] } });
    return interaction.editReply(`Ton ticket privé est prêt : ${channel}.`);
  }
  return replySafe(interaction, "Commande indisponible.");
}

async function handleAntiSpamMessage(row, message) {
  if (!message.guild || message.author.bot || message.webhookId || !message.member) return;
  if (message.member.permissions.has(PermissionFlagsBits.Administrator)
    || message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
  const bot = getBot(row.id) || row;
  if (!JSON.parse(bot.modules_json).includes("protection")) return;
  const owner = getUser(bot.owner_id);
  if (!canUseModule(effectivePlan(owner), "protection")) return;
  const settings = getAntiSpamSettings(bot.id, message.guild.id);
  if (!settings.enabled) return;
  const key = bot.id + ":" + message.guild.id + ":" + message.author.id;
  const nowStamp = Date.now();
  const windowMs = settings.window_seconds * 1000;
  const recent = (antiSpamMessages.get(key) || []).filter((stamp) => nowStamp - stamp < windowMs);
  recent.push(nowStamp);
  if (recent.length < settings.threshold) {
    antiSpamMessages.set(key, recent);
    return;
  }
  antiSpamMessages.delete(key);
  if (!message.member.moderatable) return;
  try {
    await message.member.timeout(settings.timeout_seconds * 1000, "Anti-spam automatique · " + settings.threshold + " messages en " + settings.window_seconds + "s");
    addEvent(bot.owner_id, "antispam_timeout", "Anti-spam · timeout " + message.author.username + " sur " + message.guild.name);
  } catch (error) {
    console.error("Anti-spam action failed (" + bot.id + "):", error?.code || error?.name || "error");
  }
}

async function syncCommands(client, botId) {
  const row = getBot(botId);
  if (!row) return;
  const commands = commandsFor(availableModulesFor(row));
  await Promise.all(client.guilds.cache.map((guild) => guild.commands.set(commands)));
}

export async function startManagedBot(row) {
  if (!row || managedClients.has(row.id)) return;
  let token;
  try {
    token = decryptToken(row);
  } catch (error) {
    updateBotStatus(row.id, "error");
    throw error;
  }
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  managedClients.set(row.id, client);
  client.once(Events.ClientReady, async () => {
    updateBotStatus(row.id, "running");
    try {
      await syncCommands(client, row.id);
    } catch {
      updateBotStatus(row.id, "error");
      addEvent(row.owner_id, "bot_command_sync_failed", `Les commandes du bot ${row.bot_username} n’ont pas pu être synchronisées`);
    }
  });
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
      await handleBotCommand(client, interaction, getBot(row.id) || row);
    } catch (error) {
      console.error(`Bot command failed (${row.id}):`, error?.code || error?.name || "error");
      try {
        await replySafe(interaction, "La commande n’a pas abouti. Vérifie les permissions du bot et réessaie.");
      } catch {}
    }
  });
  client.on(Events.MessageCreate, (message) => {
    handleAntiSpamMessage(row, message).catch((error) => {
      console.error("Anti-spam check failed (" + row.id + "):", error?.code || error?.name || "error");
    });
  });
  client.on(Events.GuildCreate, (guild) => {
    const current = getBot(row.id);
    if (current) guild.commands.set(commandsFor(availableModulesFor(current))).catch((error) => {
      console.error(`Command sync failed (${row.id}):`, error?.code || error?.name || "error");
    });
  });
  client.on(Events.ShardDisconnect, () => {
    if (managedClients.get(row.id) === client) updateBotStatus(row.id, "reconnecting");
  });
  client.on(Events.ShardReady, () => {
    if (managedClients.get(row.id) === client) updateBotStatus(row.id, "running");
  });
  try {
    await client.login(token);
  } catch (error) {
    managedClients.delete(row.id);
    updateBotStatus(row.id, "error");
    client.destroy();
    throw new Error("Le bot n’a pas pu se connecter à Discord", { cause: error });
  } finally {
    token = undefined;
  }
}

export async function updateManagedBot(row) {
  const client = managedClients.get(row.id);
  if (client?.isReady()) await syncCommands(client, row.id);
}

export async function stopManagedBot(id) {
  const client = managedClients.get(id);
  if (!client) return;
  managedClients.delete(id);
  client.destroy();
}

export async function deleteManagedBot(id, ownerId) {
  const row = getBot(id);
  if (!row || row.owner_id !== ownerId) return false;
  await stopManagedBot(id);
  return deleteBotRow(id, ownerId);
}

export async function reconcileUserBots(ownerId) {
  const user = getUser(ownerId);
  if (!user) return;
  const plan = effectivePlan(user);
  const bots = getBotsForUser(ownerId);
  const allBots = getAllBots();
  for (const [index, bot] of bots.entries()) {
    const globalIndex = allBots.findIndex((candidate) => candidate.id === bot.id);
    const shouldRun = index < plan.maxBots && globalIndex < maxHostedBots();
    const selectedModules = JSON.parse(bot.modules_json);
    const availableModules = selectedModules.filter((id) => canUseModule(plan, id));
    if (availableModules.length !== selectedModules.length) {
      updateBotConfig(bot.id, { projectName: bot.project_name || bot.bot_username, prefix: bot.prefix, modules: availableModules });
      if (shouldRun) await updateManagedBot(getBot(bot.id));
    }
    if (!shouldRun && bot.status !== "suspended") {
      await stopManagedBot(bot.id);
      updateBotStatus(bot.id, "suspended");
    } else if (shouldRun && (bot.status === "suspended" || bot.status === "starting") && !managedClients.has(bot.id)) {
      try {
        await startManagedBot(getBot(bot.id));
      } catch {
        updateBotStatus(bot.id, "error");
      }
    }
  }
  return plan;
}

export async function reconcileAllUsers() {
  for (const user of getAllUsers()) await reconcileUserBots(user.id);
}

export async function startSavedBots() {
  const allBots = getAllBots();
  for (const [globalIndex, bot] of allBots.entries()) {
    const user = getUser(bot.owner_id);
    if (!user) continue;
    const plan = effectivePlan(user);
    const botIndex = getBotsForUser(user.id).findIndex((entry) => entry.id === bot.id);
    if (botIndex >= plan.maxBots || globalIndex >= maxHostedBots()) {
      updateBotStatus(bot.id, "suspended");
      continue;
    }
    try {
      await startManagedBot(bot);
    } catch {
      updateBotStatus(bot.id, "error");
    }
  }
}

export function runtimeCount() {
  return managedClients.size;
}
