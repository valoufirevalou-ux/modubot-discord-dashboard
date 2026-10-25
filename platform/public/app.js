const root = document.querySelector("#root");
const topActions = document.querySelector("#top-actions");
const toastEl = document.querySelector("#toast");
let config;
let account;
let toastTimer;
let selectedProjectId = null;

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const dateText = (value) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value)) : "—";
const money = (cents) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

function askContactEmail({ manualPayPal = false } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "payment-dialog";
    dialog.innerHTML = `<form class="payment-dialog-card">
      <button class="payment-dialog-close" type="button" aria-label="Fermer">×</button>
      <span class="eyebrow"><span></span> PAIEMENT PAYPAL.ME</span>
      <h2>Où envoyer ton accès ?</h2>
      <p>Indique ton adresse e-mail de contact. Aucun mot de passe n’est demandé.${manualPayPal ? " Un code unique s’affichera ensuite : ajoute-le dans la note de ton paiement PayPal." : " Elle permettra de retrouver ta demande et de rattacher l’accès à ton compte."}</p>
      <label for="payment-contact-email">Adresse e-mail</label>
      <input id="payment-contact-email" name="contactEmail" type="email" autocomplete="email" maxlength="254" placeholder="toi@exemple.fr" required>
      <div class="payment-dialog-actions"><button class="button button-outline" type="button" data-cancel-email>Annuler</button><button class="button button-primary" type="submit">Continuer vers PayPal <span>↗</span></button></div>
      <small class="payment-dialog-privacy">Ton e-mail sera visible uniquement dans l’espace administrateur pour rapprocher le paiement et l’accès.</small>
    </form>`;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      dialog.close();
      dialog.remove();
    };
    dialog.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const email = new FormData(event.currentTarget).get("contactEmail").trim();
      finish({ email });
    });
    dialog.querySelector(".payment-dialog-close").addEventListener("click", () => finish(null));
    dialog.querySelector("[data-cancel-email]").addEventListener("click", () => finish(null));
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(null); });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector("#payment-contact-email").focus();
  });
}

function showManualPaymentSteps(payment, planId, contactEmail = "") {
  const plan = config?.plans?.find((item) => item.id === planId);
  const dialog = document.createElement("dialog");
  dialog.className = "payment-dialog payment-steps-dialog";
  dialog.innerHTML = `<div class="payment-dialog-card">
    <button class="payment-dialog-close" type="button" aria-label="Fermer">×</button>
    <span class="eyebrow"><span></span> RÉFÉRENCE PAYPAL.ME</span>
    <h2>Termine ton paiement</h2>
    <p>${escapeHtml(plan?.name || "Forfait")} · ${money(plan?.priceCents || 0)} pour 30 jours. Le code et l’e-mail sont déjà visibles dans l’admin quand tu cliques sur « Ouvrir PayPal ».</p>
    <label for="paypal-reference">Code à copier dans la note PayPal</label>
    <div class="payment-code-row"><input id="paypal-reference" type="text" value="${escapeHtml(payment.paymentCode)}" readonly aria-label="Code de référence PayPal"><button class="button button-outline" type="button" data-copy-manual-code>Copier le code</button></div>
    <ol class="payment-steps-list"><li><b>Copie le code</b> avec le bouton. Il reste dans ton presse-papiers et active le bouton bleu.</li><li><b>Clique sur « Ouvrir PayPal »</b> : PayPal.Me s’ouvre avec le montant du forfait destiné à FCSTslyz. Vérifie le montant avant de continuer.</li><li><b>Dans PayPal, colle le code dans « Ajouter une note »</b>, puis envoie le paiement. Le site ne peut pas remplir cette note à ta place. Si le type de paiement est proposé, choisis « Biens et services » pour cet achat.</li><li><b>Reviens sur ModuBot</b> et clique sur « J’ai payé » dans ta demande.</li><li><b>L’accès attend une vérification manuelle</b> : le code de la note et le montant doivent correspondre à la transaction reçue dans PayPal.</li></ol>
    <button class="button button-paypal payment-paypal-disabled" data-open-paypal type="button" aria-disabled="true" disabled>Ouvrir PayPal ↗</button>
    <small class="payment-dialog-privacy">Le code sert à retrouver la demande, mais ne confirme pas le transfert. Si PayPal ne propose pas « Ajouter une note », contacte l’administrateur et n’indique pas que tu as payé.</small>
  </div>`;
  const close = () => { if (dialog.open) dialog.close(); dialog.remove(); };
  const closeButton = dialog.querySelector(".payment-dialog-close");
  const copyButton = dialog.querySelector("[data-copy-manual-code]");
  const codeInput = dialog.querySelector("#paypal-reference");
  const paypalLink = dialog.querySelector("[data-open-paypal]");
  closeButton.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  copyButton.addEventListener("click", async () => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(payment.paymentCode);
      copied = true;
    } catch {
      codeInput.focus();
      codeInput.select();
      copied = document.execCommand("copy");
    }
    if (!copied) {
      toast("Sélectionne le code puis copie-le pour continuer.", true);
      return;
    }
    copyButton.textContent = "Code copié ✓";
    paypalLink.classList.remove("payment-paypal-disabled");
    paypalLink.setAttribute("aria-disabled", "false");
    paypalLink.disabled = false;
    toast("Code copié. Tu peux maintenant ouvrir PayPal.");
  });
  paypalLink.addEventListener("click", async () => {
    if (paypalLink.disabled || payment.opening) {
      toast("Copie d’abord le code de référence.", true);
      return;
    }
    payment.opening = true;
    paypalLink.disabled = true;
    paypalLink.textContent = "Préparation du paiement…";
    const popup = window.open("about:blank", "_blank");
    try {
      let savedPayment = payment;
      if (!payment.paymentId) {
        savedPayment = await api("/api/payments/manual", {
          method: "POST",
          body: JSON.stringify({ planId, contactEmail, paymentCode: payment.paymentCode })
        });
      }
      if (popup) {
        popup.opener = null;
        popup.location = savedPayment.paypalUrl;
        payment.paymentId = savedPayment.paymentId;
        close();
        refresh().then(() => toast("La demande apparaît dans l’admin. Vérifie le montant et ajoute le code dans la note PayPal."))
          .catch((error) => toast(error.message, true));
      } else {
        window.location.assign(savedPayment.paypalUrl);
      }
    } catch (error) {
      popup?.close();
      payment.opening = false;
      paypalLink.disabled = false;
      paypalLink.textContent = "Ouvrir PayPal ↗";
      toast(error.message, true);
    }
  });
  document.body.append(dialog);
  dialog.showModal();
}

