/* ============================================
   NUIT NOIRE TATTOO - partials.js
   Injecte nav (+ pastille langue) + bandeau d'annonce + footer
   + bouton contact (FAB) sur toutes les pages.
   Footer et FAB sont ensuite enrichis avec settings.json (bilingue via NN.t).
   Le bandeau vient de data/banner.json (switch ON/OFF depuis le CMS).
   ============================================ */

(function () {
  'use strict';

  const NAV_HTML = `
    <nav class="nav">
      <a href="/" class="nav-logo" aria-label="Accueil Nuit Noire Tattoo">
        <img src="assets/logo-mini-cream.svg" alt="NN" />
      </a>

      <button type="button" class="nav-burger" id="nav-burger" aria-expanded="false" aria-controls="nav-menu" aria-label="Menu">MENU</button>

      <ul class="nav-menu" id="nav-menu">
        <li><a href="/" class="nav-link" data-page="home" data-i18n="nav_home">Accueil</a></li>
        <li class="nav-item-dropdown" id="artists-trigger">
          <a href="/artists" class="nav-link" data-page="artists">
            <span data-i18n="nav_artists">Artistes</span>
            <span class="nav-chevron" aria-hidden="true">▾</span>
          </a>
          <ul class="nav-dropdown" id="artists-dropdown">
            <!-- Remplis dynamiquement depuis _index.json -->
          </ul>
        </li>
        <li><a href="/shop" class="nav-link" data-page="shop" data-i18n="nav_shop">Boutique</a></li>
        <li><a href="/faq" class="nav-link" data-page="faq">FAQ</a></li>
        <li><a href="/about" class="nav-link" data-page="about" data-i18n="nav_about">About</a></li>
        <li><a href="/contact" class="nav-link" data-page="contact">Contact</a></li>
        <li class="nav-lang" id="nav-lang">
          <button type="button" class="nav-lang-btn" data-lang="fr" aria-label="Français">FR</button>
          <span class="nav-lang-sep" aria-hidden="true">/</span>
          <button type="button" class="nav-lang-btn" data-lang="en" aria-label="English">EN</button>
        </li>
      </ul>
    </nav>
  `;

  // Bandeau d'annonce : glisse de sous la nav peu apres l'ouverture.
  // Reste masque tant que data/banner.json n'est pas charge (evite tout flash).
  const BANNER_HTML = `
    <div class="nn-banner" id="nn-banner" role="region" aria-label="Annonce" hidden>
      <div class="nn-banner-inner">
        <p class="nn-banner-text" id="nn-banner-text"></p>
        <button type="button" class="nn-banner-close" id="nn-banner-close" aria-label="Fermer l'annonce">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
    </div>
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
        <a class="fab-action" id="fab-instagram" href="https://instagram.com/nuitnoiretattoo" target="_blank" rel="noopener" data-i18n-aria="fab_instagram" aria-label="Instagram">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none"/></svg>
        </a>
        <a class="fab-action" id="fab-mail" href="mailto:info@nuitnoiretattoo.com" data-i18n-aria="fab_mail" aria-label="Envoyer un email">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 7l9 6 9-6"/></svg>
        </a>
        <a class="fab-action" id="fab-phone" href="tel:+41223411882" data-i18n-aria="fab_phone" aria-label="Appeler le shop">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>
        </a>
        <a class="fab-action" href="/contact#map" data-i18n-aria="fab_map" aria-label="Voir le plan d'accès">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
        </a>
        <button type="button" class="fab-action" id="fab-hours-btn" data-i18n-aria="fab_hours" aria-label="Voir les horaires" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
        </button>
      </div>

      <button type="button" class="fab-toggle" id="fab-toggle" data-i18n-aria="fab_toggle" aria-expanded="false" aria-label="Contact rapide">
        <svg class="fab-icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
        <svg class="fab-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
  `;

  function injectPartials() {
    const navMount = document.getElementById('nav-mount');
    if (navMount) navMount.outerHTML = NAV_HTML;

    // Bandeau juste apres la nav (il est en position fixed, mais on garde
    // l'ordre du DOM coherent pour les lecteurs d'ecran).
    const nav = document.querySelector('.nav');
    if (nav) nav.insertAdjacentHTML('afterend', BANNER_HTML);
    else document.body.insertAdjacentHTML('afterbegin', BANNER_HTML);
    initBanner();

    const footerMount = document.getElementById('footer-mount');
    if (footerMount) footerMount.outerHTML = FOOTER_HTML;

    // Bouton contact flottant, présent sur toutes les pages
    document.body.insertAdjacentHTML('beforeend', FAB_HTML);
    initFab();

    // Pastille langue
    initLangToggle();

    // Menu mobile (bouton MENU)
    initBurger();

    // Marquer le lien actif
    const currentPage = document.body.dataset.page;
    if (currentPage) {
      const activeLink = document.querySelector(`.nav-link[data-page="${currentPage}"]`);
      if (activeLink) activeLink.classList.add('active');
    }

    // Charger les artistes pour le dropdown + les réglages
    loadDynamicData();
  }

  // ============================================
  // BANDEAU D'ANNONCE
  // --------------------------------------------
  // Pilote depuis le CMS (data/banner.json) :
  //   enabled : true / false  -> switch ON / OFF
  //   text    : { fr, en }    -> contenu, liens markdown [texte](url) acceptes
  // Le bandeau glisse de sous la nav apres un court delai, et le visiteur
  // peut le fermer. Un nouveau message le fait reapparaitre (signature du texte).
  // ============================================
  const BANNER_DELAY = 1200;              // ms avant l'apparition
  const BANNER_STORAGE_KEY = 'nn-banner-closed';

  function initBanner() {
    syncBannerOffset();
    window.addEventListener('resize', syncBannerOffset);
    window.addEventListener('load', syncBannerOffset);

    // La nav et la sous-nav des artistes changent de hauteur (mobile, et la
    // barre des prenoms est remplie par JS apres coup) : on resuit chaque fois.
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(syncBannerOffset);
      const nav = document.querySelector('.nav');
      const quicknav = document.querySelector('.artists-quicknav');
      if (nav) ro.observe(nav);
      if (quicknav) ro.observe(quicknav);
    }

    // Les polices Google modifient la hauteur des barres en arrivant.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncBannerOffset).catch(() => {});
    }

    const closeBtn = document.getElementById('nn-banner-close');
    if (closeBtn) closeBtn.addEventListener('click', closeBanner);

    // Une fois le glissement termine, on refige les hauteurs (hero, quicknav).
    const el = document.getElementById('nn-banner');
    if (el) el.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'max-height') syncBannerOffset();
    });

    loadBanner();
  }

  // Position du bandeau : juste sous la derniere barre fixe en haut de page.
  //   --nn-nav-h   hauteur reelle de la nav (plus petite en mobile)
  //   --nn-stack-h hauteur de la sous-nav des artistes, 0 sur les autres pages
  //   --nn-banner-h hauteur du bandeau, pour caler la duree d'ouverture
  // Les hauteurs sont gardees en decimales : arrondir laisserait passer un
  // filet d'un demi-pixel entre les barres selon le zoom.
  function syncBannerOffset() {
    const root = document.documentElement.style;

    const nav = document.querySelector('.nav');
    const navH = nav ? nav.getBoundingClientRect().height : 0;
    if (navH > 0) root.setProperty('--nn-nav-h', navH.toFixed(2) + 'px');

    // Sur la page artistes, le bandeau se place sous la barre des prenoms.
    const quicknav = document.querySelector('.artists-quicknav');
    const stackH = quicknav ? quicknav.getBoundingClientRect().height : 0;
    root.setProperty('--nn-stack-h', stackH.toFixed(2) + 'px');

    const inner = document.querySelector('.nn-banner-inner');
    if (inner) {
      const h = inner.getBoundingClientRect().height;
      // +1px : compense le pixel de recouvrement sous la barre du dessus.
      if (h > 0) root.setProperty('--nn-banner-h', (h + 1).toFixed(2) + 'px');
    }
  }

  async function loadBanner() {
    const el = document.getElementById('nn-banner');
    const textEl = document.getElementById('nn-banner-text');
    if (!el || !textEl) return;

    let cfg;
    try {
      const response = await fetch('data/banner.json', { cache: 'no-cache' });
      cfg = await response.json();
    } catch (err) {
      return; // pas de bandeau, le site continue normalement
    }

    if (!cfg || cfg.enabled !== true) return;

    const T = (window.NN && window.NN.t) ? window.NN.t : (v => v);
    const raw = String(T(cfg.text) || '').trim();
    if (!raw) return;

    // Deja ferme par le visiteur pour CE message precis ?
    const sig = signature(raw);
    try {
      if (localStorage.getItem(BANNER_STORAGE_KEY) === sig) return;
    } catch (e) { /* localStorage indispo, on affiche */ }

    el.dataset.sig = sig;
    textEl.innerHTML = renderBannerText(raw);

    el.hidden = false;
    syncBannerOffset();
    // Double rAF : garantit que le navigateur peint l'etat ferme avant d'animer.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setTimeout(() => {
        el.classList.add('is-visible');
        syncBannerOffset();
      }, BANNER_DELAY);
    }));
  }

  function closeBanner() {
    const el = document.getElementById('nn-banner');
    if (!el) return;
    el.classList.remove('is-visible');
    try { localStorage.setItem(BANNER_STORAGE_KEY, el.dataset.sig || '1'); } catch (e) { /* ignore */ }
    setTimeout(() => {
      el.hidden = true;
      syncBannerOffset();
    }, 600);
  }

  // Texte du CMS -> HTML sur, avec liens [libelle](url) et gras **mot**.
  function renderBannerText(raw) {
    let out = escapeHtml(raw);

    out = out.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, function (match, label, url) {
      const href = safeUrl(url);
      if (!href) return label;
      const external = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + href + '"' + external + '>' + label + '</a>';
    });

    out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    return out;
  }

  // N'autorise que les schemas inoffensifs (pas de javascript:).
  function safeUrl(url) {
    const s = String(url).trim();
    if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
    if (/^[/#]/.test(s)) return s;
    return null;
  }

  // Petite empreinte du texte : si le message change, le bandeau
  // reapparait meme chez les visiteurs qui avaient ferme l'ancien.
  function signature(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return String(hash);
  }

  // ============================================
  // PASTILLE LANGUE FR / EN
  // ============================================
  function initLangToggle() {
    const wrap = document.getElementById('nav-lang');
    if (!wrap || !window.NN) return;

    wrap.querySelectorAll('.nav-lang-btn').forEach(btn => {
      const lang = btn.dataset.lang;
      btn.classList.toggle('is-active', lang === window.NN.lang);
      btn.addEventListener('click', () => window.NN.setLang(lang));
    });
  }

  // ============================================
  // MENU MOBILE (bouton MENU -> panneau deroulant)
  // ============================================
  function initBurger() {
    const nav = document.querySelector('.nav');
    const burger = document.getElementById('nav-burger');
    const menu = document.getElementById('nav-menu');
    if (!nav || !burger || !menu) return;

    function close() {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }

    burger.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });

    // Un tap sur un lien du panneau referme le menu (la navigation suit).
    // On ignore les boutons de langue (ils rechargent deja la page).
    menu.querySelectorAll('a.nav-link').forEach(link => {
      link.addEventListener('click', close);
    });

    // Fermer si on tape en dehors de la nav.
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('is-open') && !nav.contains(e.target)) close();
    });

    // Fermer avec Echap.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    // Repasser en desktop reinitialise l'etat.
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) close();
    });
  }

  async function loadDynamicData() {
    if (window.NN && window.NN.ready) {
      try { await window.NN.ready; } catch (e) { /* on continue */ }
    }

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

    // Traduire les libellés statiques injectés (nav, fab...)
    if (window.NN && window.NN.applyStatic) window.NN.applyStatic(document);
  }

  function populateArtistsDropdown(artists) {
    const dropdown = document.getElementById('artists-dropdown');
    if (!dropdown) return;

    const viewAll = (window.NN && window.NN.ui) ? window.NN.ui('nav_view_all') : '→ Voir tous';

    const sorted = artists.sort((a, b) => (a.order || 999) - (b.order || 999));
    const items = sorted.map(a => `
      <li><a href="/artists#${a.id}"${a.guest ? ' class="is-guest"' : ''}>${escapeHtml(a.name)}</a></li>
    `).join('');

    dropdown.innerHTML = items + `
      <li class="nav-dropdown-separator"><a href="/artists">${escapeHtml(viewAll)}</a></li>
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
        // Sur mobile, le sous-menu est masqué : le lien navigue directement
        // vers la page artistes, pas de tap d'ouverture intermédiaire.
        if (window.matchMedia('(max-width: 768px)').matches) return;
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
    const T = (window.NN && window.NN.t) ? window.NN.t : (v => v);

    const textMap = {
      'footer-phone': settings.footer_phone,
      'footer-hours': T(settings.footer_hours),
      'footer-hours-note': T(settings.footer_hours_note),
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
    const T = (window.NN && window.NN.t) ? window.NN.t : (v => v);

    const mail = document.getElementById('fab-mail');
    if (mail && settings.footer_email) mail.href = 'mailto:' + settings.footer_email;

    const insta = document.getElementById('fab-instagram');
    if (insta && settings.instagram_url) insta.href = settings.instagram_url;

    const phone = document.getElementById('fab-phone');
    if (phone && settings.footer_phone) phone.href = 'tel:' + telHref(settings.footer_phone);

    const hoursText = document.getElementById('fab-hours-text');
    const hours = T(settings.footer_hours);
    const note = T(settings.footer_hours_note);
    if (hoursText && (hours || note)) {
      hoursText.innerHTML = [hours, note]
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
      // Les libellés Open/Closed restent identiques en FR et EN (choix de marque).
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
