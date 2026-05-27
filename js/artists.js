/* ============================================
   NUIT NOIRE TATTOO — artists.js
   Charge data/artists-page.json (en-tête) + data/artists/_index.json (artistes)
   ============================================ */

(function () {
  'use strict';

  async function loadPage() {
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
      initSectionObserver();
      handleInitialHash();
    } catch (err) {
      console.error('Erreur de chargement de la page artistes', err);
      const list = document.getElementById('artists-list');
      if (list) list.innerHTML = '<p class="error-message">Impossible de charger les artistes pour le moment.</p>';
    }
  }

  function renderHeader(page) {
    const eyebrow = document.getElementById('page-eyebrow');
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    if (eyebrow) eyebrow.textContent = page.eyebrow || '';
    if (title) title.textContent = page.title || 'Artists';
    if (subtitle) subtitle.textContent = page.subtitle || '';
  }

  function renderQuickNav(artists) {
    const container = document.getElementById('artists-quicknav-inner');
    if (!container) return;
    container.innerHTML = artists.map(a => `
      <a href="#${a.id}" class="artists-quicknav-link">${escapeHtml(a.name)}</a>
    `).join('');
  }

  function renderArtists(artists) {
    const container = document.getElementById('artists-list');
    if (!container) return;
    container.innerHTML = artists.map((artist, i) => renderArtist(artist, i)).join('');
  }

  function renderArtist(artist, index) {
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
            <p class="artist-role">${escapeHtml(artist.role || '')}</p>
            <h2 class="artist-name">${escapeHtml(artist.name)}</h2>
            <p class="artist-bio">${escapeHtml(artist.bio || '')}</p>
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
              <img src="${img.src || img}" alt="${escapeHtml(img.alt || 'Tatouage')}" loading="lazy" />
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
