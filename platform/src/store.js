import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { effectivePlan, findPlan } from "./plans.js";

const dataPath = path.resolve(process.env.DATABASE_PATH || "./data/modubot.sqlite");
fs.mkdirSync(path.dirname(dataPath), { recursive: true });

export const db = new Database(dataPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar TEXT,
    email TEXT,
    password_hash TEXT,
    plan_id TEXT NOT NULL DEFAULT 'free',
    plan_expires_at TEXT,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bots (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bot_user_id TEXT NOT NULL UNIQUE,
    bot_username TEXT NOT NULL,
    project_name TEXT NOT NULL DEFAULT '',
    token_ciphertext TEXT NOT NULL,
    token_iv TEXT NOT NULL,
    token_tag TEXT NOT NULL,
    prefix TEXT NOT NULL DEFAULT '/',
    modules_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'starting',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS bots_owner_idx ON bots(owner_id, created_at);
  CREATE TABLE IF NOT EXISTS moderation_warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS moderation_warnings_member_idx ON moderation_warnings(bot_id, guild_id, user_id, id DESC);
  CREATE TABLE IF NOT EXISTS anti_spam_settings (
    bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    guild_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    threshold INTEGER NOT NULL DEFAULT 5,
    window_seconds INTEGER NOT NULL DEFAULT 5,
    timeout_seconds INTEGER NOT NULL DEFAULT 60,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (bot_id, guild_id)
  );
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    log_channel_id TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_user_idx ON events(user_id, id DESC);
  CREATE TABLE IF NOT EXISTS payment_intents (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    status TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    payment_code TEXT,
    contact_email TEXT,
    paypal_order_id TEXT UNIQUE,
    reviewed_by TEXT,
    created_at TEXT NOT NULL,
    claimed_at TEXT,
    reviewed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS payment_review_idx ON payment_intents(status, created_at);
  CREATE INDEX IF NOT EXISTS payment_owner_idx ON payment_intents(owner_id, created_at DESC);
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((column) => column.name === "email")) db.exec("ALTER TABLE users ADD COLUMN email TEXT");
if (!userColumns.some((column) => column.name === "password_hash")) db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email) WHERE email IS NOT NULL");

const botColumns = db.prepare("PRAGMA table_info(bots)").all();
if (!botColumns.some((column) => column.name === "project_name")) {
  db.exec("ALTER TABLE bots ADD COLUMN project_name TEXT NOT NULL DEFAULT ''");
}
db.exec("UPDATE bots SET project_name = bot_username WHERE project_name = ''");

const paymentColumns = db.prepare("PRAGMA table_info(payment_intents)").all();
if (!paymentColumns.some((column) => column.name === "payment_code")) {
  db.exec("ALTER TABLE payment_intents ADD COLUMN payment_code TEXT");
}
if (!paymentColumns.some((column) => column.name === "contact_email")) {
  db.exec("ALTER TABLE payment_intents ADD COLUMN contact_email TEXT");
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS payment_code_unique_idx ON payment_intents(payment_code) WHERE payment_code IS NOT NULL");
db.exec(`DELETE FROM events WHERE event_type IN (
  'payment_started', 'payment_claimed', 'payment_cancelled', 'payment_paid', 'payment_approved', 'payment_rejected'
)`);

const now = () => new Date().toISOString();

export function upsertUser({ id, username, avatar }) {
  const stamp = now();
  db.prepare(`INSERT INTO users (id, username, avatar, created_at, last_seen_at)
    VALUES (@id, @username, @avatar, @stamp, @stamp)
    ON CONFLICT(id) DO UPDATE SET username=excluded.username, avatar=excluded.avatar, last_seen_at=excluded.last_seen_at`)
    .run({ id, username, avatar: avatar || null, stamp });
  return getUser(id);
}

export function createEmailUser({ id, username, email, passwordHash }) {
  const stamp = now();
  db.prepare(`INSERT INTO users (id, username, email, password_hash, created_at, last_seen_at)
    VALUES (@id, @username, @email, @passwordHash, @stamp, @stamp)`)
    .run({ id, username, email, passwordHash, stamp });
  return getUser(id);
}

export function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email) ?? null;
}

