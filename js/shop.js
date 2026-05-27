/* ============================================
   NUIT NOIRE TATTOO — shop.js
   Charge data/shop-page.json (en-tête) + data/products/_index.json (produits)
   ============================================ */

(function () {
  'use strict';

  let allProducts = [];

  async function loadPage() {
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
      if (grid) grid.innerHTML = '<p class="error-message">Impossible de charger la boutique pour le moment.</p>';
    }
  }

  function renderHeader(page) {
    const eyebrow = document.getElementById('page-eyebrow');
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    const orderInfo = document.getElementById('order-info');
    const flashInfo = document.getElementById('flash-info');

    if (eyebrow) eyebrow.textContent = page.eyebrow || '';
    if (title) title.textContent = page.title || 'Shop';
    if (subtitle) subtitle.textContent = page.subtitle || '';
    if (orderInfo) orderInfo.textContent = page.order_info || '';
    if (flashInfo) flashInfo.textContent = page.flash_info || '';
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
    return `
      <article class="product-card ${soldOut ? 'is-sold-out' : ''}">
        <div class="product-image">
          ${p.image
            ? `<img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');" />`
            : ''}
          ${soldOut ? '<span class="product-badge">Réservé</span>' : ''}
        </div>
        <div class="product-info">
          <p class="product-category">${labelCategory(p.category)}</p>
          <h3 class="product-name">${escapeHtml(p.name)}</h3>
          <p class="product-artist">par ${escapeHtml(p.artist || '')}</p>
          ${p.description ? `<p class="product-description">${escapeHtml(p.description)}</p>` : ''}
          <p class="product-price">${escapeHtml(p.price || '')}</p>
        </div>
      </article>
    `;
  }

  function labelCategory(c) {
    const labels = { flash: 'Flash', print: 'Tirage', merch: 'Merch' };
    return labels[c] || c;
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