function toast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.className = `toast show${isError ? " toast-error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = "toast"; }, 3800);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "La demande n’a pas abouti.");
  return data;
}

let offlinePreview = location.protocol === "file:";
const loginUrl = () => offlinePreview ? "#demo" : "/auth/discord";

function renderLanding() {
  topActions.innerHTML = offlinePreview
    ? `<a class="button button-outline button-compact" href="#demo">Ouvrir l’aperçu</a>`
    : `<a class="button button-quiet" href="${loginUrl()}">Connexion</a><a class="button button-primary button-compact" href="${loginUrl()}">Créer mon espace <span>↗</span></a>`;
  const cards = config.modules.map((module, index) => `
    <article class="feature-card"><span class="feature-index">0${index + 1}</span><div class="feature-icon icon-${escapeHtml(module.id)}">${escapeHtml(module.icon || "✦")}</div><h3>${escapeHtml(module.name)}</h3><p>${escapeHtml(module.description)}</p></article>`).join("");
  const plans = config.plans.map((plan) => `
    <article class="plan-card ${plan.featured ? "plan-featured" : ""}">
      ${plan.featured ? `<span class="plan-ribbon">LE PLUS CHOISI</span>` : ""}
      <span class="plan-name">${escapeHtml(plan.name)}</span>
      <div class="plan-price">${plan.priceCents ? money(plan.priceCents) : "Gratuit"}<small>${plan.priceCents ? "/ 30 jours" : "pour commencer"}</small></div>
      <p>Jusqu’à <b>${plan.maxBots} bot${plan.maxBots > 1 ? "s" : ""}</b> dans ton espace</p>
      <a class="button ${plan.featured ? "button-primary" : "button-outline"} plan-cta" href="${loginUrl()}">${plan.id === "free" ? "Commencer" : "Choisir ce forfait"}</a>
    </article>`).join("");
  root.innerHTML = `${offlinePreview ? `<aside class="preview-notice"><b>Aperçu visuel</b><span>Parcours le tableau de bord démo. Aucun token ni paiement n’est envoyé.</span></aside>` : ""}
    <section class="hero-section">
      <div class="hero-copy">
        <div class="eyebrow"><span></span> TON ESPACE DISCORD, ENFIN CLAIR</div>
        <h1>Tes bots.<br><em>Tes règles.</em><br>Tout au même endroit.</h1>
        <p class="hero-lede">Configure les commandes utiles, garde tes clés privées et pilote tes bots depuis un tableau de bord simple.</p>
        <div class="hero-actions"><a class="button button-primary button-large" href="${loginUrl()}">${offlinePreview ? "Ouvrir le tableau de bord" : "Continuer avec Discord"} <span>↗</span></a><a class="text-link" href="#modules">Découvrir les modules <span>↓</span></a></div>
        <div class="hero-proof"><div class="proof-avatar">M</div><div><b>Un seul espace, plusieurs bots</b><span>Compte Discord · réglages par bot · journaux privés</span></div></div>
      </div>
      <div class="hero-preview" aria-label="Aperçu du tableau de bord">
        <div class="preview-window"><div class="preview-top"><span class="window-dots"><i></i><i></i><i></i></span><span>MON ESPACE / VUE D’ENSEMBLE</span><span class="preview-live"><i></i> EN LIGNE</span></div>
          <div class="preview-body"><div class="preview-sidebar"><div class="preview-logo">✳ modu<span>bot</span></div><div class="preview-side-active">◫ &nbsp;Vue d’ensemble</div><div>◇ &nbsp;Mes bots</div><div>☷ &nbsp;Modules</div><div>◉ &nbsp;Facturation</div><div class="preview-side-bottom">● &nbsp;Espace privé</div></div>
            <div class="preview-main"><div class="preview-greeting"><div><small>TON TABLEAU DE BORD</small><h3>Salut, créateur <span>✦</span></h3></div><div class="preview-user">M</div></div>
              <div class="preview-stats"><div><small>BOTS ACTIFS</small><b>02 <i>↗</i></b></div><div><small>COMMANDES</small><b>24 <i>↗</i></b></div><div><small>FORFAIT</small><b>Pro <i class="stat-pill">ACTIF</i></b></div></div>
              <div class="preview-title"><b>Modules configurés</b><span>Voir tout ↗</span></div>
              <div class="preview-module"><span class="preview-module-icon">◈</span><span><b>Modération</b><small>8 commandes · 2 bots</small></span><i class="toggle-on"></i></div>
              <div class="preview-module"><span class="preview-module-icon mint">⌘</span><span><b>Utilitaires</b><small>5 commandes · 2 bots</small></span><i class="toggle-on"></i></div>
              <div class="preview-activity"><span>✓</span><div><b>Configuration synchronisée</b><small>Les commandes sont prêtes sur Discord</small></div><time>maintenant</time></div>
            </div>
          </div>
        </div><div class="preview-orbit orbit-a"></div><div class="preview-orbit orbit-b"></div>
      </div>
    </section>
    <section class="trust-strip"><span>CONFIDENTIALITÉ PAR DÉFAUT</span><i></i><span>COMMANDES SLASH DISCORD</span><i></i><span>VALIDATION MANUELLE DES ACCÈS PAYANTS</span></section>
    <section class="section-block" id="modules"><div class="section-heading"><div><div class="eyebrow"><span></span> UNE CONFIGURATION QUI TE RESSEMBLE</div><h2>Les bons outils,<br><em>sans le bruit.</em></h2></div><p>Choisis les fonctions utiles. Modifie-les quand tu veux. Le bot synchronise les commandes slash activées sur Discord.</p></div><div class="feature-grid">${cards}</div></section>
    <section class="security-band" id="confidentialite"><div class="security-mark">⌑</div><div><div class="eyebrow"><span></span> CLÉS PRIVÉES, TRAITÉES COMME TELLES</div><h2>Un token reste<br><em>à sa place : secret.</em></h2><p>Le token est envoyé au serveur en HTTPS, chiffré avant stockage, jamais réaffiché et jamais écrit dans les journaux. Tu peux retirer ton bot pour supprimer sa clé.</p></div><div class="security-points"><span>✓ Chiffrement côté serveur</span><span>✓ Aucun token dans Discord</span><span>✓ Événements conservés 30 jours</span></div></section>
    <section class="section-block pricing-section" id="offres"><div class="section-heading"><div><div class="eyebrow"><span></span> GRANDIR À TON RYTHME</div><h2>Un espace pour<br><em>chaque étape.</em></h2></div><p>Les forfaits payants durent 30 jours. Les paiements PayPal sont examinés avant l’activation des quotas.</p></div><div class="plan-grid">${plans}</div><div class="payment-guide"><div class="eyebrow"><span></span> PAYER AVEC PAYPAL.ME</div><h3>Comment activer ton forfait ?</h3><ol><li><b>Choisis un forfait</b><span>Connecte-toi avec Discord, puis indique ton e-mail de contact.</span></li><li><b>Copie ta référence</b><span>Un code à huit chiffres apparaît. Le bouton PayPal reste bloqué tant que tu ne l’as pas copié.</span></li><li><b>Envoie le montant affiché</b><span>PayPal.Me ouvre le bon montant pour FCSTslyz. Colle le code dans la note si PayPal propose ce champ et choisis « Biens et services » pour cet achat.</span></li><li><b>Déclare le paiement</b><span>Reviens dans ton espace et clique sur « J’ai payé ». L’accès est activé après vérification manuelle dans PayPal.</span></li></ol><p>PayPal.Me ne confirme pas le transfert au site. Le code aide à retrouver la transaction et ne prouve pas le paiement.</p></div><p class="pricing-footnote">Les prix et capacités sont configurables par l’administrateur. L’hébergement dépend de la capacité réelle du serveur.</p></section>
    <section class="bottom-cta"><div class="cta-spark">✳</div><h2>Prêt à mieux piloter<br><em>tes bots Discord ?</em></h2><p>Ouvre ton espace privé en quelques secondes avec ton compte Discord.</p><a class="button button-primary button-large" href="${loginUrl()}">Créer mon espace <span>↗</span></a></section>
    <p class="legal-note">Le site ne demande jamais ton mot de passe Discord. Pour PayPal.Me, l’adresse e-mail de contact et la référence de paiement sont visibles uniquement par l’administrateur afin de vérifier la transaction et d’activer l’accès.</p>`;
}

function statusClass(status) {
  if (status.startsWith("En ligne")) return "status-good";
  if (status.startsWith("En pause")) return "status-paused";
  if (status.startsWith("À vérifier")) return "status-error";
  return "status-wait";
}

function paymentLabel(status) {
  return ({ pending: "À payer", claimed: "Déclaration à vérifier", paid_pending_review: "PayPal confirmé · accès à valider", approved: "Approuvé", rejected: "Refusé", failed: "Échec" })[status] || status;
}

function renderPayment(payment) {
  const presetPlan = config?.plans?.find((plan) => plan.id === payment.plan_id);
  const customPlan = /^custom-(\d{1,2})$/.exec(payment.plan_id);
  const planName = presetPlan?.name || (customPlan ? `Forfait ${customPlan[1]} bots` : payment.plan_id.toUpperCase());
  const waitingManual = payment.payment_method === "paypal_me" && payment.status === "pending";
  const canCancel = payment.status === "pending";
  const actions = waitingManual
    ? `<button class="button button-outline button-tiny" data-resume-payment="${escapeHtml(payment.id)}">Reprendre le paiement</button><button class="button button-outline button-tiny" data-claim-payment="${escapeHtml(payment.id)}">J’ai payé</button>`
    : `<span class="payment-state">${escapeHtml(paymentLabel(payment.status))}</span>`;
  const reference = payment.payment_method === "paypal_me" && payment.status === "claimed"
    ? `<div class="payment-reference"><p>Ta déclaration a été envoyée. Le propriétaire vérifie le montant et la note dans PayPal avant d’activer le forfait.</p></div>`
    : "";
  return `<article class="payment-entry"><div class="payment-row"><div class="payment-mark">${payment.status === "approved" ? "✓" : "€"}</div><div class="payment-info"><b>${escapeHtml(planName)} · ${money(payment.amount_cents)}</b><small>${dateText(payment.created_at)} · ${escapeHtml(paymentLabel(payment.status))}</small></div>${actions}${canCancel ? `<button class="danger-link" data-cancel-payment="${escapeHtml(payment.id)}">Annuler</button>` : ""}</div>${reference}</article>`;
}

function moduleChoices(bot) {
  const selectedModules = Array.isArray(bot.modules) ? bot.modules : [];
  const currentRank = config.plans.find((plan) => plan.id === account.plan.id)?.rank || 0;
  return config.modules.map((module) => {
    const minimumPlan = config.plans.find((plan) => plan.id === module.requiredPlanId) || config.plans[0];
    const locked = currentRank < (minimumPlan.rank || 0);
    const icon = module.icon || "✦";
    const count = Number(module.commandCount) || 0;
    return `<article class="module-card ${locked ? "module-card-locked" : ""} ${selectedModules.includes(module.id) ? "module-card-enabled" : ""}">
      <span class="module-card-icon">${escapeHtml(icon)}</span>
      <span class="module-card-copy"><b>${escapeHtml(module.name)}</b><small>${escapeHtml(module.description)}</small><small class="module-command-count">${count} commande${count === 1 ? "" : "s"} slash</small></span>
      ${locked
        ? `<span class="module-lock"><b>🔒 ${escapeHtml(minimumPlan.name)}</b><button type="button" class="text-link" data-unlock-module="${escapeHtml(module.id)}">Voir les offres ↗</button></span>`
        : `<label class="module-toggle" aria-label="Activer ${escapeHtml(module.name)}"><input type="checkbox" name="module" value="${escapeHtml(module.id)}" ${selectedModules.includes(module.id) ? "checked" : ""}><span></span></label>`}
    </article>`;
  }).join("");
}

function renderAddBotForm() {
  const defaults = { modules: ["utility", "fun"] };
  return `<form class="bot-card add-bot-form" id="add-bot-form">
    <div class="bot-card-head"><div class="bot-avatar">＋</div><div class="bot-ident"><b>Nouveau projet bot</b><small>Le token reste secret et n’est jamais réaffiché.</small></div></div>
    <div class="form-row project-settings-row add-project-fields">
      <label class="field"><span>Nom du projet</span><input name="projectName" maxlength="50" minlength="2" placeholder="Ex. Modération du serveur" required><small>Choisis le nom visible dans ton espace.</small></label>
      <label class="field token-field"><span>Token secret du bot Discord</span><div class="token-input-wrap"><input name="token" type="password" autocomplete="new-password" spellcheck="false" placeholder="Colle le token du bot ici" required><button type="button" class="token-reveal" data-toggle-token aria-label="Afficher ou masquer le token">Afficher</button></div><small>Colle le token du bot depuis le portail développeur. Il ne s’agit pas de l’ID de l’application.</small></label>
      <label class="field prefix-field"><span>Préfixe des commandes</span><input name="prefix" value="/" readonly aria-readonly="true"><small>Fixé à / : les commandes sont toujours des commandes slash Discord.</small></label>
    </div>
    <div class="token-safety-note"><span>⌑</span><span>En ligne, le serveur vérifie le token auprès de Discord puis le chiffre avant stockage. En aperçu local, le formulaire ne transmet aucune donnée.</span></div>
    <div class="project-modules-heading"><div><b>Modules du projet</b><small>Utilitaires et Fun restent gratuits. Les autres se débloquent avec leur forfait.</small></div></div>
    <div class="module-card-grid">${moduleChoices(defaults)}</div>
    <div class="add-project-actions"><button class="button button-primary" type="submit">Créer et mettre en ligne le bot <span>↗</span></button><small>Le serveur connectera le bot et synchronisera les commandes slash sélectionnées.</small></div>
  </form>`;
}

function renderBot(bot) {
  return `<article class="bot-card" data-bot-id="${escapeHtml(bot.id)}">
    <div class="bot-card-head"><div class="bot-avatar">${escapeHtml((bot.projectName || bot.username).slice(0, 1).toUpperCase())}</div><div class="bot-ident"><b>${escapeHtml(bot.projectName || bot.username)}</b><small>Bot Discord · ${escapeHtml(bot.username)} · ID ${escapeHtml(bot.discordId)}</small></div><span class="bot-status ${statusClass(bot.status)}"><i></i>${escapeHtml(bot.status)}</span></div>
    <form class="bot-config-form" data-config-bot="${escapeHtml(bot.id)}">
      <div class="form-row project-settings-row"><label class="field"><span>Nom du projet</span><input name="projectName" maxlength="50" value="${escapeHtml(bot.projectName || bot.username)}"><small>Le nom affiché dans ta liste de projets.</small></label><label class="field"><span>Préfixe des commandes</span><input name="prefix" value="/" readonly aria-readonly="true"><small>Fixé à / : seules les commandes slash sont utilisées.</small></label><button class="button button-primary button-tiny" type="submit">Enregistrer</button></div>
      <div class="project-modules-heading"><div><b>Modules de ce projet</b><small>Active les modules débloqués. Les commandes Discord restent en /.</small></div><span>${bot.modules.length} actif${bot.modules.length === 1 ? "" : "s"}</span></div>
      <div class="module-card-grid">${moduleChoices(bot)}</div>
    </form>
    <div class="bot-card-foot"><span>Projet créé le ${dateText(bot.createdAt)}</span><button class="danger-link" data-delete-bot="${escapeHtml(bot.id)}">Retirer ce projet</button></div>
  </article>`;
}

function renderDashboard() {
  const { user, plan, bots, payments, events } = account;
  document.body.classList.add("dashboard-mode");
  topActions.innerHTML = "";
  selectedProjectId = bots.some((bot) => bot.id === selectedProjectId) ? selectedProjectId : bots[0]?.id || null;
  const selectedBot = bots.find((bot) => bot.id === selectedProjectId);
  const capacity = config.capacity?.maxHostedBots || 1;
  const allowedSlots = Math.min(plan.maxBots, capacity);
  const activeModules = bots.reduce((sum, bot) => sum + bot.modules.length, 0);
  const hasOpenPayment = payments.some((payment) => ["pending", "claimed", "paid_pending_review"].includes(payment.status));
  const projectsMarkup = bots.map((bot) => `<button class="project-nav-item ${bot.id === selectedProjectId ? "active" : ""}" type="button" data-select-project="${escapeHtml(bot.id)}"><span class="project-nav-avatar">${escapeHtml((bot.projectName || bot.username).slice(0, 1).toUpperCase())}</span><span><b>${escapeHtml(bot.projectName || bot.username)}</b><small>${escapeHtml(bot.status)}</small></span><i></i></button>`).join("");
  const projectMarkup = selectedBot
    ? renderBot(selectedBot)
    : `<div class="empty-state project-empty"><div class="empty-icon">✳</div><h3>Crée ton premier projet bot</h3><p>Choisis un nom, ajoute le token secret de ton bot, puis active les modules gratuits.</p><button class="button button-primary" type="button" data-open-add>＋ Nouveau projet</button></div>`;
  const activityMarkup = events.length ? events.map((event) => `<div class="activity-row"><span class="activity-check">✓</span><div><b>${escapeHtml(event.summary)}</b><small>${escapeHtml(event.event_type.replaceAll("_", " "))}</small></div><time>${dateText(event.created_at)}</time></div>`).join("") : `<div class="activity-empty">Les connexions et modifications de tes projets apparaîtront ici.</div>`;
  const paymentsMarkup = payments.length ? payments.map(renderPayment).join("") : `<div class="activity-empty">Aucune demande de paiement.</div>`;
  const planMarkup = config.plans.map((item) => {
    const canBuy = item.id === "free" || (config.payments.enabled && account.availablePlans.includes(item.id));
    const active = item.id === plan.id;
    const unavailableLabel = hasOpenPayment ? "Demande en cours" : config.payments.enabled ? "Capacité indisponible" : "Paiements à configurer";
    const features = config.modules.filter((module) => (item.rank || 0) >= (config.plans.find((tier) => tier.id === module.requiredPlanId)?.rank || 0)).map((module) => module.name);
    let cta;
    if (active) cta = `<span class="plan-current-label">Ton forfait actuel</span>`;
    else if (item.id === "free") cta = `<span class="plan-current-label">Gratuit pour commencer</span>`;
    else if (!canBuy) cta = `<button class="button button-outline" disabled>${escapeHtml(unavailableLabel)}</button>`;
    else cta = `<button class="button ${item.featured ? "button-primary" : "button-outline"}" data-buy-plan="${escapeHtml(item.id)}" data-payment-method="${config.payments.manual ? "manual" : "checkout"}">${config.payments.manual ? "Payer avec PayPal.Me" : "Payer avec PayPal"}</button>`;
    return `<article class="billing-card ${item.featured ? "billing-featured" : ""} ${active ? "billing-current" : ""}"><span class="plan-name">${escapeHtml(item.name)}</span><div class="billing-price">${item.priceCents ? money(item.priceCents) : "Gratuit"}<small>${item.priceCents ? " / 30 jours" : " pour commencer"}</small></div><p class="billing-bots">Jusqu’à <b>${item.maxBots} projets bots</b></p><p class="billing-features">${features.map(escapeHtml).join(" · ")}</p>${cta}</article>`;
  }).join("");
  const payDisclosure = config.payments.manual
    ? "Copie le code, ouvre PayPal.Me avec le montant exact et ajoute la référence dans la note. Le propriétaire vérifie la transaction avant d’activer l’accès."
    : config.payments.checkout
    ? "PayPal Checkout confirme le paiement. Tu peux examiner les demandes et activer les forfaits dans /admin."
    : config.payments.manual
      ? "PayPal.Me ouvre ton compte PayPal. Après le paiement, déclare-le ici ; le propriétaire vérifie la transaction avant d’activer les quotas."
      : "Les paiements seront disponibles lorsque l’hébergement et ses capacités seront configurés.";
  const avatar = user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt="">` : `<span class="account-avatar">${escapeHtml((user.username || "M").slice(0, 1).toUpperCase())}</span>`;
  root.innerHTML = `<div class="workspace-shell">
    <aside class="workspace-sidebar">
      <a class="brand workspace-brand" href="${offlinePreview ? "#" : "/"}" aria-label="ModuBot accueil"><span class="brand-mark">✳</span><span>modu<span>bot</span></span></a>
      <div class="sidebar-label">ESPACE DE TRAVAIL</div><div class="workspace-switcher"><span class="workspace-switcher-avatar">${escapeHtml((user.username || "M").slice(0, 1).toUpperCase())}</span><span><b>${escapeHtml(user.username)}</b><small>${escapeHtml(plan.name)}</small></span><i>⌄</i></div>
      <div class="sidebar-label sidebar-project-heading"><span>PROJETS</span><button type="button" data-open-add aria-label="Ajouter un projet">＋</button></div>
      <div class="project-nav-list">${projectsMarkup || `<span class="sidebar-empty">Tes projets bot apparaîtront ici.</span>`}</div>
      <nav class="workspace-nav" aria-label="Menu de l’espace"><a href="#overview" class="workspace-nav-active">⌂ <span>Vue d’ensemble</span></a><a href="#modules">✦ <span>Modules</span></a><a href="#billing">€ <span>Facturation</span></a><a href="#activity">☷ <span>Journaux</span></a></nav>
      <div class="sidebar-user">${avatar}<span><b>${escapeHtml(user.username)}</b><small>Espace privé</small></span><button id="logout" type="button" title="Déconnexion">···</button></div>
    </aside>
    <main class="workspace-main">
      <header class="workspace-topbar"><div class="workspace-breadcrumb">Mon espace <span>/</span> <b>Vue d’ensemble</b></div><div class="workspace-top-actions">${offlinePreview ? `<span class="demo-pill">● MODE DÉMO · aucune action envoyée</span>` : ""}<button class="button button-primary button-compact" type="button" data-open-add ${bots.length >= allowedSlots ? "disabled" : ""}>＋ Nouveau projet</button></div></header>
      <section class="workspace-overview" id="overview"><div class="dashboard-heading"><div><div class="eyebrow"><span></span> VUE D’ENSEMBLE · TON ESPACE PRIVÉ</div><h1>Bonjour ${escapeHtml(user.username)} <em>✦</em></h1><p>Choisis un projet à gauche pour gérer son token, ses modules et ses commandes slash.</p></div></div>
      <div class="overview-grid"><article class="overview-card"><span>FORFAIT ACTUEL</span><b>${escapeHtml(plan.name)}</b><small>${plan.expiresAt ? `Jusqu’au ${dateText(plan.expiresAt)}` : `${plan.maxBots} projet${plan.maxBots === 1 ? "" : "s"} inclus`}</small></article><article class="overview-card"><span>PROJETS BOTS</span><b>${bots.length}<small> / ${allowedSlots}</small></b><small>${bots.filter((bot) => bot.status.startsWith("En ligne")).length} actuellement en ligne</small></article><article class="overview-card"><span>MODULES ACTIVÉS</span><b>${activeModules}</b><small>Sur ${bots.length} projet${bots.length === 1 ? "" : "s"}</small></article><article class="overview-card overview-card-highlight"><span>COMMANDES</span><b>Slash /</b><small>Le préfixe reste un réglage de compatibilité</small></article></div></section>
      <section class="dashboard-section project-section" id="modules"><div class="dashboard-section-heading"><div><div class="eyebrow"><span></span> PROJET SÉLECTIONNÉ</div><h2>${escapeHtml(selectedBot?.projectName || "Tes projets bots")}</h2></div><span class="section-count">${bots.length} / ${allowedSlots} places</span></div>${projectMarkup}
      ${bots.length < allowedSlots && selectedBot ? `<details class="add-bot-panel" id="new-project-panel"><summary><span class="add-plus">＋</span><span><b>Créer un nouveau projet bot</b><small>Un projet distinct avec son nom, son token et ses modules.</small></span><span class="summary-arrow">⌄</span></summary>${renderAddBotForm()}</details>` : selectedBot ? `<div class="quota-note">Tu as utilisé toutes les places de ton forfait ou de l’hébergement.</div>` : renderAddBotForm()}</section>
      <section class="dashboard-section billing-section" id="billing"><div class="dashboard-section-heading"><div><div class="eyebrow"><span></span> FACTURATION</div><h2>Choisis tes capacités</h2></div><span class="section-caption">Forfaits de 30 jours · paiement PayPal</span></div><div class="billing-grid billing-grid-four">${planMarkup}</div><div class="payment-list"><div class="mini-heading"><b>Mes paiements</b><span>Les demandes restent consultables dans ton espace.</span></div>${paymentsMarkup}</div><div class="billing-disclosure">${payDisclosure}</div></section>
      <section class="dashboard-section activity-section" id="activity"><div class="dashboard-section-heading"><div><div class="eyebrow"><span></span> JOURNAL DU COMPTE</div><h2>Activité récente</h2></div><span class="section-caption">Conservation : 30 jours</span></div><div class="activity-card">${activityMarkup}</div></section>
      <section class="privacy-reminder"><div class="security-mark">⌑</div><div><b>Token de bot protégé</b><span>Il est chiffré côté serveur, jamais réaffiché ni envoyé dans les journaux Discord.</span></div><a href="${offlinePreview ? "#" : "/#confidentialite"}">Confidentialité ↗</a></section>
    </main></div>`;
}

