/* ============================================
   NUIT NOIRE TATTOO - shop.js
   Charge data/shop-page.json (en-tete) + data/products/_index.json (produits)
   Bilingue FR/EN via window.NN.
   --------------------------------------------
   Depuis l'ajout de la boutique, chaque fiche produit peut porter :
     price       nombre, en CHF (les anciennes fiches ont une chaine : on
                 l'affiche telle quelle mais le produit n'est pas achetable)
     sellable    false pour un produit vitrine (contact direct)
     variants[{ size, stock }]  liste des tailles, vide = produit sans taille
     stock       nombre, pour les produits sans taille
   Le stock affiche ici peut avoir jusqu'a une minute de retard apres une
   vente (le temps du redeploiement). Ce n'est qu'un affichage : la fonction
   /api/checkout relit le stock en direct et refuse toute ligne epuisee.
   ============================================ */

(function () {
  'use strict';

  const T = (window.NN && window.NN.t) ? window.NN.t : (v => (v && v.fr) || v || '');
  const UI = (window.NN && window.NN.ui) ? window.NN.ui : (() => '');

  // Champs a deux variantes (ex. description + description_en) : anglais si dispo
  // et langue = en, sinon francais. Tolere aussi un objet {fr,en}.
  function pick(base, en) {
    if (base && typeof base === 'object') return T(base);
    const lang = window.NN ? window.NN.lang : 'fr';
    if (lang === 'en' && en) return en;
    return base || '';
  }

  let allProducts = [];
  let currency = 'CHF';

  async function loadPage() {
    if (window.NN && window.NN.ready) {
      try { await window.NN.ready; } catch (e) { /* on continue */ }
    }
    try {
      const [pageResponse, indexResponse] = await Promise.all([
        fetch('data/shop-page.json'),
        fetch('data/products/_index.json')
      ]);
      const page = await pageResponse.json();
      const index = await indexResponse.json();

      renderHeader(page);
      allProducts = index.items || [];
      renderProducts(allProducts);
      initFilters();
    } catch (err) {
      console.error('Erreur de chargement de la page shop', err);
      const grid = document.getElementById('shop-grid');
      if (grid) grid.innerHTML = `<p class="error-message">${escapeHtml(UI('err_shop'))}</p>`;
    }

    // La devise sert uniquement a l'affichage ici. Le montant reellement
    // facture est recalcule cote serveur au moment du checkout.
    try {
      const shipping = await (await fetch('data/shipping.json')).json();
      if (shipping && shipping.currency) currency = shipping.currency;
      renderProducts(currentFilterList());
    } catch (e) { /* on garde CHF */ }
  }

  function renderHeader(page) {
    const eyebrow = document.getElementById('page-eyebrow');
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    const orderInfo = document.getElementById('order-info');

    if (eyebrow) eyebrow.textContent = T(page.eyebrow) || '';
    if (title) title.textContent = T(page.title) || 'Shop';
    if (subtitle) subtitle.textContent = T(page.subtitle) || '';
    if (orderInfo) orderInfo.textContent = T(page.order_info) || '';
  }

  // ============================================
  // ETAT D'UN PRODUIT
  // ============================================

  // Un produit est achetable s'il a un prix numerique, n'est pas masque
  // et n'est pas marque "vitrine". Une ancienne fiche avec un prix en
  // texte libre reste affichee, simplement sans bouton d'achat.
  function isBuyable(p) {
    return p.sellable !== false
      && p.available !== false
      && typeof p.price === 'number'
      && p.price > 0;
  }

  // Un produit a des tailles des lors que sa liste "variants" n'est pas vide.
  function variantsOf(p) {
    if (!Array.isArray(p.variants)) return [];
    return p.variants.filter(v => v && v.size);
  }

  function totalStock(p) {
    const variants = variantsOf(p);
    if (variants.length) return variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    return Number(p.stock) || 0;
  }

  function isSoldOut(p) {
    if (p.available === false) return true;
    if (!isBuyable(p)) return false;   // produit vitrine : ni dispo ni epuise
    return totalStock(p) <= 0;
  }

  function priceLabel(p) {
    if (typeof p.price === 'number') {
      return window.NNCart ? window.NNCart.format(p.price, currency) : p.price + ' ' + currency;
    }
    return p.price || '';
  }

  // ============================================
  // RENDU
  // ============================================

  function renderProducts(products) {
    const grid = document.getElementById('shop-grid');
    const empty = document.getElementById('shop-empty');
    if (!grid || !empty) return;

    if (products.length === 0) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    grid.innerHTML = products.map(p => renderProduct(p)).join('');
    bindBuyButtons();
  }

  function renderProduct(p) {
    const soldOut = isSoldOut(p);
    const by = UI('shop_by') || 'par';
    const media = window.NNMedia && window.NNMedia.src(p.image);

    return `
      <article class="product-card ${soldOut ? 'is-sold-out' : ''}">
        <div class="product-image">
          ${media
            ? `<img src="${media}"${window.NNMedia.styleAttr(p.image)} alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');" />`
            : ''}
          ${soldOut ? `<span class="product-badge">${escapeHtml(UI('shop_sold_out'))}</span>` : ''}
        </div>
        <div class="product-info">
          <p class="product-category">${labelCategory(p.category)}</p>
          <h3 class="product-name">${escapeHtml(p.name)}</h3>
          <p class="product-artist">${escapeHtml(by)} ${escapeHtml(p.artist || '')}</p>
          ${pick(p.description, p.description_en) ? `<p class="product-description">${escapeHtml(pick(p.description, p.description_en))}</p>` : ''}
          <p class="product-price">${escapeHtml(priceLabel(p))}</p>
          ${renderBuyControls(p, soldOut)}
        </div>
      </article>
    `;
  }

  function renderBuyControls(p, soldOut) {
    if (!isBuyable(p)) return '';   // produit vitrine : le bloc "Commander" en bas de page prend le relais

    if (soldOut) {
      return `<p class="product-soldout-note">${escapeHtml(UI('shop_sold_out_note'))}</p>`;
    }

    const variants = variantsOf(p);
    const slug = productSlug(p);

    let sizeField = '';
    if (variants.length) {
      const options = variants.map(v => {
        const out = (Number(v.stock) || 0) <= 0;
        const label = out
          ? `${v.size} - ${UI('shop_sold_out')}`
          : v.size;
        return `<option value="${escapeHtml(v.size)}"${out ? ' disabled' : ''}>${escapeHtml(label)}</option>`;
      }).join('');

      sizeField = `
        <label class="product-size">
          <span class="product-size-label">${escapeHtml(UI('shop_size'))}</span>
          <select class="product-size-select" data-slug="${escapeHtml(slug)}" aria-label="${escapeHtml(UI('shop_size'))}">
            ${options}
          </select>
        </label>
      `;
    }

    const low = lowStockNote(p, variants);

    return `
      <div class="product-buy">
        ${sizeField}
        <button type="button" class="product-add" data-slug="${escapeHtml(slug)}" data-variants="${variants.length ? '1' : '0'}">
          <span class="product-add-label">${escapeHtml(UI('shop_add_to_cart'))}</span>
        </button>
        ${low ? `<p class="product-stock-note">${escapeHtml(low)}</p>` : ''}
      </div>
    `;
  }

  // Petit signal de rarete, uniquement sous 4 pieces au total.
  function lowStockNote(p, variants) {
    const total = variants.length
      ? variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)
      : (Number(p.stock) || 0);
    if (total <= 0 || total > 3) return '';
    const tpl = UI('shop_low_stock') || '';
    return tpl.replace('{n}', String(total));
  }

  // Le slug est le nom du fichier JSON cote CMS. Decap ne l'ecrit pas dans le
  // contenu, et build.js ne l'ajoutait pas non plus : il le fait maintenant.
  // Secours pour les fiches generees avant ce changement.
  function productSlug(p) {
    if (p.slug) return p.slug;
    return String(p.name || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function bindBuyButtons() {
    document.querySelectorAll('.product-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const slug = btn.dataset.slug;
        let size = null;

        if (btn.dataset.variants === '1') {
          const select = document.querySelector(`.product-size-select[data-slug="${CSS.escape(slug)}"]`);
          if (!select || !select.value) return;
          if (select.options[select.selectedIndex] && select.options[select.selectedIndex].disabled) return;
          size = select.value;
        }

        if (!window.NNCart) return;
        const ok = window.NNCart.add(slug, size, 1);

        // Retour visuel court : le bouton confirme puis reprend son libelle.
        const label = btn.querySelector('.product-add-label');
        if (!label) return;
        const original = UI('shop_add_to_cart');
        label.textContent = ok ? UI('shop_added') : UI('shop_cart_full');
        btn.classList.add('is-added');
        setTimeout(() => {
          label.textContent = original;
          btn.classList.remove('is-added');
        }, 1400);
      });
    });
  }

  function labelCategory(c) {
    const keys = { print: 'cat_print', merch: 'cat_merch' };
    const key = keys[c];
    return key ? escapeHtml(UI(key) || c) : escapeHtml(c || '');
  }

  // ============================================
  // FILTRES
  // ============================================
  let activeFilter = 'all';

  function currentFilterList() {
    return activeFilter === 'all'
      ? allProducts
      : allProducts.filter(p => p.category === activeFilter);
  }

  function initFilters() {
    const buttons = document.querySelectorAll('.shop-filter');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        activeFilter = btn.dataset.filter;
        renderProducts(currentFilterList());
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('DOMContentLoaded', loadPage);
})();
