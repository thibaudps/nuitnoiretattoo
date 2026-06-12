/* ============================================
   NUIT NOIRE TATTOO — faq.js
   Charge data/faq.json (en-tête + questions/réponses)
   ============================================ */

(function () {
  'use strict';

  async function loadPage() {
    try {
      const response = await fetch('data/faq.json');
      const data = await response.json();
      renderHeader(data);
      renderItems(data.items || []);
    } catch (err) {
      console.error('Erreur de chargement de la page FAQ', err);
      const list = document.getElementById('faq-list');
      if (list) list.innerHTML = '<p class="error-message">Impossible de charger la FAQ pour le moment.</p>';
    }
  }

  function renderHeader(data) {
    const eyebrow = document.getElementById('page-eyebrow');
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    if (eyebrow) eyebrow.textContent = data.eyebrow || '';
    if (title) title.textContent = data.title || 'FAQ';
    if (subtitle) subtitle.textContent = data.subtitle || '';
  }

  function renderItems(items) {
    const container = document.getElementById('faq-list');
    if (!container) return;

    container.innerHTML = items
      .filter(item => item && item.question)
      .map(item => `
        <details class="faq-item">
          <summary>
            <span class="faq-question">${escapeHtml(item.question)}</span>
            <span class="faq-marker" aria-hidden="true">+</span>
          </summary>
          <div class="faq-answer">${renderAnswer(item.answer || '')}</div>
        </details>
      `).join('');
  }

  // Échappe le HTML, puis convertit les liens [texte](url) et les retours à la ligne.
  // Seuls les liens http(s), mailto, tel et relatifs (.html, #) sont autorisés.
  function renderAnswer(text) {
    let html = escapeHtml(text);
    html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
      const safe = /^(https?:\/\/|mailto:|tel:|[a-z0-9-]+\.html|#)/i.test(url);
      if (!safe) return match;
      const external = /^https?:\/\//i.test(url);
      return `<a href="${url}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
    });
    return html.replace(/\n/g, '<br>');
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
