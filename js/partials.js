/* ============================================
   NUIT NOIRE TATTOO — partials.js
   Injecte nav + footer sur toutes les pages.
   Le footer est ensuite enrichi avec settings.json.
   ============================================ */

(function () {
  'use strict';

  const NAV_HTML = `
    <nav class="nav">
      <a href="index.html" class="nav-logo" aria-label="Accueil Nuit Noire Tattoo">
        <img src="assets/logo-mini-cream.svg" alt="NN" />
      </a>

      <ul class="nav-menu">
        <li><a href="index.html" class="nav-link" data-page="home">Home</a></li>
        <li class="nav-item-dropdown" id="artists-trigger">
          <a href="artists.html" class="nav-link" data-page="artists">
            Artists
            <span class="nav-chevron" aria-hidden="true">▾</span>
          </a>
          <ul class="nav-dropdown" id="artists-dropdown">
            <!-- Remplis dynamiquement depuis _index.json -->
          </ul>
        </li>
        <li><a href="shop.html" class="nav-link" data-page="shop">Shop</a></li>
        <li><a href="contact.html" class="nav-link" data-page="contact">Contact</a></li>
      </ul>
    </nav>
  `;

  const FOOTER_HTML = `
    <footer class="footer">
      <span id="footer-address">Rue de —, Genève</span>
      <a href="#" target="_blank" rel="noopener" id="footer-instagram">Instagram</a>
      <span id="footer-years">Since 2010</span>
    </footer>
  `;

  function injectPartials() {
    const navMount = document.getElementById('nav-mount');
    if (navMount) navMount.outerHTML = NAV_HTML;

    const footerMount = document.getElementById('footer-mount');
    if (footerMount) footerMount.outerHTML = FOOTER_HTML;

    // Marquer le lien actif
    const currentPage = document.body.dataset.page;
    if (currentPage) {
      const activeLink = document.querySelector(`.nav-link[data-page="${currentPage}"]`);
      if (activeLink) activeLink.classList.add('active');
    }

    // Charger les artistes pour le dropdown + les réglages
    loadDynamicData();
  }

  async function loadDynamicData() {
    // Dropdown des artistes
    try {
      const response = await fetch('data/artists/_index.json');
      const data = await response.json();
      populateArtistsDropdown(data.items || []);
    } catch (err) {
      console.warn('Impossible de charger la liste des artistes pour le dropdown', err);
    }

    // Réglages du footer
    try {
      const response = await fetch('data/settings.json');
      const settings = await response.json();
      populateFooter(settings);
    } catch (err) {
      console.warn('Impossible de charger les réglages', err);
    }
  }

  function populateArtistsDropdown(artists) {
    const dropdown = document.getElementById('artists-dropdown');
    if (!dropdown) return;

    const sorted = artists.sort((a, b) => (a.order || 999) - (b.order || 999));
    const items = sorted.map(a => `
      <li><a href="artists.html#${a.id}">${escapeHtml(a.name)}</a></li>
    `).join('');

    dropdown.innerHTML = items + `
      <li class="nav-dropdown-separator"><a href="artists.html">→ Voir tous</a></li>
    `;
  }

  function populateFooter(settings) {
    const address = document.getElementById('footer-address');
    const insta = document.getElementById('footer-instagram');
    const years = document.getElementById('footer-years');

    if (address && settings.footer_address) address.textContent = settings.footer_address;
    if (years && settings.footer_years) years.textContent = settings.footer_years;
    if (insta && settings.instagram_url) insta.href = settings.instagram_url;
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPartials);
  } else {
    injectPartials();
  }
})();
