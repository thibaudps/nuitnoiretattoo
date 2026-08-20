/* ============================================
   NUIT NOIRE TATTOO - lib/nn-commerce.js
   Code partage entre les deux fonctions Cloudflare :
     functions/api/checkout.js        creation de la session Stripe
     functions/api/stripe-webhook.js  decrementation du stock apres paiement

   Ce fichier est place hors de functions/ pour ne pas etre pris pour une
   route par le routeur de Cloudflare Pages. Il ne contient aucun secret :
   les cles vivent uniquement dans les variables d'environnement.
   ============================================ */

// ============================================
// GITHUB
// --------------------------------------------
// Le stock est stocke dans les fichiers data/products/*.json du depot.
// On les lit TOUJOURS via l'API GitHub et jamais depuis le site publie :
// le site a jusqu'a une minute de retard apres une vente (temps du
// redeploiement), alors que l'API renvoie l'etat reel a la seconde.
// ============================================

const GH_API = 'https://api.github.com';

function ghHeaders(env) {
  return {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'nuitnoiretattoo-shop'
  };
}

export async function ghFetch(env, path, init) {
  const response = await fetch(`${GH_API}/repos/${env.GITHUB_REPO}${path}`, {
    ...init,
    headers: { ...ghHeaders(env), ...((init && init.headers) || {}) }
  });
  return response;
}

