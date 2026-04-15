# NetflixLight

Plateforme de streaming vidéo développée dans le cadre d'un projet scolaire. Elle permet de naviguer dans un catalogue de films et séries, d'effectuer des recherches, de gérer une liste de favoris et d'accéder aux détails de chaque contenu via l'API TMDB.

---

## Installation

### Prérequis

- Node.js v18 ou supérieur
- Un compte TMDB pour obtenir un Bearer Token

### Étapes

```bash
# Cloner le dépôt
git clone https://github.com/Lilou-28/NetflixLight.git
cd NetflixLight

# Installer les dépendances
npm install

# Créer le fichier d'environnement
cp .env.example .env
# Puis renseigner votre TMDB_BEARER_TOKEN dans .env

# Lancer le serveur
node cmd/server.js
```

L'application est accessible sur `http://localhost:8080`.

---

## Configuration de l'API TMDB

1. Créer un compte sur [themoviedb.org](https://www.themoviedb.org)
2. Aller dans **Settings → API**
3. Créer une application (Developer Plan, gratuit)
4. Copier le **API Read Access Token** (commence par `eyJ...`)
5. Créer un fichier `.env` à la racine du projet :

```
TMDB_BEARER_TOKEN=eyJ...votre_token
```

---

## Architecture du projet

```
NetflixLight/
├── cmd/
│   └── server.js               # Serveur HTTP Node.js — routes et logique backend
├── internal/
│   ├── appelAPI.js             # Appels à l'API TMDB
│   ├── database.js             # Connexion SQLite et création des tables
│   ├── dbNetflixLight.db       # Base de données SQLite (ignorée par git)
│   ├── hashmdp.js              # Hachage et vérification des mots de passe (bcrypt)
│   └── token.js                # Génération et vérification des tokens de session
├── web/
│   ├── static/
│   │   ├── js/
│   │   │   ├── header.js       # Composant header global (nav, recherche, auth)
│   │   │   └── router.js       # Système de routing SPA hash-based
│   │   ├── script/
│   │   │   ├── carrouselComponent.js   # Composant carrousel générique
│   │   │   ├── favoris.js              # Gestion des favoris (add/remove/toggle)
│   │   │   ├── heroBanner.js           # Hero banner page d'accueil
│   │   │   └── animationHover.js       # Animations au survol des posters
│   │   ├── acceuil.css
│   │   ├── detail.css
│   │   ├── header.css
│   │   ├── index.css
│   │   ├── login.css
│   │   ├── register.css
│   │   └── userinfo.css
│   └── templates/
│       ├── acceuil.html        # Page d'accueil avec carrousels
│       ├── detail.html         # Page détail film/série
│       ├── films.html          # Page Films
│       ├── series.html         # Page Séries
│       ├── ma-liste.html       # Page Watchlist (favoris)
│       ├── login.html          # Page connexion
│       ├── register.html       # Page inscription
│       ├── userinfo.html       # Page profil utilisateur
│       └── index.html          # Coquille principale (SPA)
├── .env                        # Variables d'environnement (ignoré par git)
├── .gitignore
├── package.json
└── README.md
```

---

## Choix techniques

**Node.js HTTP natif** — Le serveur utilise le module `http` natif de Node.js plutôt qu'Express, pour rester au plus près des fondamentaux et comprendre le fonctionnement des requêtes HTTP.

**SQLite** — Base de données légère, sans serveur, adaptée à un prototype. Les tables `users`, `tokens` et `favoris` couvrent l'ensemble des besoins de persistance.

**Sessions par cookie** — L'authentification repose sur un token stocké en cookie HTTP. Chaque route protégée vérifie ce token avant de répondre.

**Routing SPA hash-based** — Un router JS côté client intercepte les changements de hash (`#/series`, `#/films`) et charge les pages dynamiquement via des routes `/api/page/...` côté serveur, sans rechargement de page.

**carrouselComponent.js** — Composant générique qui centralise toute la logique de chargement et d'affichage des carrousels Swiper. Chaque carrousel est configuré par un objet `config` (endpoint, wrapperIds, messages d'erreur).

**Debounce 300ms** — La barre de recherche intégrée au header attend 300ms après la dernière frappe avant d'émettre un événement de recherche, évitant de surcharger l'API TMDB.

**JavaScript vanilla** — Aucun framework front-end (React, Vue, etc.) n'est utilisé, conformément aux contraintes du projet.

---

## Fonctionnalités implémentées

- Inscription et connexion utilisateur avec session persistante
- Header global avec navigation, barre de recherche et menu profil
- Page d'accueil avec carrousels par catégorie (populaires, mieux notés, action, fantasy)
- Page Séries et page Films dédiées
- Page détail avec backdrop, synopsis, casting, films similaires
- Bouton Ajouter/Retirer des favoris sur la page détail
- Page Ma liste (Watchlist) avec suppression des favoris
- Routing SPA hash-based
- Déconnexion

---

## Documentation API backend

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/` | Non | Redirige vers `/acceuil` ou `/login` selon la session |
| GET | `/login` | Non | Page de connexion |
| POST | `/login` | Non | Authentifie l'utilisateur, crée une session |
| GET | `/register` | Non | Page d'inscription |
| POST | `/register` | Non | Crée un compte utilisateur |
| GET | `/logout` | Non | Supprime la session et redirige |
| GET | `/acceuil` | Oui | Page d'accueil |
| GET | `/series` | Oui | Page Séries |
| GET | `/films` | Oui | Page Films |
| GET | `/ma-liste` | Oui | Page Watchlist |
| GET | `/details?id=&type=` | Oui | Page détail film ou série |
| GET | `/userinfo` | Oui | Page profil utilisateur |
| GET | `/api/userinfo` | Oui | Données utilisateur connecté (JSON) |
| GET | `/api/favoris` | Oui | Liste des favoris de l'utilisateur (JSON) |
| POST | `/api/favoris` | Oui | Ajouter un favori |
| DELETE | `/api/favoris/:id` | Oui | Supprimer un favori |
| GET | `/api/popular-mixed` | Oui | Films et séries populaires mélangés |
| GET | `/api/trending-mixed` | Oui | Tendances films et séries |
| GET | `/api/top-rated-mixed` | Oui | Mieux notés films et séries |
| GET | `/api/similar?id=` | Oui | Contenus similaires |
| GET | `/discover/movie-action` | Oui | Films et séries d'action |
| GET | `/discover/movie-fantasy` | Oui | Films et séries fantasy |
| GET | `/search-movie?query=` | Oui | Recherche TMDB |
| GET | `/static/*` | Non | Fichiers statiques (CSS, JS, images) |
