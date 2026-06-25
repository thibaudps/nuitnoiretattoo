/* ============================================
   NUIT NOIRE TATTOO - main.js (page d'accueil)
   Contenu chargé depuis data/home.json (géré via CMS, bilingue FR/EN)
   ============================================ */

(function () {
  'use strict';

  // Helper langue (fallback identité si i18n.js absent)
  const T = (window.NN && window.NN.t) ? window.NN.t : (v => (v && v.fr) || v || '');

  // Timings
  const SLIDE_DURATION = 4000;
  const LOGO_DURATION = 4500;

  let phrases = [];

  // ============================================
  // CAROUSEL HORIZONTAL (HERO)
  // ============================================
  function buildCarouselSlides() {
    const carousel = document.getElementById('hero-carousel');
    const dotsContainer = document.getElementById('hero-dots');
    if (!carousel || !dotsContainer) return;

    // Le slide 0 (logo) est déjà dans le HTML, on ajoute les phrases après
    phrases.forEach((phrase, i) => {
      const slide = document.createElement('div');
      slide.className = 'hero-slide';
      slide.dataset.slide = String(i + 1);
      slide.innerHTML = `<p class="hero-phrase">${escapeHtml(T(phrase.text))}</p>`;
      carousel.appendChild(slide);
    });

    // Construire les dots : 1 pour le logo + 1 par phrase
    const totalSlides = phrases.length + 1;
    dotsContainer.innerHTML = '';
    for (let i = 0; i < totalSlides; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.dataset.dot = String(i);
      dotsContainer.appendChild(dot);
    }
  }

  function initCarousel() {
    const carousel = document.getElementById('hero-carousel');
    if (!carousel) return;

    const slides = Array.from(carousel.querySelectorAll('.hero-slide'));
    const dots = document.querySelectorAll('#hero-dots .dot');
    if (slides.length < 2) return; // pas la peine d'animer s'il n'y a qu'un slide

    let current = 0;
    let isAnimating = false;

    // Initialiser les slides non-actives en "waiting-right"
    slides.forEach((slide, i) => {
      if (i !== current) slide.classList.add('is-waiting-right');
    });

    function goToSlide(targetIndex) {
      if (isAnimating || targetIndex === current) return;
      isAnimating = true;

      const currentSlide = slides[current];
      const nextSlide = slides[targetIndex];

      nextSlide.classList.remove('is-active', 'is-leaving-left');
      nextSlide.classList.add('is-waiting-right');

      void nextSlide.offsetWidth; // force reflow

      requestAnimationFrame(() => {
        currentSlide.classList.remove('is-active');
        currentSlide.classList.add('is-leaving-left');

        nextSlide.classList.remove('is-waiting-right');
        nextSlide.classList.add('is-active');
      });

      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === targetIndex);
      });

      current = targetIndex;

      setTimeout(() => {
        isAnimating = false;
        currentSlide.classList.remove('is-leaving-left');
      }, 950);
    }

    function nextSlide() {
      const next = (current + 1) % slides.length;
      goToSlide(next);
    }

    // Auto-play
    let autoplayTimer = null;
    function scheduleNext() {
      const duration = current === 0 ? LOGO_DURATION : SLIDE_DURATION;
      autoplayTimer = setTimeout(() => {
        nextSlide();
        scheduleNext();
      }, duration);
    }
    scheduleNext();

    // Clic sur un dot
    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        clearTimeout(autoplayTimer);
        goToSlide(i);
        scheduleNext();
      });
    });
  }

  // ============================================
  // DROPDOWN ARTISTS (tactile)
  // ============================================
  function initDropdown() {
    const trigger = document.getElementById('artists-trigger');
    if (!trigger) return;

    const link = trigger.querySelector('.nav-link');
    let isTouch = false;
    window.addEventListener('touchstart', () => { isTouch = true; }, { once: true });

    link.addEventListener('click', (e) => {
      if (window.matchMedia('(max-width: 768px)').matches) return;
      if (isTouch && !trigger.classList.contains('is-open')) {
        e.preventDefault();
        trigger.classList.add('is-open');
      }
    });

    document.addEventListener('click', (e) => {
      if (!trigger.contains(e.target)) {
        trigger.classList.remove('is-open');
      }
    });
  }

  // ============================================
  // INJECTION DU CONTENU DEPUIS home.json
  // ============================================
  async function loadHomeContent() {
    try {
      const response = await fetch('data/home.json');
      const data = await response.json();

      // Phrases du carrousel
      phrases = (data.phrases || []).filter(p => p && p.text);

      // Texte de présentation
      const introEl = document.getElementById('intro-text');
      if (introEl && data.intro_text) introEl.textContent = T(data.intro_text);

      // Titre Latest work
      const titleEl = document.getElementById('latest-work-title');
      if (titleEl && data.latest_work_title) titleEl.textContent = T(data.latest_work_title);

      // Handle Instagram
      const handleEl = document.getElementById('latest-work-handle');
      if (handleEl) {
        const handle = data.instagram_handle || '@nuitnoiretattoo';
        handleEl.textContent = handle;
        const username = handle.replace('@', '');
        handleEl.href = `https://instagram.com/${username}`;
      }

      // Photos du carrousel
      renderLatestWork(data.latest_work || []);

      // Construire le carrousel maintenant qu'on a les phrases
      buildCarouselSlides();
      initCarousel();
    } catch (err) {
      console.error('Impossible de charger home.json', err);
      // Fallback : une phrase par défaut
      phrases = [{ text: { fr: 'Ici, on fait du tatouage de qualité.', en: 'Here we make great quality tattoos.' } }];
      buildCarouselSlides();
      initCarousel();
    }
  }

  function renderLatestWork(items) {
    const grid = document.getElementById('latest-work-grid');
    if (!grid) return;

    const visible = items.slice(0, 6);

    if (visible.length === 0) {
      renderPlaceholders(grid, 6);
      return;
    }

    grid.innerHTML = visible.map(item => `
      <a href="${item.link || '#'}" class="work-item" ${item.link ? 'target="_blank" rel="noopener"' : ''}>
        <img src="${item.image}" alt="${escapeHtml(T(item.alt) || 'Tatouage Nuit Noire')}" loading="lazy" />
      </a>
    `).join('');
  }

  function renderPlaceholders(grid, count) {
    const svgs = [
      '<svg width="60" height="60" viewBox="0 0 60 60"><path d="M30 10 L40 25 L50 30 L40 35 L30 50 L20 35 L10 30 L20 25 Z" fill="none" stroke="currentColor" stroke-width="0.5"/></svg>',
      '<svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="18" fill="none" stroke="currentColor" stroke-width="0.5"/><circle cx="30" cy="30" r="10" fill="none" stroke="currentColor" stroke-width="0.5"/></svg>',
      '<svg width="60" height="60" viewBox="0 0 60 60"><path d="M15 45 Q30 15 45 45" fill="none" stroke="currentColor" stroke-width="0.5"/><path d="M20 45 Q30 25 40 45" fill="none" stroke="currentColor" stroke-width="0.5"/></svg>',
      '<svg width="60" height="60" viewBox="0 0 60 60"><rect x="18" y="18" width="24" height="24" fill="none" stroke="currentColor" stroke-width="0.5" transform="rotate(45 30 30)"/></svg>',
      '<svg width="60" height="60" viewBox="0 0 60 60"><path d="M30 12 L34 24 L46 24 L36 32 L40 44 L30 36 L20 44 L24 32 L14 24 L26 24 Z" fill="none" stroke="currentColor" stroke-width="0.5"/></svg>',
      '<svg width="60" height="60" viewBox="0 0 60 60"><path d="M15 30 Q30 15 45 30 Q30 45 15 30 Z" fill="none" stroke="currentColor" stroke-width="0.5"/><circle cx="30" cy="30" r="4" fill="currentColor"/></svg>'
    ];
    grid.innerHTML = Array.from({ length: count }, (_, i) => `
      <div class="work-item work-item-placeholder">${svgs[i % svgs.length]}</div>
    `).join('');
  }

  // Utilitaire : échapper le HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================
  // INIT
  // ============================================
  document.addEventListener('DOMContentLoaded', () => {
    loadHomeContent();
    initDropdown();
  });
})();
