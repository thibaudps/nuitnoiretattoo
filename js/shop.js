/* ============================================
   NUIT NOIRE TATTOO - shop.js
   Charge data/shop-page.json (en-tete) + data/products/_index.json (produits)
   Bilingue FR/EN via window.NN.
   --------------------------------------------
   Chaque fiche produit peut porter :
     price       nombre, en CHF (une ancienne fiche avec un prix en texte
                 reste affichee, simplement sans bouton d'achat)
     sellable    false pour un produit vitrine (contact direct)
     images      jusqu'a 3 photos {src, focus} -> carrousel + zoom plein ecran
     image       ancien format, une seule photo : toujours lu en secours
     variants[]  { size, stock } pour les textiles
     stock       nombre, pour les produits sans taille

   Le stock affiche ici peut avoir jusqu'a une minute de retard apres une
   vente (le temps du redeploiement). Ce n'est qu'un affichage : la fonction
   /api/checkout relit le stock en direct et refuse toute ligne epuisee.
   ============================================ */

(function () {
  'use strict';

  const T = (window.NN && window.NN.t) ? window.NN.t : (v => (v && v.fr) || v || '');
  const UI = (window.NN && window.NN.ui) ? window.NN.ui : (() => '');

  const MAX_PHOTOS = 3;        // aligne sur le hint du CMS
  const SWIPE_MIN = 40;        // px avant de considerer un glissement

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

  // Photos de la fiche : le champ "images" du CMS, sinon l'ancien champ
  // "image" a photo unique. Trois maximum, comme annonce dans le CMS.
  function photosOf(p) {
    const list = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    if (list.length) return list.slice(0, MAX_PHOTOS);
    return p.image ? [p.image] : [];
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
    bindGalleries();
  }

  function renderProduct(p) {
    const soldOut = isSoldOut(p);
    const by = UI('shop_by') || 'par';

    return `
      <article class="product-card ${soldOut ? 'is-sold-out' : ''}">
        ${renderGallery(p, soldOut)}
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

  // ---- Carrousel de la carte ----
  // Les photos sont posees cote a cote dans une piste que l'on translate.
  // Chaque <img> garde son propre recadrage (--nn-zoom / --nn-origin) pose
  // par NNMedia : c'est pour cela que la translation porte sur la piste et
  // jamais sur les images elles-memes.
  function renderGallery(p, soldOut) {
    const photos = photosOf(p);
    const multiple = photos.length > 1;

    if (!photos.length) {
      return `<div class="product-image no-image">${soldOut ? ribbon() : ''}</div>`;
    }

    const slides = photos.map((photo, i) => {
      const src = window.NNMedia ? window.NNMedia.src(photo) : (photo.src || photo);
      const styleAttr = window.NNMedia ? window.NNMedia.styleAttr(photo) : '';
      return `<div class="product-slide">
          <img src="${escapeHtml(src)}"${styleAttr} alt="${escapeHtml(p.name)}${i ? ' - ' + (i + 1) : ''}" loading="${i ? 'lazy' : 'eager'}" onerror="this.style.display='none'" />
        </div>`;
    }).join('');

    const zoomLabel = escapeHtml(UI('shop_zoom'));

    return `
      <div class="product-image${multiple ? ' has-gallery' : ''}" data-gallery data-index="0" data-count="${photos.length}"
           data-photos="${escapeHtml(JSON.stringify(photos.map(ph => window.NNMedia ? window.NNMedia.src(ph) : (ph.src || ph))))}"
           data-title="${escapeHtml(p.name)}">
        <div class="product-track" style="width:${photos.length * 100}%; transform: translateX(0%)">
          ${slides}
        </div>

        <button type="button" class="product-zoom" data-zoom aria-label="${zoomLabel}" title="${zoomLabel}"></button>

        ${multiple ? `
          <button type="button" class="product-arrow product-arrow-prev" data-slide="-1" aria-label="${escapeHtml(UI('shop_prev_photo'))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
          </button>
          <button type="button" class="product-arrow product-arrow-next" data-slide="1" aria-label="${escapeHtml(UI('shop_next_photo'))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
          </button>
          <div class="product-dots" aria-hidden="true">
            ${photos.map((_, i) => `<span class="product-dot${i === 0 ? ' is-active' : ''}"></span>`).join('')}
          </div>` : ''}

        ${soldOut ? ribbon() : ''}
      </div>
    `;
  }

  function ribbon() {
    return `<span class="product-ribbon">${escapeHtml(UI('shop_sold_out_badge'))}</span>`;
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
        const label = out ? `${v.size} - ${UI('shop_sold_out')}` : v.size;
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
        <button type="button" class="product-add" data-slug="${escapeHtml(slug)}" data-name="${escapeHtml(p.name)}" data-variants="${variants.length ? '1' : '0'}">
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

  // Le slug est le nom du fichier JSON cote CMS, injecte par build.js.
  // Secours pour les fiches generees avant ce changement.
  function productSlug(p) {
    if (p.slug) return p.slug;
    return String(p.name || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ============================================
  // CARROUSEL : fleches, glissement tactile, zoom
  // ============================================
  function bindGalleries() {
    document.querySelectorAll('[data-gallery]').forEach(box => {
      const count = Number(box.dataset.count) || 1;

      box.querySelectorAll('[data-slide]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();   // ne pas declencher le zoom
          go(box, Number(btn.dataset.slide));
        });
      });

      // Zoom plein ecran. Le bouton couvre la photo : il est au-dessus des
      // images mais sous les fleches, pour rester atteignable au clavier.
      const zoom = box.querySelector('[data-zoom]');
      if (zoom) {
        zoom.addEventListener('click', () => {
          // Un glissement du doigt se termine aussi par un clic sur le
          // bouton qui couvre la photo : sans ce garde-fou, feuilleter
          // ouvrirait la vue plein ecran a chaque fois.
          if (Date.now() - (box.__nnSwipedAt || 0) < 500) return;
          openLightbox(readPhotos(box), Number(box.dataset.index) || 0, box.dataset.title || '');
        });
      }

      if (count > 1) {
        attachSwipe(box, dir => go(box, dir));
        // Etat initial des fleches : sans cet appel, "precedente" resterait
        // active sur la premiere photo jusqu'a la premiere navigation.
        setIndex(box, Number(box.dataset.index) || 0);
      }
    });
  }

  function readPhotos(box) {
    try { return JSON.parse(box.dataset.photos) || []; } catch (e) { return []; }
  }

  // Deplacement d'une photo. Pas de boucle infinie : on s'arrete aux bords,
  // ce qui rend l'etat des fleches lisible.
  function go(box, delta) {
    const count = Number(box.dataset.count) || 1;
    let index = (Number(box.dataset.index) || 0) + delta;
    index = Math.max(0, Math.min(count - 1, index));
    setIndex(box, index);
  }

  function setIndex(box, index) {
    const count = Number(box.dataset.count) || 1;
    box.dataset.index = String(index);

    const track = box.querySelector('.product-track');
    if (track) track.style.transform = `translateX(-${index * (100 / count)}%)`;

    box.querySelectorAll('.product-dot').forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
    });

    const prev = box.querySelector('.product-arrow-prev');
    const next = box.querySelector('.product-arrow-next');
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === count - 1;
  }

  // Glissement du doigt. On ne bloque le defilement vertical de la page que
  // si le mouvement est clairement horizontal, sinon on gene le scroll.
  function attachSwipe(el, onSwipe) {
    let x0 = null, y0 = null, locked = false;

    el.addEventListener('touchstart', e => {
      const t = e.changedTouches[0];
      x0 = t.clientX; y0 = t.clientY; locked = false;
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      if (x0 === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (!locked && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) locked = true;
      if (locked && e.cancelable) e.preventDefault();
    }, { passive: false });

    el.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
        el.__nnSwipedAt = Date.now();
        onSwipe(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  // ============================================
  // ZOOM PLEIN ECRAN
  // --------------------------------------------
  // Une seule fenetre pour toute la page, creee au premier usage. La photo y
  // est affichee entiere (object-fit: contain) et SANS le recadrage du CMS :
  // le but est justement de voir l'article en entier.
  // ============================================
  let lightbox = null;
  let lbPhotos = [];
  let lbIndex = 0;
  let lastFocus = null;

  function buildLightbox() {
    const el = document.createElement('div');
    el.className = 'nn-lightbox';
    el.id = 'nn-lightbox';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <button type="button" class="nn-lightbox-close" data-lb="close" aria-label="${escapeHtml(UI('close'))}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <button type="button" class="nn-lightbox-arrow nn-lightbox-prev" data-lb="-1" aria-label="${escapeHtml(UI('shop_prev_photo'))}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <figure class="nn-lightbox-frame">
        <img class="nn-lightbox-img" alt="" />
        <figcaption class="nn-lightbox-caption"></figcaption>
      </figure>
      <button type="button" class="nn-lightbox-arrow nn-lightbox-next" data-lb="1" aria-label="${escapeHtml(UI('shop_next_photo'))}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
      </button>
    `;
    document.body.appendChild(el);

    // Clic sur le fond (et pas sur la photo ni les boutons) : on ferme.
    el.addEventListener('click', e => {
      const action = e.target.closest('[data-lb]');
      if (action) {
        const value = action.dataset.lb;
        if (value === 'close') closeLightbox();
        else lbGo(Number(value));
        return;
      }
      if (!e.target.closest('.nn-lightbox-frame')) closeLightbox();
    });

    attachSwipe(el, dir => lbGo(dir));
    return el;
  }

  function openLightbox(photos, index, title) {
    if (!photos.length) return;
    if (!lightbox) lightbox = buildLightbox();

    lbPhotos = photos;
    lbIndex = Math.max(0, Math.min(photos.length - 1, index || 0));
    lightbox.querySelector('.nn-lightbox-caption').textContent = title || '';
    lightbox.classList.toggle('is-single', photos.length < 2);
    lbRender();

    lastFocus = document.activeElement;
    lightbox.hidden = false;
    // Double rAF : l'element doit etre peint avant d'animer l'ouverture.
    requestAnimationFrame(() => requestAnimationFrame(() => lightbox.classList.add('is-open')));
    document.body.classList.add('nn-noscroll');
    lightbox.querySelector('.nn-lightbox-close').focus();
    document.addEventListener('keydown', onLightboxKey);
  }

  function lbRender() {
    const img = lightbox.querySelector('.nn-lightbox-img');
    img.src = lbPhotos[lbIndex];
    lightbox.querySelector('.nn-lightbox-prev').disabled = lbIndex === 0;
    lightbox.querySelector('.nn-lightbox-next').disabled = lbIndex === lbPhotos.length - 1;
  }

  function lbGo(delta) {
    const next = lbIndex + delta;
    if (next < 0 || next >= lbPhotos.length) return;
    lbIndex = next;
    lbRender();
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.classList.remove('is-open');
    document.body.classList.remove('nn-noscroll');
    document.removeEventListener('keydown', onLightboxKey);
    setTimeout(() => { lightbox.hidden = true; }, 240);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onLightboxKey(e) {
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') lbGo(-1);
    else if (e.key === 'ArrowRight') lbGo(1);
  }

  // ============================================
  // AJOUT AU PANIER
  // ============================================
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

        // Deux retours d'action : le bouton confirme sur place, et le
        // message flottant confirme globalement (le bouton peut etre hors
        // de vue apres un scroll).
        if (window.NNToast) {
          const name = btn.dataset.name || '';
          window.NNToast.show(
            ok ? (UI('toast_added') || '').replace('{item}', name + (size ? ' (' + size + ')' : ''))
               : UI('shop_cart_full'),
            ok ? 'success' : 'warn'
          );
        }

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
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('DOMContentLoaded', loadPage);
})();