function bindDashboardActions() {
  document.querySelectorAll("[data-select-project]").forEach((button) => button.addEventListener("click", () => {
    selectedProjectId = button.dataset.selectProject;
    render();
  }));
  document.querySelectorAll("[data-open-add]").forEach((button) => button.addEventListener("click", () => {
    const panel = document.querySelector("#new-project-panel");
    if (panel) panel.open = true;
    document.querySelector("#add-bot-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }));
  document.querySelectorAll("[data-unlock-module]").forEach((button) => button.addEventListener("click", () => document.querySelector("#billing")?.scrollIntoView({ behavior: "smooth" })));
  document.querySelectorAll("[data-toggle-token]").forEach((button) => button.addEventListener("click", () => {
    const input = button.closest(".token-input-wrap")?.querySelector("input");
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "Afficher" : "Masquer";
  }));
  document.querySelector("#logout")?.addEventListener("click", async () => {
    if (offlinePreview) { toast("Aperçu de démonstration : aucune session Discord n’est ouverte."); return; }
    try { await api("/auth/logout", { method: "POST", body: "{}" }); location.assign("/"); }
    catch (error) { toast(error.message, true); }
  });
  document.querySelector("#add-bot-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (offlinePreview) {
      form.querySelector('[name="token"]').value = "";
      toast("Aperçu local : le token et le paiement ne sont pas envoyés. Démarre le serveur pour connecter un bot.");
      return;
    }
    const formData = new FormData(form);
    const token = formData.get("token");
    const projectName = formData.get("projectName");
    const modules = [...form.querySelectorAll('input[name="module"]:checked')].map((item) => item.value);
    const prefix = formData.get("prefix");
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Connexion sécurisée…";
    try {
      await api("/api/bots", { method: "POST", body: JSON.stringify({ token, projectName, prefix, modules }) });
      form.querySelector('[name="token"]').value = "";
      toast("Bot connecté. Son token a été chiffré et effacé du formulaire.");
      await refresh();
    } catch (error) {
      submit.disabled = false;
      submit.textContent = "Créer et mettre en ligne le bot";
      toast(error.message, true);
    }
  });
  document.querySelectorAll("[data-config-bot]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (offlinePreview) { toast("Aperçu de démonstration : les changements ne sont pas enregistrés."); return; }
    const target = event.currentTarget;
    const modules = [...target.querySelectorAll('input[name="module"]:checked')].map((item) => item.value);
    try {
      await api(`/api/bots/${encodeURIComponent(target.dataset.configBot)}`, {
        method: "PATCH", body: JSON.stringify({ projectName: new FormData(target).get("projectName"), prefix: new FormData(target).get("prefix"), modules })
      });
      toast("Réglages enregistrés et commandes synchronisées.");
      await refresh();
    } catch (error) { toast(error.message, true); }
  }));
  document.querySelectorAll("[data-delete-bot]").forEach((button) => button.addEventListener("click", async () => {
    if (offlinePreview) { toast("Aperçu de démonstration : aucune suppression n’est effectuée."); return; }
    if (!confirm("Retirer ce bot ? Sa clé sera supprimée du stockage et sa connexion arrêtée.")) return;
    try {
      await api(`/api/bots/${encodeURIComponent(button.dataset.deleteBot)}`, { method: "DELETE" });
      toast("Bot retiré et token supprimé.");
      await refresh();
    } catch (error) { toast(error.message, true); }
  }));
  document.querySelectorAll("[data-buy-plan]").forEach((button) => button.addEventListener("click", async () => {
    if (offlinePreview) { toast("Aperçu local : configure le serveur et PayPal pour traiter un vrai paiement."); return; }
    const planId = button.dataset.buyPlan;
    const paymentMethod = button.dataset.paymentMethod;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Préparation de PayPal…";
    try {
      if (paymentMethod === "checkout") {
        const contact = await askContactEmail();
        if (!contact) {
          button.disabled = false;
          button.textContent = original;
          return;
        }
        const result = await api("/api/paypal/orders", { method: "POST", body: JSON.stringify({ planId, contactEmail: contact.email }) });
        location.assign(result.approveUrl);
      } else {
        const contact = await askContactEmail({ manualPayPal: true });
        if (!contact) {
          button.disabled = false;
          button.textContent = original;
          return;
        }
        let paymentCode;
        const random = new Uint32Array(1);
        crypto.getRandomValues(random);
        paymentCode = String(random[0] % 100_000_000).padStart(8, "0");
        showManualPaymentSteps({ paymentCode }, planId, contact.email);
      }
    } catch (error) {
      button.disabled = false;
      button.textContent = original;
      toast(error.message, true);
    }
  }));
  document.querySelectorAll("[data-claim-payment]").forEach((button) => button.addEventListener("click", async () => {
    if (offlinePreview) { toast("Aperçu de démonstration : aucune déclaration de paiement n’est envoyée."); return; }
    button.disabled = true;
    try {
      await api(`/api/payments/${encodeURIComponent(button.dataset.claimPayment)}/claim`, { method: "POST", body: "{}" });
      toast("Déclaration enregistrée. La demande apparaît dans l’espace admin et sera activée après vérification PayPal.");
      await refresh();
    } catch (error) { button.disabled = false; toast(error.message, true); }
  }));
  document.querySelectorAll("[data-resume-payment]").forEach((button) => button.addEventListener("click", () => {
    const payment = account?.payments?.find((item) => item.id === button.dataset.resumePayment);
    if (!payment?.payment_code || !payment.paypalUrl) return;
    showManualPaymentSteps({ paymentId: payment.id, paymentCode: payment.payment_code, paypalUrl: payment.paypalUrl }, payment.plan_id, account.user.email || "");
  }));
  document.querySelectorAll("[data-copy-payment-code]").forEach((button) => button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copyPaymentCode);
      toast("Code de référence copié.");
    } catch {
      toast(`Code PayPal : ${button.dataset.copyPaymentCode}`);
    }
  }));
  document.querySelectorAll("[data-cancel-payment]").forEach((button) => button.addEventListener("click", async () => {
    if (offlinePreview) { toast("Aperçu de démonstration : aucune demande n’est annulée."); return; }
    try {
      await api(`/api/payments/${encodeURIComponent(button.dataset.cancelPayment)}/cancel`, { method: "POST", body: "{}" });
      toast("Demande annulée. Aucune validation ne sera envoyée à l’administrateur.");
      await refresh();
    } catch (error) { toast(error.message, true); }
  }));
}

