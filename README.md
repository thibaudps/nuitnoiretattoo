# Nuit Noire Tattoo — Site web

Site vitrine du salon de tatouage Nuit Noire à Genève.
Stack : HTML / CSS / JavaScript vanilla + Decap CMS pour la gestion du contenu.

## Architecture du contenu

**Tout le contenu du site est dans `data/`**, géré via Decap CMS. Le code HTML/JS ne contient aucun texte de fond — il charge tout dynamiquement depuis ces fichiers JSON :

```
data/
├── home.json              # Page d'accueil : phrases, intro, photos
├── artists-page.json      # En-tête de la page artistes
├── shop-page.json         # En-tête + textes de la page shop
├── contact.json           # Toute la page contact
├── settings.json          # Réglages globaux (footer)
├── artists/               # Un fichier par artiste
│   ├── _index.json        # ⚙️  Généré automatiquement par build.js
│   ├── vince-pages.json
│   ├── clea-ferlay.json
│   └── ...
└── products/              # Un fichier par produit du shop
    ├── _index.json        # ⚙️  Généré automatiquement par build.js
    ├── flash-001.json
    └── ...
```

## Decap CMS

L'interface d'admin est à `/admin/`. Connexion via compte GitHub.

**4 sections dans le CMS** (une par page du site) :
- 🏠 **Accueil** — phrases d'animation, texte de présentation, photos du carrousel
- 🎨 **Artistes** — en-tête + un sous-éditeur par artiste (bio, portrait, portfolio)
- 🛍 **Shop** — en-tête + textes + un sous-éditeur par produit
- ✉️ **Contact** — adresse, horaires, email, textes du formulaire
- ⚙️ **Réglages généraux** — footer

### Configurer le CMS

Ouvre `admin/config.yml` et remplace `USERNAME/nuit-noire-tattoo` par ton vrai chemin de repo GitHub.

### Tester le CMS en local (sans toucher GitHub)

```bash
# Dans un premier terminal :
npx decap-server

# Dans un second :
python3 -m http.server 8000

# Ouvrir : http://localhost:8000/admin/
```

Le mode `local_backend: true` dans `config.yml` permet de tester les modifs sans pousser sur GitHub. À retirer en production si tu veux verrouiller.

## Lancer en local (sans CMS)

```bash
node build.js              # générer les index
python3 -m http.server 8000
# ouvrir http://localhost:8000
```

Ou en une commande : `npm run dev`

## Déploiement (Cloudflare Pages)

1. Pousser le repo sur GitHub
2. Sur Cloudflare Pages, créer un projet lié à ce repo
3. **Settings → Builds & deployments** :
   - Build command : `node build.js`
   - Build output directory : `/` (la racine, c'est un site statique)
   - Root directory : `/`

À chaque commit (notamment ceux que Decap fait quand on édite via le CMS), Cloudflare relance `node build.js` qui régénère les `_index.json` à partir des fichiers individuels, puis déploie le site mis à jour.

## Authentification du CMS — DecapBridge

[DecapBridge](https://decapbridge.com) est un service gratuit qui gère l'auth (email magique ou Google) et le proxy git-gateway vers GitHub. **Avantage majeur : les artistes n'ont pas besoin de compte GitHub.**

### Setup initial (à faire une seule fois)

1. **Créer un compte sur https://decapbridge.com** (login avec ton email)
2. **Ajouter un nouveau site** :
   - Nom : `Nuit Noire Tattoo`
   - URL du CMS : `https://nuitnoiretattoo.com/admin/` (ou ton URL Cloudflare Pages)
3. **Connecter ton repo GitHub** : DecapBridge te demande d'installer leur GitHub App sur le repo `nuit-noire-tattoo`
4. **Récupérer ton `site-id`** (DecapBridge te le donne)
5. **Mettre à jour `admin/config.yml`** :
   ```yaml
   backend:
     name: git-gateway
     repo: TON-USERNAME/nuit-noire-tattoo          # à remplir
     branch: main
     identity_url: https://auth.decapbridge.com/sites/TON-SITE-ID   # à remplir
     gateway_url: https://gateway.decapbridge.com
   ```
6. **Inviter les utilisateurs** depuis le dashboard DecapBridge :
   - Toi (admin)
   - Le patron du shop
   - Les 8 artistes (par email)
   - Chacun reçoit un email d'invitation → définit son mot de passe → peut se connecter à `/admin/`

### Quota gratuit DecapBridge

Le plan gratuit autorise un nombre limité d'utilisateurs et de commits/mois. Vérifie les limites actuelles sur leur site. Pour un shop avec 10 personnes max, ça suffit largement.

## Format des images

**Tous les visuels du site doivent être au format 1080×1440 px (ratio 3:4)** — format portrait Instagram. Le CSS impose ce ratio, donc une image carrée ou paysage sera recadrée.

## Notes techniques

- **Build script (`build.js`)** : scanne `data/artists/*.json` et `data/products/*.json` pour générer les fichiers `_index.json`. Pourquoi : le CMS écrit un fichier par entité (pratique pour l'édition), mais le site a besoin d'une liste pour afficher tout d'un coup.
- **Format `_index.json`** : `{ "items": [...] }`. Trié par `order` pour les artistes, par `name` pour les produits.
- **Partials** : nav + footer dans `js/partials.js`, injectés dans toutes les pages via `<div id="nav-mount"></div>` et `<div id="footer-mount"></div>`.
