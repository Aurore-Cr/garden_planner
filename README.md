# Cycle — déploiement sur Render

Application personnelle (nutrition, sport, cardio, organisation) avec un petit
serveur Express qui sert l'app et sauvegarde tes données dans un fichier sur disque.

## 1. Mettre le code sur GitHub

1. Crée un dépôt GitHub (public ou privé, peu importe).
2. Dans ce dossier : `git init`, `git add .`, `git commit -m "Cycle"`, puis pousse-le vers GitHub.

## 2. Créer le service sur Render

1. Sur [render.com](https://render.com), **New +** → **Web Service**.
2. Connecte ton dépôt GitHub.
3. Renseigne :
   - **Build command** : `npm install`
   - **Start command** : `npm start`
4. Dans **Environment variables**, ajoute :
   - `APP_PIN` — le code à saisir sur ton téléphone pour ouvrir l'app (4 à 12 caractères). **Change-le**, la valeur par défaut n'est pas secrète.
   - `COOKIE_SECRET` — une chaîne aléatoire longue (ex. générée sur https://randomkeygen.com), pour signer le cookie de session.
   - `DATA_DIR` — mets `/data` (voir étape suivante).
5. Dans **Disks**, ajoute un disque persistant : *Mount Path* = `/data`, taille 1 Go suffit largement. **C'est cette étape qui garantit que tes données ne disparaissent pas** à chaque redéploiement (sans disque persistant, le système de fichiers de Render est réinitialisé à chaque déploiement).
6. Déploie.

## 3. Utilisation sur ton téléphone

- Ouvre l'URL Render fournie (`https://ton-app.onrender.com`) depuis Safari ou Chrome sur ton téléphone.
- Entre ton code d'accès (`APP_PIN`).
- Ajoute la page à l'écran d'accueil (Safari : partager → « Sur l'écran d'accueil ») pour l'utiliser comme une app.
- Tes données sont sauvegardées automatiquement côté serveur (sur le disque persistant) à chaque modification, avec une copie de secours quotidienne dans le dossier `/data`. Un bouton « Exporter une sauvegarde » (Profil → Réglages) télécharge aussi une copie JSON à tout moment.

## Notes

- **Plan gratuit Render** : le service s'endort après une quinzaine de minutes d'inactivité et met quelques secondes à se réveiller au prochain accès — c'est normal, tes données ne sont pas perdues pour autant (elles sont sur le disque, pas en mémoire).
- **Montre Garmin** : Garmin ne propose pas d'API publique ouverte aux particuliers (leur *Health API* nécessite un accord commercial avec Garmin). Il n'est donc pas possible de synchroniser l'app avec ta montre en temps réel. L'app propose à la place un import manuel : exporte tes données depuis Garmin Connect (widget Pas ou Sommeil) et colle-les dans Profil → Réglages → *Import Garmin*.
- **Sécurité** : l'app est protégée par un simple code d'accès (PIN), pas par un vrai compte utilisateur — c'est volontairement minimal puisque c'est une app personnelle à usage unique. Ne partage pas l'URL et le code.
