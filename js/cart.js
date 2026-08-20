/* ============================================
   NUIT NOIRE TATTOO - cart.js
   Panier partage entre la page shop et la page panier.
   --------------------------------------------
   Le panier vit UNIQUEMENT dans le navigateur du visiteur (localStorage).
   Rien n'est enregistre cote serveur, aucun stock n'est reserve : tant que
   le paiement n'est pas encaisse, les quantites du CMS ne bougent pas.

   On ne stocke QUE { slug, size, qty }. Ni le nom, ni le prix, ni l'image :
   un panier peut dormir des semaines dans un navigateur, et on veut que la
   page panier reaffiche toujours les donnees fraiches du catalogue plutot
   qu'un prix perime. C'est aussi la raison pour laquelle le serveur ignore
   tout ce que le navigateur lui envoie a part le slug, la taille et la
   quantite (voir functions/api/checkout.js).

   API : window.NNCart
     get()                  -> [{ slug, size, qty }]
     add(slug, size, qty)   -> ajoute (cumule si la ligne existe deja)
     setQty(slug, size, qty)-> fixe la quantite (0 = supprime la ligne)
     remove(slug, size)     -> supprime la ligne
     clear()                -> vide le panier
     count()                -> nombre total d'articles
     onChange(cb)           -> callback a chaque modification
   ============================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'nn-cart-v1';
  const MAX_LINES = 20;   // garde-fou, aligne sur la limite du serveur
  const MAX_QTY = 10;     // par ligne

  const listeners = [];

  function read() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return []; }
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // On revalide a la lecture : un localStorage peut avoir ete bricole
      // a la main, ou venir d'une ancienne version du site.
      return parsed
        .filter(l => l && typeof l.slug === 'string' && l.slug)
        .map(l => ({
          slug: String(l.slug),
          size: l.size ? String(l.size) : null,
          qty: clampQty(l.qty)
        }))
        .filter(l => l.qty > 0)
        .slice(0, MAX_LINES);
    } catch (e) {
      return [];
    }
  }

  function write(lines) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); } catch (e) { /* mode prive */ }
    notify(lines);
  }

  function clampQty(n) {
    const q = parseInt(n, 10);
    if (!Number.isFinite(q) || q < 0) return 0;
    return Math.min(q, MAX_QTY);
  }

  function sameLine(a, slug, size) {
    return a.slug === slug && (a.size || null) === (size || null);
  }

  function notify(lines) {
    updateBadge(lines);
    listeners.forEach(cb => {
      try { cb(lines); } catch (e) { console.error(e); }
    });
  }

  // ============================================
  // API publique
  // ============================================
  const NNCart = {
    get: read,

    count: function () {
      return read().reduce((sum, l) => sum + l.qty, 0);
    },

    add: function (slug, size, qty) {
      const lines = read();
      const want = clampQty(qty == null ? 1 : qty) || 1;
      const existing = lines.find(l => sameLine(l, slug, size));
      if (existing) {
        existing.qty = clampQty(existing.qty + want);
      } else {
        if (lines.length >= MAX_LINES) return false;
        lines.push({ slug: String(slug), size: size || null, qty: want });
      }
      write(lines);
      return true;
    },

    setQty: function (slug, size, qty) {
      let lines = read();
      const q = clampQty(qty);
      if (q === 0) {
        lines = lines.filter(l => !sameLine(l, slug, size));
      } else {
        const existing = lines.find(l => sameLine(l, slug, size));
        if (existing) existing.qty = q;
      }
      write(lines);
    },

    remove: function (slug, size) {
      write(read().filter(l => !sameLine(l, slug, size)));
    },

    clear: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      notify([]);
    },

    onChange: function (cb) {
      if (typeof cb === 'function') listeners.push(cb);
    },

    // Format monetaire unique du site. La devise vient de data/shipping.json,
    // mais on garde CHF en secours pour que rien ne s'affiche vide.
    format: function (amount, currency) {
      const cur = currency || 'CHF';
      const n = Number(amount) || 0;
      const lang = (window.NN && window.NN.lang) === 'en' ? 'en-CH' : 'fr-CH';
      try {
        return new Intl.NumberFormat(lang, {
          style: 'currency',
          currency: cur,
          minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
          maximumFractionDigits: 2
        }).format(n);
      } catch (e) {
        return n + ' ' + cur;
      }
    }
  };

  // ============================================
  // PASTILLE DU PANIER DANS LA NAV
  // --------------------------------------------
  // Le lien est injecte par partials.js, qui peut arriver apres ce fichier :
  // on rafraichit donc la pastille au chargement ET a chaque modification,
  // et partials.js rappelle refreshBadge() une fois la nav en place.
  // ============================================
  function updateBadge(lines) {
    // Deux exemplaires du lien panier coexistent : celui de la barre de menu
    // (desktop) et celui pose a cote du bouton MENU (mobile). On les met a
    // jour tous les deux, l'affichage se fait en CSS selon la largeur.
    const badges = document.querySelectorAll('.nav-cart-count');
    if (!badges.length) return;
    const total = (lines || read()).reduce((sum, l) => sum + l.qty, 0);

    badges.forEach(badge => {
      badge.textContent = total > 9 ? '9+' : String(total);
      badge.hidden = total === 0;
    });
    document.querySelectorAll('.nav-cart').forEach(link => {
      link.classList.toggle('has-items', total > 0);
    });
  }

  NNCart.refreshBadge = function () { updateBadge(null); };

  // Un autre onglet a modifie le panier : on se resynchronise.
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) notify(read());
  });

  window.NNCart = NNCart;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', NNCart.refreshBadge);
  } else {
    NNCart.refreshBadge();
  }
})();
