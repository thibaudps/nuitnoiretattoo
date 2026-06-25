/* ============================================
   NUIT NOIRE TATTOO - shop.js
   Charge data/shop-page.json (en-tête) + data/products/_index.json (produits)
   Bilingue FR/EN via window.NN.
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
  }

  function renderHeader(page) {
    const eyebrow = document.getElementById('page-eyebrow');
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    const orderInfo = document.getElementById('order-info');
    const flashInfo = document.getElementById('flash-info');

    if (eyebrow) eyebrow.textContent = T(page.eyebrow) || '';
    if (title) title.textContent = T(page.title) || 'Shop';
    if (subtitle) subtitle.textContent = T(page.subtitle) || '';
    if (orderInfo) orderInfo.textContent = T(page.order_info) || '';
    if (flashInfo) flashInfo.textContent = T(page.flash_info) || '';
  }

  function renderProducts(products) {
    const grid = document.getElementById('shop-grid');
    const empty = document.getElementById('shop-empty');

    if (products.length === 0) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    grid.innerHTML = products.map(p => renderProduct(p)).join('');
  }

  function renderProduct(p) {
    const soldOut = p.available === false;
    const by = UI('shop_by') || 'par';
    return `
      <article class="product-card ${soldOut ? 'is-sold-out' : ''}">
        <div class="product-image">
          ${p.image
            ? `<img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');" />`
            : ''}
          ${soldOut ? `<span class="product-badge">${escapeHtml(UI('shop_reserved'))}</span>` : ''}
        </div>
        <div class="product-info">
          <p class="product-category">${labelCategory(p.category)}</p>
          <h3 class="product-name">${escapeHtml(p.name)}</h3>
          <p class="product-artist">${escapeHtml(by)} ${escapeHtml(p.artist || '')}</p>
          ${pick(p.description, p.description_en) ? `<p class="product-description">${escapeHtml(pick(p.description, p.description_en))}</p>` : ''}
          <p class="product-price">${escapeHtml(p.price || '')}</p>
        </div>
      </article>
    `;
  }

  function labelCategory(c) {
    const keys = { flash: 'cat_flash', print: 'cat_print', merch: 'cat_merch' };
    const key = keys[c];
    return key ? escapeHtml(UI(key) || c) : escapeHtml(c || '');
  }

  function initFilters() {
    const buttons = document.querySelectorAll('.shop-filter');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const filter = btn.dataset.filter;
        const filtered = filter === 'all'
          ? allProducts
          : allProducts.filter(p => p.category === filter);
        renderProducts(filtered);
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
