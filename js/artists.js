/* ============================================
   NUIT NOIRE TATTOO - artists.js
   Charge data/artists-page.json (en-tête) + data/artists/_index.json (artistes)
   Bilingue FR/EN via window.NN.
   ============================================ */

(function () {
  'use strict';

  const T = (window.NN && window.NN.t) ? window.NN.t : (v => (v && v.fr) || v || '');
  const UI = (window.NN && window.NN.ui) ? window.NN.ui : (() => '');

  // Champs a deux variantes (ex. bio + bio_en) : renvoie l'anglais si dispo et
  // langue = en, sinon le francais. Tolere aussi un objet {fr,en} le cas echeant.
  function pick(base, en) {
    if (base && typeof base === 'object') return T(base);
    const lang = window.NN ? window.NN.lang : 'fr';
    if (lang === 'en' && en) return en;
    return base || '';
  }

  async function loadPage() {
    if (window.NN && window.NN.ready) {
      try { await window.NN.ready; } catch (e) { /* on continue */ }
    }
    try {
      const [pageResponse, indexResponse] = await Promise.all([
        fetch('data/artists-page.json'),
        fetch('data/artists/_index.json')
      ]);
      const page = await pageResponse.json();
      const index = await indexResponse.json();

      renderHeader(page);
      const artists = (index.items || []).sort((a, b) => (a.order || 999) - (b.order || 999));
      renderQuickNav(artists);
      renderArtists(artists);

      initQuickNav();
      initQuickNavArrows();
      initSectionObserver();
      handleInitialHash();
    } catch (err) {
      console.error('Erreur de chargement de la page artistes', err);
      const list = document.getElementById('artists-list');
      if (list) list.innerHTML = `<p class="error-message">${escapeHtml(UI('err_artists'))}</p>`;
    }
  }

  function renderHeader(page) {
    const eyebrow = document.getElementById('page-eyebrow');
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    if (eyebrow) eyebrow.textContent = T(page.eyebrow) || '';
    if (title) title.textContent = T(page.title) || 'Artists';
    if (subtitle) subtitle.textContent = T(page.subtitle) || '';
  }

  // Affiche le rôle traduit. En FR on garde la valeur saisie ;
  // en EN on traduit les valeurs connues du select.
  function roleLabel(role) {
    if (!role) return '';
    if (window.NN && window.NN.lang === 'fr') return role;
    const map = {
      'Fondateur': 'role_fondateur',
      'Fondatrice': 'role_fondatrice',
      'Résident': 'role_resident',
      'Résidente': 'role_residente',
      'Invité': 'role_invite',
      'Invitée': 'role_invitee'
    };
    const key = map[role];
    return key ? (UI(key) || role) : role;
  }

  function renderQuickNav(artists) {
    const container = document.getElementById('artists-quicknav-inner');
    if (!container) return;
    container.innerHTML = artists.map(a => `
      <a href="#${a.id}" class="artists-quicknav-link${a.guest ? ' is-guest' : ''}">${escapeHtml(a.name)}</a>
    `).join('');
  }

  function renderArtists(artists) {
    const container = document.getElementById('artists-list');
    if (!container) return;
    container.innerHTML = artists.map((artist, i) => renderArtist(artist, i)).join('');
  }

  function renderArtist(artist, index) {
    if (artist.guest) return renderGuestSection(artist);

    const portfolioHTML = renderPortfolio(artist);
    const isReversed = index % 2 === 1;

    return `
      <section class="artist-section ${isReversed ? 'is-reversed' : ''}" id="${artist.id}">
        <div class="artist-intro">
          <div class="artist-portrait">
            ${artist.portrait
              ? `<img src="${artist.portrait}" alt="Portrait de ${escapeHtml(artist.name)}" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');" />`
              : ''}
          </div>
          <div class="artist-info">
            <p class="artist-role">${escapeHtml(roleLabel(artist.role))}</p>
            <h2 class="artist-name">${escapeHtml(artist.name)}</h2>
            <p class="artist-bio">${escapeHtml(pick(artist.bio, artist.bio_en))}</p>
            ${artist.instagram ? `
              <a href="https://instagram.com/${artist.instagram}" target="_blank" rel="noopener" class="artist-instagram">
                @${escapeHtml(artist.instagram)} ↗
              </a>
            ` : ''}
          </div>
        </div>
        ${portfolioHTML}
      </section>
    `;
  }

  function renderGuestSection(artist) {
    return `
      <section class="artist-section guest-section" id="${artist.id}">
        <h2 class="artist-name guest-name">${escapeHtml(artist.name)}</h2>
        <div class="guest-image">
          ${artist.portrait
            ? `<img src="${artist.portrait}" alt="${escapeHtml(artist.name)}" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');" />`
            : ''}
        </div>
        ${pick(artist.bio, artist.bio_en) ? `<p class="guest-text">${escapeHtml(pick(artist.bio, artist.bio_en))}</p>` : ''}
        ${artist.instagram ? `
          <a href="https://instagram.com/${artist.instagram}" target="_blank" rel="noopener" class="artist-instagram">
            @${escapeHtml(artist.instagram)} ↗
          </a>
        ` : ''}
      </section>
    `;
  }

  function renderPortfolio(artist) {
    const items = artist.portfolio || [];

    if (items.length === 0) {
      return `
        <div class="artist-portfolio">
          <div class="artist-portfolio-grid">
            ${Array.from({ length: 6 }, () => `
              <div class="work-item work-item-placeholder">
                <svg width="50" height="50" viewBox="0 0 60 60"><circle cx="30" cy="30" r="18" fill="none" stroke="currentColor" stroke-width="0.5"/><circle cx="30" cy="30" r="10" fill="none" stroke="currentColor" stroke-width="0.5"/></svg>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="artist-portfolio">
        <div class="artist-portfolio-grid">
          ${items.map(img => `
            <div class="work-item">
              <img src="${img.src || img}" alt="${escapeHtml(T(img.alt) || 'Tatouage')}" loading="lazy" />
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function initQuickNav() {
    const links = document.querySelectorAll('.artists-quicknav-link');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = link.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (target) {
          const offset = 100;
          const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
          window.scrollTo({ top, behavior: 'smooth' });
          history.replaceState(null, '', '#' + id);
        }
      });
    });
  }

  // Affiche une fleche discrete a gauche / a droite tant qu'il reste des noms
  // a faire defiler de ce cote (surtout utile sur mobile). Non cliquable.
  function initQuickNavArrows() {
    const bar = document.getElementById('artists-quicknav');
    const inner = document.getElementById('artists-quicknav-inner');
    if (!bar || !inner) return;

    function update() {
      const max = inner.scrollWidth - inner.clientWidth;
      const x = inner.scrollLeft;
      const EPS = 2; // tolerance pour les arrondis
      bar.classList.toggle('can-scroll-left', x > EPS);
      bar.classList.toggle('can-scroll-right', x < max - EPS);
    }

    inner.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // Recalcule apres le chargement des polices (la largeur peut changer)
    window.addEventListener('load', update);
    setTimeout(update, 300);
    update();
  }

  function initSectionObserver() {
    const sections = document.querySelectorAll('.artist-section');
    const links = document.querySelectorAll('.artists-quicknav-link');
    if (!('IntersectionObserver' in window) || sections.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach(link => {
            link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });

    sections.forEach(s => observer.observe(s));
  }

  function handleInitialHash() {
    if (!window.location.hash) return;
    const id = window.location.hash.slice(1);
    setTimeout(() => {
      const target = document.getElementById(id);
      if (target) {
        const offset = 100;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }, 200);
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
