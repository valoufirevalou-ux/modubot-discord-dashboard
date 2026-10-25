# ModuBot — plateforme privée

Cette version ajoute un serveur à la maquette visuelle. Elle comprend une connexion Discord OAuth, un tableau de bord organisé par projets bots, six modules de commandes slash, un bot privé pour les journaux et les validations, des forfaits temporaires et deux modes de paiement PayPal.

## Ce qui est fonctionnel dans le code

- Connexion avec Discord ; le site ne demande jamais le mot de passe Discord. Une adresse e-mail de contact est demandée seulement au moment d’une commande payante.
- Création de projets avec un nom et le token secret du bot. Le token est vérifié côté serveur puis chiffré avec AES-256-GCM ; il n’est jamais renvoyé au navigateur ni envoyé dans les journaux. Les commandes utilisent toujours le préfixe slash `/`. Retirer un bot arrête sa connexion et supprime sa clé stockée.
- Modules réellement disponibles : modération (12 commandes), protection (verrouillage, mode lent et anti-spam activable par serveur), utilitaires (8 commandes), communauté, détente et tickets. Les commandes slash sélectionnées sont synchronisées auprès de Discord après la connexion du bot.
- Projets sélectionnables dans la barre latérale. Les réglages, modules et quotas sont propres à chaque bot. Utilitaires et Fun sont accessibles gratuitement ; les autres modules sont verrouillés selon le forfait.
- Bot opérateur privé : `/configurer-journal`, `/tester-journal` et `/statut-modubot`. Les validations PayPal se font dans la page privée `/admin` du site.
- Journal Discord fixé par défaut au salon `1563843691326476450`, avec `/tester-journal` pour vérifier l’envoi depuis le serveur. Les références PayPal et les e-mails ne sont pas envoyés dans Discord.
- Journal des actions essentielles : connexion, ajout, réglages et retrait d’un bot. Les événements de site sont purgés après 30 jours.
- PayPal Checkout côté serveur : l’application crée et capture la commande. Un paiement confirmé passe ensuite en attente de ton approbation dans `/admin`. Un webhook facultatif vérifie les signatures auprès de PayPal.
- PayPal.Me en mode manuel : le client saisit son e-mail de contact, copie une référence à huit chiffres, puis clique pour ouvrir le montant du forfait. À ce clic, la demande est enregistrée et apparaît dans `/admin` avant le transfert. PayPal.Me préremplit le montant, mais pas la note : le client doit coller lui-même le code dans « Ajouter une note » si PayPal affiche ce champ, puis déclarer le paiement dans son espace. La référence et l’e-mail restent dans la base du site et ne sont pas envoyés dans le salon Discord. Tu vérifies le montant et la note dans ton compte PayPal avant d’activer ou de refuser l’accès.
- Forfaits de 30 jours : Gratuit (1 bot), Mod (2), Pro (8), Ultime (25). Les montants configurés dans `src/plans.js` sont 4,99 €, 9,99 € et 29,99 €.
- Si PayPal.Me est configuré, l’espace client affiche ce parcours avec copie obligatoire avant l’ouverture du lien. PayPal Checkout reste disponible quand aucun lien PayPal.Me n’est défini. Les quotas sont activés après confirmation ou vérification du paiement et approbation dans `/admin`.

## Ce qui n’est pas encore publié

Le site déjà publié sur GitHub Pages est un hébergement statique. Il ne peut pas exécuter ce serveur Node.js ni maintenir un bot Discord connecté. Les fichiers de cette version sont préparés localement, mais aucun service backend n’a encore été déployé et aucun nom de domaine backend n’a été attribué.

Le compte Bot-Hosting ouvert dans le navigateur propose un seul déploiement gratuit avec ressources limitées et renouvellement manuel tous les quatre jours. C’est adapté à un essai très limité, sans engagement de disponibilité ; ce n’est pas une capacité démontrée pour vendre 2, 8 ou 25 bots par client. Le code limite à un bot hébergé au total par défaut via `MAX_HOSTED_BOTS=1`. Les paiements restent désactivés et les forfaits payants sont indisponibles tant que la capacité ne couvre pas les places réservées.

## Lancer le serveur

Utilise Node.js 24.17 ou plus récent. Depuis ce dossier :

```powershell
npm install
Copy-Item .env.example .env
```

Génère séparément un secret de session et une clé de chiffrement de 32 octets :

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Place le premier résultat dans `SESSION_SECRET` et le second dans `TOKEN_ENCRYPTION_KEY`. Ne mets jamais `.env` dans GitHub. Garde une sauvegarde protégée de `TOKEN_ENCRYPTION_KEY` : sans elle, les tokens chiffrés ne pourront plus être déchiffrés.

## Secrets et réglages Discord

Dans le portail développeur Discord, configure l’application qui servira au site et au bot opérateur :

1. Révoque le token qui a été collé dans la conversation et génère un nouveau token de bot. Ne colle aucun token dans le chat ou dans GitHub.
2. Renseigne `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` et `PLATFORM_BOT_TOKEN` dans les variables secrètes de l’hébergeur.
3. Ajoute comme URL OAuth2 de redirection : `https://TON-DOMAINE/auth/discord/callback`.
4. Configure `APP_BASE_URL` avec exactement le domaine HTTPS qui servira l’application.
5. Invite le bot opérateur sur ton serveur et donne-lui accès au salon privé `1563843691326476450`, avec les droits Voir le salon, Envoyer des messages et Intégrer des liens. Le salon doit être invisible pour `@everyone`.
6. Dans les variables secrètes de l’hébergeur, définis `DISCORD_LOG_CHANNEL_ID=1563843691326476450`. Le bot publiera dans ce salon les événements généraux du site, sans e-mail ni référence de paiement. `/configurer-journal` reste disponible si tu retires cette valeur.

