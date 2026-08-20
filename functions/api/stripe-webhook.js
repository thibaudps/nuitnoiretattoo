/* ============================================
   NUIT NOIRE TATTOO - functions/api/stripe-webhook.js
   POST /api/stripe-webhook
   --------------------------------------------
   Appele par Stripe une fois le paiement REELLEMENT encaisse. C'est le seul
   endroit du site qui diminue le stock. Un panier abandonne, une carte
   refusee ou un retour en arriere depuis la page Stripe ne passent jamais
   par ici, donc ne touchent a rien.

   Deroule :
     1. verification de la signature Stripe (sans quoi n'importe qui
        pourrait vider le stock en appelant cette URL)
     2. on ne traite que checkout.session.completed effectivement paye
     3. controle d'idempotence : l'identifiant de session est inscrit dans
        le message de commit, on refuse de compter deux fois le meme
     4. lecture des fiches produit, decrementation, et UN SEUL commit pour
        toute la commande (le plan gratuit Cloudflare est limite a 500
        builds par mois, un commit par article les brulerait vite)
     5. en cas de course avec le CMS ou une autre vente, GitHub refuse le
        fast-forward et on recommence, jusqu'a 4 fois

   Toujours repondre 200 quand l'evenement a ete traite. Sur une vraie
   panne on repond 500 : Stripe rejoue alors pendant 3 jours, donc une
   vente ne peut pas etre perdue silencieusement.

   Variables d'environnement :
     STRIPE_WEBHOOK_SECRET  whsec_...
     GITHUB_TOKEN / GITHUB_REPO / GITHUB_BRANCH
   ============================================ */

import {
  ghReadJson, ghCommitFiles, alreadyProcessed,
  productPath, decrementStock, decodeCart,
  verifyStripeSignature, json
} from '../../lib/nn-commerce.js';

const MAX_ATTEMPTS = 4;

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_WEBHOOK_SECRET || !env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    console.error('Variables d environnement manquantes pour le webhook');
    return json({ error: 'config' }, 500);
  }

  // ---- 1. Signature ----------------------------------------------------
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  const valid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET, 300);
  if (!valid) {
    console.warn('Signature Stripe invalide, evenement ignore');
    return json({ error: 'invalid_signature' }, 400);
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch (e) {
    return json({ error: 'bad_payload' }, 400);
  }

  // ---- 2. Filtrage de l'evenement --------------------------------------
  if (event.type !== 'checkout.session.completed') {
    return json({ received: true, ignored: event.type });
  }

  const session = event.data && event.data.object;
  if (!session || session.payment_status !== 'paid') {
    return json({ received: true, ignored: 'unpaid' });
  }

  const lines = decodeCart(session.metadata || {});
  if (!lines.length) {
    console.warn(`Session ${session.id} sans panier dans les metadonnees`);
    return json({ received: true, ignored: 'empty_cart' });
  }

  // ---- 3. Idempotence --------------------------------------------------
  try {
    if (await alreadyProcessed(env, session.id)) {
      return json({ received: true, ignored: 'already_processed' });
    }
  } catch (err) {
    console.error('Controle d idempotence impossible', err);
    // On continue : mieux vaut un risque de double decrementation, qui se
    // corrige dans le CMS, qu'une vente jamais deduite du stock.
  }

  // ---- 4. Decrementation, avec reprise en cas de course ----------------
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let result;
    try {
      result = await applyOrder(env, session, lines);
    } catch (err) {
      console.error(`Tentative ${attempt} en echec pour ${session.id}`, err);
      if (attempt === MAX_ATTEMPTS) return json({ error: 'github' }, 500);
      await sleep(300 * attempt);
      continue;
    }

    if (result.conflict) {
      // Le depot a bouge entre notre lecture et notre ecriture : on relit tout.
      console.warn(`Conflit Git sur ${session.id}, tentative ${attempt}`);
      if (attempt === MAX_ATTEMPTS) return json({ error: 'conflict' }, 500);
      await sleep(400 * attempt);
      continue;
    }

    if (result.warnings.length) {
      // Survente ou taille disparue : la commande est encaissee, le stock
      // est plancher a zero, et la trace reste dans les logs Cloudflare.
      console.error(`Anomalies de stock sur ${session.id}: ${result.warnings.join(' | ')}`);
    }

    return json({ received: true, updated: result.updated, warnings: result.warnings });
  }

  return json({ error: 'exhausted' }, 500);
}

// ============================================
// Applique une commande : lit chaque fiche, decremente, pousse un commit.
// ============================================
async function applyOrder(env, session, lines) {
  const warnings = [];
  const byPath = new Map();   // un seul fichier par produit, meme avec deux tailles

  for (const line of lines) {
    const path = productPath(line.slug);

    let product = byPath.has(path) ? byPath.get(path) : await ghReadJson(env, path);
    if (!product) {
      warnings.push(`produit introuvable: ${line.slug}`);
      continue;
    }

    const outcome = decrementStock(product, line.size, line.qty);
    if (outcome.missing) {
      warnings.push(`taille inconnue: ${line.slug} / ${line.size}`);
      continue;
    }
    if (outcome.short) {
      warnings.push(`survente: ${line.slug}${line.size ? ' / ' + line.size : ''} demande ${line.qty}, deduit ${outcome.applied}`);
    }

    byPath.set(path, outcome.product);
  }

  if (!byPath.size) return { conflict: false, updated: 0, warnings: warnings };

  const files = [...byPath.entries()].map(([path, product]) => ({
    path: path,
    content: JSON.stringify(product, null, 2) + '\n'
  }));

  const commit = await ghCommitFiles(env, files, commitMessage(session, lines));
  if (!commit.ok && commit.conflict) return { conflict: true, updated: 0, warnings: warnings };

  return { conflict: false, updated: files.length, warnings: warnings };
}

// Le message de commit sert a trois choses : lire l'historique des ventes
// dans Git, retrouver une commande, et garantir l'idempotence (il contient
// l'identifiant de session Stripe, recherche au prochain rejeu).
function commitMessage(session, lines) {
  const summary = lines
    .map(l => `${l.qty}x ${l.slug}${l.size ? ' (' + l.size + ')' : ''}`)
    .join(', ');

  const total = session.amount_total != null
    ? ` - ${(session.amount_total / 100).toFixed(2)} ${String(session.currency || '').toUpperCase()}`
    : '';

  return `Vente: ${summary}${total} - ${session.id}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
