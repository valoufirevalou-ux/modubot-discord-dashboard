import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieSession from "cookie-session";
import express from "express";
import { PermissionsBitField, PermissionFlagsBits } from "discord.js";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { MODULES, PLANS, PLAN_RANK, canUseModule, effectivePlan, findPlan, modulesForPlan } from "./plans.js";
import {
  addEvent,
  approvePayment,
  canAddHostedBot,
  canAllocatePlan,
  cancelPayment,
  claimPayment,
  countBotsForUser,
  createPayment,
  createEmailUser,
  getBot,
  getBotByDiscordId,
  getBotsForUser,
  getEventsForUser,
  getPayment,
  getPaymentsForAdmin,
  getPaymentsForUser,
  getPaymentByCode,
  getOpenPaymentForUser,
  getUser,
  getUserByEmail,
  insertBot,
  pruneEvents,
  rejectPayment,
  setPaymentOrder,
  setPaymentStatus,
  touchUser,
  updateBotConfig,
  upsertUser
} from "./store.js";
import { encryptToken, randomId } from "./secrets.js";
import {
  deleteManagedBot,
  publicBot,
  reconcileAllUsers,
  reconcileUserBots,
  startManagedBot,
  startSavedBots,
  updateManagedBot,
  validateBotToken
} from "./runtime.js";
import { notifyAdmin, startAdminBot, stopAdminBot } from "./admin-bot.js";
import { capturePayPalOrder, createPayPalOrder, isPayPalCheckoutReady, verifyPayPalWebhook } from "./paypal.js";

const required = ["APP_BASE_URL", "SESSION_SECRET", "TOKEN_ENCRYPTION_KEY"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Configuration requise absente : ${missing.join(", ")}`);
if (process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET doit faire au moins 32 caractères.");
if (!/^[a-f0-9]{64}$/i.test(process.env.TOKEN_ENCRYPTION_KEY)) {
  throw new Error("TOKEN_ENCRYPTION_KEY doit contenir exactement 64 caractères hexadécimaux.");
}
const baseUrl = new URL(process.env.APP_BASE_URL);
if (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:") {
  throw new Error("APP_BASE_URL doit utiliser HTTPS en production.");
}
const redirectUri = `${baseUrl.origin}/auth/discord/callback`;
const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.SERVER_PORT || 3000);
const paymentsEnabled = process.env.PAYMENTS_ENABLED === "true";
const maxHostedBots = Math.max(1, Number.parseInt(process.env.MAX_HOSTED_BOTS || "1", 10) || 1);
const paypalMeUrl = process.env.PAYPAL_ME_URL || "";
const manualPayPalReady = paymentsEnabled && /^https:\/\/paypal\.me\//i.test(paypalMeUrl);
const checkoutReady = paymentsEnabled && isPayPalCheckoutReady();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://cdn.discordapp.com"],
      connectSrc: ["'self'", "https://discord.com", "https://api-m.paypal.com", "https://api-m.sandbox.paypal.com"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cookieSession({
  name: "modubot.session",
  keys: [process.env.SESSION_SECRET],
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax"
}));
app.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false }));
app.use(express.static(path.join(here, "..", "public"), { maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));

const apiLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false });
const sensitiveLimit = rateLimit({ windowMs: 10 * 60_000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false });
const adminLoginLimit = rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false });
const accountAuthLimit = rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false });

function sameOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("origin") !== baseUrl.origin) return res.status(403).json({ error: "Origine de requête refusée." });
  next();
}

function requireAuth(req, res, next) {
  const id = req.session?.userId;
  if (!id) return res.status(401).json({ error: "Connecte-toi avec Discord pour continuer." });
  const user = getUser(id);
  if (!user) {
    req.session = null;
    return res.status(401).json({ error: "Session expirée. Reconnecte-toi." });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.session?.adminAuthenticated !== true) return res.status(401).json({ error: "Entre le code administrateur pour continuer." });
  next();
}

function authConfigurationReady() {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

function publicAvatar(user) {
  if (!user.avatar) return `https://cdn.discordapp.com/embed/avatars/${Number.parseInt(user.id.slice(-1), 10) % 6 || 0}.png`;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

function publicPlans() {
  return PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceCents: plan.priceCents,
    durationDays: plan.durationDays,
    maxBots: plan.maxBots,
    rank: PLAN_RANK[plan.id] ?? 0,
    accent: plan.accent,
    featured: Boolean(plan.featured)
  }));
}

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.get("/auth/discord", (req, res) => {
  if (!authConfigurationReady()) return res.status(503).send("Connexion Discord non configurée.");
  const state = crypto.randomBytes(24).toString("hex");
  req.session.oauthState = state;
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);
  res.redirect(authorize.toString());
});

