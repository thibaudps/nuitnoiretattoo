/* ============================================
   NUIT NOIRE TATTOO - panier.js
   Page panier : recapitulatif, pays de livraison, apercu des frais de port,
   puis redirection vers Stripe Checkout.
   --------------------------------------------
   Tous les montants affiches ici sont indicatifs. Le navigateur n'envoie au
   serveur que { slug, size, qty } et le code pays : la fonction
   /api/checkout relit les prix et la grille de port a la source et refait
   tous les calculs. Un total bricole dans la console n'a donc aucun effet.
   ============================================ */

(function () {
  'use strict';

  const T = (window.NN && window.NN.t) ? window.NN.t : (v => (v && v.fr) || v || '');
  const UI = (window.NN && window.NN.ui) ? window.NN.ui : (() => '');
  const COUNTRY_KEY = 'nn-ship-country';

  let catalogue = [];        // fiches produits fraiches
  let shipping = null;       // data/shipping.json
  let currency = 'CHF';
  let notices = [];          // lignes ajustees automatiquement (prix, stock, retrait)

  // ============================================
  // CHARGEMENT
  // ============================================
  async function init() {
    if (window.NN && window.NN.ready) {
      try { await window.NN.ready; } catch (e) { /* on continue */ }
    }

    try {
      const [prodRes, shipRes] = await Promise.all([
        fetch('data/products/_index.json', { cache: 'no-cache' }),
        fetch('data/shipping.json', { cache: 'no-cache' })
      ]);
      catalogue = (await prodRes.json()).items || [];
      shipping = await shipRes.json();
      if (shipping && shipping.currency) currency = shipping.currency;
    } catch (err) {
      console.error('Chargement du panier impossible', err);
      showFatal(UI('cart_load_error'));
      return;
    }

    buildCountrySelect();
    reconcile();
    render();

    const select = document.getElementById('cart-country');
    if (select) select.addEventListener('change', () => {
      try { localStorage.setItem(COUNTRY_KEY, select.value); } catch (e) { /* ignore */ }
      render();
    });

    const payBtn = document.getElementById('cart-pay');
    if (payBtn) payBtn.addEventListener('click', checkout);

    if (window.NNCart) window.NNCart.onChange(() => { reconcile(); render(); });
  }

  // ============================================
  // RECONCILIATION AVEC LE CATALOGUE
  // --------------------------------------------
  // Un panier peut dormir des semaines dans un navigateur. Entre-temps un
  // produit a pu disparaitre, changer de prix, ou tomber en rupture. Plutot
  // que de laisser le serveur refuser la commande au dernier moment, on
  // corrige ici et on explique ce qui a change.
  // ============================================
  function reconcile() {
    if (!window.NNCart) return;
    notices = [];

    window.NNCart.get().forEach(line => {
      const product = findProduct(line.slug);

      if (!product || product.sellable === false || product.available === false
          || typeof product.price !== 'number') {
        notices.push({ type: 'removed', name: product ? product.name : line.slug });
        window.NNCart.remove(line.slug, line.size);
        return;
      }

      const available = stockFor(product, line.size);

      if (available <= 0) {
        notices.push({ type: 'removed', name: product.name, size: line.size });
        window.NNCart.remove(line.slug, line.size);
        return;
      }

      if (line.qty > available) {
        notices.push({ type: 'reduced', name: product.name, size: line.size, qty: available });
        window.NNCart.setQty(line.slug, line.size, available);
      }
    });
  }

  function findProduct(slug) {
    return catalogue.find(p => slugOf(p) === slug) || null;
  }

  function slugOf(p) {
    if (p.slug) return p.slug;
    return String(p.name || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function stockFor(product, size) {
    if (Array.isArray(product.variants) && product.variants.some(v => v && v.size)) {
      const v = product.variants.find(x => x && x.size === size);
      return v ? (Number(v.stock) || 0) : 0;
    }
    return Number(product.stock) || 0;
  }

  // ============================================
  // PAYS ET FRAIS DE PORT
  // ============================================
  function buildCountrySelect() {
    const select = document.getElementById('cart-country');
    if (!select || !shipping || !Array.isArray(shipping.zones)) return;

    const names = window.NNCountries || {};
    const lang = (window.NN && window.NN.lang) === 'en' ? 'en' : 'fr';

    const groups = shipping.zones.map(zone => {
      const options = (zone.countries || [])
        .filter(code => names[code])
        .map(code => ({ code: code, label: names[code][lang] || names[code].fr }))
        .sort((a, b) => a.label.localeCompare(b.label, lang));

      if (!options.length) return '';
      return `<optgroup label="${escapeHtml(T(zone.label))}">`
        + options.map(o => `<option value="${o.code}">${escapeHtml(o.label)}</option>`).join('')
        + `</optgroup>`;
    }).join('');

    select.innerHTML = `<option value="">${escapeHtml(UI('cart_choose_country'))}</option>` + groups;

    // On se souvient du dernier pays choisi, c'est presque toujours le meme.
    let saved = null;
    try { saved = localStorage.getItem(COUNTRY_KEY); } catch (e) { /* ignore */ }
    if (saved && select.querySelector(`option[value="${CSS.escape(saved)}"]`)) {
      select.value = saved;
    }
  }

  function zoneFor(code) {
    if (!code || !shipping || !Array.isArray(shipping.zones)) return null;
    return shipping.zones.find(z => (z.countries || []).indexOf(code) !== -1) || null;
  }

  // Formule : base + supplement x (nombre total d'articles - 1).
  // Doit rester identique a celle de functions/api/checkout.js.
  function shippingCost(zone, itemCount, subtotal) {
    if (!zone || itemCount <= 0) return 0;
    if (zone.free_from != null && subtotal >= Number(zone.free_from)) return 0;
    const base = Number(zone.base) || 0;
    const extra = Number(zone.extra_item) || 0;
    return base + extra * (itemCount - 1);
  }

  // ============================================
  // RENDU
  // ============================================
  function render() {
    const lines = window.NNCart ? window.NNCart.get() : [];
    const empty = document.getElementById('cart-empty');
    const content = document.getElementById('cart-content');

    renderNotices();

    if (!lines.length) {
      if (empty) empty.hidden = false;
      if (content) content.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (content) content.hidden = false;

    const body = document.getElementById('cart-lines');
    if (body) body.innerHTML = lines.map(renderLine).join('');
    bindLineControls();

    const itemCount = lines.reduce((s, l) => s + l.qty, 0);
    const subtotal = lines.reduce((s, l) => {
      const p = findProduct(l.slug);
      return s + (p ? p.price * l.qty : 0);
    }, 0);

    const select = document.getElementById('cart-country');
    const country = select ? select.value : '';
    const zone = zoneFor(country);
    const ship = shippingCost(zone, itemCount, subtotal);

    setText('cart-subtotal', money(subtotal));

    const shipRow = document.getElementById('cart-shipping-row');
    const shipValue = document.getElementById('cart-shipping');
    const totalRow = document.getElementById('cart-total-row');

    if (!zone) {
      if (shipValue) shipValue.textContent = UI('cart_shipping_pending');
      if (shipRow) shipRow.classList.add('is-pending');
      if (totalRow) totalRow.hidden = true;
    } else {
      if (shipValue) shipValue.textContent = ship === 0 ? UI('cart_shipping_free') : money(ship);
      if (shipRow) shipRow.classList.remove('is-pending');
      if (totalRow) totalRow.hidden = false;
      setText('cart-total', money(subtotal + ship));
    }

    // Delai indicatif et avertissement douane
    const delay = document.getElementById('cart-delay');
    if (delay) {
      if (zone && zone.delivery_min && zone.delivery_max) {
        delay.textContent = (UI('cart_delivery_estimate') || '')
          .replace('{min}', zone.delivery_min)
          .replace('{max}', zone.delivery_max);
        delay.hidden = false;
      } else {
        delay.hidden = true;
      }
    }

    const customs = document.getElementById('cart-customs');
    if (customs) {
      const outsideCH = zone && zone.id !== 'ch';
      const text = shipping && shipping.customs_notice ? T(shipping.customs_notice) : '';
      customs.textContent = text;
      customs.hidden = !(outsideCH && text);
    }

    const payBtn = document.getElementById('cart-pay');
    if (payBtn) payBtn.disabled = !zone;

    const hint = document.getElementById('cart-pay-hint');
    if (hint) hint.hidden = !!zone;
  }

  function renderLine(line) {
    const p = findProduct(line.slug);
    if (!p) return '';
    const max = stockFor(p, line.size);
    const media = window.NNMedia && window.NNMedia.src(p.image);
    const key = escapeHtml(line.slug) + '|' + escapeHtml(line.size || '');

    return `
      <li class="cart-line">
        <div class="cart-line-media">
          ${media ? `<img src="${media}"${window.NNMedia.styleAttr(p.image)} alt="" loading="lazy" />` : ''}
        </div>

        <div class="cart-line-info">
          <p class="cart-line-name">${escapeHtml(p.name)}</p>
          ${line.size ? `<p class="cart-line-size">${escapeHtml(UI('shop_size'))} ${escapeHtml(line.size)}</p>` : ''}
          <p class="cart-line-unit">${escapeHtml(money(p.price))}</p>
        </div>

        <div class="cart-line-qty">
          <button type="button" class="cart-qty-btn" data-action="dec" data-key="${key}" aria-label="-">&minus;</button>
          <span class="cart-qty-value">${line.qty}</span>
          <button type="button" class="cart-qty-btn" data-action="inc" data-key="${key}" ${line.qty >= max ? 'disabled' : ''} aria-label="+">+</button>
        </div>

        <p class="cart-line-total">${escapeHtml(money(p.price * line.qty))}</p>

        <button type="button" class="cart-line-remove" data-action="remove" data-key="${key}" aria-label="${escapeHtml(UI('cart_remove'))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </li>
    `;
  }

  function bindLineControls() {
    document.querySelectorAll('[data-action]').forEach(btn => {
      if (!btn.dataset.key) return;
      btn.addEventListener('click', () => {
        const parts = btn.dataset.key.split('|');
        const slug = parts[0];
        const size = parts[1] || null;
        const action = btn.dataset.action;
        if (!window.NNCart) return;

        const line = window.NNCart.get().find(l => l.slug === slug && (l.size || '') === (size || ''));
        if (!line) return;

        if (action === 'remove') window.NNCart.remove(slug, size);
        if (action === 'dec') window.NNCart.setQty(slug, size, line.qty - 1);
        if (action === 'inc') window.NNCart.setQty(slug, size, line.qty + 1);
      });
    });
  }

  function renderNotices() {
    const box = document.getElementById('cart-notices');
    if (!box) return;
    if (!notices.length) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = notices.map(n => {
      const label = n.name + (n.size ? ' (' + n.size + ')' : '');
      const tpl = n.type === 'removed' ? UI('cart_notice_removed') : UI('cart_notice_reduced');
      return `<p>${escapeHtml((tpl || '').replace('{item}', label).replace('{n}', n.qty))}</p>`;
    }).join('');
  }

  function showFatal(message) {
    const content = document.getElementById('cart-content');
    const empty = document.getElementById('cart-empty');
    if (content) content.hidden = true;
    if (empty) {
      empty.hidden = false;
      empty.innerHTML = `<p class="error-message">${escapeHtml(message)}</p>`;
    }
  }

  // ============================================
  // PASSAGE AU PAIEMENT
  // ============================================
  async function checkout() {
    const btn = document.getElementById('cart-pay');
    const select = document.getElementById('cart-country');
    const errorBox = document.getElementById('cart-error');
    if (!btn || !select || !window.NNCart) return;

    const lines = window.NNCart.get();
    if (!lines.length || !select.value) return;

    if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }
    btn.disabled = true;
    btn.classList.add('is-loading');
    const label = btn.querySelector('.cart-pay-label');
    const originalLabel = label ? label.textContent : '';
    if (label) label.textContent = UI('cart_redirecting');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines,
          country: select.value,
          lang: (window.NN && window.NN.lang) || 'fr'
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.url) {
        // On NE vide PAS le panier ici : le client peut abandonner sur la page
        // Stripe et revenir. Le panier est vide uniquement sur /merci.
        window.location.href = data.url;
        return;
      }

      // Le stock a bouge entre l'affichage et le clic : on resynchronise.
      if (data.error === 'stock' && Array.isArray(data.items)) {
        try {
          const fresh = await (await fetch('data/products/_index.json', { cache: 'reload' })).json();
          catalogue = fresh.items || [];
        } catch (e) { /* on garde le catalogue en memoire */ }
        reconcile();
        render();
        showError(UI('cart_error_stock'));
      } else {
        showError(UI('cart_error_generic'));
      }
    } catch (err) {
      console.error('Checkout impossible', err);
      showError(UI('cart_error_network'));
    }

    btn.disabled = false;
    btn.classList.remove('is-loading');
    if (label) label.textContent = originalLabel;
  }

  function showError(message) {
    const box = document.getElementById('cart-error');
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
  }

  // ============================================
  // UTILITAIRES
  // ============================================
  function money(amount) {
    return window.NNCart ? window.NNCart.format(amount, currency) : amount + ' ' + currency;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
