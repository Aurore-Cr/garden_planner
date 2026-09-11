# Cycle — déploiement sur Render

Application multi-comptes (nutrition, sport, cardio, organisation, cycle menstruel) avec un
serveur Express qui sert l'app et sauvegarde les données de chaque compte dans son propre
fichier sur disque.

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
   - `COOKIE_SECRET` — une chaîne aléatoire longue (ex. générée sur https://randomkeygen.com), pour signer le cookie de session. **Obligatoire en production** (sans elle, une valeur aléatoire différente est générée à chaque redémarrage du serveur, ce qui déconnecterait tout le monde).
   - `DATA_DIR` — mets `/data` (voir étape suivante).
5. Dans **Disks**, ajoute un disque persistant : *Mount Path* = `/data`, taille 1 Go suffit largement pour plusieurs comptes. **C'est cette étape qui garantit que les données ne disparaissent pas** à chaque redéploiement (sans disque persistant, le système de fichiers de Render est réinitialisé à chaque déploiement).
6. Déploie.

## 3. Comptes multiples

- Chaque personne crée son propre compte (identifiant + mot de passe) directement sur la page de connexion, bouton « Créer un compte ». Aucune limite au nombre de comptes.
- Les données de chaque compte sont totalement séparées (un fichier par compte sur le disque), avec mot de passe haché (bcrypt) — jamais stocké en clair.
- Chaque personne peut changer son mot de passe depuis Profil → Réglages → *Changer de mot de passe*.
- Les repas, objectifs de pas, et objectifs caloriques/protéiques s'adaptent automatiquement au poids, à la taille et à l'objectif (perte / maintien / prise) renseignés par chaque personne dans son propre profil.

## 4. Utilisation sur ton téléphone

- Ouvre l'URL Render fournie (`https://ton-app.onrender.com`) depuis Safari ou Chrome sur ton téléphone.
- Connecte-toi avec ton identifiant et ton mot de passe (ou crée ton compte au premier lancement).
- Ajoute la page à l'écran d'accueil (Safari : partager → « Sur l'écran d'accueil ») pour l'utiliser comme une app.
- Tes données sont sauvegardées automatiquement côté serveur (sur le disque persistant) à chaque modification, avec une copie de secours quotidienne par compte dans `/data/backups/<compte>`. Un bouton « Exporter une sauvegarde » (Profil → Réglages) télécharge aussi une copie JSON à tout moment.

## Cycle menstruel

- Sur l'onglet Calendrier, un bouton permet de marquer le premier jour des règles ; la durée du cycle et des règles est réglable (par défaut 28 et 5 jours).
- L'application calcule ensuite automatiquement la phase du cycle pour chaque jour (règles, folliculaire, ovulatoire, lutéale, prémenstruelle) :
  - **Sport** : en phase de règles, le renforcement/tractions/corde/boxe prévus sont automatiquement remplacés par une séance de Pilates plus douce ; en phase prémenstruelle, la course et la boxe sont remplacées par de la marche. Toute modification manuelle du planning d'un jour reste toujours prioritaire sur cette adaptation automatique.
  - **Nutrition** : en phase prémenstruelle, un petit « boost » (chocolat noir + graines de courge, riches en magnésium) s'ajoute automatiquement au menu du jour, en plus des repas habituels.

## Cahiers personnalisés (repas + sport réels, 1 an, en boucle)

- À la création du compte, chacun choisit **qui il est** : *Aurore* (cahier personnalisé), *Conjoint* (son propre cahier), ou *Une autre personne* (calcul automatique générique selon le profil). Ce choix détermine quelles données l'app affiche — les deux cahiers réels sont stockés dans l'app (`public/data/*.json`) mais **seul le compte du bon rôle y a accès à l'affichage** (Aurore voit son cahier, le conjoint voit le sien).
- **Repas** (onglet Nutrition → Menus) : pour les comptes Aurore/Conjoint, le menu du jour affiché est celui réellement rédigé dans le cahier alimentaire (petit-déj, déjeuner, collation, dîner, macros et bilan du jour), et non plus le calcul générique. Le complément prémenstruel magnésium reste ajouté automatiquement pendant la phase concernée.
- **Sport** (onglet Sport → « 📋 Séance du jour ») : affiche la séance réellement prévue ce jour-là (section, exercices, séries/reps/repos), avec, pour Aurore, la phase de cycle et l'adaptation d'intensité (RIR) prévues dans son programme, ainsi que les séances de boxe libres quand il y en a. Les autres sous-onglets (course, pas, cardio, corde, tractions, renfo, boxe, pilates, libre) restent disponibles pour un suivi complémentaire.
- **Posture** (onglet Sport → « 🧍 Posture ») : programme quotidien de 30 jours pour se redresser (respiration, gainage, mobilité), qui reprend automatiquement au jour 1 après le jour 30, avec cases à cocher pour suivre les exercices faits chaque jour.
- **Génération après 1 an** : les cahiers réels couvrent une année authentique (10 septembre 2026 → 9 septembre 2027). Passé cette date, l'application reprend automatiquement le programme depuis le premier jour (repas, sport et rythme de cycle inclus), en boucle indéfiniment — aucune limite dans le temps.
- Un compte « Une autre personne » (ou tout nouveau compte créé plus tard) continue de bénéficier du moteur générique existant (calcul des repas/calories selon poids, taille et objectif), indépendamment des cahiers personnalisés.

## Notes

- **Plan gratuit Render** : le service s'endort après une quinzaine de minutes d'inactivité et met quelques secondes à se réveiller au prochain accès — c'est normal, les données ne sont pas perdues pour autant (elles sont sur le disque, pas en mémoire).
- **Montre Garmin** : Garmin ne propose pas d'API publique ouverte aux particuliers (leur *Health API* nécessite un accord commercial avec Garmin). Il n'est donc pas possible de synchroniser l'app avec une montre en temps réel. L'app propose à la place un import manuel : exporter les données depuis Garmin Connect (widget Pas ou Sommeil) et les coller dans Profil → Réglages → *Import Garmin*.
- **Sécurité** : chaque compte est protégé par un identifiant et un mot de passe (haché avec bcrypt, jamais stocké en clair), avec un cookie de session signé et marqué `httpOnly`. Les données d'un compte ne sont accessibles qu'à ce compte. Comme pour toute application, ne partage pas ton mot de passe, et choisis un `COOKIE_SECRET` fort sur Render.
