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

      fillText('page-eyebrow', T(data.eyebrow));
      fillText('page-title', T(data.title));
      fillText('page-subtitle', T(data.subtitle));

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAbout);
  } else {
    loadAbout();
  }
})();
