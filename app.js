(() => {
  const modules = [
    { id: 'moderation', name: 'Modération', description: 'Gère les comportements et les sanctions du serveur.', icon: 'i-shield', color: 'purple', commands: ['ban', 'tempban', 'softban', 'unban', 'kick', 'timeout', 'untimeout', 'mute', 'unmute', 'warn', 'warnings', 'unwarn', 'clear', 'purge', 'slowmode', 'lock', 'unlock', 'nick', 'deafen', 'undeafen', 'voicekick', 'role', 'addrole', 'removerole'] },
    { id: 'welcome', name: 'Bienvenue', description: 'Accueille les nouveaux membres et attribue un rôle.', icon: 'i-users', color: 'green', commands: ['welcome', 'setwelcome', 'testwelcome', 'goodbye', 'setgoodbye', 'autorole', 'welcomechannel'] },
    { id: 'protection', name: 'Anti-spam & protection', description: 'Aide à filtrer le spam et les arrivées suspectes.', icon: 'i-message', color: 'orange', commands: ['antispam', 'antiraid', 'raidmode', 'antiinvite', 'antilink', 'antiscam', 'antimention', 'antibot', 'verify', 'whitelist', 'lockdown', 'unlockdown'] },
    { id: 'utility', name: 'Utilitaires', description: 'Ajoute des commandes pratiques à ton serveur.', icon: 'i-terminal', color: 'blue', commands: ['help', 'serverinfo', 'userinfo', 'avatar', 'banner', 'ping', 'botinfo', 'roleinfo', 'channelinfo', 'invite', 'poll', 'remind', 'calc', 'translate', 'emoji', 'membercount', 'uptime'] },
    { id: 'logs', name: 'Journaux', description: 'Centralise les événements utiles à suivre.', icon: 'i-log', color: 'purple', commands: ['setlog', 'logs', 'modlogs', 'messagelogs', 'memberlogs', 'voicelogs'] },
    { id: 'tickets', name: 'Tickets', description: 'Organise les demandes d’aide de ta communauté.', icon: 'i-message', color: 'green', commands: ['ticket', 'close', 'adduser', 'removeuser', 'claim', 'transcript', 'ticketpanel', 'ticketconfig', 'reopen'] },
    { id: 'roles', name: 'Rôles & réactions', description: 'Laisse les membres choisir leurs rôles et automatise leur attribution.', icon: 'i-users', color: 'blue', commands: ['rolecreate', 'roledelete', 'rolecolor', 'reactionrole', 'rolepanel', 'roleadd', 'roleremove', 'rolelist', 'rolerandom'] },
    { id: 'levels', name: 'Niveaux & activité', description: 'Récompense la participation avec des niveaux et des rôles.', icon: 'i-spark', color: 'orange', commands: ['rank', 'leaderboard', 'levelset', 'levelreward', 'levelreset', 'xpboost', 'levelcard', 'leveltoggle'] },
    { id: 'fun', name: 'Jeux & fun', description: 'Ajoute quelques commandes légères à la vie du serveur.', icon: 'i-spark', color: 'purple', commands: ['8ball', 'coinflip', 'dice', 'hug', 'pat', 'meme', 'joke', 'ship', 'choose', 'trivia'] },
    { id: 'polls', name: 'Sondages', description: 'Recueille les avis de la communauté avec des votes simples.', icon: 'i-message', color: 'green', commands: ['quickpoll', 'pollresults', 'pollclose', 'vote', 'pollcreate'] },
    { id: 'suggestions', name: 'Suggestions', description: 'Centralise les idées et laisse les membres voter.', icon: 'i-spark', color: 'blue', commands: ['suggest', 'suggestionstatus', 'suggestionsetup', 'suggestionlist'] },
    { id: 'giveaways', name: 'Giveaways', description: 'Configure des tirages au sort et désigne des gagnants.', icon: 'i-spark', color: 'coral', commands: ['giveaway', 'gstart', 'gend', 'greroll', 'glist', 'gdelete'] },
    { id: 'custom', name: 'Commandes perso', description: 'Prépare des réponses et raccourcis personnalisés.', icon: 'i-terminal', color: 'orange', commands: ['customadd', 'customedit', 'customremove', 'customlist', 'customtest'] },
    { id: 'reminders', name: 'Rappels & agenda', description: 'Planifie des rappels pour les membres et les événements.', icon: 'i-log', color: 'purple', commands: ['reminders', 'remindcancel', 'event', 'eventlist'] },
  ];
  const state = {
    user: { name: 'Camille' },
    currentPage: 'overview',
    selectedModule: null,
    botName: 'Astéria Studio',
    botId: '',
    prefix: '!',
    enabled: new Set(['moderation', 'welcome', 'protection']),
    enabledCommands: new Set(modules.flatMap((module) => module.commands.map((command) => `${module.id}:${command}`))),
    bannerVisible: true,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const dashboard = $('#dashboard-content');

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
    $('#server-name').textContent = state.botName;
    $('#active-count').textContent = state.enabled.size;
  }
  function pageHeading(label, title, description, action = '') {
    return `<div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-dot"></span> ${label}</div><h1>${title}</h1><p>${description}</p></div>${action ? `<div class="page-action">${action}</div>` : ''}</div>`;
  }
  function overviewMarkup() {
    const activeModules = modules.filter((module) => state.enabled.has(module.id));
    const moduleRows = activeModules.length ? activeModules.map((module) => `<div class="module-row">${moduleIcon(module)}<span class="module-copy"><b>${module.name}</b><small>${commandCount(module)} commande${commandCount(module) === 1 ? '' : 's'} active${commandCount(module) === 1 ? '' : 's'} <span class="command-hint">${module.commands.slice(0, 3).map((command) => `/${command}`).join(' · ')}</span></small></span><input class="toggle" type="checkbox" checked aria-label="Désactiver ${module.name}" data-toggle-module="${module.id}"><button class="text-button" data-config-module="${module.id}">Régler</button></div>`).join('') : `<div class="empty-notice"><b>Aucun module actif</b>Choisis un module pour commencer à configurer ton bot.</div>`;
    return `${pageHeading('TON ESPACE', `Bonjour ${escapeHtml(state.user.name)} <span>✦</span>`, 'Voici ce qui se passe sur ton espace de démonstration.', '<button class="button button-small" data-action="bot-setup">Configurer mon bot</button>')}
      <div class="stat-grid"><article class="stat-card"><div class="stat-label">État du bot ${icon('i-bot')}</div><div class="stat-value" style="font-size:17px;color:#e2c87f">Démo</div><div class="stat-foot">Aucun bot réel relié</div></article><article class="stat-card"><div class="stat-label">Modules actifs ${icon('i-spark')}</div><div class="stat-value">${state.enabled.size}</div><div class="stat-foot">sur ${modules.length} disponibles</div></article><article class="stat-card"><div class="stat-label">Commandes actives ${icon('i-terminal')}</div><div class="stat-value">${countAllCommands()}</div><div class="stat-foot">dans cette session</div></article><article class="stat-card"><div class="stat-label">Préfixe ${icon('i-settings')}</div><div class="stat-value">${escapeHtml(state.prefix)}</div><div class="stat-foot">personnalisable</div></article></div>
      <div class="dashboard-grid"><section class="panel-card"><div class="panel-header"><h2>Mes modules</h2><button class="text-button" data-nav="modules">Voir les ${modules.length} modules →</button></div><div class="module-list">${moduleRows}</div></section><section class="panel-card"><div class="panel-header"><h2>Activité récente</h2><span>APERÇU</span></div><div class="activity-list"><div class="activity-row"><span class="activity-icon green">✓</span><span><b>Espace de démonstration prêt</b><small>Les réglages ne sont pas enregistrés en ligne</small></span><span class="activity-time">maintenant</span></div><div class="activity-row"><span class="activity-icon purple">✦</span><span><b>${state.enabled.size} modules sélectionnés</b><small>Tu peux les modifier à tout moment</small></span><span class="activity-time">session</span></div><div class="activity-row"><span class="activity-icon yellow">!</span><span><b>Token du bot non demandé</b><small>La connexion réelle nécessite un serveur sécurisé</small></span><span class="activity-time">info</span></div></div></section></div>`;
  }
  function modulesMarkup() {
    const cards = modules.map((module) => `<article class="catalog-card">${moduleIcon(module)}<div><h3>${module.name}</h3><p>${module.description}</p><small style="font-size:8px;color:#8d8b98">${commandCount(module)} / ${module.commands.length} commandes sélectionnées</small><button class="text-button" data-config-module="${module.id}">Configurer les commandes →</button></div><input class="toggle" type="checkbox" ${state.enabled.has(module.id) ? 'checked' : ''} aria-label="${state.enabled.has(module.id) ? 'Désactiver' : 'Activer'} ${module.name}" data-toggle-module="${module.id}"></article>`).join('');
    return `${pageHeading('CONFIGURATION', 'Les modules', 'Active les fonctionnalités adaptées à ton serveur.')}
      <div class="module-catalog">${cards}</div>`;
  }
  function commandsMarkup() {
    const rows = modules.flatMap((module) => module.commands.map((command) => {
      const selected = state.enabledCommands.has(`${module.id}:${command}`);
      const active = state.enabled.has(module.id) && selected;
      const status = !state.enabled.has(module.id) ? 'Module inactif' : selected ? 'Activée' : 'Désactivée';
      return `<tr data-command-search="${escapeAttribute(`${state.prefix}${command} ${module.name}`.toLowerCase())}"><td class="command-name">${escapeHtml(state.prefix)}${command}</td><td class="command-module">${module.name}</td><td>${active ? '<span class="command-status-active">Activée</span>' : status}</td><td><button class="text-button" data-config-module="${module.id}">Modifier</button></td></tr>`;
    }));
    return `${pageHeading('CONFIGURATION', 'Les commandes', 'Parcours la bibliothèque, cherche une commande et configure ses modules.')}
      <section class="panel-card"><div class="panel-header"><h2>Bibliothèque de commandes</h2><span>${rows.length} COMMANDES · ${modules.length} MODULES</span></div><div class="log-toolbar"><input class="text-input" id="command-search" type="search" placeholder="Rechercher une commande ou un module…" aria-label="Rechercher une commande"></div><div class="command-table-wrap"><table class="command-table"><thead><tr><th>COMMANDE</th><th>MODULE</th><th>ÉTAT</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div></section>`;
  }
  function logsMarkup() {
    return `${pageHeading('SUIVI', 'Les journaux', 'Un aperçu des changements effectués dans cette session.')}
      <section class="panel-card"><div class="panel-header"><h2>Événements récents</h2><span>SESSION ACTUELLE</span></div><div class="activity-list"><div class="activity-row"><span class="activity-icon green">✓</span><span><b>La maquette est prête à explorer</b><small>Aucun événement de bot réel n’est collecté</small></span><span class="activity-time">maintenant</span></div><div class="activity-row"><span class="activity-icon purple">✦</span><span><b>${state.enabled.size} modules sélectionnés</b><small>Les réglages sont temporaires et locaux à cette page</small></span><span class="activity-time">session</span></div></div></section>`;
  }
  function settingsMarkup() {
    return `${pageHeading('ESPACE', 'Paramètres', 'Personnalise les détails de ta configuration de démonstration.')}
      <div class="settings-grid"><section class="panel-card"><div class="panel-header"><h2>Configuration du bot</h2><span>APERÇU</span></div><form class="settings-form" id="settings-form"><label class="field-label">Nom du bot<input class="text-input" name="botName" value="${escapeAttribute(state.botName)}" maxlength="40" required></label><label class="field-label">ID de l’application Discord<small>Identifiant public, pas le token secret</small><input class="text-input" name="botId" value="${escapeAttribute(state.botId)}" placeholder="Ex. 123456789012345678" inputmode="numeric"></label><label class="field-label">Préfixe des commandes<input class="text-input" name="prefix" value="${escapeAttribute(state.prefix)}" maxlength="5" required></label><button class="button button-primary" type="submit">Enregistrer dans la session</button></form></section><section class="panel-card"><div class="panel-header"><h2>Connexion sécurisée</h2>${icon('i-lock')}</div><div class="setting-hint">Un token Discord est une clé secrète qui donne le contrôle de ton bot. Cette maquette n’accepte pas de token et ne se connecte pas à Discord. Pour la version en ligne, il faudra un serveur sécurisé qui chiffre chaque token et l’isole pour son propriétaire.</div><div class="setting-hint" style="margin-top:10px">Ne publie jamais ton token dans GitHub, dans le code du site, ni dans un formulaire de démonstration.</div></section></div>`;
  }
  const pageTitles = { overview: 'Vue d’ensemble', modules: 'Modules', commands: 'Commandes', logs: 'Journaux', settings: 'Paramètres' };
  function renderPage() {
    updateProfile();
    $('#breadcrumb-title').textContent = pageTitles[state.currentPage] || 'Vue d’ensemble';
    $$('.side-link').forEach((link) => link.classList.toggle('active', link.dataset.nav === state.currentPage));
    const renderers = { overview: overviewMarkup, modules: modulesMarkup, commands: commandsMarkup, logs: logsMarkup, settings: settingsMarkup };
    dashboard.innerHTML = renderers[state.currentPage]();
  }
  function countAllCommands() {
    return modules.reduce((total, module) => total + (state.enabled.has(module.id) ? commandCount(module) : 0), 0);
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function escapeAttribute(value) { return escapeHtml(value); }

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
    openModal(`<div class="modal-heading-icon">${icon('i-bot')}</div><h2 id="modal-title">Configurer mon bot</h2><p class="modal-intro">Ajoute les informations publiques de ton application pour préparer son espace.</p><form class="modal-form" id="bot-form"><label class="field-label">Nom du bot<input class="text-input" name="botName" maxlength="40" value="${escapeAttribute(state.botName)}" required></label><label class="field-label">ID de l’application Discord<small>Visible dans le portail développeur Discord</small><input class="text-input" name="botId" inputmode="numeric" maxlength="22" value="${escapeAttribute(state.botId)}" placeholder="Ex. 123456789012345678"></label><label class="field-label">Préfixe des commandes<input class="text-input" name="prefix" maxlength="5" value="${escapeAttribute(state.prefix)}" required></label><p class="modal-security"><b>Le token n’est pas demandé ici.</b> Cette démo ne peut pas connecter ni héberger un bot. Une version publique devra chiffrer le token côté serveur.</p><button class="button button-primary" type="submit">Préparer l’espace ${icon('i-arrow')}</button></form>`);
  }
  function moduleModal(moduleId) {
    const module = modules.find((item) => item.id === moduleId);
    if (!module) return;
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
    const auth = event.target.closest('[data-auth]');
    if (auth) { authModal(auth.dataset.auth); return; }
    const nav = event.target.closest('[data-nav]');
    if (nav) { event.preventDefault(); setPage(nav.dataset.nav); return; }
    const config = event.target.closest('[data-config-module]');
    if (config) { moduleModal(config.dataset.configModule); return; }
    const toggle = event.target.closest('[data-toggle-module]');
    if (toggle) {
      const id = toggle.dataset.toggleModule;
      toggle.checked ? state.enabled.add(id) : state.enabled.delete(id);
      renderPage();
      toast(toggle.checked ? 'Module activé dans cette démo.' : 'Module désactivé dans cette démo.');
      return;
    }
    if (event.target.closest('[data-action="demo"]')) { enterDashboard('Camille'); return; }
    if (event.target.closest('[data-action="bot-setup"]')) { botModal(); return; }
    if (event.target.closest('[data-action="profile"]')) { toast('Profil de démonstration.'); return; }
    if (event.target.closest('[data-close-modal]') || event.target === $('#modal-backdrop') || event.target.closest('#modal-close')) { closeModal(); return; }
    if (event.target.closest('#dismiss-banner')) { state.bannerVisible = false; $('.demo-banner').classList.add('hidden'); return; }
    if (event.target.closest('#mobile-menu')) { $('.topbar').classList.toggle('mobile-open'); return; }
    if (event.target.closest('#sidebar-toggle')) { $('#sidebar').classList.toggle('open'); return; }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'auth-form') {
      event.preventDefault();
      const data = new FormData(event.target);
      const email = String(data.get('email') || '');
      const firstName = String(data.get('name') || '').trim() || (email.split('@')[0].replace(/[._-]+/g, ' ').split(' ')[0] || 'Camille');
      enterDashboard(firstName.charAt(0).toUpperCase() + firstName.slice(1));
      return;
    }
    if (event.target.id === 'bot-form' || event.target.id === 'settings-form') {
      event.preventDefault();
      const data = new FormData(event.target);
      state.botName = String(data.get('botName') || 'Mon bot').trim() || 'Mon bot';
      state.botId = String(data.get('botId') || '').trim();
      state.prefix = String(data.get('prefix') || '!').trim() || '!';
      closeModal();
      renderPage();
      toast('Configuration mise à jour pour cette session.');
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
