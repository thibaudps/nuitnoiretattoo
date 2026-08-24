# Boutique en ligne — mode d'emploi

Panier sur le site, paiement par Stripe, stock qui se met à jour tout seul dans le CMS.
Aucun abonnement mensuel : seuls les frais Stripe s'appliquent (2.9 % + 0.30 CHF sur une carte suisse, 3.25 % + 0.30 CHF sur une carte internationale).

---

## 1. Ce qui se passe quand quelqu'un achète

1. Le visiteur ajoute des articles depuis `/shop`. Le panier vit **uniquement dans son navigateur**. Rien n'est enregistré chez nous, aucun stock n'est réservé.
2. Sur `/panier`, il choisit son pays. Les frais de port s'affichent.
3. Il clique sur « Passer au paiement ». Le site appelle `/api/checkout`, qui **relit les vrais prix et le vrai stock dans GitHub**, refait tous les calculs, et crée la commande chez Stripe.
4. Il paie sur la page Stripe (carte, TWINT, Apple Pay, Google Pay), en saisissant son adresse de livraison. Aucune inscription.
5. Stripe appelle `/api/stripe-webhook`, qui **retire les quantités vendues** des fiches produit et pousse un commit du type :
   `Vente: 1x tshirt-nuit-noire (XL), 2x casquette-nn - 155.00 CHF - cs_live_a1b2c3`
6. Le visiteur atterrit sur `/merci`, son panier est vidé.

Un panier abandonné, une carte refusée ou un retour en arrière ne touchent **jamais** au stock : seul un paiement encaissé déclenche l'étape 5.

---

## 2. Réglages à faire une seule fois

### 2.1 Stripe

Vous n'avez **aucun produit à créer dans Stripe**. Le catalogue reste entièrement dans Decap.

1. Dans le tableau de bord Stripe, restez en **mode test** pour commencer (interrupteur en haut à droite).
2. **Developers → API keys** : copiez la clé secrète `sk_test_...`
3. **Developers → Webhooks → Add endpoint** :
   - URL : `https://www.nuitnoiretattoo.com/api/stripe-webhook`
   - Événement à écouter : `checkout.session.completed` (celui-là seulement)
   - Copiez le **signing secret** `whsec_...`
4. **Settings → Payment methods** : activez carte, TWINT, Apple Pay, Google Pay.
5. **Settings → Branding** : mettez le logo et les couleurs Nuit Noire, la page de paiement les reprend.

Quand tout est validé, refaites les points 2 et 3 en **mode live** et remplacez les deux clés.

### 2.2 Jeton GitHub

Le webhook a besoin d'écrire dans le dépôt pour mettre le stock à jour.

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Repository access** : « Only select repositories » → `thibaudps/nuitnoiretattoo` **uniquement**
3. **Permissions → Repository permissions → Contents : Read and write**. Rien d'autre.
4. Expiration : mettez-vous un rappel avant la date, sinon le stock cessera de se mettre à jour un jour sans prévenir.
5. Copiez le jeton `github_pat_...`

### 2.3 Variables d'environnement Cloudflare

Cloudflare Pages → votre projet → **Settings → Environment variables → Production**.
Cochez **Encrypt** sur les trois premières.

