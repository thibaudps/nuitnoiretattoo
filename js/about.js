/* ============================================
   NUIT NOIRE TATTOO - about.js (page À propos)
   Contenu chargé depuis data/about.json (bilingue FR/EN via NN.t)
   ============================================ */

(function () {
  'use strict';

  const T = (window.NN && window.NN.t) ? window.NN.t : (v => (v && v.fr) || v || '');

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Transforme un texte en paragraphes : ligne vide = nouveau <p>, simple retour = <br>
  function renderParagraphs(text) {
    return String(text || '')
      .trim()
      .split(/\n\s*\n/)
      .filter(Boolean)
      .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function fillText(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }

  async function loadAbout() {
    try {
      const response = await fetch('data/about.json');
      const data = await response.json();

      // Photo (éditable dans le CMS). Masquée si aucune image.
      const figure = document.getElementById('about-photo');
      const img = document.getElementById('about-image');
      if (figure && img && data.image) {
        img.src = data.image;
        img.alt = T(data.image_alt) || 'Nuit Noire Tattoo';
        figure.hidden = false;
      } else if (figure) {
        figure.hidden = true;
      }

      const body = document.getElementById('about-body');
      if (body && data.body) body.innerHTML = renderParagraphs(T(data.body));
    } catch (err) {
      console.warn('Impossible de charger about.json', err);
      // Fallback : au moins un titre pour ne pas laisser la page vide
      fillText('page-title', T({ fr: 'À propos', en: 'About' }));
    }
  }

  // Hauteur exacte de la page = viewport moins la nav, pour tout voir sans scroller
  function setAboutHeight() {
    const nav = document.querySelector('.nav');
    const navH = nav ? nav.getBoundingClientRect().height : 0;
    const h = Math.max(0, window.innerHeight - navH);
    document.documentElement.style.setProperty('--about-h', h + 'px');
  }

  function initHeight() {
    setAboutHeight();
    window.addEventListener('resize', setAboutHeight);
    window.addEventListener('load', setAboutHeight);
    // La nav est injectée dans #nav-mount de façon asynchrone : on recalcule dès qu'elle apparaît
    const mount = document.getElementById('nav-mount');
    if (mount && 'MutationObserver' in window) {
      new MutationObserver(setAboutHeight).observe(mount, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { loadAbout(); initHeight(); });
  } else {
    loadAbout();
    initHeight();
  }
})();
