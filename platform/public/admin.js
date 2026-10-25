const adminRoot = document.querySelector("#admin-root");
const adminToast = document.querySelector("#admin-toast");
let paymentRows = [];
let refreshTimer;
let toastTimer;

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const money = (cents, currency = "EUR") => new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
const dateText = (value) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const labels = {
  pending: "En attente du paiement",
  claimed: "À vérifier dans PayPal",
  paid_pending_review: "Capture PayPal confirmée",
  approved: "Accès activé",
  rejected: "Refusé",
  cancelled: "Annulé",
  failed: "Échec"
};

function toast(message, error = false) {
  adminToast.textContent = message;
  adminToast.className = `admin-toast show${error ? " is-error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { adminToast.className = "admin-toast"; }, 4000);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "La demande n’a pas abouti.");
  return data;
}

function renderLogin(message = "") {
  clearInterval(refreshTimer);
  adminRoot.innerHTML = `<section class="admin-login-card">
    <div class="admin-icon">⌑</div>
    <div class="admin-eyebrow"><i></i> ESPACE PRIVÉ</div>
    <h1>Administration</h1>
    <p>Entre le code administrateur pour consulter les demandes PayPal.Me et les e-mails de contact.</p>
    <form id="admin-login-form">
      <label for="admin-code">Code administrateur</label>
      <input id="admin-code" name="code" type="password" inputmode="numeric" autocomplete="current-password" maxlength="128" required autofocus>
      <button class="admin-button admin-button-primary" type="submit">Ouvrir l’espace <span>→</span></button>
      <small>Seul l’e-mail de contact est demandé aux clients. Aucun mot de passe n’est collecté.</small>
    </form>
    ${message ? `<div class="admin-inline-error">${escapeHtml(message)}</div>` : ""}
  </section>`;
  document.querySelector("#admin-login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Vérification…";
    try {
      const code = new FormData(form).get("code");
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ code }) });
      await renderDashboard();
    } catch (error) {
      renderLogin(error.message);
    }
  });
}

function paymentStatusClass(status) {
  if (status === "approved") return "status-approved";
  if (status === "claimed" || status === "paid_pending_review") return "status-review";
  if (["rejected", "cancelled", "failed"].includes(status)) return "status-closed";
  return "status-open";
}

function paymentCard(payment) {
  const canApprove = ["claimed", "paid_pending_review"].includes(payment.status);
  const canReject = ["pending", "claimed", "paid_pending_review"].includes(payment.status);
  const plan = ({ mod: "Mod", pro: "Pro", ultimate: "Ultime" })[payment.plan_id] || payment.plan_id;
  const method = payment.payment_method === "paypal_checkout" ? "PayPal Checkout" : "PayPal.Me";
  return `<article class="payment-card">
    <div class="payment-card-head"><div><span class="payment-plan">${escapeHtml(plan)}</span><b>${money(payment.amount_cents, payment.currency)}</b><small class="payment-method">${escapeHtml(method)}</small></div><span class="status-pill ${paymentStatusClass(payment.status)}">${escapeHtml(labels[payment.status] || payment.status)}</span></div>
    <div class="payment-details">
      <div><small>E-MAIL DE CONTACT</small><b class="email-value">${escapeHtml(payment.contact_email || "—")}</b></div>
      <div><small>${payment.payment_code ? "CODE À LIRE DANS LA NOTE PAYPAL" : "RÉFÉRENCE DE COMMANDE"}</small><b class="payment-code">${escapeHtml(payment.payment_code || "PayPal Checkout")}</b></div>
      <div><small>COMPTE DU SITE</small><b>${escapeHtml(payment.username || "Utilisateur Discord")}</b></div>
      <div><small>DEMANDE CRÉÉE</small><b>${escapeHtml(dateText(payment.created_at))}</b></div>
    </div>
    ${payment.status === "pending" ? `<p class="payment-hint">Le lien PayPal.Me a été ouvert. Aucun transfert n’est confirmé ici : attends la déclaration du client, puis vérifie toi-même le montant et la note dans PayPal.</p>` : ""}
    ${canApprove || canReject ? `<div class="payment-actions">${canApprove ? `<button class="admin-button admin-button-primary" data-approve-payment="${escapeHtml(payment.id)}">J’ai vérifié sur PayPal · activer</button>` : ""}${canReject ? `<button class="admin-button admin-button-danger" data-reject-payment="${escapeHtml(payment.id)}">Refuser</button>` : ""}</div>` : ""}
  </article>`;
}

function renderRows() {
  const query = (document.querySelector("#payment-search")?.value || "").trim().toLocaleLowerCase("fr");
  const rows = paymentRows.filter((payment) => [payment.contact_email, payment.payment_code, payment.username, payment.plan_id, labels[payment.status]]
    .some((value) => String(value || "").toLocaleLowerCase("fr").includes(query)));
  const container = document.querySelector("#payment-list");
  if (!container) return;
  container.innerHTML = rows.length ? rows.map(paymentCard).join("") : `<div class="admin-empty"><span>✦</span><b>${query ? "Aucun résultat" : "Aucune demande PayPal.Me"}</b><small>${query ? "Essaie un autre e-mail ou code." : "Les e-mails et les codes apparaîtront ici après une demande de forfait."}</small></div>`;
  bindPaymentActions();
}

function bindPaymentActions() {
  document.querySelectorAll("[data-approve-payment]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm("Tu as vérifié dans ton compte PayPal que le montant et le code de note correspondent ? L’accès sera activé pour 30 jours.")) return;
    await decidePayment(button, `/api/admin/payments/${encodeURIComponent(button.dataset.approvePayment)}/approve`, "Accès activé pour 30 jours.");
  }));
  document.querySelectorAll("[data-reject-payment]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm("Refuser cette demande ? Aucun quota payant ne sera accordé.")) return;
    await decidePayment(button, `/api/admin/payments/${encodeURIComponent(button.dataset.rejectPayment)}/reject`, "Demande refusée.");
  }));
}

async function decidePayment(button, path, message) {
  button.disabled = true;
  try {
    await api(path, { method: "POST", body: "{}" });
    toast(message);
    await loadPayments();
  } catch (error) {
    button.disabled = false;
    toast(error.message, true);
  }
}

async function loadPayments() {
  const result = await api("/api/admin/payments");
  paymentRows = result.payments;
  const open = paymentRows.filter((payment) => ["pending", "claimed", "paid_pending_review"].includes(payment.status)).length;
  const openCount = document.querySelector("#open-count");
  if (openCount) openCount.textContent = String(open);
  renderRows();
}

async function renderDashboard() {
  try {
    const result = await api("/api/admin/payments");
    paymentRows = result.payments;
    adminRoot.innerHTML = `<div class="admin-dashboard">
      <div class="admin-dashboard-heading"><div><div class="admin-eyebrow"><i></i> ESPACE PRIVÉ</div><h1>Demandes PayPal</h1><p>Vérifie le montant et le code dans PayPal avant d’activer chaque forfait.</p></div><button id="admin-logout" class="admin-button admin-button-outline">Déconnexion</button></div>
      <div class="admin-summary"><span class="admin-summary-icon">€</span><div><small>DEMANDES À EXAMINER</small><b id="open-count">0</b></div><span class="admin-summary-note">Actualisé automatiquement</span></div>
      <div class="admin-list-heading"><div><h2>Paiements PayPal</h2><span>Référence PayPal.Me à retrouver dans la note · e-mail de contact privé</span></div><label class="admin-search"><span>⌕</span><input id="payment-search" type="search" placeholder="E-mail, code ou compte"></label></div>
      <div id="payment-list" class="payment-list"></div>
      <aside class="admin-reminder"><span>i</span><p><b>Vérification manuelle requise</b><br>PayPal.Me ne confirme pas automatiquement une transaction au site. Le client peut déclarer avoir payé sans qu’un transfert ait eu lieu. Compare le code, le montant et l’état de la transaction dans PayPal, puis active l’accès.</p></aside>
    </div>`;
    document.querySelector("#payment-search").addEventListener("input", renderRows);
    document.querySelector("#admin-logout").addEventListener("click", async () => {
      await api("/api/admin/logout", { method: "POST", body: "{}" });
      paymentRows = [];
      renderLogin();
    });
    renderRows();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => loadPayments().catch((error) => toast(error.message, true)), 30000);
  } catch (error) {
    if (/administrateur|autorisé/i.test(error.message)) return renderLogin();
    adminRoot.innerHTML = `<section class="admin-login-card"><h1>Espace indisponible</h1><p>${escapeHtml(error.message)}</p><a class="admin-button admin-button-outline" href="/admin">Réessayer</a></section>`;
  }
}

async function init() {
  try {
    const session = await api("/api/admin/session");
    if (session.authenticated) return await renderDashboard();
    renderLogin();
  } catch (error) {
    adminRoot.innerHTML = `<section class="admin-login-card"><h1>Serveur indisponible</h1><p>${escapeHtml(error.message)}</p><a class="admin-button admin-button-outline" href="/admin">Réessayer</a></section>`;
  }
}

init();
