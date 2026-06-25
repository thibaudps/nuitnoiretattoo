/* ============================================
   NUIT NOIRE TATTOO - faq.js
   Charge data/faq.json (en-tete + questions/reponses)
   Bilingue : contenu via NN.t({fr,en}), interface via NN.ui(key)
   ============================================ */

(function () {
  'use strict';

  const T = (v) => (window.NN ? window.NN.t(v) : (typeof v === 'string' ? v : (v && (v.fr || v.en)) || ''));
  const UI = (k) => (window.NN ? window.NN.ui(k) : '');

  async function loadPage() {
    try {
      if (window.NN && window.NN.ready) { await window.NN.ready; }
      const response = await fetch('data/faq.json');
      const data = await response.json();
      renderHeader(data);
      renderItems(data.items || []);
    } catch (err) {
      console.error('Erreur de chargement de la page FAQ', err);
      const list = document.getElementById('faq-list');
      if (list) list.innerHTML = `<p class="error-message">${escapeHtml(UI('err_faq'))}</p>`;
    }
  }

  function renderHeader(data) {
    const eyebrow = document.getElementById('page-eyebrow');
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    if (eyebrow) eyebrow.textContent = T(data.eyebrow) || '';
    if (title) title.textContent = T(data.title) || 'FAQ';
    if (subtitle) subtitle.textContent = T(data.subtitle) || '';
  }

  function renderItems(items) {
    const container = document.getElementById('faq-list');
    if (!container) return;

    container.innerHTML = items
      .filter(item => item && T(item.question))
      .map(item => `
        <details class="faq-item">
          <summary>
            <span class="faq-question">${escapeHtml(T(item.question))}</span>
            <span class="faq-marker" aria-hidden="true">+</span>
          </summary>
          <div class="faq-answer">${renderAnswer(T(item.answer) || '')}</div>
        </details>
      `).join('');
  }

  // Echappe le HTML, puis convertit les liens [texte](url) et les retours a la ligne.
  // Seuls les liens http(s), mailto, tel et relatifs (.html, #) sont autorises.
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