app.get("/auth/discord/callback", async (req, res) => {
  const state = String(req.query.state || "");
  const expected = req.session?.oauthState || "";
  req.session.oauthState = null;
  if (!state || !expected || state !== expected || typeof req.query.code !== "string") {
    req.session = null;
    return res.redirect("/?error=discord-login");
  }
  try {
    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: redirectUri
      }),
      signal: AbortSignal.timeout(12000)
    });
    if (!tokenResponse.ok) throw new Error("OAuth token exchange failed");
    const token = await tokenResponse.json();
    const identityResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(12000)
    });
    if (!identityResponse.ok) throw new Error("Discord identity request failed");
    const identity = await identityResponse.json();
    const user = upsertUser({ id: identity.id, username: identity.global_name || identity.username, avatar: identity.avatar });
    req.session = { userId: user.id };
    addEvent(user.id, "account_connected", "Connexion au tableau de bord avec Discord");
    await notifyAdmin({ type: "account_connected", title: "Connexion au site", summary: `${user.username} a ouvert son espace ModuBot`, userId: user.id });
    res.redirect("/app");
  } catch (error) {
    console.error("Discord OAuth failed:", error?.name || "error");
    req.session = null;
    res.redirect("/?error=discord-login");
  }
});

app.post("/auth/logout", express.json({ limit: "2kb" }), sameOrigin, requireAuth, (_req, res) => {
  _req.session = null;
  res.status(204).end();
});

// PayPal sends signed JSON directly; keep the original bytes for verification.
app.post("/api/paypal/webhook", express.raw({ type: "application/json", limit: "128kb" }), async (req, res) => {
  try {
    await verifyPayPalWebhook(req);
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("PayPal webhook rejected:", error?.status || error?.name || "error");
    res.status(error.status || 400).json({ error: "Webhook non accepté." });
  }
});

app.use(express.json({ limit: "32kb" }));
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
}, sameOrigin, apiLimit);

function passwordDigest(password, salt = crypto.randomBytes(16)) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => {
    if (error) return reject(error);
    resolve(`scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`);
  }));
}

async function passwordMatches(password, digest) {
  const [algorithm, saltText, keyText] = String(digest || "").split("$");
  if (algorithm !== "scrypt" || !saltText || !keyText) return false;
  const expected = Buffer.from(keyText, "base64url");
  const actual = await new Promise((resolve, reject) => crypto.scrypt(password, Buffer.from(saltText, "base64url"), expected.length, (error, key) => error ? reject(error) : resolve(key)));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

app.post("/api/auth/signup", accountAuthLimit, async (req, res, next) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (username.length < 2 || username.length > 32 || !/^[\p{L}\p{N}_. -]+$/u.test(username)) return res.status(400).json({ error: "Le pseudo doit contenir 2 à 32 caractères (lettres, chiffres, espaces, . _ ou -)." });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Saisis une adresse e-mail valide." });
  if (password.length < 10 || password.length > 128) return res.status(400).json({ error: "Choisis un mot de passe de 10 à 128 caractères." });
  if (getUserByEmail(email)) return res.status(409).json({ error: "Un compte utilise déjà cette adresse e-mail. Connecte-toi plutôt." });
  try {
    const passwordHash = await passwordDigest(password);
    const user = createEmailUser({ id: randomId(), username, email, passwordHash });
    req.session = { userId: user.id };
    addEvent(user.id, "account_created", "Compte ModuBot créé");
    await notifyAdmin({ type: "account_connected", title: "Nouveau compte ModuBot", summary: `${user.username} a créé un espace`, userId: user.id });
    res.status(201).json({ user: { id: user.id, username: user.username } });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Un compte utilise déjà cette adresse e-mail." });
    next(error);
  }
});