L’application utilise uniquement la permission OAuth `identify`. Elle ne demande pas l’accès à la liste de serveurs ni aux adresses e-mail des membres. La page de paiement demande séparément une adresse e-mail de contact et ne demande jamais de mot de passe. Cette adresse et la référence apparaissent uniquement à l’administrateur dans `/admin`.

## Paiements

Pour le mode automatisé, crée une application REST PayPal et place `PAYPAL_CLIENT_ID` et `PAYPAL_CLIENT_SECRET` comme secrets d’hébergement. Commence avec `PAYPAL_ENV=sandbox`. Pour recevoir les notifications même si l’utilisateur ferme son navigateur, configure un webhook PayPal vers `https://TON-DOMAINE/api/paypal/webhook`, copie son identifiant dans `PAYPAL_WEBHOOK_ID` et abonne-le à `PAYMENT.CAPTURE.COMPLETED`. Le serveur vérifie la signature avant de traiter un événement.

Le mode PayPal.Me utilise `PAYPAL_ME_URL=https://paypal.me/FCSTslyz`. Le client saisit son e-mail, copie la référence à huit chiffres et clique sur « Ouvrir PayPal.Me ». Le serveur enregistre alors la demande, qui apparaît dans `/admin` avec l’e-mail, le code et le montant. Le lien préremplit le montant du forfait ; le client ajoute le code dans la note si PayPal propose ce champ, choisit « Biens et services » pour cet achat si l’option s’affiche, envoie le paiement puis clique sur « J’ai payé » dans son espace. Le code aide à retrouver la transaction, mais ne prouve pas qu’elle a été reçue : vérifie le paiement dans ton compte PayPal avant de cliquer sur « J’ai vérifié sur PayPal · activer ». PayPal.Me ne transmet pas de confirmation au site.

L’accès `/admin` utilise le code configuré dans `ADMIN_ACCESS_CODE`. Pour reprendre le code demandé `201212`, ajoute `ADMIN_ACCESS_CODE=201212` aux variables secrètes de l’hébergeur ou au fichier local `.env` (jamais dans GitHub). Le formulaire est limité à huit essais par adresse IP sur quinze minutes. Un code à six chiffres reste faible pour un site public ; choisis de préférence un code secret plus long avant d’ouvrir le service. Les paiements restent désactivés tant que `PAYMENTS_ENABLED=false`.

## Déployer sur un hébergeur Node

1. Place le dossier dans un dépôt privé ou dans un dépôt dont tu acceptes la publication du code. Le fichier `.env` et `data/` sont exclus par `.gitignore`.
2. Crée une application Node.js avec la commande `npm start`.
3. Configure toutes les variables ci-dessus dans l’écran de secrets de l’hébergeur.
4. Fais écouter le serveur sur `0.0.0.0` et le port fourni dans `SERVER_PORT` (le code le fait déjà).
5. Configure HTTPS, un domaine stable et un stockage persistant pour `DATABASE_PATH` avant d’ouvrir les inscriptions.
6. Commence par un petit groupe d’essai. Vérifie les connexions, les commandes Discord, la sauvegarde SQLite, les limites mémoire, les suppressions et les paiements PayPal Sandbox avant les paiements réels.

GitHub Pages ne lance pas `npm start`. Le backend et le domaine de production doivent donc être hébergés séparément de la maquette statique.

## Commandes de modération ajoutées

Le module Modération comprend `/avertir`, `/avertissements`, `/retirer-avertissement`, `/retirer-timeout`, `/debannir`, `/pseudo`, `/role-ajouter` et `/role-retirer`, en plus du nettoyage, de l’expulsion, du bannissement, du timeout et de `/dire`. Les avertissements sont enregistrés par projet, serveur et membre. Les sanctions et modifications de rôles vérifient les permissions Discord et restent soumises à la hiérarchie des rôles du serveur.

Le module Protection ajoute `/anti-spam` : un membre disposant de « Gérer le serveur » peut l’activer ou le désactiver et choisir le seuil et la fenêtre de temps. Par défaut, il est désactivé. Une fois activé, le bot compte uniquement le rythme des messages (il ne lit ni ne stocke leur contenu) et applique un timeout de 60 secondes aux membres non modérateurs qui dépassent le seuil. Le bot a besoin de « Modérer les membres » pour appliquer le timeout.

## Limites à connaître

- Les commandes disponibles sont celles des six modules décrits ci-dessus. La protection anti-spam n’est pas un anti-raid complet et reste désactivée tant qu’un administrateur ne l’active pas.
- Les bots clients ont besoin des permissions Discord associées aux commandes choisies. Les commandes de modération respectent aussi la hiérarchie des rôles Discord.
- Les tokens des bots clients sont chiffrés au repos, mais le serveur doit les déchiffrer en mémoire pour connecter les bots. Protège l’accès administrateur et la clé d’encryption.
- Les commandes de cette version sont uniquement des commandes slash `/`.
- Un paiement PayPal validé donne 30 jours d’accès après ton approbation. Il n’y a pas de renouvellement automatique.