export function touchUser(id) {
  db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(now(), id);
  return getUser(id);
}

export function getUser(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) ?? null;
}

export function getAllUsers() {
  return db.prepare("SELECT * FROM users").all();
}

export function insertBot(bot) {
  db.prepare(`INSERT INTO bots
    (id, owner_id, bot_user_id, bot_username, project_name, token_ciphertext, token_iv, token_tag, prefix, modules_json, status, created_at, updated_at)
    VALUES (@id, @owner_id, @bot_user_id, @bot_username, @project_name, @token_ciphertext, @token_iv, @token_tag, @prefix, @modules_json, @status, @created_at, @updated_at)`)
    .run(bot);
  return getBot(bot.id);
}

export function getBot(id) {
  return db.prepare("SELECT * FROM bots WHERE id = ?").get(id) ?? null;
}

export function getBotByDiscordId(botUserId) {
  return db.prepare("SELECT * FROM bots WHERE bot_user_id = ?").get(botUserId) ?? null;
}

export function getBotsForUser(ownerId) {
  return db.prepare(`SELECT id, owner_id, bot_user_id, bot_username, project_name, prefix, modules_json, status, created_at, updated_at
    FROM bots WHERE owner_id = ? ORDER BY created_at ASC`).all(ownerId);
}

export function getAllBots() {
  return db.prepare("SELECT * FROM bots ORDER BY created_at ASC").all();
}

export function countBotsForUser(ownerId) {
  return db.prepare("SELECT COUNT(*) AS count FROM bots WHERE owner_id = ?").get(ownerId).count;
}

function activeBotCount(ownerId) {
  return db.prepare("SELECT COUNT(*) AS count FROM bots WHERE owner_id = ? AND status != 'suspended'").get(ownerId).count;
}

export function canAllocatePlan(ownerId, planId, globalLimit) {
  const target = findPlan(planId);
  const currentUser = getUser(ownerId);
  if (!currentUser || target.id === "free") return false;
  const users = getAllUsers();
  const activeCurrent = effectivePlan(currentUser);
  const currentAllocation = activeCurrent.id === "free" ? activeBotCount(ownerId) : activeCurrent.maxBots;
  if (target.maxBots <= currentAllocation) return false;
  const baseAllocation = (user) => {
    const active = effectivePlan(user);
    return active.id === "free" ? activeBotCount(user.id) : active.maxBots;
  };
  const reservedByOthers = users.reduce((sum, user) => {
    if (user.id === ownerId) return sum;
    const openPayment = getOpenPaymentForUser(user.id);
    const pendingAllocation = openPayment ? findPlan(openPayment.plan_id).maxBots : 0;
    return sum + Math.max(baseAllocation(user), pendingAllocation);
  }, 0);
  return reservedByOthers + Math.max(currentAllocation, target.maxBots) <= globalLimit;
}

export function canAddHostedBot(ownerId, globalLimit) {
  const user = getUser(ownerId);
  if (!user) return false;
  const plan = effectivePlan(user);
  const ownActive = activeBotCount(ownerId);
  if (ownActive >= plan.maxBots) return false;
  const users = getAllUsers();
  const otherReserved = users.reduce((sum, candidate) => {
    if (candidate.id === ownerId) return sum;
    const active = effectivePlan(candidate);
    const openPayment = getOpenPaymentForUser(candidate.id);
    const allocation = Math.max(
      active.id === "free" ? activeBotCount(candidate.id) : active.maxBots,
      openPayment ? findPlan(openPayment.plan_id).maxBots : 0
    );
    return sum + Math.max(0, allocation - activeBotCount(candidate.id));
  }, 0);
  const globallyRunning = db.prepare("SELECT COUNT(*) AS count FROM bots WHERE status != 'suspended'").get().count;
  return globallyRunning + 1 + otherReserved <= globalLimit;
}

