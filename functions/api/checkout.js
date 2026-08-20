/* ============================================
   NUIT NOIRE TATTOO - functions/api/checkout.js
   POST /api/checkout
   --------------------------------------------
   Recoit un panier depuis le navigateur, le REVERIFIE entierement a la
   source, calcule le montant reel, et cree une session Stripe Checkout.

   Regle de base : rien de ce que le navigateur envoie n'est fait confiance,
   a part le slug, la taille, la quantite et le pays. Les prix et les frais
   de port sont relus dans le depot GitHub a chaque appel. Un panier bricole
   dans la console ne peut donc pas changer le montant facture.

   Entree  : { items: [{ slug, size, qty }], country: "FR", lang: "fr" }
   Sortie  : { url: "https://checkout.stripe.com/..." }
   Erreurs : { error: "stock" | "empty" | "country" | "config" | "server", items? }

   Variables d'environnement attendues (Cloudflare Pages > Settings) :
     STRIPE_SECRET_KEY   sk_test_... puis sk_live_...
     GITHUB_TOKEN        jeton fine-grained, ecriture sur le seul depot
     GITHUB_REPO         thibaudps/nuitnoiretattoo
     GITHUB_BRANCH       main (optionnel)
   ============================================ */

import {
  ghReadJson, safeSlug, productPath, stockFor, hasVariants,
  zoneForCountry, computeShipping, toMinorUnits,
  encodeCart, stripeRequest, json
} from '../../lib/nn-commerce.js';

const MAX_LINES = 20;
const MAX_QTY_PER_LINE = 10;

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY || !env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    console.error('Variables d environnement manquantes pour /api/checkout');
    return json({ error: 'config' }, 500);
  }

  // ---- 1. Lecture et validation de forme -------------------------------
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'bad_request' }, 400);
  }

  const country = String(body && body.country || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return json({ error: 'country' }, 400);

  const lang = (body && body.lang) === 'en' ? 'en' : 'fr';

  const rawItems = Array.isArray(body && body.items) ? body.items : [];
  if (!rawItems.length) return json({ error: 'empty' }, 400);
  if (rawItems.length > MAX_LINES) return json({ error: 'too_many' }, 400);

  // On fusionne les doublons eventuels (meme produit, meme taille) pour ne
  // pas verifier deux fois le meme stock avec deux lignes independantes.
  const merged = new Map();
  for (const item of rawItems) {
    const slug = safeSlug(item && item.slug);
    if (!slug) return json({ error: 'bad_request' }, 400);

    const size = item.size ? String(item.size).slice(0, 20) : null;
    const qty = parseInt(item.qty, 10);
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return json({ error: 'bad_request' }, 400);
    }

    const key = `${slug}|${size || ''}`;
    const existing = merged.get(key);
    if (existing) existing.qty = Math.min(MAX_QTY_PER_LINE, existing.qty + qty);
    else merged.set(key, { slug, size, qty });
  }
  const items = [...merged.values()];

  // ---- 2. Relecture des donnees a la source ----------------------------
  let shipping;
  let products;
  try {
    const results = await Promise.all([
      ghReadJson(env, 'data/shipping.json'),
      ...items.map(i => ghReadJson(env, productPath(i.slug)))
    ]);
    shipping = results[0];
    products = results.slice(1);
  } catch (err) {
    console.error('Lecture GitHub impossible', err);
    return json({ error: 'server' }, 502);
  }

  if (!shipping) {
    console.error('data/shipping.json introuvable');
    return json({ error: 'config' }, 500);
  }

  const zone = zoneForCountry(shipping, country);
  if (!zone) return json({ error: 'country' }, 400);

  const currency = (shipping.currency || 'CHF').toLowerCase();

  // ---- 3. Verification produit par produit -----------------------------
  const problems = [];
  const lineItems = [];
  let subtotal = 0;
  let itemCount = 0;

  items.forEach((item, index) => {
    const product = products[index];

    if (!product || product.sellable === false || product.available === false) {
      problems.push({ slug: item.slug, size: item.size, reason: 'unavailable' });
      return;
    }

    if (typeof product.price !== 'number' || !(product.price > 0)) {
      problems.push({ slug: item.slug, size: item.size, reason: 'no_price' });
      return;
    }

    // Un produit a tailles exige une taille, et l'inverse.
    if (hasVariants(product) && !item.size) {
      problems.push({ slug: item.slug, size: null, reason: 'size_required' });
      return;
    }

    const available = stockFor(product, item.size);
    if (available < item.qty) {
      problems.push({ slug: item.slug, size: item.size, reason: 'stock', available: available });
      return;
    }

    subtotal += product.price * item.qty;
    itemCount += item.qty;

    lineItems.push({
      quantity: item.qty,
      price_data: {
        currency: currency,
        unit_amount: toMinorUnits(product.price),
        product_data: {
          // Le nom inclut la taille : c'est ce que vous lirez dans Stripe
          // au moment de preparer le colis.
          name: item.size ? `${product.name} (${item.size})` : product.name,
          metadata: { slug: item.slug, size: item.size || '' }
        }
      }
    });
  });

  if (problems.length) {
    return json({ error: 'stock', items: problems }, 409);
  }

  // ---- 4. Frais de port ------------------------------------------------
  const shippingAmount = computeShipping(zone, itemCount, subtotal);
  const zoneLabel = (zone.label && (zone.label[lang] || zone.label.fr)) || zone.id;

  const shippingRate = {
    type: 'fixed_amount',
    fixed_amount: { amount: toMinorUnits(shippingAmount), currency: currency },
    display_name: lang === 'en' ? `Shipping - ${zoneLabel}` : `Livraison - ${zoneLabel}`
  };

  if (zone.delivery_min && zone.delivery_max) {
    shippingRate.delivery_estimate = {
      minimum: { unit: 'business_day', value: Number(zone.delivery_min) },
      maximum: { unit: 'business_day', value: Number(zone.delivery_max) }
    };
  }

  // ---- 5. Creation de la session Stripe --------------------------------
  const origin = env.SITE_URL || new URL(request.url).origin;

  const params = {
    mode: 'payment',
    locale: lang,
    success_url: `${origin}/merci?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/panier`,
    line_items: lineItems,
    shipping_options: [{ shipping_rate_data: shippingRate }],

    // On restreint l'adresse au pays choisi sur notre page. Sans cela, le
    // client pourrait selectionner la Suisse chez nous (port a 5.-) puis
    // saisir une adresse australienne sur la page Stripe.
    shipping_address_collection: { allowed_countries: [country] },
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: true },

    metadata: {
      ...encodeCart(items),
      nn_country: country,
      nn_zone: zone.id
    }
  };

  let session;
  try {
    session = await stripeRequest(env, '/checkout/sessions', params);
  } catch (err) {
    console.error('Creation de la session Stripe impossible', err);
    return json({ error: 'server' }, 502);
  }

  return json({ url: session.url, id: session.id });
}

// Seul POST est expose : Cloudflare repond automatiquement 405 sur les
// autres methodes puisqu'aucun handler onRequest generique n'est exporte.
