# ModuBot — maquette interactive

Prototype front-end autonome en français pour un tableau de bord de configuration de bot Discord. La bibliothèque de démonstration contient 14 modules et plus de 120 entrées de commandes.

## Ouvrir la maquette

Ouvre `index.html` dans un navigateur récent. Aucun serveur, compte ou paquet à installer n’est nécessaire.

## Ce qui fonctionne dans la démo

- L’écran d’accueil et les formulaires visuels d’inscription/connexion.
- Le tableau de bord, la navigation entre les pages et les interrupteurs des modules.
- La sélection des commandes, les réglages du nom, de l’ID public et du préfixe.
- L’état de démonstration (nom affiché, modules, commandes et réglages) reste en mémoire dans l’onglet; il disparaît lorsque la page est rechargée. L’adresse e-mail et le mot de passe du formulaire ne sont pas conservés.

## Limites avant publication

Cette maquette ne crée pas de comptes, ne contacte pas Discord et n’héberge aucun bot. Aucun formulaire n’envoie ni ne sauvegarde durablement de donnée. Pour en faire un vrai service public, il faudra ajouter une authentification, un backend, une base de données et un environnement d’hébergement des bots. Le token Discord ne doit jamais être placé dans le navigateur ni dans le dépôt GitHub; le backend devra le chiffrer et le protéger par propriétaire.
