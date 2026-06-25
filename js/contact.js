/* ============================================
   NUIT NOIRE TATTOO - contact.js
   Charge data/contact.json + data/artists/_index.json (pour le dropdown artistes)
   Genere un mailto: pre-rempli depuis le formulaire
   Bilingue : textes de contenu via NN.t({fr,en}), interface via NN.ui(key)
   ============================================ */

(function () {
  'use strict';

  const T = (v) => (window.NN ? window.NN.t(v) : (typeof v === 'string' ? v : (v && (v.fr || v.en)) || ''));
  const UI = (k) => (window.NN ? window.NN.ui(k) : '');

  let contactEmail = 'contact@nuitnoiretattoo.com';

  async function loadPage() {
    try {
      if (window.NN && window.NN.ready) { await window.NN.ready; }

      const [contactResponse, artistsResponse] = await Promise.all([
        fetch('data/contact.json'),
        fetch('data/artists/_index.json')
      ]);
      const contact = await contactResponse.json();
      const artists = await artistsResponse.json();

      renderHeader(contact);
      renderInfo(contact);
      renderFormIntro(contact);
      populateArtistsDropdown(artists.items || []);

      contactEmail = contact.email || contactEmail;

      // Mettre a jour le lien fallback dans le formulaire
      const fallback = document.getElementById('fallback-email');
      if (fallback) {
        fallback.textContent = contactEmail;
        fallback.href = `mailto:${contactEmail}`;
      }

      initForm();
    } catch (err) {
      console.error('Erreur de chargement de la page contact', err);
    }
  }

  function renderHeader(c) {
    const eyebrow = document.getElementById('page-eyebrow');
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    if (eyebrow) eyebrow.textContent = T(c.eyebrow) || '';
    if (title) title.textContent = T(c.title) || 'Contact';
    if (subtitle) subtitle.textContent = T(c.subtitle) || '';
  }

  function renderInfo(c) {
    const address = document.getElementById('contact-address');
    const phone = document.getElementById('contact-phone');
    const hours = document.getElementById('contact-hours');
    const direct = document.getElementById('contact-direct');

    if (address && c.address) {
      address.innerHTML = textToHtml(T(c.address));
    }

    if (phone) {
      if (c.phone) {
        const tel = String(c.phone).replace(/\(0\)/g, '').replace(/[^+\d]/g, '');
        phone.innerHTML = `<a href="tel:${tel}">${escapeHtml(c.phone)}</a>`;
      } else {
        phone.parentElement.hidden = true;
      }
    }

    if (hours) {
      let html = textToHtml(T(c.hours) || '');
      const note = T(c.hours_note);
      if (note) {
        html += `<br><span class="contact-meta">${escapeHtml(note)}</span>`;
      }
      hours.innerHTML = html;
    }

    if (direct) {
      const email = c.email || '';
      const insta = c.instagram || '';
      direct.innerHTML = `
        <a href="mailto:${email}">${escapeHtml(email)}</a><br />
        <a href="https://instagram.com/${insta}" target="_blank" rel="noopener">@${escapeHtml(insta)}</a>
      `;
    }

    renderAccess(c);
    renderMap(c);
  }

  function renderAccess(c) {
    setAccessLine('access-tpg', UI('access_tpg'), T(c.access_tpg), 'https://www.tpg.ch/');
    setAccessLine('access-cff', UI('access_cff'), T(c.access_cff), 'https://www.sbb.ch/');
    setAccessLine('access-parking', UI('access_parking'), T(c.parking));

    // Masquer l'encart si aucune info d'acces n'est renseignee
    if (!T(c.access_tpg) && !T(c.access_cff) && !T(c.parking)) {
      const box = document.querySelector('.contact-access');
      if (box) box.hidden = true;
    }
  }

  function setAccessLine(id, label, value, url) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!value) {
      el.hidden = true;
      return;
    }
    const inner = `<em>${escapeHtml(value)}</em>`;
    el.innerHTML = `<span class="access-label">${escapeHtml(label)} :</span> ` +
      (url ? `<a href="${url}" target="_blank" rel="noopener">${inner}</a>` : inner);
  }

  function renderMap(c) {
    const iframe = document.getElementById('map-iframe');
    if (iframe && c.map_query) {
      iframe.src = 'https://www.google.com/maps?q=' + encodeURIComponent(c.map_query) + '&output=embed';
    }
  }

  function renderFormIntro(c) {
    const title = document.getElementById('form-intro-title');
    const text = document.getElementById('form-intro-text');
    const photosNote = document.getElementById('form-photos-note');
    if (title) title.textContent = T(c.form_intro_title) || '';
    if (text) text.textContent = T(c.form_intro_text) || '';
    if (photosNote) {
      const note = T(c.form_photos_note);
      if (note) {
        photosNote.textContent = note;
      } else {
        photosNote.hidden = true;
      }
    }
  }

  function populateArtistsDropdown(artists) {
    const select = document.getElementById('form-artist');
    if (!select) return;
    const sorted = artists.sort((a, b) => (a.order || 999) - (b.order || 999));
    sorted.forEach(artist => {
      const option = document.createElement('option');
      option.value = artist.name;
      option.textContent = artist.name;
      select.appendChild(option);
    });
  }

  // ============================================
  // MAILTO (corps genere dans la langue courante)
  // ============================================
  function buildMailto(data) {
    const subjectLine = `[${data.subject}] ${data.name}${data.artist ? ' - ' + data.artist : ''}`;

    const bodyLines = [
      UI('mail_greeting'), ``,
      `${UI('mail_name')} : ${data.name}`,
      `${UI('mail_email')} : ${data.email}`,
      `${UI('mail_artist')} : ${data.artist || UI('mail_no_pref')}`,
      `${UI('mail_subject')} : ${data.subject}`, ``,
      `${UI('mail_placement')} : ${data.placement || '-'}`, ``,
      UI('mail_description'),
      data.message, ``,
      `${UI('mail_availability')} : ${data.availability || '-'}`, ``,
      UI('mail_regards'), data.name
    ];

    const body = bodyLines.join('\n');
    return `mailto:${contactEmail}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;
  }

  function initForm() {
    const submit = document.getElementById('form-submit');
    if (!submit) return;

    submit.addEventListener('click', () => {
      const name = document.getElementById('form-name').value.trim();
      const email = document.getElementById('form-email').value.trim();
      const message = document.getElementById('form-message').value.trim();

      if (!name || !email || !message) {
        alert(UI('form_validation'));
        return;
      }

      const subjectSelect = document.getElementById('form-subject');
      const subjectText = subjectSelect.options[subjectSelect.selectedIndex].textContent.trim();

      const data = {
        name, email,
        artist: document.getElementById('form-artist').value,
        subject: subjectText,
        placement: document.getElementById('form-placement').value.trim(),
        message,
        availability: document.getElementById('form-availability').value.trim()
      };

      window.location.href = buildMailto(data);
    });
  }

  function textToHtml(str) {
    return escapeHtml(str).replace(/\n/g, '<br>');
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