export function updateBotStatus(id, status) {
  db.prepare("UPDATE bots SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id);
}

export function updateBotConfig(id, { prefix, modules, projectName }) {
  db.prepare("UPDATE bots SET project_name = ?, prefix = ?, modules_json = ?, updated_at = ? WHERE id = ?")
    .run(projectName, prefix, JSON.stringify(modules), now(), id);
  return getBot(id);
}

export function addModerationWarning({ botId, guildId, userId, moderatorId, reason }) {
  const result = db.prepare(`INSERT INTO moderation_warnings
    (bot_id, guild_id, user_id, moderator_id, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(botId, guildId, userId, moderatorId, reason.slice(0, 400), now());
  return result.lastInsertRowid;
}

export function getModerationWarnings(botId, guildId, userId, limit = 10) {
  return db.prepare(`SELECT id, moderator_id, reason, created_at FROM moderation_warnings
    WHERE bot_id = ? AND guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?`)
    .all(botId, guildId, userId, limit);
}

export function deleteModerationWarning(botId, guildId, userId, warningId) {
  return db.prepare(`DELETE FROM moderation_warnings
    WHERE bot_id = ? AND guild_id = ? AND user_id = ? AND id = ?`)
    .run(botId, guildId, userId, warningId).changes > 0;
}

export function setAntiSpamSettings(botId, guildId, { enabled, threshold, windowSeconds, timeoutSeconds = 60 }) {
  db.prepare(`INSERT INTO anti_spam_settings
    (bot_id, guild_id, enabled, threshold, window_seconds, timeout_seconds, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(bot_id, guild_id) DO UPDATE SET enabled=excluded.enabled,
      threshold=excluded.threshold, window_seconds=excluded.window_seconds,
      timeout_seconds=excluded.timeout_seconds, updated_at=excluded.updated_at`)
    .run(botId, guildId, enabled ? 1 : 0, threshold, windowSeconds, timeoutSeconds, now());
  return getAntiSpamSettings(botId, guildId);
}

export function getAntiSpamSettings(botId, guildId) {
  return db.prepare(`SELECT enabled, threshold, window_seconds, timeout_seconds
    FROM anti_spam_settings WHERE bot_id = ? AND guild_id = ?`).get(botId, guildId)
    ?? { enabled: 0, threshold: 5, window_seconds: 5, timeout_seconds: 60 };
}

export function deleteBot(id, ownerId) {
  return db.prepare("DELETE FROM bots WHERE id = ? AND owner_id = ?").run(id, ownerId).changes > 0;
}

export function addEvent(userId, eventType, summary) {
  db.prepare("INSERT INTO events (user_id, event_type, summary, created_at) VALUES (?, ?, ?, ?)")
    .run(userId || null, eventType.slice(0, 64), summary.slice(0, 220), now());
}

export function getEventsForUser(userId, limit = 12) {
  return db.prepare("SELECT event_type, summary, created_at FROM events WHERE user_id = ? ORDER BY id DESC LIMIT ?")
    .all(userId, limit);
}

export function pruneEvents(days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("DELETE FROM events WHERE created_at < ?").run(cutoff);
}

export function saveGuildLogChannel(guildId, channelId) {
  db.prepare(`INSERT INTO guild_settings (guild_id, log_channel_id, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET log_channel_id=excluded.log_channel_id, updated_at=excluded.updated_at`)
    .run(guildId, channelId, now());
}

export function getGuildLogChannels() {
  return db.prepare("SELECT guild_id, log_channel_id FROM guild_settings").all();
}

export function createPayment(payment) {
  db.prepare(`INSERT INTO payment_intents
    (id, owner_id, plan_id, amount_cents, currency, status, payment_method, payment_code, contact_email, created_at)
    VALUES (@id, @owner_id, @plan_id, @amount_cents, @currency, @status, @payment_method, @payment_code, @contact_email, @created_at)`)
    .run(payment);
  return getPayment(payment.id);
}

export function getPayment(id) {
  return db.prepare("SELECT * FROM payment_intents WHERE id = ?").get(id) ?? null;
}

export function getPaymentByCode(paymentCode) {
  return db.prepare("SELECT id FROM payment_intents WHERE payment_code = ?").get(paymentCode) ?? null;
}

export function getPaymentByOrder(orderId) {
  return db.prepare("SELECT * FROM payment_intents WHERE paypal_order_id = ?").get(orderId) ?? null;
}

export function setPaymentOrder(id, orderId) {
  db.prepare("UPDATE payment_intents SET paypal_order_id = ? WHERE id = ?").run(orderId, id);
  return getPayment(id);
}

export function setPaymentStatus(id, status) {
  db.prepare("UPDATE payment_intents SET status = ? WHERE id = ?").run(status, id);
  return getPayment(id);
}

export function getOpenPaymentForUser(ownerId) {
  return db.prepare(`SELECT * FROM payment_intents WHERE owner_id=?
    AND status IN ('pending', 'claimed', 'paid_pending_review') ORDER BY created_at DESC LIMIT 1`).get(ownerId) ?? null;
}

export function cancelPayment(id, ownerId) {
  const result = db.prepare(`UPDATE payment_intents SET status='cancelled', reviewed_at=?
    WHERE id=? AND owner_id=? AND status='pending'`).run(now(), id, ownerId);
  return result.changes > 0 ? getPayment(id) : null;
}

export function claimPayment(id, ownerId) {
  const stamp = now();
  const result = db.prepare(`UPDATE payment_intents SET status='claimed', claimed_at=?
    WHERE id=? AND owner_id=? AND payment_method='paypal_me' AND status='pending'`).run(stamp, id, ownerId);
  return result.changes > 0 ? getPayment(id) : null;
}

export function markPaymentPaid(id) {
  const result = db.prepare(`UPDATE payment_intents SET status='paid_pending_review'
    WHERE id=? AND status IN ('pending', 'claimed')`).run(id);
  return result.changes > 0 ? getPayment(id) : null;
}

export function getPaymentsForUser(ownerId, limit = 8) {
  return db.prepare(`SELECT id, plan_id, amount_cents, currency, status, payment_method, payment_code, created_at, claimed_at, reviewed_at
    FROM payment_intents WHERE owner_id=? ORDER BY created_at DESC LIMIT ?`).all(ownerId, limit);
}

export function getPendingPayments(limit = 10) {
  return db.prepare(`SELECT p.*, u.username FROM payment_intents p JOIN users u ON u.id=p.owner_id
    WHERE p.status IN ('pending', 'claimed', 'paid_pending_review') ORDER BY p.created_at ASC LIMIT ?`).all(limit);
}

export function getPaymentsForAdmin() {
  return db.prepare(`SELECT p.id, p.owner_id, p.plan_id, p.amount_cents, p.currency, p.status,
      p.payment_method, p.payment_code, p.contact_email, p.created_at, p.claimed_at, p.reviewed_at,
      u.username
    FROM payment_intents p JOIN users u ON u.id=p.owner_id
    ORDER BY p.created_at DESC`).all();
}

export function approvePayment(id, moderatorId) {
  const payment = getPayment(id);
  if (!payment || !["claimed", "paid_pending_review"].includes(payment.status)) return null;
  const user = getUser(payment.owner_id);
  if (!user) return null;
  const currentEnd = user.plan_expires_at && Date.parse(user.plan_expires_at) > Date.now()
    ? Date.parse(user.plan_expires_at)
    : Date.now();
  const expiresAt = new Date(currentEnd + 30 * 24 * 60 * 60 * 1000).toISOString();
  const transaction = db.transaction(() => {
    const updated = db.prepare(`UPDATE payment_intents SET status='approved', reviewed_by=?, reviewed_at=?
      WHERE id=? AND status IN ('claimed', 'paid_pending_review')`).run(moderatorId, now(), id);
    if (!updated.changes) return null;
    db.prepare("UPDATE users SET plan_id=?, plan_expires_at=? WHERE id=?")
      .run(payment.plan_id, expiresAt, payment.owner_id);
    return { payment: getPayment(id), user: getUser(payment.owner_id), expiresAt };
  });
  return transaction();
}

export function rejectPayment(id, moderatorId) {
  const result = db.prepare(`UPDATE payment_intents SET status='rejected', reviewed_by=?, reviewed_at=?
    WHERE id=? AND status IN ('pending', 'claimed', 'paid_pending_review')`).run(moderatorId, now(), id);
  if (!result.changes) return null;
  const payment = getPayment(id);
  return payment;
}
