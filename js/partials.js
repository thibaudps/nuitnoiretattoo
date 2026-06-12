/* ============================================
   NUIT NOIRE TATTOO - partials.js
   Injecte nav + footer + bouton contact (FAB) sur toutes les pages.
   Footer et FAB sont ensuite enrichis avec settings.json.
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
        <li><a href="faq.html" class="nav-link" data-page="faq">FAQ</a></li>
        <li><a href="contact.html" class="nav-link" data-page="contact">Contact</a></li>
      </ul>
    </nav>
  `;

  const FOOTER_HTML = `
    <footer class="footer">
      <p class="footer-line">
        <span class="footer-pair"><a href="tel:+41223411882" id="footer-phone" class="footer-strong">+41 (0)22 341 18 82</a><span class="footer-sep" aria-hidden="true">|</span><span id="footer-hours">lun - sam : 10h30 - 17h30</span></span>
        <span class="footer-sep footer-sep-mid" aria-hidden="true">|</span>
        <span class="footer-pair"><span id="footer-hours-note">dim : fermé</span><span class="footer-sep" aria-hidden="true">|</span><a href="mailto:info@nuitnoiretattoo.com" id="footer-email">info@nuitnoiretattoo.com</a></span>
      </p>

      <p class="footer-line">
        <span class="footer-strong footer-name">Nuit Noire Tattoo</span>
        <span class="footer-sep footer-name" aria-hidden="true">|</span>
        <span id="footer-address">Ch. des Coquelicots, 7 - 1214 Vernier - Switzerland.</span>
      </p>

      <a href="https://thibaudpages.com" target="_blank" rel="noopener" class="footer-credit">Designed by Thibaud Pagès</a>
    </footer>
  `;

  const FAB_HTML = `
    <div class="fab" id="fab">
      <div class="fab-hours-popover" id="fab-hours-popover" hidden>
        <p class="fab-status" id="fab-status" hidden><span class="fab-status-dot" aria-hidden="true"></span><span id="fab-status-text"></span></p>
        <p id="fab-hours-text">lun - sam : 10h30 - 17h30<br>dim : fermé</p>
      </div>

      <div class="fab-actions">
        <a class="fab-action" id="fab-instagram" href="https://instagram.com/nuitnoiretattoo" target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none"/></svg>
        </a>
        <a class="fab-action" id="fab-mail" href="mailto:info@nuitnoiretattoo.com" aria-label="Envoyer un email">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 7l9 6 9-6"/></svg>
        </a>
        <a class="fab-action" id="fab-phone" href="tel:+41223411882" aria-label="Appeler le shop">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>
        </a>
        <a class="fab-action" href="contact.html#map" aria-label="Voir le plan d'accès">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
        </a>
        <button type="button" class="fab-action" id="fab-hours-btn" aria-label="Voir les horaires" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
        </button>
      </div>

      <button type="button" class="fab-toggle" id="fab-toggle" aria-expanded="false" aria-label="Contact rapide">
        <svg class="fab-icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 7l9 6 9-6"/></svg>
        <svg class="fab-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
  `;

  function injectPartials() {
    const navMount = document.getElementById('nav-mount');
    if (navMount) navMount.outerHTML = NAV_HTML;

    const footerMount = document.getElementById('footer-mount');
    if (footerMount) footerMount.outerHTML = FOOTER_HTML;

    // Bouton contact flottant, présent sur toutes les pages
    document.body.insertAdjacentHTML('beforeend', FAB_HTML);
    initFab();

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

    // Réglages du footer et du bouton contact
    try {
      const response = await fetch('data/settings.json');
      const settings = await response.json();
      populateFooter(settings);
      populateFab(settings);
    } catch (err) {
      console.warn('Impossible de charger les réglages', err);
    }
  }

  function populateArtistsDropdown(artists) {
    const dropdown = document.getElementById('artists-dropdown');
    if (!dropdown) return;

    const sorted = artists.sort((a, b) => (a.order || 999) - (b.order || 999));
    const items = sorted.map(a => `
      <li><a href="artists.html#${a.id}"${a.guest ? ' class="is-guest"' : ''}>${escapeHtml(a.name)}</a></li>
    `).join('');

    dropdown.innerHTML = items + `
      <li class="nav-dropdown-separator"><a href="artists.html">→ Voir tous</a></li>
    `;

    // Une fois le dropdown rempli, on active la logique d'ouverture / fermeture
    initDropdownBehavior();
  }

  function initDropdownBehavior() {
    const trigger = document.getElementById('artists-trigger');
    const dropdown = document.getElementById('artists-dropdown');
    if (!trigger || !dropdown) return;

    const CLOSE_DELAY = 250; // ms avant fermeture après que la souris quitte
    let closeTimer = null;

    function open() {
      clearTimeout(closeTimer);
      trigger.classList.add('is-open');
    }

    function scheduleClose() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        trigger.classList.remove('is-open');
      }, CLOSE_DELAY);
    }

    // Le trigger ouvre au survol
    trigger.addEventListener('mouseenter', open);
    trigger.addEventListener('mouseleave', scheduleClose);

    // Le dropdown reste ouvert tant qu'on est dessus
    dropdown.addEventListener('mouseenter', open);
    dropdown.addEventListener('mouseleave', scheduleClose);

    // Gestion tactile : premier tap ouvre, deuxième suit le lien
    let isTouch = false;
    window.addEventListener('touchstart', () => { isTouch = true; }, { once: true });

    const triggerLink = trigger.querySelector('.nav-link');
    if (triggerLink) {
      triggerLink.addEventListener('click', (e) => {
        if (isTouch && !trigger.classList.contains('is-open')) {
          e.preventDefault();
          open();
        }
      });
    }

    // Fermer si on clique en dehors (utile sur mobile et après tap)
    document.addEventListener('click', (e) => {
      if (!trigger.contains(e.target)) {
        trigger.classList.remove('is-open');
      }
    });
  }

  // ============================================
  // FOOTER
  // ============================================
  function populateFooter(settings) {
    const textMap = {
      'footer-phone': settings.footer_phone,
      'footer-hours': settings.footer_hours,
      'footer-hours-note': settings.footer_hours_note,
      'footer-email': settings.footer_email,
      'footer-address': settings.footer_address
    };
    Object.keys(textMap).forEach(id => {
      const el = document.getElementById(id);
      if (el && textMap[id]) el.textContent = textMap[id];
    });

    const phoneLink = document.getElementById('footer-phone');
    if (phoneLink && settings.footer_phone) phoneLink.href = 'tel:' + telHref(settings.footer_phone);

    const emailLink = document.getElementById('footer-email');
    if (emailLink && settings.footer_email) emailLink.href = 'mailto:' + settings.footer_email;
  }

  // ============================================
  // FAB - bouton contact flottant
  // ============================================
  let fabSettings = null;

  function populateFab(settings) {
    fabSettings = settings;

    const mail = document.getElementById('fab-mail');
    if (mail && settings.footer_email) mail.href = 'mailto:' + settings.footer_email;

    const insta = document.getElementById('fab-instagram');
    if (insta && settings.instagram_url) insta.href = settings.instagram_url;

    const phone = document.getElementById('fab-phone');
    if (phone && settings.footer_phone) phone.href = 'tel:' + telHref(settings.footer_phone);

    const hoursText = document.getElementById('fab-hours-text');
    if (hoursText && (settings.footer_hours || settings.footer_hours_note)) {
      hoursText.innerHTML = [settings.footer_hours, settings.footer_hours_note]
        .filter(Boolean)
        .map(escapeHtml)
        .join('<br>');
    }
  }

  // Badge Open/Closed calculé sur l'heure actuelle à Vernier (Europe/Zurich)
  function updateFabStatus() {
    const wrap = document.getElementById('fab-status');
    if (!wrap) return;

    const s = fabSettings;
    if (!s || !s.open_from || !s.open_until || !Array.isArray(s.open_days) || s.open_days.length === 0) {
      wrap.hidden = true;
      return;
    }

    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Zurich',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(new Date());

      const get = type => (parts.find(p => p.type === type) || {}).value;
      const dayMap = { Sun: '0', Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6' };
      const day = dayMap[get('weekday')];
      const nowMin = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);

      const toMin = str => {
        const bits = String(str).split(':');
        return parseInt(bits[0], 10) * 60 + (parseInt(bits[1], 10) || 0);
      };

      const isOpen = s.open_days.map(String).includes(day)
        && nowMin >= toMin(s.open_from)
        && nowMin < toMin(s.open_until);

      wrap.hidden = false;
      wrap.classList.toggle('is-open-now', isOpen);
      wrap.classList.toggle('is-closed-now', !isOpen);
      const txt = document.getElementById('fab-status-text');
      if (txt) txt.textContent = isOpen ? 'Open' : 'Closed';
    } catch (err) {
      wrap.hidden = true;
    }
  }

  function initFab() {
    const fab = document.getElementById('fab');
    const toggle = document.getElementById('fab-toggle');
    const hoursBtn = document.getElementById('fab-hours-btn');
    const popover = document.getElementById('fab-hours-popover');
    if (!fab || !toggle) return;

    function hidePopover() {
      if (popover) popover.hidden = true;
      if (hoursBtn) hoursBtn.setAttribute('aria-expanded', 'false');
    }

    function closeFab() {
      fab.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      hidePopover();
    }

    toggle.addEventListener('click', () => {
      const isOpen = fab.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        updateFabStatus();
      } else {
        hidePopover();
      }
    });

    if (hoursBtn && popover) {
      hoursBtn.addEventListener('click', () => {
        popover.hidden = !popover.hidden;
        hoursBtn.setAttribute('aria-expanded', String(!popover.hidden));
        if (!popover.hidden) updateFabStatus();
      });
    }

    // Fermer si on clique en dehors ou avec Échap
    document.addEventListener('click', (e) => {
      if (!fab.contains(e.target)) closeFab();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeFab();
    });
  }

  // Convertit "+41 (0)22 341 18 82" en "+41223411882" pour le lien tel:
  function telHref(phone) {
    return String(phone).replace(/\(0\)/g, '').replace(/[^+\d]/g, '');
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
