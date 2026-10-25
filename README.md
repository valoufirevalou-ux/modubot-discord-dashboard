# ModuBot — maquette interactive

La racine du dépôt est une maquette front-end statique en français. Le backend complet est dans `platform/` et comprend maintenant une inscription avec pseudo, e-mail et mot de passe, une connexion par e-mail/mot de passe, une base SQLite et des demandes PayPal.Me enregistrées avant l’ouverture de PayPal.

## Ouvrir la maquette

Ouvre `index.html` dans un navigateur récent. Aucun serveur, compte ou paquet à installer n’est nécessaire.

## Ce qui fonctionne dans la démo

- L’écran d’accueil et les formulaires visuels d’inscription/connexion. Dans cette maquette seule, ils ne créent pas de compte réel.
- Le tableau de bord, la navigation entre les pages et les interrupteurs des modules.
- Les modules Utilitaires et Jeux & fun sont gratuits. Les autres modules affichent le forfait requis et renvoient vers la page Forfaits.
- Les forfaits affichés sont Gratuit (1 bot), Mod (2 bots, 4,99 €), Pro (8 bots, 9,99 €) et Ultime (25 bots, 29,99 €), pour 30 jours.
- La création et la sélection de projets dans la session de démonstration. Les projets disparaissent lorsque la page est rechargée.
- Les paiements sont désactivés dans cette maquette : aucun bouton ne redirige vers PayPal et aucune demande n’est envoyée à un panneau admin.
- Le champ du token n’est pas proposé dans la maquette statique : elle ne connecte ni ne déploie de bot. Dans la version serveur, le token est demandé uniquement lors de la création du projet puis chiffré côté serveur. Le préfixe est fixé à `/` et les commandes sont des slash.
- Les formulaires d’inscription, l’état de démonstration, les commandes et les réglages sont temporaires et ne sont pas conservés après rechargement.

## Publication et backend

La racine de ce dépôt reste une maquette statique. GitHub Pages peut publier cette interface, mais ne peut pas exécuter le backend Node : ses formulaires et ses boutons de paiement restent donc désactivés/non persistants. La version complète est dans `platform/` : déploie ce dossier sur un hébergeur Node avec stockage persistant, configure les variables de `platform/.env.example` dans les secrets de l’hébergeur, puis utilise l’URL HTTPS du serveur pour le site. L’inscription et la connexion par e-mail fonctionnent avec le backend sans OAuth Discord. Garde `PAYMENTS_ENABLED=false` jusqu’à ce que PayPal et la capacité réelle d’hébergement soient configurés.

Le backend stocke la demande PayPal avant d’ouvrir le lien PayPal.Me et permet à l’administrateur de vérifier le transfert. PayPal ne préremplit pas le champ de note : le client doit coller le code lui-même. Les commandes bot sont hébergées uniquement quand le serveur Node est en ligne. Ne saisis jamais de secret dans la maquette statique ni dans GitHub.
