export const PLAN_RANK = { free: 0, mod: 1, pro: 2, ultimate: 3 };

export const PLANS = [
  { id: "free", name: "Gratuit", priceCents: 0, durationDays: 0, maxBots: 1, accent: "mint", featured: false },
  { id: "mod", name: "Mod", priceCents: 499, durationDays: 30, maxBots: 2, accent: "blue", featured: false },
  { id: "pro", name: "Pro", priceCents: 999, durationDays: 30, maxBots: 8, accent: "violet", featured: true },
  { id: "ultimate", name: "Ultime", priceCents: 2999, durationDays: 30, maxBots: 25, accent: "gold", featured: false }
];

export const MODULES = [
  { id: "moderation", name: "Modération", description: "Nettoyage, avertissements, rôles et sanctions contrôlées.", requiredPlanId: "mod", commandCount: 13, icon: "◈" },
  { id: "community", name: "Sondages & communauté", description: "Sondages et annonces dans les salons choisis.", requiredPlanId: "pro", commandCount: 2, icon: "◉" },
  { id: "protection", name: "Protection du serveur", description: "Anti-spam réglable, ralentissement et verrouillage des salons.", requiredPlanId: "mod", commandCount: 4, icon: "⌁" },
  { id: "utility", name: "Utilitaires", description: "Aide, ping, serveur, membre, avatar, bot, salon et rôle.", requiredPlanId: "free", commandCount: 8, icon: "⌘" },
  { id: "support", name: "Tickets", description: "Ouvre des salons privés de support.", requiredPlanId: "ultimate", commandCount: 1, icon: "▤" },
  { id: "fun", name: "Jeux & fun", description: "Dé et boule magique, disponibles gratuitement.", requiredPlanId: "free", commandCount: 2, icon: "✦" }
];

export function findPlan(id) {
  return PLANS.find((plan) => plan.id === id) || PLANS[0];
}

export function effectivePlan(user, now = Date.now()) {
  if (!user || user.plan_id === "free") return findPlan("free");
  if (!user.plan_expires_at || Date.parse(user.plan_expires_at) <= now) return findPlan("free");
  return findPlan(user.plan_id);
}

export function canUseModule(planOrId, moduleId) {
  const plan = typeof planOrId === "string" ? findPlan(planOrId) : planOrId;
  const module = MODULES.find((entry) => entry.id === moduleId);
  if (!module) return false;
  return (PLAN_RANK[plan?.id] ?? 0) >= (PLAN_RANK[module.requiredPlanId] ?? Number.POSITIVE_INFINITY);
}

export function modulesForPlan(planOrId) {
  const plan = typeof planOrId === "string" ? findPlan(planOrId) : planOrId;
  return MODULES.filter((module) => canUseModule(plan, module.id)).map((module) => module.id);
}
