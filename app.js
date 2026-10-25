(() => {
  const modules = [
    { id: 'moderation', name: 'Modération', description: 'Gère les comportements et les sanctions du serveur.', requiredPlan: 'mod', icon: 'i-shield', color: 'purple', commands: ['ban', 'tempban', 'softban', 'unban', 'kick', 'timeout', 'untimeout', 'mute', 'unmute', 'warn', 'warnings', 'unwarn', 'clear', 'purge', 'slowmode', 'lock', 'unlock', 'nick', 'deafen', 'undeafen', 'voicekick', 'role', 'addrole', 'removerole'] },
    { id: 'welcome', name: 'Bienvenue', description: 'Accueille les nouveaux membres et attribue un rôle.', requiredPlan: 'mod', icon: 'i-users', color: 'green', commands: ['welcome', 'setwelcome', 'testwelcome', 'goodbye', 'setgoodbye', 'autorole', 'welcomechannel'] },
    { id: 'protection', name: 'Protection', description: 'Aide à filtrer le spam et les arrivées suspectes.', requiredPlan: 'mod', icon: 'i-message', color: 'orange', commands: ['antispam', 'antiraid', 'raidmode', 'antiinvite', 'antilink', 'antiscam', 'antimention', 'antibot', 'verify', 'whitelist', 'lockdown', 'unlockdown'] },
    { id: 'utility', name: 'Utilitaires', description: 'Les commandes essentielles pour commencer.', requiredPlan: 'free', icon: 'i-terminal', color: 'blue', commands: ['help', 'serverinfo', 'userinfo', 'avatar', 'banner', 'ping', 'botinfo', 'roleinfo', 'channelinfo', 'invite', 'poll', 'remind', 'calc', 'translate', 'emoji', 'membercount', 'uptime'] },
    { id: 'logs', name: 'Journaux', description: 'Centralise les événements utiles à suivre.', requiredPlan: 'mod', icon: 'i-log', color: 'purple', commands: ['setlog', 'logs', 'modlogs', 'messagelogs', 'memberlogs', 'voicelogs'] },
    { id: 'tickets', name: 'Tickets', description: 'Organise les demandes d’aide de ta communauté.', requiredPlan: 'ultimate', icon: 'i-message', color: 'green', commands: ['ticket', 'close', 'adduser', 'removeuser', 'claim', 'transcript', 'ticketpanel', 'ticketconfig', 'reopen'] },
    { id: 'roles', name: 'Rôles & réactions', description: 'Laisse les membres choisir leurs rôles et automatise leur attribution.', requiredPlan: 'pro', icon: 'i-users', color: 'blue', commands: ['rolecreate', 'roledelete', 'rolecolor', 'reactionrole', 'rolepanel', 'roleadd', 'roleremove', 'rolelist', 'rolerandom'] },
    { id: 'levels', name: 'Niveaux & activité', description: 'Récompense la participation avec des niveaux et des rôles.', requiredPlan: 'pro', icon: 'i-spark', color: 'orange', commands: ['rank', 'leaderboard', 'levelset', 'levelreward', 'levelreset', 'xpboost', 'levelcard', 'leveltoggle'] },
    { id: 'fun', name: 'Jeux & fun', description: 'Quelques commandes légères disponibles gratuitement.', requiredPlan: 'free', icon: 'i-spark', color: 'purple', commands: ['8ball', 'coinflip', 'dice', 'hug', 'pat', 'meme', 'joke', 'ship', 'choose', 'trivia'] },
    { id: 'polls', name: 'Sondages', description: 'Recueille les avis de la communauté avec des votes simples.', requiredPlan: 'pro', icon: 'i-message', color: 'green', commands: ['quickpoll', 'pollresults', 'pollclose', 'vote', 'pollcreate'] },
    { id: 'suggestions', name: 'Suggestions', description: 'Centralise les idées et laisse les membres voter.', requiredPlan: 'pro', icon: 'i-spark', color: 'blue', commands: ['suggest', 'suggestionstatus', 'suggestionsetup', 'suggestionlist'] },
    { id: 'giveaways', name: 'Giveaways', description: 'Configure des tirages au sort et désigne des gagnants.', requiredPlan: 'ultimate', icon: 'i-spark', color: 'coral', commands: ['giveaway', 'gstart', 'gend', 'greroll', 'glist', 'gdelete'] },
    { id: 'custom', name: 'Commandes perso', description: 'Prépare des réponses et raccourcis personnalisés.', requiredPlan: 'pro', icon: 'i-terminal', color: 'orange', commands: ['customadd', 'customedit', 'customremove', 'customlist', 'customtest'] },
    { id: 'reminders', name: 'Rappels & agenda', description: 'Planifie des rappels pour les membres et les événements.', requiredPlan: 'pro', icon: 'i-log', color: 'purple', commands: ['reminders', 'remindcancel', 'event', 'eventlist'] },
  ];
  const plans = [
    { id: 'free', name: 'Gratuit', price: '0 €', maxBots: 1, rank: 0, subtitle: 'Pour découvrir', modules: ['Utilitaires', 'Jeux & fun'] },
    { id: 'mod', name: 'Mod', price: '4,99 €', amountCents: 499, maxBots: 2, rank: 1, subtitle: 'La modération', modules: ['Tout Gratuit', 'Modération', 'Bienvenue', 'Protection', 'Journaux'] },
    { id: 'pro', name: 'Pro', price: '9,99 €', amountCents: 999, maxBots: 8, rank: 2, subtitle: 'Pour grandir', modules: ['Tout Mod', 'Rôles', 'Niveaux', 'Sondages', 'Suggestions', 'Commandes perso', 'Rappels'] },
    { id: 'ultimate', name: 'Ultime', price: '29,99 €', amountCents: 2999, maxBots: 25, rank: 3, subtitle: 'Tout débloquer', modules: ['Tout Pro', 'Tickets', 'Giveaways', 'Tous les modules'] },
  ];
  const planRank = Object.fromEntries(plans.map((plan) => [plan.id, plan.rank]));
  const state = {
    user: { name: 'Camille' },
    currentPage: 'overview',
    selectedModule: null,
    botName: 'Astéria Studio',
    projects: [{ id: 'project-demo-1', name: 'Astéria Studio' }],
    selectedProjectId: 'project-demo-1',
    prefix: '/',
    plan: 'free',
    enabled: new Set(['utility', 'fun']),
    enabledCommands: new Set(modules.flatMap((module) => module.commands.map((command) => `${module.id}:${command}`))),
    payments: [],
    discordLog: [],
    adminUnlocked: false,
    bannerVisible: true,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const dashboard = $('#dashboard-content');
  const modulePlan = (module) => plans.find((plan) => plan.id === module.requiredPlan) || plans[0];
  const canUseModule = (module) => planRank[state.plan] >= planRank[module.requiredPlan];

  function moduleIcon(module) {
    return `<span class="module-icon ${module.color}">${icon(module.icon)}</span>`;
  }
  function commandCount(module) {
    return module.commands.filter((command) => state.enabledCommands.has(`${module.id}:${command}`)).length;
  }
  function updateProfile() {
    const cleanName = state.user.name || 'Camille';
    $('#profile-name').textContent = cleanName;
    $('#profile-initial').textContent = cleanName.trim().charAt(0).toUpperCase() || 'C';
    const selectedProject = state.projects.find((project) => project.id === state.selectedProjectId);
    state.botName = selectedProject?.name || state.botName;
    $('#server-name').textContent = state.botName;
    $('#project-list').innerHTML = state.projects.map((project) => `<button class="project-switch-item ${project.id === state.selectedProjectId ? 'active' : ''}" type="button" data-select-project="${escapeAttribute(project.id)}"><span>${escapeHtml(project.name.slice(0, 1).toUpperCase())}</span><b>${escapeHtml(project.name)}</b></button>`).join('');
    $('#active-count').textContent = state.enabled.size;
  }
  function pageHeading(label, title, description, action = '') {
    return `<div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-dot"></span> ${label}</div><h1>${title}</h1><p>${description}</p></div>${action ? `<div class="page-action">${action}</div>` : ''}</div>`;
  }
  function overviewMarkup() {
    const activeModules = modules.filter((module) => state.enabled.has(module.id));
    const moduleRows = activeModules.length ? activeModules.map((module) => `<div class="module-row">${moduleIcon(module)}<span class="module-copy"><b>${module.name}</b><small>${commandCount(module)} commande${commandCount(module) === 1 ? '' : 's'} active${commandCount(module) === 1 ? '' : 's'} <span class="command-hint">${module.commands.slice(0, 3).map((command) => `/${command}`).join(' · ')}</span></small></span><input class="toggle" type="checkbox" checked aria-label="Désactiver ${module.name}" data-toggle-module="${module.id}"><button class="text-button" data-config-module="${module.id}">Régler</button></div>`).join('') : `<div class="empty-notice"><b>Aucun module actif</b>Choisis un module pour commencer à configurer ton bot.</div>`;
    return `${pageHeading('VUE D’ENSEMBLE', `Bonjour ${escapeHtml(state.user.name)} <span>✦</span>`, 'Voici ce qui se passe sur ton espace de démonstration.', '<button class="button button-small" data-action="new-project">＋ Nouveau projet</button>')}
      <div class="stat-grid"><article class="stat-card"><div class="stat-label">Forfait ${icon('i-bot')}</div><div class="stat-value" style="font-size:17px;color:#e2c87f">${plans.find((plan) => plan.id === state.plan).name}</div><div class="stat-foot">Aucun bot réel relié</div></article><article class="stat-card"><div class="stat-label">Modules actifs ${icon('i-spark')}</div><div class="stat-value">${state.enabled.size}</div><div class="stat-foot">sur ${modules.length} disponibles</div></article><article class="stat-card"><div class="stat-label">Commandes actives ${icon('i-terminal')}</div><div class="stat-value">${countAllCommands()}</div><div class="stat-foot">dans cette session</div></article><article class="stat-card"><div class="stat-label">Commandes ${icon('i-settings')}</div><div class="stat-value">Slash /</div><div class="stat-foot">préfixe conservé en compatibilité</div></article></div>
      <div class="dashboard-grid"><section class="panel-card"><div class="panel-header"><h2>Mes modules</h2><button class="text-button" data-nav="modules">Voir les ${modules.length} modules →</button></div><div class="module-list">${moduleRows}</div></section><section class="panel-card"><div class="panel-header"><h2>Activité récente</h2><span>APERÇU</span></div><div class="activity-list"><div class="activity-row"><span class="activity-icon green">✓</span><span><b>Espace de démonstration prêt</b><small>Les réglages ne sont pas enregistrés en ligne</small></span><span class="activity-time">maintenant</span></div><div class="activity-row"><span class="activity-icon purple">✦</span><span><b>${state.enabled.size} modules sélectionnés</b><small>Tu peux les modifier à tout moment</small></span><span class="activity-time">session</span></div><div class="activity-row"><span class="activity-icon yellow">!</span><span><b>Token du bot non demandé</b><small>La connexion réelle nécessite un serveur sécurisé</small></span><span class="activity-time">info</span></div></div></section></div>`;
  }
  function modulesMarkup() {
    const cards = modules.map((module) => {
      const unlocked = canUseModule(module);
      const lock = modulePlan(module);
      const control = unlocked
        ? `<input class="toggle" type="checkbox" ${state.enabled.has(module.id) ? 'checked' : ''} aria-label="${state.enabled.has(module.id) ? 'Désactiver' : 'Activer'} ${module.name}" data-toggle-module="${module.id}">`
        : `<div class="module-paywall"><b>🔒 ${lock.name}</b><button class="text-button" data-upgrade-module="${module.id}">Voir les offres →</button></div>`;
      const configure = unlocked
        ? `<button class="text-button" data-config-module="${module.id}">Configurer les commandes →</button>`
        : `<span class="locked-caption">${lock.name} requis</span>`;
      return `<article class="catalog-card ${unlocked ? '' : 'catalog-card-locked'}">${moduleIcon(module)}<div><h3>${module.name}</h3><p>${module.description}</p><small class="command-selection-count">${commandCount(module)} / ${module.commands.length} commandes sélectionnées</small>${configure}</div>${control}</article>`;
    }).join('');
    return `${pageHeading('CONFIGURATION', 'Les modules', 'Utilitaires et Jeux & fun sont gratuits. Les autres modules se débloquent avec un forfait.')}
      <div class="module-catalog">${cards}</div>`;
  }
  function commandsMarkup() {
    const rows = modules.flatMap((module) => module.commands.map((command) => {
      const selected = state.enabledCommands.has(`${module.id}:${command}`);
      const unlocked = canUseModule(module);
      const active = unlocked && state.enabled.has(module.id) && selected;
      const status = !unlocked ? `🔒 ${modulePlan(module).name}` : !state.enabled.has(module.id) ? 'Module inactif' : selected ? 'Activée' : 'Désactivée';
      const action = unlocked ? `<button class="text-button" data-config-module="${module.id}">Modifier</button>` : `<button class="text-button" data-upgrade-module="${module.id}">Offres</button>`;
      return `<tr data-command-search="${escapeAttribute(`/${command} ${module.name}`.toLowerCase())}"><td class="command-name">/${command}</td><td class="command-module">${module.name}</td><td>${active ? '<span class="command-status-active">Activée</span>' : status}</td><td>${action}</td></tr>`;
    }));
    return `${pageHeading('CONFIGURATION', 'Les commandes', 'Les commandes restent en slash /. Les modules payants sont visibles mais verrouillés selon ton forfait.')}
      <section class="panel-card"><div class="panel-header"><h2>Bibliothèque de commandes</h2><span>${rows.length} COMMANDES · ${modules.length} MODULES</span></div><div class="log-toolbar"><input class="text-input" id="command-search" type="search" placeholder="Rechercher une commande ou un module…" aria-label="Rechercher une commande"></div><div class="command-table-wrap"><table class="command-table"><thead><tr><th>COMMANDE</th><th>MODULE</th><th>ÉTAT</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div></section>`;
  }
  function logsMarkup() {
    const logRows = state.discordLog.length ? state.discordLog.map((entry) => {
      return `<article class="demo-discord-message"><div class="demo-discord-avatar">M</div><div class="demo-discord-body"><div class="demo-discord-author">ModuBot <span>APP</span><time>${escapeHtml(entry.time)}</time></div><b>${escapeHtml(entry.title)}</b><p>${escapeHtml(entry.summary)}</p><div class="demo-discord-fields"><div><small>Compte Discord</small><b>${escapeHtml(entry.accountName)} · ${escapeHtml(entry.accountId)}</b></div><div><small>État</small><b>${escapeHtml(entry.statusText)}</b></div></div></div></article>`;
    }).join('') : '<div class="empty-notice"><b>Aucun événement simulé</b>Les événements généraux du site apparaîtront ici en mode démo.</div>';
    return `${pageHeading('SUIVI', 'Journaux Discord', 'Aperçu des événements généraux du bot opérateur. Les paiements se consultent dans l’espace admin du site.')}
      <div class="demo-log-warning"><b>Simulation locale</b><span>Ces messages restent dans cet onglet. Aucun bot Discord ne les reçoit.</span></div>
      <section class="panel-card demo-command-panel"><div><span class="panel-header"><h2>Commandes admin</h2><span>SIMULATION</span></span><p>Teste les commandes générales du bot.</p></div><div class="demo-command-actions"><button class="button button-outline button-small" data-demo-command="test">/tester-journal</button><button class="button button-outline button-small" data-demo-command="status">/statut-modubot</button></div></section>
      <section class="panel-card"><div class="panel-header"><h2>Salon privé · #journal-modubot</h2><span>${state.discordLog.length} MESSAGE${state.discordLog.length === 1 ? '' : 'S'} SIMULÉ${state.discordLog.length === 1 ? '' : 'S'}</span></div><div class="demo-discord-feed">${logRows}</div></section>`;
  }
  function settingsMarkup() {
    return `${pageHeading('ESPACE', 'Paramètres', 'Personnalise les détails de ta configuration de démonstration.')}
      <div class="settings-grid"><section class="panel-card"><div class="panel-header"><h2>Préférences du projet</h2><span>APERÇU</span></div><form class="settings-form" id="settings-form"><label class="field-label">Nom du projet<input class="text-input" name="botName" value="${escapeAttribute(state.botName)}" maxlength="40" required></label><label class="field-label">Préfixe des commandes<small>Fixé à / : les commandes sont toujours des slash Discord.</small><input class="text-input" name="prefix" value="/" readonly aria-readonly="true"></label><button class="button button-primary" type="submit">Enregistrer dans la session</button></form></section><section class="panel-card"><div class="panel-header"><h2>Connexion sécurisée</h2>${icon('i-lock')}</div><div class="setting-hint">Le token se demande uniquement à la création d’un projet sur le serveur sécurisé. Cette maquette ne collecte ni ne transmet de secret.</div><div class="setting-hint" style="margin-top:10px">Le serveur vérifie le token auprès de Discord, le chiffre au stockage et synchronise les commandes slash.</div></section></div>`;
  }
  function billingMarkup() {
    const cards = plans.map((plan) => `<article class="price-card ${plan.id === 'pro' ? 'price-card-featured' : ''} ${plan.id === state.plan ? 'price-card-current' : ''}"><span class="price-label">${plan.name}</span><div class="price-amount">${plan.price}<small>${plan.id === 'free' ? 'pour commencer' : '/ 30 jours'}</small></div><p>Jusqu’à <b>${plan.maxBots} bot${plan.maxBots > 1 ? 's' : ''}</b></p><ul>${plan.modules.map((item) => `<li>${item}</li>`).join('')}</ul>${plan.id === state.plan ? '<span class="plan-status">Forfait actuel</span>' : plan.amountCents ? '<button class="button button-outline" type="button" disabled>Paiement à configurer</button>' : '<span class="plan-status">Disponible</span>'}</article>`).join('');
    const visiblePayments = state.payments.filter((payment) => payment.status !== 'draft');
    const payments = visiblePayments.length ? visiblePayments.map((payment) => {
      const plan = plans.find((item) => item.id === payment.planId);
      const status = { pending: 'À payer · aucun paiement reçu', claimed: 'Déclaré · à vérifier', approved: 'Approuvé · forfait activé', rejected: 'Refusé · aucun accès ajouté' }[payment.status] || payment.status;
      const pendingAction = payment.status === 'pending' ? `<button class="button button-outline button-small" data-simulate-payment="${escapeAttribute(payment.id)}">Continuer la démo</button>` : '';
      return `<article class="demo-payment-row"><div><small>${escapeHtml(plan?.name || payment.planId)} · ${formatEuro(payment.amountCents)}</small><b>${escapeHtml(payment.email || 'E-mail à saisir')}</b><span>${escapeHtml(status)}</span></div><div class="demo-payment-actions">${pendingAction}</div></article>`;
    }).join('') : '<div class="empty-notice">Aucune demande. Choisis un forfait pour parcourir le flux de démonstration.</div>';
    return `${pageHeading('OFFRES', 'Choisis ton forfait', 'Les forfaits payants débloquent les modules et augmentent le nombre de bots.')}
      <div class="pricing-grid">${cards}</div><div class="payment-notice"><b>Serveur de paiement non configuré</b><span>Cette maquette ne redirige pas vers PayPal et ne crée pas de demande administrateur. Le bouton sera activé sur la version serveur après configuration de PayPal et du stockage.</span></div><section class="panel-card demo-payment-list"><div class="panel-header"><h2>Mes demandes</h2><button class="text-button" data-nav="admin">Espace admin →</button></div><div class="demo-payment-rows">${payments}</div></section><div class="payment-guide"><div class="eyebrow"><span class="eyebrow-dot"></span> ÉTAPES DU PAIEMENT</div><h3>Comment payer et recevoir ton accès ?</h3><ol><li><b>Choisis un forfait</b><span>Dans la version serveur, indique ton e-mail de contact.</span></li><li><b>Copie la référence</b><span>Le serveur enregistre la demande avant d’ouvrir PayPal.Me.</span></li><li><b>Ajoute la note PayPal</b><span>Colle le code dans « Ajouter une note » si PayPal affiche ce champ, puis vérifie le montant avant d’envoyer.</span></li><li><b>Déclare ton paiement</b><span>Reviens sur le site. L’administrateur compare la note et le montant dans PayPal avant d’activer l’accès.</span></li></ol></div>`;
  }
  function adminMarkup() {
    if (!state.adminUnlocked) return `${pageHeading('ADMINISTRATION', 'Espace privé', 'Entre le code administrateur pour consulter les e-mails, les références et les demandes.')}
      <section class="panel-card admin-demo-login"><div class="panel-header"><h2>Accès administrateur</h2><span>DÉMO</span></div><form class="settings-form" id="admin-pin-form"><label class="field-label">Code administrateur<input class="text-input" name="adminCode" type="password" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="Code d’accès" required></label><p class="modal-security">Les e-mails et références des demandes sont consultables uniquement dans cet espace.</p><button class="button button-primary" type="submit">Ouvrir les demandes</button></form></section>`;
    const adminPayments = state.payments.filter((payment) => payment.status !== 'draft');
    const rows = adminPayments.length ? adminPayments.map((payment) => {
      const plan = plans.find((item) => item.id === payment.planId);
      const status = { pending: 'En attente de déclaration', claimed: 'À vérifier dans PayPal', approved: 'Accès activé', rejected: 'Refusé' }[payment.status] || payment.status;
      const canApprove = payment.status === 'claimed';
      const canReject = ['pending', 'claimed'].includes(payment.status);
      return `<article class="demo-payment-row admin-payment-card"><div><small>${escapeHtml(plan?.name || payment.planId)} · ${formatEuro(payment.amountCents)} · ${escapeHtml(status)}</small><b>${escapeHtml(payment.email || 'E-mail non saisi')}</b><span>Code à chercher dans la note PayPal : <strong>${escapeHtml(payment.code)}</strong></span></div><div class="demo-payment-actions">${canApprove ? `<button class="button button-small button-primary" data-review-payment="${escapeAttribute(payment.id)}" data-review-choice="approve">Vérifié · activer</button>` : ''}${canReject ? `<button class="button button-small button-outline" data-review-payment="${escapeAttribute(payment.id)}" data-review-choice="reject">Refuser</button>` : ''}</div></article>`;
    }).join('') : '<div class="empty-notice"><b>Aucune demande pour le moment</b>Les e-mails et les références apparaîtront ici après le clic sur PayPal de démonstration.</div>';
    return `${pageHeading('ADMINISTRATION', 'Demandes PayPal', 'Compare le code et le montant dans PayPal, puis active l’accès si le transfert est reçu.')}
      <div class="payment-notice"><b>Démo uniquement</b><span>Le code administrateur est simulé. Les e-mails et références restent dans cette session navigateur ; aucun paiement réel n’est validé.</span></div><section class="panel-card demo-payment-list"><div class="panel-header"><h2>Demandes et e-mails</h2><button class="text-button" data-action="admin-logout">Verrouiller</button></div><div class="demo-payment-rows">${rows}</div></section>`;
  }
  const pageTitles = { overview: 'Vue d’ensemble', modules: 'Modules', commands: 'Commandes', logs: 'Journaux', billing: 'Forfaits', admin: 'Admin paiements', settings: 'Paramètres' };
  function renderPage() {
    updateProfile();
    $('#breadcrumb-title').textContent = pageTitles[state.currentPage] || 'Vue d’ensemble';
    $$('.side-link').forEach((link) => link.classList.toggle('active', link.dataset.nav === state.currentPage));
    const renderers = { overview: overviewMarkup, modules: modulesMarkup, commands: commandsMarkup, logs: logsMarkup, billing: billingMarkup, admin: adminMarkup, settings: settingsMarkup };
    dashboard.innerHTML = renderers[state.currentPage]();
  }
  function countAllCommands() {
    return modules.reduce((total, module) => total + (state.enabled.has(module.id) ? commandCount(module) : 0), 0);
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function escapeAttribute(value) { return escapeHtml(value); }
  function formatEuro(cents) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }
  function newDemoCode() {
    let code;
    const values = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / 100000000) * 100000000;
    do {
      do { crypto.getRandomValues(values); }
      while (values[0] >= limit);
      code = String(values[0] % 100000000).padStart(8, '0');
    } while (state.payments.some((payment) => payment.code === code));
    return code;
  }
  function addDemoDiscordLog({ title, summary, statusText }) {
    state.discordLog.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      summary,
      statusText,
      accountName: state.user.name || 'Camille',
      accountId: '100000000000000001 · démo',
      time: new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
    });
  }
  function paymentTestModal(payment) {
    const plan = plans.find((item) => item.id === payment.planId);
    openModal(`<div class="modal-heading-icon">${icon('i-bot')}</div><h2 id="modal-title">Prépare ton paiement · démo</h2><p class="modal-intro">${escapeHtml(plan?.name || 'Forfait')} · ${formatEuro(payment.amountCents)} pour 30 jours. Copie cette référence avant de continuer.</p><form class="modal-form" id="demo-payment-setup-form" data-payment-id="${escapeAttribute(payment.id)}"><label class="field-label">Adresse e-mail de contact<input class="text-input" name="contactEmail" type="email" autocomplete="email" maxlength="254" placeholder="toi@exemple.fr" value="${escapeAttribute(payment.email || '')}" required></label><div class="demo-reference-box"><small>1 · Copie ce code dans la note PayPal</small><b>${escapeHtml(payment.code)}</b><button type="button" class="button button-outline button-small" data-copy-demo-code="${escapeAttribute(payment.code)}">Copier le code</button></div><p class="modal-security">2 · Après la copie, le bouton bleu « Ouvrir PayPal » s’active. Dans le vrai service, le site enregistre la demande dans l’admin et PayPal.Me ouvre le montant prévu.</p><button class="button button-paypal" type="submit" data-demo-open-paypal disabled>Ouvrir PayPal · démo ↗</button><p class="modal-security">Démo uniquement : aucun vrai PayPal ne s’ouvre et aucun argent n’est envoyé.</p></form>`);
  }
  function paypalNoteModal(payment) {
    const plan = plans.find((item) => item.id === payment.planId);
    openModal(`<div class="modal-heading-icon">${icon('i-bot')}</div><h2 id="modal-title">PayPal.Me · simulation</h2><p class="modal-intro">Le clic a créé la demande dans l’espace admin. Dans un vrai paiement, envoie exactement ${formatEuro(payment.amountCents)} et colle le code copié dans le champ « Ajouter une note » de PayPal.</p><form class="modal-form" id="demo-payment-form" data-payment-id="${escapeAttribute(payment.id)}"><label class="field-label">Note PayPal (simulation)<input class="text-input" name="paymentNote" inputmode="numeric" autocomplete="off" maxlength="8" pattern="[0-9]{8}" placeholder="Colle le code à 8 chiffres" required></label><p class="modal-security">Dans le parcours réel, il faut coller la note soi-même dans PayPal. Cette démo ne vérifie ni ne transfère aucun paiement.</p><button class="button button-primary" type="submit">Simuler le retour après paiement</button></form>`);
  }
  function startTestPayment(planId) {
    const plan = plans.find((item) => item.id === planId);
    if (!plan?.amountCents) { toast('Choisis un forfait payant pour tester le paiement.'); return; }
    const existing = state.payments.find((payment) => ['pending', 'claimed'].includes(payment.status));
    if (existing) {
      setPage('billing');
      paymentTestModal(existing);
      toast('Termine ou refuse la demande de test déjà ouverte.');
      return;
    }
    const payment = {
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      planId: plan.id,
      amountCents: plan.amountCents,
      code: newDemoCode(),
      email: '',
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    state.payments.unshift(payment);
    if ($('#landing') && !$('#landing').classList.contains('hidden')) enterDashboard(state.user.name);
    setPage('billing');
    paymentTestModal(payment);
  }
  function simulateDemoPayment(paymentId, note) {
    const payment = state.payments.find((item) => item.id === paymentId);
    if (!payment || payment.status !== 'pending') return;
    if (String(note || '').trim() !== payment.code) {
      toast('Le code de la note ne correspond pas. Copie les 8 chiffres affichés puis réessaie.');
      return;
    }
    payment.status = 'claimed';
    closeModal();
    setPage('admin');
    toast('Déclaration simulée. Vérifie maintenant la demande dans l’espace admin.');
  }
  function decideDemoPayment(paymentId, choice) {
    const payment = state.payments.find((item) => item.id === paymentId);
    if (!payment || payment.status !== 'claimed') return;
    const plan = plans.find((item) => item.id === payment.planId);
    if (choice === 'approve') {
      payment.status = 'approved';
      state.plan = payment.planId;
      toast(`Forfait ${plan?.name || payment.planId} simulé comme approuvé.`);
    } else {
      payment.status = 'rejected';
      toast('Demande simulée refusée.');
    }
    renderPage();
  }

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.remove('hidden');
    el.classList.remove('show');
    requestAnimationFrame(() => el.classList.add('show'));
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => el.classList.add('hidden'), 2700);
  }
  function openModal(content) {
    $('#modal-content').innerHTML = content;
    $('#modal-backdrop').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const focusable = $('#modal-content input');
    if (focusable) window.setTimeout(() => focusable.focus(), 20);
  }
  function closeModal() {
    $('#modal-backdrop').classList.add('hidden');
    document.body.style.overflow = '';
  }
  function authModal(mode) {
    const signup = mode === 'signup';
    openModal(`<div class="modal-heading-icon">${icon('i-spark')}</div><h2 id="modal-title">${signup ? 'Crée ton espace' : 'Ravi de te revoir'}</h2><p class="modal-intro">${signup ? 'Commence à configurer ton bot Discord à ta façon.' : 'Ouvre ton espace de démonstration ModuBot.'}</p><form class="modal-form" id="auth-form"><label class="field-label">${signup ? 'Ton prénom' : 'Ton nom'}<input class="text-input" name="name" autocomplete="name" placeholder="Ex. Camille" ${signup ? 'required' : ''}></label><label class="field-label">Adresse e-mail<input class="text-input" name="email" type="email" autocomplete="email" placeholder="toi@exemple.fr" required></label><label class="field-label">Mot de passe<input class="text-input" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="••••••••" minlength="6" required></label><p class="modal-security">Démo uniquement : le formulaire ne transmet ni ne sauvegarde tes informations. L’authentification réelle sera à mettre en place avant publication.</p><button class="button button-primary" type="submit">${signup ? 'Créer mon espace' : 'Se connecter'} ${icon('i-arrow')}</button></form><p class="modal-switch">${signup ? 'Tu as déjà un compte ?' : 'Nouveau sur ModuBot ?'} <button type="button" data-auth="${signup ? 'login' : 'signup'}">${signup ? 'Connexion' : 'Créer un compte'}</button></p>`);
  }
  function botModal() {
    openModal(`<div class="modal-heading-icon">${icon('i-bot')}</div><h2 id="modal-title">Nouveau projet bot</h2><p class="modal-intro">Choisis un nom pour créer un nouveau projet dans cet aperçu.</p><form class="modal-form" id="bot-form"><label class="field-label">Nom du projet<input class="text-input" name="botName" maxlength="40" placeholder="Ex. Modération de mon serveur" required></label><label class="field-label">Préfixe des commandes<small>Fixé à / : les commandes sont toujours des slash Discord.</small><input class="text-input" name="prefix" value="/" readonly aria-readonly="true"></label><p class="modal-security">Aperçu local : aucun token n’est demandé, aucun bot ne démarre et aucune donnée ne part vers un serveur. Dans la version hébergée, le token est demandé uniquement dans ce formulaire, puis vérifié et chiffré par le serveur.</p><button class="button button-primary" type="submit">Créer le projet (aperçu) ${icon('i-arrow')}</button></form>`);
  }
  function moduleModal(moduleId) {
    const module = modules.find((item) => item.id === moduleId);
    if (!module) return;
    if (!canUseModule(module)) { setPage('billing'); toast(`${modulePlan(module).name} est requis pour activer ${module.name}.`); return; }
    state.selectedModule = moduleId;
    const checks = module.commands.map((command) => `<label class="command-check"><input type="checkbox" name="command" value="${command}" ${state.enabledCommands.has(`${module.id}:${command}`) ? 'checked' : ''}><span><b>/${command}</b></span></label>`).join('');
    openModal(`<div class="modal-heading-icon">${icon(module.icon)}</div><h2 id="modal-title">${module.name}</h2><p class="modal-intro">Coche les commandes à afficher pour ce module.</p><form id="module-form"><div class="command-checks">${checks}</div><p class="modal-security">Les choix ne sont gardés que pendant cette session de démonstration.</p><div class="modal-footer"><button class="button button-muted" type="button" data-close-modal>Annuler</button><button class="button button-primary" type="submit">Enregistrer</button></div></form>`);
  }
  function enterDashboard(userName) {
    state.user.name = userName || 'Camille';
    $('#landing').classList.add('hidden');
    $('#app').classList.remove('hidden');
    closeModal();
    state.currentPage = 'overview';
    renderPage();
    window.scrollTo(0, 0);
  }
  function setPage(page) {
    if (!pageTitles[page]) return;
    state.currentPage = page;
    renderPage();
    $('#sidebar').classList.remove('open');
  }

  document.addEventListener('click', (event) => {
    const testPayment = event.target.closest('[data-test-payment]');
    if (testPayment) { startTestPayment(testPayment.dataset.testPayment); return; }
    const simulatePayment = event.target.closest('[data-simulate-payment]');
    if (simulatePayment) {
      const payment = state.payments.find((item) => item.id === simulatePayment.dataset.simulatePayment);
      if (payment) paymentTestModal(payment);
      return;
    }
    const copyDemoCode = event.target.closest('[data-copy-demo-code]');
    if (copyDemoCode) {
      const code = copyDemoCode.dataset.copyDemoCode;
      const enableNextStep = () => {
        const form = $('#demo-payment-setup-form');
        const continueButton = form?.querySelector('[data-demo-open-paypal]');
        const payment = state.payments.find((item) => item.id === form?.dataset.paymentId);
        if (payment) payment.codeCopied = true;
        if (continueButton) continueButton.disabled = false;
        copyDemoCode.textContent = 'Code copié ✓';
        toast('Code copié. Tu peux passer à l’étape PayPal de démonstration.');
      };
      const fallbackCopy = () => {
        const field = document.createElement('textarea');
        field.value = code;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.append(field);
        field.select();
        let copied = false;
        try { copied = document.execCommand('copy'); } catch { copied = false; }
        field.remove();
        if (copied) enableNextStep();
        else toast('Sélectionne le code et copie-le avant de continuer.');
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(enableNextStep).catch(fallbackCopy);
      else fallbackCopy();
      return;
    }
    const reviewPayment = event.target.closest('[data-review-payment]');
    if (reviewPayment) { decideDemoPayment(reviewPayment.dataset.reviewPayment, reviewPayment.dataset.reviewChoice); return; }
    const demoCommand = event.target.closest('[data-demo-command]');
    if (demoCommand) {
      if (demoCommand.dataset.demoCommand === 'test') {
        addDemoDiscordLog({ title: 'Test du journal ModuBot', summary: 'Le bot opérateur publierait ici les événements généraux du site.', statusText: 'Message de test simulé' });
        renderPage();
        toast('/tester-journal simulé : message ajouté au salon de démonstration.');
      } else {
        const activeBots = 2;
        toast(`/statut-modubot simulé : service de démonstration actif · ${activeBots} projets exemples.`);
      }
      return;
    }
    if (event.target.closest('[data-action="admin-logout"]')) { state.adminUnlocked = false; renderPage(); toast('Espace admin verrouillé.'); return; }
    const auth = event.target.closest('[data-auth]');
    if (auth) { authModal(auth.dataset.auth); return; }
    const project = event.target.closest('[data-select-project]');
    if (project) {
      state.selectedProjectId = project.dataset.selectProject;
      state.botName = state.projects.find((item) => item.id === state.selectedProjectId)?.name || state.botName;
      renderPage();
      return;
    }
    const nav = event.target.closest('[data-nav]');
    if (nav) { event.preventDefault(); setPage(nav.dataset.nav); return; }
    const config = event.target.closest('[data-config-module]');
    if (config) { moduleModal(config.dataset.configModule); return; }
    const upgrade = event.target.closest('[data-upgrade-module]');
    if (upgrade) {
      const module = modules.find((item) => item.id === upgrade.dataset.upgradeModule);
      if (module) {
        setPage('billing');
        toast(`Le forfait ${modulePlan(module).name} débloque ${module.name}.`);
      }
      return;
    }
    const toggle = event.target.closest('[data-toggle-module]');
    if (toggle) {
      const id = toggle.dataset.toggleModule;
      const module = modules.find((item) => item.id === id);
      if (!module || !canUseModule(module)) { renderPage(); toast(`Choisis un forfait pour débloquer ${module?.name || 'ce module'}.`); return; }
      toggle.checked ? state.enabled.add(id) : state.enabled.delete(id);
      renderPage();
      toast(toggle.checked ? 'Module activé dans cette démo.' : 'Module désactivé dans cette démo.');
      return;
    }
    if (event.target.closest('[data-action="demo"]')) { enterDashboard('Camille'); return; }
    if (event.target.closest('[data-action="new-project"]')) { botModal(); return; }
    if (event.target.closest('[data-action="profile"]')) { toast('Profil de démonstration.'); return; }
    if (event.target.closest('[data-close-modal]') || event.target === $('#modal-backdrop') || event.target.closest('#modal-close')) { closeModal(); return; }
    if (event.target.closest('#dismiss-banner')) { state.bannerVisible = false; $('.demo-banner').classList.add('hidden'); return; }
    if (event.target.closest('#mobile-menu')) { $('.topbar').classList.toggle('mobile-open'); return; }
    if (event.target.closest('#sidebar-toggle')) { $('#sidebar').classList.toggle('open'); return; }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'demo-payment-setup-form') {
      event.preventDefault();
      const data = new FormData(event.target);
      const payment = state.payments.find((item) => item.id === event.target.dataset.paymentId);
      if (!payment || !payment.codeCopied) { toast('Copie d’abord le code de référence.'); return; }
      payment.email = String(data.get('contactEmail') || '').trim();
      payment.status = 'pending';
      renderPage();
      paypalNoteModal(payment);
      toast('Demande ajoutée à l’espace admin de démonstration.');
      return;
    }
    if (event.target.id === 'demo-payment-form') {
      event.preventDefault();
      const data = new FormData(event.target);
      simulateDemoPayment(event.target.dataset.paymentId, data.get('paymentNote'));
      return;
    }
    if (event.target.id === 'admin-pin-form') {
      event.preventDefault();
      const code = String(new FormData(event.target).get('adminCode') || '');
      if (code !== '201212') { toast('Code administrateur incorrect.'); return; }
      state.adminUnlocked = true;
      renderPage();
      toast('Espace admin de démonstration ouvert.');
      return;
    }
    if (event.target.id === 'auth-form') {
      event.preventDefault();
      const data = new FormData(event.target);
      const email = String(data.get('email') || '');
      const firstName = String(data.get('name') || '').trim() || (email.split('@')[0].replace(/[._-]+/g, ' ').split(' ')[0] || 'Camille');
      enterDashboard(firstName.charAt(0).toUpperCase() + firstName.slice(1));
      return;
    }
    if (event.target.id === 'bot-form') {
      event.preventDefault();
      const name = String(new FormData(event.target).get('botName') || '').trim();
      if (!name) { toast('Donne un nom au nouveau projet.'); return; }
      const project = { id: `project-demo-${Date.now()}`, name };
      state.projects.push(project);
      state.selectedProjectId = project.id;
      state.botName = project.name;
      state.prefix = '/';
      closeModal();
      renderPage();
      toast('Projet ajouté à cet aperçu. Aucun bot réel n’a été connecté.');
      return;
    }
    if (event.target.id === 'settings-form') {
      event.preventDefault();
      const data = new FormData(event.target);
      state.botName = String(data.get('botName') || 'Mon bot').trim() || 'Mon bot';
      const project = state.projects.find((item) => item.id === state.selectedProjectId);
      if (project) project.name = state.botName;
      state.prefix = '/';
      closeModal();
      renderPage();
      toast('Projet préparé dans cet aperçu. Aucun bot réel n’a été connecté.');
      return;
    }
    if (event.target.id === 'module-form') {
      event.preventDefault();
      const module = modules.find((item) => item.id === state.selectedModule);
      if (!module) return;
      module.commands.forEach((command) => state.enabledCommands.delete(`${module.id}:${command}`));
      $$('input[name="command"]:checked', event.target).forEach((input) => state.enabledCommands.add(`${module.id}:${input.value}`));
      closeModal();
      renderPage();
      toast('Commandes mises à jour pour cette session.');
    }
  });
  document.addEventListener('input', (event) => {
    if (event.target.id !== 'command-search') return;
    const query = event.target.value.trim().toLowerCase();
    $$('[data-command-search]', dashboard).forEach((row) => {
      row.classList.toggle('hidden-row', query !== '' && !row.dataset.commandSearch.includes(query));
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
  renderPage();
})();