async function render() {
  if (!account?.user) {
    document.body.classList.remove("dashboard-mode");
    renderLanding();
    return;
  }
  renderDashboard();
  bindDashboardActions();
}

async function refresh() {
  account = await api("/api/me");
  await render();
}

async function captureReturnedPayPalOrder() {
  const query = new URLSearchParams(location.search);
  const orderId = query.get("token");
  if (query.get("paypal") !== "success" || !orderId || !account?.user) return;
  history.replaceState({}, "", "/app");
  try {
    await api("/api/paypal/capture", { method: "POST", body: JSON.stringify({ orderId }) });
    toast("Paiement confirmé par PayPal. L’administrateur doit encore approuver le forfait.");
    await refresh();
  } catch (error) {
    toast(error.message, true);
    await refresh();
  }
}

async function init() {
  if (offlinePreview) {
    initPreview();
    return;
  }
  try {
    config = await api("/api/config");
    account = await api("/api/me");
    await render();
    await captureReturnedPayPalOrder();
    const params = new URLSearchParams(location.search);
    if (params.get("error") === "discord-login") toast("La connexion Discord n’a pas abouti. Réessaie.", true);
    if (params.get("paypal") === "cancel") {
      history.replaceState({}, "", "/app");
      toast("Le paiement PayPal a été annulé.");
    }
  } catch (error) {
    offlinePreview = true;
    history.replaceState({}, "", `${location.pathname}#${location.hash.slice(1) || "offres"}`);
    initPreview();
    toast("Aperçu affiché : le serveur privé n’est pas encore connecté.");
  }
}