app.post("/api/auth/login", accountAuthLimit, async (req, res, next) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (email.length > 254 || password.length > 128) return res.status(401).json({ error: "Adresse e-mail ou mot de passe incorrect." });
  try {
    const user = getUserByEmail(email);
    if (!user?.password_hash || !(await passwordMatches(password, user.password_hash))) return res.status(401).json({ error: "Adresse e-mail ou mot de passe incorrect." });
    const refreshed = touchUser(user.id);
    req.session = { userId: refreshed.id };
    addEvent(refreshed.id, "account_connected", "Connexion à ModuBot");
    await notifyAdmin({ type: "account_connected", title: "Connexion au site", summary: `${refreshed.username} a ouvert son espace ModuBot`, userId: refreshed.id });
    res.json({ user: { id: refreshed.id, username: refreshed.username } });
  } catch (error) { next(error); }
});

app.post("/api/admin/login", adminLoginLimit, (req, res) => {
  const expected = process.env.ADMIN_ACCESS_CODE || "";
  const submitted = typeof req.body?.code === "string" ? req.body.code : "";
  if (!expected) return res.status(503).json({ error: "L’accès administrateur n’est pas configuré sur le serveur." });
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  const submittedHash = crypto.createHash("sha256").update(submitted.slice(0, 128)).digest();
  if (!submitted || !crypto.timingSafeEqual(expectedHash, submittedHash)) {
    return res.status(401).json({ error: "Code administrateur incorrect." });
  }
  req.session.adminAuthenticated = true;
  req.session.adminAuthenticatedAt = Date.now();
  res.json({ authenticated: true });
});

app.get("/api/admin/session", (req, res) => {
  res.json({ authenticated: req.session?.adminAuthenticated === true });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.adminAuthenticated = false;
  req.session.adminAuthenticatedAt = null;
  res.status(204).end();
});

app.get("/api/admin/payments", requireAdmin, (_req, res) => {
  res.json({ payments: getPaymentsForAdmin() });
});

app.post("/api/admin/payments/:id/approve", requireAdmin, sensitiveLimit, async (req, res, next) => {
  try {
    const pending = getPayment(req.params.id);
    if (pending && !canAllocatePlan(pending.owner_id, pending.plan_id, maxHostedBots)) {
      return res.status(409).json({ error: "La capacité de l’hébergement ne permet pas d’activer ce forfait." });
    }
    const result = approvePayment(req.params.id, "admin-panel");
    if (!result) return res.status(409).json({ error: "Cette demande n’est plus en attente de validation." });
    await reconcileUserBots(result.user.id);
    res.json({ status: result.payment.status, expiresAt: result.expiresAt });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/payments/:id/reject", requireAdmin, sensitiveLimit, (req, res) => {
  const payment = rejectPayment(req.params.id, "admin-panel");
  if (!payment) return res.status(409).json({ error: "Cette demande a déjà été traitée." });
  res.json({ status: payment.status });
});

app.get("/api/config", (_req, res) => {
  const permissions = PermissionsBitField.resolve([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ModerateMembers
  ]).toString();
  let inviteUrl = null;
  if (process.env.DISCORD_CLIENT_ID) {
    const invite = new URL("https://discord.com/oauth2/authorize");
    invite.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID);
    invite.searchParams.set("scope", "bot applications.commands");
    invite.searchParams.set("permissions", permissions);
    inviteUrl = invite.toString();
  }
  res.json({
    plans: publicPlans(),
    modules: MODULES,
    capacity: { maxHostedBots },
    discordInviteUrl: inviteUrl,
    payments: {
      enabled: paymentsEnabled && (checkoutReady || manualPayPalReady),
      checkout: checkoutReady,
      manual: manualPayPalReady
    }
  });
});

