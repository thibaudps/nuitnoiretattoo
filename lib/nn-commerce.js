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

// ============================================
// EMAIL DE COMMANDE (Resend)
// --------------------------------------------
// Envoye a l'equipe des qu'un paiement est encaisse, pour preparer le colis
// sans avoir a ouvrir Stripe. Contient les articles avec leurs tailles et
// l'adresse de livraison, prete a recopier sur l'etiquette.
//
// Regle absolue : un echec d'email ne doit JAMAIS faire echouer le webhook.
// Le stock a deja ete decremente quand on arrive ici ; si l'envoi rate, on
// journalise et on repond quand meme 200 a Stripe. Sinon Stripe rejouerait
// l'evenement et on risquerait de decrementer deux fois pour un simple
// probleme de boite mail.
//
// Variables d'environnement :
//   RESEND_API_KEY    obligatoire, sinon l'envoi est simplement ignore
//   ORDER_EMAIL_TO    destinataire, defaut info@nuitnoiretattoo.com
//   ORDER_EMAIL_FROM  expediteur, doit etre sur un domaine verifie chez Resend
// ============================================

const DEFAULT_TO = 'info@nuitnoiretattoo.com';
const DEFAULT_FROM = 'Boutique Nuit Noire <commandes@nuitnoiretattoo.com>';

export function orderReference(sessionId) {
  return 'NN-' + String(sessionId || '').slice(-8).toUpperCase();
}

// L'adresse a change de place dans l'API Stripe : depuis la version Basil
// (2025-03-31), shipping_details a ete deplace sous collected_information.
// On lit le nouvel emplacement en priorite, l'ancien en secours, pour que le
// code survive a un changement de version du webhook dans un sens ou l'autre.
export function shippingFrom(session) {
  const collected = session.collected_information && session.collected_information.shipping_details;
  return collected || session.shipping_details || null;
}

function amount(minor, currency) {
  const value = (Number(minor) || 0) / 100;
  return value.toFixed(2) + ' ' + String(currency || 'chf').toUpperCase();
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Adresse mise en forme sur plusieurs lignes, prete a recopier telle quelle
// sur une etiquette d'envoi.
// Nom de pays en toutes lettres pour l'etiquette d'envoi. Intl est
// disponible dans le runtime Cloudflare, mais on retombe sur le code ISO
// si jamais il ne l'etait pas : mieux vaut "CH" qu'une case vide.
function countryName(code) {
  if (!code) return '';
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) || code;
  } catch (e) {
    return code;
  }
}

function addressLines(shipping, fallbackName) {
  if (!shipping || !shipping.address) return [];
  const a = shipping.address;
  return [
    shipping.name || fallbackName,
    a.line1,
    a.line2,
    [a.postal_code, a.city].filter(Boolean).join(' '),
    a.state,
    countryName(a.country)
  ].filter(Boolean);
}