function initPreview() {
  config = {
    modules: [
      { id: "moderation", name: "Modération", description: "Nettoyage et sanctions du serveur.", requiredPlanId: "mod", commandCount: 5, icon: "◈" },
      { id: "community", name: "Sondages & communauté", description: "Sondages et annonces dans les salons choisis.", requiredPlanId: "pro", commandCount: 2, icon: "◉" },
      { id: "protection", name: "Protection du serveur", description: "Ralentissement et verrouillage des salons.", requiredPlanId: "mod", commandCount: 3, icon: "⌁" },
      { id: "utility", name: "Utilitaires", description: "Aide, ping, serveur, membre et avatar.", requiredPlanId: "free", commandCount: 5, icon: "⌘" },
      { id: "support", name: "Tickets", description: "Ouvre des salons privés de support.", requiredPlanId: "ultimate", commandCount: 1, icon: "▤" },
      { id: "fun", name: "Jeux & fun", description: "Dé et boule magique, disponibles gratuitement.", requiredPlanId: "free", commandCount: 2, icon: "✦" }
    ],
    plans: [
      { id: "free", name: "Gratuit", priceCents: 0, maxBots: 1, rank: 0 },
      { id: "mod", name: "Mod", priceCents: 499, maxBots: 2, rank: 1 },
      { id: "pro", name: "Pro", priceCents: 999, maxBots: 8, rank: 2, featured: true },
      { id: "ultimate", name: "Ultime", priceCents: 2999, maxBots: 25, rank: 3 }
    ],
    capacity: { maxHostedBots: 25 },
    payments: { enabled: true, checkout: true, manual: true },
    discordInviteUrl: "#"
  };
  const renderPreviewRoute = () => {
    if (location.hash === "#demo") {
      account = {
        user: { id: "demo-user", username: "Créateur", avatarUrl: "" },
        plan: { id: "pro", name: "Pro", maxBots: 8, expiresAt: null },
        availablePlans: ["mod", "pro", "ultimate"],
        bots: [
          { id: "demo-bot-1", projectName: "Astéria Studio", username: "AsteriaBot", discordId: "120000000000000001", prefix: "!", modules: ["utility", "fun", "moderation", "protection", "community"], status: "En ligne · aperçu", createdAt: new Date().toISOString() },
          { id: "demo-bot-2", projectName: "Communauté", username: "CommunityHelper", discordId: "120000000000000002", prefix: "?", modules: ["utility", "fun"], status: "En ligne · aperçu", createdAt: new Date().toISOString() }
        ],
        events: [],
        payments: []
      };
    } else account = { user: null };
    render();
    if (!account.user) {
      document.querySelectorAll('a[href="#"], a[href="/"]').forEach((link) => link.addEventListener("click", (event) => {
        if (link.getAttribute("href") === "/") return;
        event.preventDefault();
        toast("Aperçu local : démarre le serveur pour activer cette fonction.");
      }));
    }
  };
  renderPreviewRoute();
  window.addEventListener("hashchange", renderPreviewRoute);
}

init();

setInterval(async () => {
  if (offlinePreview || document.visibilityState !== "visible" || !account?.user || root.contains(document.activeElement)) return;
  try { await refresh(); } catch {}
}, 12000);