app.get("/api/me", async (req, res, next) => {
  if (!req.session?.userId) return res.json({ user: null });
  try {
    await reconcileUserBots(req.session.userId);
    const user = getUser(req.session.userId);
    if (!user) {
      req.session = null;
      return res.json({ user: null });
    }
    const plan = effectivePlan(user);
    const bots = getBotsForUser(user.id).map(publicBot);
    const paymentsAvailable = paymentsEnabled && (checkoutReady || manualPayPalReady);
    const canPurchase = paymentsAvailable && !getOpenPaymentForUser(user.id);
    res.json({
      user: { id: user.id, username: user.username, email: user.email || null, avatarUrl: publicAvatar(user) },
      plan: { id: plan.id, name: plan.name, maxBots: plan.maxBots, expiresAt: plan.id === "free" ? null : user.plan_expires_at },
      availableModules: modulesForPlan(plan),
      bots,
      payments: getPaymentsForUser(user.id).map((payment) => ({
        ...payment,
        paypalUrl: payment.payment_method === "paypal_me" && payment.status === "pending"
          ? `${paypalMeUrl.replace(/\/$/, "")}/${(payment.amount_cents / 100).toFixed(2)}EUR`
          : null
      })),
      events: getEventsForUser(user.id),
      availablePlans: canPurchase
        ? PLANS.filter((item) => item.id !== "free" && canAllocatePlan(user.id, item.id, maxHostedBots)).map((item) => item.id)
        : []
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/bots", requireAuth, sensitiveLimit, async (req, res, next) => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const projectName = typeof req.body?.projectName === "string" ? req.body.projectName.trim() : "Mon bot Discord";
  const prefix = "/";
  const requestedModules = Array.isArray(req.body?.modules) ? req.body.modules : ["utility", "fun"];
  const allowedModules = new Set(MODULES.map((module) => module.id));
  const modules = [...new Set(requestedModules)].filter((id) => allowedModules.has(id));
  if (!token || token.length > 200 || projectName.length < 2 || projectName.length > 50) {
    return res.status(400).json({ error: "Renseigne un nom de projet et un token Discord valide." });
  }
  const lockedModule = modules.find((id) => !canUseModule(effectivePlan(req.user), id));
  if (lockedModule) {
    const entry = MODULES.find((module) => module.id === lockedModule);
    return res.status(403).json({ error: `Le module ${entry.name} est inclus dans le forfait ${findPlan(entry.requiredPlanId).name}.` });
  }
  if (countBotsForUser(req.user.id) >= effectivePlan(req.user).maxBots) {
    return res.status(403).json({ error: "La limite de bots de ton forfait est atteinte. Choisis un forfait supérieur." });
  }
  if (!canAddHostedBot(req.user.id, maxHostedBots)) {
    return res.status(503).json({ error: "La capacité de cet hébergement est atteinte. Réessaie quand une place se libère." });
  }
  let identity;
  try {
    identity = await validateBotToken(token);
  } catch {
    addEvent(req.user.id, "bot_validation_failed", "Tentative de connexion refusée · token Discord invalide");
    await notifyAdmin({ type: "bot_validation_failed", title: "Connexion d’un bot refusée", summary: "Un token Discord invalide a été présenté. La valeur du token n’a pas été conservée ni journalisée.", userId: req.user.id });
    return res.status(400).json({ error: "Discord a refusé ce token. Vérifie que tu as copié le nouveau token du bot." });
  }
  try {
    if (getBotByDiscordId(identity.id)) return res.status(409).json({ error: "Ce bot est déjà associé à un espace ModuBot." });
    const encrypted = encryptToken(token);
    const stamp = new Date().toISOString();
    const row = insertBot({
      id: randomId(), owner_id: req.user.id, bot_user_id: identity.id, bot_username: identity.username,
      project_name: projectName, ...encrypted, prefix, modules_json: JSON.stringify(modules), status: "starting", created_at: stamp, updated_at: stamp
    });
    try {
      await startManagedBot(row);
    } catch {
      await deleteManagedBot(row.id, req.user.id);
      addEvent(req.user.id, "bot_connection_failed", `Connexion impossible pour le bot ${identity.username}`);
      await notifyAdmin({ type: "bot_connection_failed", title: "Connexion d’un bot échouée", summary: `Le bot ${identity.username} n’a pas pu démarrer. Aucun token n’a été ajouté au journal.`, userId: req.user.id });
      return res.status(400).json({ error: "Le bot n’a pas pu se connecter. Vérifie son token et ses paramètres Discord." });
    }
    addEvent(req.user.id, "bot_added", `Projet créé : ${projectName} · bot ${identity.username}`);
    await notifyAdmin({ type: "bot_added", title: "Projet bot ajouté au compte", summary: `${projectName} · ${identity.username}`, userId: req.user.id });
    return res.status(201).json({ bot: publicBot(getBot(row.id)) });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Ce token de bot est déjà utilisé." });
    next(error);
  }
});

app.patch("/api/bots/:id", requireAuth, async (req, res, next) => {
  const current = getBot(req.params.id);
  if (!current || current.owner_id !== req.user.id) return res.status(404).json({ error: "Bot introuvable." });
  const allowedModules = new Set(MODULES.map((module) => module.id));
  const modules = Array.isArray(req.body?.modules) ? [...new Set(req.body.modules)].filter((id) => allowedModules.has(id)) : [];
  const prefix = "/";
  const projectName = typeof req.body?.projectName === "string" ? req.body.projectName.trim() : current.project_name || current.bot_username;
  if (projectName.length < 2 || projectName.length > 50) return res.status(400).json({ error: "Le nom du projet doit contenir 2 à 50 caractères." });
  const lockedModule = modules.find((id) => !canUseModule(effectivePlan(req.user), id));
  if (lockedModule) {
    const entry = MODULES.find((module) => module.id === lockedModule);
    return res.status(403).json({ error: `Le module ${entry.name} est inclus dans le forfait ${findPlan(entry.requiredPlanId).name}.` });
  }
  try {
    const updated = updateBotConfig(current.id, { projectName, prefix, modules });
    await updateManagedBot(updated);
    addEvent(req.user.id, "bot_updated", `Projet ${projectName} modifié · modules actifs : ${modules.join(", ") || "aucun"}`);
    await notifyAdmin({ type: "bot_updated", title: "Configuration d’un projet modifiée", summary: `${projectName} · modules actifs : ${modules.join(", ") || "aucun"}`, userId: req.user.id });
    res.json({ bot: publicBot(getBot(current.id)) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/bots/:id", requireAuth, async (req, res, next) => {
  try {
    const bot = getBot(req.params.id);
    if (!bot || bot.owner_id !== req.user.id) return res.status(404).json({ error: "Bot introuvable." });
    await deleteManagedBot(bot.id, req.user.id);
    addEvent(req.user.id, "bot_deleted", `Bot Discord retiré : ${bot.bot_username}`);
    await notifyAdmin({ type: "bot_deleted", title: "Bot retiré du compte", summary: `Bot supprimé · ${bot.bot_username}`, userId: req.user.id });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

function createPaymentRow(userId, plan, method, contactEmail = null, requestedPaymentCode = null) {
  const id = randomId();
  let paymentCode = null;
  if (method === "paypal_me") {
    paymentCode = requestedPaymentCode;
  }
  return createPayment({
    id,
    owner_id: userId,
    plan_id: plan.id,
    amount_cents: plan.priceCents,
    currency: "EUR",
    status: "pending",
    payment_method: method,
    payment_code: paymentCode,
    contact_email: contactEmail,
    created_at: new Date().toISOString()
  });
}

app.post("/api/payments/manual", requireAuth, sensitiveLimit, async (req, res, next) => {
  const plan = findPlan(req.body?.planId);
  const contactEmail = typeof req.body?.contactEmail === "string" ? req.body.contactEmail.trim() : "";
  if (!paymentsEnabled || !manualPayPalReady) return res.status(503).json({ error: "Le paiement PayPal.Me n’est pas activé." });
  if (plan.id === "free") return res.status(400).json({ error: "Le forfait gratuit ne demande pas de paiement." });
  if (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return res.status(400).json({ error: "Saisis une adresse e-mail valide pour recevoir l’accès au forfait." });
  }
  if (getOpenPaymentForUser(req.user.id)) return res.status(409).json({ error: "Tu as déjà une demande PayPal ouverte. Termine-la ou annule-la avant d’en créer une autre." });
  if (!canAllocatePlan(req.user.id, plan.id, maxHostedBots)) return res.status(503).json({ error: "La capacité actuelle ne permet pas de vendre ce forfait." });
  try {
    let paymentCode;
    do { paymentCode = String(crypto.randomInt(0, 100_000_000)).padStart(8, "0"); } while (getPaymentByCode(paymentCode));
    const payment = createPaymentRow(req.user.id, plan, "paypal_me", contactEmail, paymentCode);
    const paypalUrl = `${paypalMeUrl.replace(/\/$/, "")}/${(plan.priceCents / 100).toFixed(2)}EUR`;
    res.status(201).json({ paymentId: payment.id, paymentCode: payment.payment_code, paypalUrl });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments/:id/claim", requireAuth, async (req, res, next) => {
  try {
    const payment = claimPayment(req.params.id, req.user.id);
    if (!payment) return res.status(409).json({ error: "Cette demande n’est plus en attente." });
    res.json({ paymentId: payment.id, status: payment.status });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const payment = cancelPayment(req.params.id, req.user.id);
    if (!payment) return res.status(409).json({ error: "Cette demande n’est plus annulable." });
    res.json({ paymentId: payment.id, status: payment.status });
  } catch (error) {
    next(error);
  }
});

app.post("/api/paypal/orders", requireAuth, sensitiveLimit, async (req, res, next) => {
  const plan = findPlan(req.body?.planId);
  const contactEmail = typeof req.body?.contactEmail === "string" ? req.body.contactEmail.trim() : "";
  if (!checkoutReady) return res.status(503).json({ error: "PayPal Checkout n’est pas configuré." });
  if (plan.id === "free") return res.status(400).json({ error: "Le forfait gratuit ne demande pas de paiement." });
  if (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return res.status(400).json({ error: "Saisis une adresse e-mail valide pour recevoir l’accès au forfait." });
  }
  if (getOpenPaymentForUser(req.user.id)) return res.status(409).json({ error: "Tu as déjà une demande PayPal ouverte. Termine-la ou annule-la avant d’en créer une autre." });
  if (!canAllocatePlan(req.user.id, plan.id, maxHostedBots)) return res.status(503).json({ error: "La capacité actuelle ne permet pas de vendre ce forfait." });
  try {
    const payment = createPaymentRow(req.user.id, plan, "paypal_checkout", contactEmail);
    try {
      const order = await createPayPalOrder(payment, plan, baseUrl.origin);
      setPaymentOrder(payment.id, order.id);
      res.status(201).json({ paymentId: payment.id, approveUrl: order.approveUrl });
    } catch (error) {
      setPaymentStatus(payment.id, "failed");
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

app.post("/api/paypal/capture", requireAuth, sensitiveLimit, async (req, res, next) => {
  const orderId = typeof req.body?.orderId === "string" ? req.body.orderId : "";
  if (!orderId || orderId.length > 64) return res.status(400).json({ error: "Référence PayPal invalide." });
  try {
    const payment = await capturePayPalOrder(orderId, req.user.id);
    res.json({ status: payment.status });
  } catch (error) {
    next(error);
  }
});

app.get("/app", (_req, res) => res.sendFile(path.join(here, "..", "public", "index.html")));
app.get("/admin", (_req, res) => res.sendFile(path.join(here, "..", "public", "admin.html")));

app.use((error, _req, res, _next) => {
  console.error("Request failed:", error?.status || error?.code || error?.name || "error");
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
  const message = status === 500 ? "Une erreur est survenue. Réessaie dans un instant." : error.message;
  res.status(status).json({ error: message });
});

const server = app.listen(port, "0.0.0.0", async () => {
  console.log(`ModuBot listening on 0.0.0.0:${port}`);
  await startAdminBot();
  await startSavedBots();
  await reconcileAllUsers();
  pruneEvents(30);
});

const maintenance = setInterval(async () => {
  try {
    await reconcileAllUsers();
    pruneEvents(30);
  } catch (error) {
    console.error("Scheduled maintenance failed:", error?.name || "error");
  }
}, 15 * 60_000);
maintenance.unref();

async function shutdown() {
  clearInterval(maintenance);
  await stopAdminBot();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