// Lit un fichier du depot. Renvoie null si absent (404), ce qui permet de
// distinguer "produit inconnu" d'une vraie panne reseau.
export async function ghReadJson(env, path) {
  const branch = env.GITHUB_BRANCH || 'main';
  const response = await ghFetch(env, `/contents/${path}?ref=${encodeURIComponent(branch)}`, {
    headers: { 'Accept': 'application/vnd.github.raw' },
    cf: { cacheTtl: 0, cacheEverything: false }
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub ${response.status} sur ${path}: ${await response.text()}`);
  }
  return JSON.parse(await response.text());
}

// ============================================
// COMMIT UNIQUE POUR PLUSIEURS FICHIERS
// --------------------------------------------
// Une commande peut toucher trois fiches produit. Passer par l'API Contents
// ferait trois commits, donc trois redeploiements Cloudflare, et le plan
// gratuit est plafonne a 500 builds par mois. On construit donc un arbre Git
// complet et on ne pousse qu'un seul commit.
//
// La mise a jour de la reference est un compare-and-swap : si quelqu'un
// (le CMS, un autre paiement) a pousse entre notre lecture et notre ecriture,
// GitHub refuse le fast-forward et l'appelant relit tout puis recommence.
// C'est ce qui empeche deux ventes simultanees de s'ecraser l'une l'autre.
// ============================================
export async function ghCommitFiles(env, files, message) {
  const branch = env.GITHUB_BRANCH || 'main';

  const refRes = await ghFetch(env, `/git/ref/heads/${branch}`);
  if (!refRes.ok) throw new Error(`Lecture de la ref impossible: ${refRes.status}`);
  const baseSha = (await refRes.json()).object.sha;

  const commitRes = await ghFetch(env, `/git/commits/${baseSha}`);
  if (!commitRes.ok) throw new Error(`Lecture du commit impossible: ${commitRes.status}`);
  const baseTree = (await commitRes.json()).tree.sha;

  const blobs = [];
  for (const file of files) {
    const blobRes = await ghFetch(env, '/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: file.content, encoding: 'utf-8' })
    });
    if (!blobRes.ok) throw new Error(`Creation du blob impossible: ${blobRes.status}`);
    blobs.push({ path: file.path, mode: '100644', type: 'blob', sha: (await blobRes.json()).sha });
  }

  const treeRes = await ghFetch(env, '/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTree, tree: blobs })
  });
  if (!treeRes.ok) throw new Error(`Creation de l'arbre impossible: ${treeRes.status}`);
  const newTree = (await treeRes.json()).sha;

  const newCommitRes = await ghFetch(env, '/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree, parents: [baseSha] })
  });
  if (!newCommitRes.ok) throw new Error(`Creation du commit impossible: ${newCommitRes.status}`);
  const newCommit = (await newCommitRes.json()).sha;

  // force: false -> GitHub refuse si la branche a bouge entre-temps.
  const patchRes = await ghFetch(env, `/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommit, force: false })
  });

  if (patchRes.status === 422) return { ok: false, conflict: true };
  if (!patchRes.ok) throw new Error(`Mise a jour de la ref impossible: ${patchRes.status}`);
  return { ok: true, sha: newCommit };
}

// Un evenement Stripe peut arriver plusieurs fois (rejeu, retry apres
// timeout). L'identifiant de session est inscrit dans le message de commit :
// s'il est deja present dans l'historique recent, la vente a deja ete
// comptee et on ne touche a rien.
export async function alreadyProcessed(env, sessionId) {
  const branch = env.GITHUB_BRANCH || 'main';
  const response = await ghFetch(env, `/commits?sha=${encodeURIComponent(branch)}&per_page=60`);
  if (!response.ok) return false;   // dans le doute on laisse passer, un stock negatif se corrige
  const commits = await response.json();
  return commits.some(c => c.commit && c.commit.message && c.commit.message.includes(sessionId));
}

// ============================================
// PRODUITS
// ============================================

// Un slug vient du navigateur : il sert a construire un chemin de fichier.
// On n'accepte donc que des minuscules, chiffres et tirets, ce qui rend
// toute remontee de repertoire ("../../") impossible.
export function safeSlug(value) {
  const slug = String(value || '').trim();
  return /^[a-z0-9][a-z0-9-]{0,80}$/.test(slug) ? slug : null;
}

export function productPath(slug) {
  return `data/products/${slug}.json`;
}

// Un produit a des tailles des lors que sa liste "variants" n'est pas vide.
// Pas de drapeau separe a maintenir : la liste seule fait foi, cote CMS
// comme cote code.
export function hasVariants(product) {
  return Array.isArray(product.variants) && product.variants.some(v => v && v.size);
}

export function stockFor(product, size) {
  if (hasVariants(product)) {
    const variant = product.variants.find(v => v && v.size === size);
    return variant ? (Number(variant.stock) || 0) : 0;
  }
  return Number(product.stock) || 0;
}

// Renvoie une copie du produit avec le stock diminue. Ne descend jamais
// sous zero : si une survente a eu lieu, on encaisse quand meme et on
// journalise, plutot que d'ecrire un nombre negatif dans le CMS.
export function decrementStock(product, size, qty) {
  const next = JSON.parse(JSON.stringify(product));
  let applied = 0;

  if (hasVariants(next)) {
    const variant = next.variants.find(v => v && v.size === size);
    if (!variant) return { product: next, applied: 0, missing: true };
    const before = Number(variant.stock) || 0;
    variant.stock = Math.max(0, before - qty);
    applied = before - variant.stock;
  } else {
    const before = Number(next.stock) || 0;
    next.stock = Math.max(0, before - qty);
    applied = before - next.stock;
  }

  return { product: next, applied: applied, missing: false, short: applied < qty };
}

// ============================================
// FRAIS DE PORT
// --------------------------------------------
// Formule : base + supplement x (nombre total d'articles - 1).
// Doit rester identique a celle de js/panier.js, qui n'en fait qu'un apercu.
// ============================================
export function zoneForCountry(shipping, country) {
  if (!shipping || !Array.isArray(shipping.zones)) return null;
  return shipping.zones.find(z => Array.isArray(z.countries) && z.countries.indexOf(country) !== -1) || null;
}

export function computeShipping(zone, itemCount, subtotal) {
  if (!zone || itemCount <= 0) return 0;
  if (zone.free_from != null && subtotal >= Number(zone.free_from)) return 0;
  const base = Number(zone.base) || 0;
  const extra = Number(zone.extra_item) || 0;
  return base + extra * (itemCount - 1);
}

// ============================================
// MONNAIE
// --------------------------------------------
// Stripe raisonne en plus petite unite (centimes). On arrondit une seule
// fois, au moment de convertir, pour eviter les derives de virgule
// flottante sur les additions.
// ============================================
export function toMinorUnits(amount) {
  return Math.round(Number(amount) * 100);
}

// ============================================
// PANIER ENCODE DANS LES METADONNEES STRIPE
// --------------------------------------------
// Stripe limite chaque valeur de metadonnee a 500 caracteres. On serialise
// le panier en "slug~taille~quantite;..." et on decoupe en tranches
// cart0, cart1... que le webhook recolle.
// ============================================
const META_CHUNK = 450;

export function encodeCart(lines) {
  const payload = lines
    .map(l => `${l.slug}~${l.size || ''}~${l.qty}`)
    .join(';');

  const chunks = {};
  for (let i = 0; i * META_CHUNK < payload.length; i++) {
    chunks[`cart${i}`] = payload.slice(i * META_CHUNK, (i + 1) * META_CHUNK);
  }
  return chunks;
}

export function decodeCart(metadata) {
  let payload = '';
  for (let i = 0; metadata[`cart${i}`] !== undefined; i++) {
    payload += metadata[`cart${i}`];
  }
  if (!payload) return [];

  return payload.split(';').filter(Boolean).map(entry => {
    const [slug, size, qty] = entry.split('~');
    return { slug: slug, size: size || null, qty: parseInt(qty, 10) || 0 };
  }).filter(l => l.slug && l.qty > 0);
}

// ============================================
// APPEL A L'API STRIPE
// --------------------------------------------
// On utilise fetch et l'encodage formulaire plutot que le SDK Stripe :
// aucune dependance npm a installer, aucun bundle a maintenir, et le
// runtime Cloudflare reste leger.
// ============================================
export function toForm(obj, prefix, out) {
  out = out || new URLSearchParams();
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined || value === null) continue;
    const field = prefix ? `${prefix}[${key}]` : key;

    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') toForm(item, `${field}[${i}]`, out);
        else out.append(`${field}[${i}]`, String(item));
      });
    } else if (typeof value === 'object') {
      toForm(value, field, out);
    } else {
      out.append(field, String(value));
    }
  }
  return out;
}

export async function stripeRequest(env, path, params) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-06-20'
    },
    body: toForm(params).toString()
  });

  const data = await response.json();
  if (!response.ok) {
    const message = (data && data.error && data.error.message) || `HTTP ${response.status}`;
    throw new Error(`Stripe: ${message}`);
  }
  return data;
}

// ============================================
// VERIFICATION DE LA SIGNATURE DU WEBHOOK
// --------------------------------------------
// Sans cette verification, n'importe qui pourrait appeler notre URL de
// webhook et vider le stock. On recalcule le HMAC SHA-256 de
// "timestamp.corps" avec le secret du webhook et on compare en temps
// constant, puis on rejette les evenements trop anciens (rejeu).
// ============================================
export async function verifyStripeSignature(payload, header, secret, toleranceSeconds) {
  if (!header || !secret) return false;

  const parts = {};
  header.split(',').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key === 'v1') (parts.v1 = parts.v1 || []).push(value);
    else parts[key] = value;
  });

  if (!parts.t || !parts.v1 || !parts.v1.length) return false;

  const age = Math.floor(Date.now() / 1000) - parseInt(parts.t, 10);
  if (!Number.isFinite(age) || Math.abs(age) > (toleranceSeconds || 300)) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${parts.t}.${payload}`)
  );
  const expected = [...new Uint8Array(signature)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return parts.v1.some(candidate => timingSafeEqual(candidate, expected));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ============================================
// REPONSES JSON
// ============================================
export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
