/* ============================================
   NUIT NOIRE TATTOO — contact.js
   Charge data/contact.json + data/artists/_index.json (pour le dropdown artistes)
   Génère un mailto: pré-rempli depuis le formulaire
   ============================================ */

(function () {
  'use strict';

  let contactEmail = 'contact@nuitnoiretattoo.com';

  async function loadPage() {
    try {
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

      // Mettre à jour le lien fallback dans le formulaire
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
    if (eyebrow) eyebrow.textContent = c.eyebrow || '';
    if (title) title.textContent = c.title || 'Contact';
    if (subtitle) subtitle.textContent = c.subtitle || '';
  }

  function renderInfo(c) {
    const address = document.getElementById('contact-address');
    const phone = document.getElementById('contact-phone');
    const hours = document.getElementById('contact-hours');
    const direct = document.getElementById('contact-direct');

    if (address && c.address) {
      address.innerHTML = textToHtml(c.address);
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
      let html = textToHtml(c.hours || '');
      if (c.hours_note) {
        html += `<br><span class="contact-meta">${escapeHtml(c.hours_note)}</span>`;
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
    setAccessLine('access-tpg', 'Accès TPG', c.access_tpg, 'https://www.tpg.ch/');
    setAccessLine('access-cff', 'Accès CFF', c.access_cff, 'https://www.sbb.ch/');
    setAccessLine('access-parking', 'Parking', c.parking);

    // Masquer l'encart si aucune info d'accès n'est renseignée
    if (!c.access_tpg && !c.access_cff && !c.parking) {
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
    if (title) title.textContent = c.form_intro_title || '';
    if (text) text.textContent = c.form_intro_text || '';
    if (photosNote) {
      if (c.form_photos_note) {
        photosNote.textContent = c.form_photos_note;
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
  // MAILTO
  // ============================================
  function buildMailto(data) {
    const subjectLine = `[${data.subject}] ${data.name}${data.artist ? ' — ' + data.artist : ''}`;

    const bodyLines = [
      `Bonjour,`, ``,
      `Nom : ${data.name}`,
      `Email : ${data.email}`,
      `Artiste souhaité : ${data.artist || 'Sans préférence'}`,
      `Type de demande : ${data.subject}`, ``,
      `Emplacement / taille : ${data.placement || '—'}`, ``,
      `Description du projet :`,
      data.message, ``,
      `Disponibilités : ${data.availability || '—'}`, ``,
      `Cordialement,`, data.name
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
        alert('Merci de remplir au moins votre nom, votre email et la description du projet.');
        return;
      }

      const data = {
        name, email,
        artist: document.getElementById('form-artist').value,
        subject: document.getElementById('form-subject').value,
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