| Nom | Type | Valeur |
|---|---|---|
| `STRIPE_SECRET_KEY` | Secret | `sk_test_...` puis `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Secret | `whsec_...` |
| `GITHUB_TOKEN` | Secret | `github_pat_...` |
| `GITHUB_REPO` | Text | `thibaudps/nuitnoiretattoo` |
| `RESEND_API_KEY` | Secret | `re_...`, pour l'email de commande |
| `ORDER_EMAIL_TO` | Text | `info@nuitnoiretattoo.com` (optionnel, c'est la valeur par défaut) |
| `ORDER_EMAIL_FROM` | Text | `Boutique Nuit Noire <commandes@send.nuitnoiretattoo.com>` (optionnel) |

`GITHUB_BRANCH` est inutile, le code utilise `main` par défaut. `SITE_URL` aussi : le code détecte le domaine sur lequel tourne le visiteur, ce qui rendra la migration vers `.com` transparente.

Si `RESEND_API_KEY` est absente, aucun email n'est envoyé et tout le reste continue de fonctionner normalement.

**Un redéploiement est indispensable après toute modification de variable** : Deployments → menu ⋯ du dernier déploiement → Retry deployment. Sans cela la variable n'est pas lue.

---

## 3. Au quotidien, dans le CMS

### Ajouter un produit — onglet 🛍 Produits

| Champ | À savoir |
|---|---|
| **Prix (CHF)** | Chiffres uniquement : `45`, `39.90`. Plus de `"45 CHF"` en texte. |
| **Photos** | Jusqu'à 3. La première est celle de la grille du shop, les suivantes se feuillettent avec les flèches. Au-delà de 3, les vignettes sont grisées dans le CMS et ignorées par le site. |
| **Vendable en ligne** | Coché = bouton « Ajouter au panier ». Décoché = produit vitrine, le visiteur passe par le bloc « Commander ». |
| **Visible sur le site** | Décoché = le produit disparaît complètement de la boutique. |
| **Tailles et stock par taille** | Pour les tee-shirts. Une entrée par taille : XS, S, M, L, XL. |
| **Stock (produit sans taille)** | Pour les casquettes, prints, accessoires. **Ignoré** si la liste des tailles est remplie. |

Un produit dont tout le stock est à zéro affiche automatiquement un bandeau **SOLD OUT** en diagonale sur sa photo, et son bouton d'achat disparaît. Vous n'avez rien à décocher.

Le bandeau est crème sur fond sombre, comme le reste du site. Pour le passer en rouge, ajoutez ces deux lignes dans le `:root` en haut de `css/main.css` :

```css
--nn-ribbon-bg: #b3392b;
--nn-ribbon-fg: #f4efe4;
```

### Ce que voit le client sur la fiche

- **Plusieurs photos** : petites flèches sur les côtés, points indicateurs en bas, et glissement du doigt sur mobile.
- **Clic ou tap sur la photo** : ouverture en plein écran, photo entière et sans recadrage. Fermeture par Échap, par le bouton, ou en cliquant à côté. Flèches du clavier pour naviguer.
- **Ajout au panier** : un court message apparaît en bas de l'écran (« T-shirt NN (M) ajouté au panier ») et s'efface au bout de deux secondes.

### Changer les frais de port — onglet 🚚 Livraison

Formule appliquée : **tarif de base + supplément × (nombre d'articles − 1)**.
Trois tee-shirts vers la France avec base 12 et supplément 2 → 12 + 2 × 2 = **16 CHF**.

Un pays ne doit figurer que dans **une seule zone**. Un pays absent de toutes les zones n'est pas proposé au client : c'est ainsi que vous décidez où vous expédiez.

Côté panier, le menu déroulant ne montre pas les zones. Il affiche d'abord les six destinations principales (Suisse, France, Allemagne, Italie, Royaume-Uni, États-Unis), puis un séparateur, puis tous les autres pays livrables par ordre alphabétique. Les zones restent invisibles pour le client : elles ne servent qu'au calcul.

Le champ « Port offert à partir de » est prêt mais laissé vide. Remplissez-le pour offrir la livraison au-dessus d'un montant.

### Suivre les ventes

Trois endroits, du plus pratique au plus brut :

- **Stripe → Payments** : le détail de chaque commande, articles avec leur taille, adresse de livraison, téléphone. C'est ce que vous lisez pour préparer un colis.
- **Le CMS** : le stock restant, à jour après chaque vente.
- **L'historique Git** : un commit par commande, avec le récapitulatif dans le message.

---

## 4. Points de vigilance

**Délai d'affichage.** Après une vente, le site met environ une minute à afficher le nouveau stock (le temps du redéploiement). Ce n'est qu'un affichage : la vérification au moment du paiement lit toujours l'état réel, donc personne ne peut acheter un article épuisé à cause de ce délai.

**Survente.** Le stock est vérifié à la création du paiement, pas pendant. Si deux personnes paient le dernier XL dans la même minute, le stock plancherait à zéro et vous auriez une commande de trop. C'est rare, et vous le verrez dans les logs Cloudflare (`Anomalies de stock sur cs_...`). Vous remboursez ou proposez une autre taille.

**Édition simultanée.** Si vous modifiez une fiche produit dans Decap au moment exact où une vente tombe, votre sauvegarde peut écraser la décrémentation. Rare, et corrigeable à la main.

**Quota de builds.** Le plan gratuit Cloudflare Pages autorise 500 builds par mois. Chaque vente en consomme un, chaque modification dans le CMS aussi. Cela laisse largement de la marge, mais c'est la limite à surveiller en cas de gros drop.

**Douane.** Chaque colis hors de Suisse a besoin d'une déclaration CN22, et le destinataire paie la TVA à l'import. Le texte affiché sur la page panier vient du champ « Avertissement douane » de l'onglet Livraison.

---

## 5. Tester avant d'ouvrir

En mode test Stripe, la carte `4242 4242 4242 4242` (n'importe quelle date future, n'importe quel CVC) simule un paiement réussi.

À vérifier :

1. Commande d'un seul produit sans taille.
2. Commande de plusieurs produits dont un avec taille, et contrôle que le port suit la formule.
3. Un pays de chaque zone.
4. Un produit mis à 1 en stock, acheté, puis vérification qu'il passe en « Épuisé » et que le CMS affiche bien 0.
5. Une taille épuisée : elle doit être grisée dans le menu déroulant.
6. Dans Stripe, **Developers → Webhooks → votre endpoint → Resend** sur un événement déjà traité : le stock ne doit **pas** rebaisser une deuxième fois.

Quand tout passe, basculez les clés en live et faites une vraie commande à 1 CHF que vous rembourserez.

---

## 6. L'email de commande

À chaque paiement encaissé, un email part vers `info@nuitnoiretattoo.com` avec tout ce qu'il faut pour préparer le colis, sans avoir à ouvrir Stripe :

- la référence de commande, la même que celle affichée au client sur la page de remerciement
- le contenu du colis : chaque article avec sa taille et sa quantité
- le sous-total, les frais de port et le total encaissé
- l'adresse de livraison en bloc, prête à recopier sur l'étiquette, pays en toutes lettres
- le nom, l'email et le téléphone du client
- pour une commande hors de Suisse, un rappel automatique de la déclaration CN22 et de la TVA à l'import
- en cas d'anomalie de stock, un encadré rouge indiquant quoi corriger dans le CMS

**Répondre à cet email écrit directement au client** : le champ de réponse pointe sur son adresse.

### Garanties

L'envoi passe par Resend, dont le plan gratuit couvre 3 000 emails par mois et 100 par jour.

Le point important : **un échec d'email ne peut jamais casser la décrémentation du stock**. L'envoi a lieu après la mise à jour du stock et il est enfermé dans un garde-fou. Si Resend est indisponible, le webhook répond quand même 200 à Stripe, le stock reste correct, et l'échec est journalisé dans les logs Cloudflare. C'est volontaire : répondre en erreur pousserait Stripe à rejouer l'événement, et le stock risquerait d'être décrémenté deux fois pour un simple problème de boîte mail.

Conséquence à connaître : dans ce cas rare, vous n'êtes pas prévenu par email. La commande reste évidemment visible dans Stripe. Pour une sécurité supplémentaire, activez aussi les notifications de paiement natives de Stripe : elles sont gratuites et empruntent un chemin totalement indépendant.

### Configurer Resend

1. Créer un compte sur `resend.com`, plan gratuit.
2. **Add domain** : utiliser un **sous-domaine d'envoi**, par exemple `send.nuitnoiretattoo.com`, et surtout pas le domaine racine. Resend demande un enregistrement MX, et le poser sur la racine casserait la réception de `info@nuitnoiretattoo.com`.
3. Ajouter les enregistrements DNS fournis (MX, SPF, DKIM) chez le gestionnaire DNS de `nuitnoiretattoo.com`, puis attendre la vérification.
4. **API Keys** → créer une clé avec la permission d'envoi uniquement, la copier.
5. Renseigner `RESEND_API_KEY`, `ORDER_EMAIL_TO` et `ORDER_EMAIL_FROM` dans Cloudflare, puis relancer un déploiement.

Pour un premier essai sans toucher au DNS, Resend fournit l'expéditeur `onboarding@resend.dev`, qui ne peut écrire qu'à l'adresse du titulaire du compte. Suffisant pour valider la chaîne, à remplacer ensuite par votre domaine.

## 7. Fichiers concernés

| Fichier | Rôle |
|---|---|
| `functions/api/checkout.js` | Vérifie le panier, calcule le montant réel, crée la session Stripe |
| `functions/api/stripe-webhook.js` | Décrémente le stock après paiement encaissé |
| `lib/nn-commerce.js` | Code partagé : GitHub, Stripe, frais de port, signature, email de commande |
| `js/cart.js` | Panier dans le navigateur, pastille de la nav |
| `js/panier.js` | Page panier, choix du pays, aperçu du port |
| `js/countries.js` | Noms des pays FR/EN (fichier généré, ne pas éditer) |
| `js/shop.js` | Grille produits, carrousel de photos, vue plein écran |
| `panier.html` / `merci.html` | Les deux nouvelles pages |
| `data/shipping.json` | Grille des frais de port, pilotée par le CMS |
| `_routes.json` | Limite les fonctions serveur à `/api/*` |

`data/products/_index.json` reste généré par `build.js` et n'est pas versionné.