export function buildOrderEmail(session, items, warnings) {
  const currency = session.currency || 'chf';
  const shipping = shippingFrom(session);
  const customer = session.customer_details || {};
  const reference = orderReference(session.id);
  const country = (session.metadata && session.metadata.nn_country) || '';
  const address = addressLines(shipping, customer.name);

  const shippingCost = session.shipping_cost ? session.shipping_cost.amount_total
    : (session.total_details ? session.total_details.amount_shipping : 0);

  const rows = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e6e1d6;">
        <strong style="font-size:15px;">${esc(item.name)}</strong>
        ${item.size ? `<br><span style="font-size:13px;color:#6b6558;">Taille ${esc(item.size)}</span>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #e6e1d6;text-align:center;font-size:15px;white-space:nowrap;">
        <strong>x ${item.qty}</strong>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #e6e1d6;text-align:right;font-size:14px;white-space:nowrap;">
        ${esc(amount(item.unitPrice * 100 * item.qty, currency))}
      </td>
    </tr>`).join('');

  const totalPieces = items.reduce((sum, i) => sum + i.qty, 0);

  const customsBlock = country && country !== 'CH' ? `
    <p style="margin:18px 0 0;padding:12px 14px;background:#fdf6e3;border-left:3px solid #c9a227;font-size:13px;line-height:1.6;color:#5c4d1f;">
      <strong>Envoi hors de Suisse.</strong> Déclaration douanière CN22 à joindre au colis.
      La TVA à l'import est à la charge du destinataire.
    </p>` : '';

  const warningBlock = warnings && warnings.length ? `
    <p style="margin:18px 0 0;padding:12px 14px;background:#fdeaea;border-left:3px solid #b3392b;font-size:13px;line-height:1.6;color:#7a2419;">
      <strong>Anomalie de stock détectée, à vérifier dans le CMS :</strong><br>
      ${warnings.map(w => esc(w)).join('<br>')}
    </p>` : '';

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f4f1e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1a15;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e6e1d6;">

    <div style="padding:22px 28px;background:#0a120d;color:#e8e2d4;">
      <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.7;">Nuit Noire Tattoo</div>
      <div style="font-size:22px;margin-top:6px;">Nouvelle commande</div>
    </div>

    <div style="padding:24px 28px;">

      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#6b6558;">
        <tr>
          <td style="padding-bottom:4px;">Référence</td>
          <td style="padding-bottom:4px;text-align:right;color:#1c1a15;"><strong>${esc(reference)}</strong></td>
        </tr>
        <tr>
          <td>Articles à expédier</td>
          <td style="text-align:right;color:#1c1a15;"><strong>${totalPieces}</strong></td>
        </tr>
      </table>

      <h2 style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b6558;margin:26px 0 4px;font-weight:600;">Contenu du colis</h2>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>

      <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:14px;">
        <tr>
          <td style="padding:3px 0;color:#6b6558;">Sous-total</td>
          <td style="padding:3px 0;text-align:right;">${esc(amount(session.amount_subtotal, currency))}</td>
        </tr>
        <tr>
          <td style="padding:3px 0;color:#6b6558;">Frais de port</td>
          <td style="padding:3px 0;text-align:right;">${esc(amount(shippingCost, currency))}</td>
        </tr>
        <tr>
          <td style="padding:10px 0 0;border-top:1px solid #1c1a15;font-size:16px;"><strong>Total encaissé</strong></td>
          <td style="padding:10px 0 0;border-top:1px solid #1c1a15;text-align:right;font-size:16px;"><strong>${esc(amount(session.amount_total, currency))}</strong></td>
        </tr>
      </table>

      <h2 style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b6558;margin:30px 0 8px;font-weight:600;">Adresse de livraison</h2>
      <div style="padding:16px 18px;background:#f4f1e8;font-size:15px;line-height:1.7;">
        ${address.length ? address.map(l => esc(l)).join('<br>') : '<em style="color:#b3392b;">Aucune adresse transmise, à vérifier dans Stripe</em>'}
      </div>

      <h2 style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b6558;margin:26px 0 8px;font-weight:600;">Client</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.7;">
        <tr><td style="width:70px;color:#6b6558;">Nom</td><td>${esc(customer.name || '-')}</td></tr>
        <tr><td style="color:#6b6558;">Email</td><td><a href="mailto:${esc(customer.email)}" style="color:#1c1a15;">${esc(customer.email || '-')}</a></td></tr>
        <tr><td style="color:#6b6558;">Téléphone</td><td>${esc(customer.phone || '-')}</td></tr>
      </table>

      ${customsBlock}
      ${warningBlock}

      <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#8a8478;">
        Le stock a été mis à jour automatiquement dans le CMS.
        Répondez à cet email pour écrire directement au client.
      </p>

    </div>
  </div>
</body></html>`;

  const subject = `Nouvelle commande ${amount(session.amount_total, currency)} - ${customer.name || 'client'}`;

  return { subject, html, replyTo: customer.email || null };
}

export async function sendOrderEmail(env, session, items, warnings) {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY absente : email de commande non envoye');
    return { sent: false, reason: 'no_key' };
  }

  const { subject, html, replyTo } = buildOrderEmail(session, items, warnings);

  const payload = {
    from: env.ORDER_EMAIL_FROM || DEFAULT_FROM,
    to: [env.ORDER_EMAIL_TO || DEFAULT_TO],
    subject: subject,
    html: html
  };
  // Repondre a l'email ecrit directement au client, sans le rechercher.
  if (replyTo) payload.reply_to = replyTo;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${await response.text()}`);
  }
  return { sent: true, id: (await response.json()).id };
}
