/* ============================================
   NUIT NOIRE TATTOO - i18n.js
   Gestion bilingue FR / EN, chargé EN PREMIER sur chaque page.
   --------------------------------------------
   - Langue courante : window.NN.lang ('fr' par défaut), persistée dans localStorage.
   - t(value)      : renvoie la bonne langue depuis un objet {fr, en} (ou une chaîne simple = legacy).
   - ui(key)       : renvoie une chaîne d'interface (boutons, libellés...) depuis data/ui.json.
   - NN.ready      : promesse résolue une fois data/ui.json chargé (ne bloque jamais, même en cas d'erreur).
   - applyStatic() : remplit tous les [data-i18n] / [data-i18n-ph] / [data-i18n-aria] de la page.
   ============================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'nn-lang';
  const SUPPORTED = ['fr', 'en'];
  const DEFAULT_LANG = 'fr';

  function readLang() {
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* localStorage indispo */ }
    return SUPPORTED.includes(stored) ? stored : DEFAULT_LANG;
  }

  const lang = readLang();

  // Renvoie la bonne traduction depuis un objet {fr, en}.
  // Tolérant : accepte aussi une chaîne simple (contenu pas encore migré) -> fallback.
  function t(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      return value[lang] || value[DEFAULT_LANG] || value.en || '';
    }
    return '';
  }

  // Dictionnaire d'interface : valeurs de secours en dur (FR + EN) pour que
  // le site reste fonctionnel même si data/ui.json ne charge pas. Surchargé
  // par data/ui.json une fois récupéré (le CMS écrit dans ce fichier).
  const DEFAULTS = {
    nav_view_all:        { fr: '→ Voir tous',  en: '→ View all' },
    home_view_artists:   { fr: 'Voir les artistes →', en: 'View the artists →' },

    shop_filter_all:     { fr: 'Tout',     en: 'All' },
    shop_filter_flash:   { fr: 'Flashs',   en: 'Flashes' },
    shop_filter_print:   { fr: 'Tirages',  en: 'Prints' },
    shop_filter_merch:   { fr: 'Merch',    en: 'Merch' },
    shop_empty:          { fr: 'Aucun produit dans cette catégorie pour le moment.', en: 'No products in this category yet.' },
    shop_by:             { fr: 'par',      en: 'by' },
    shop_reserved:       { fr: 'Réservé',  en: 'Reserved' },
    shop_order_heading:  { fr: 'Commander', en: 'Order' },
    shop_contact_us:     { fr: 'Nous contacter →', en: 'Contact us →' },
    cat_flash:           { fr: 'Flash',    en: 'Flash' },
    cat_print:           { fr: 'Tirage',   en: 'Print' },
    cat_merch:           { fr: 'Merch',    en: 'Merch' },

    role_fondateur:      { fr: 'Fondateur',  en: 'Founder' },
    role_fondatrice:     { fr: 'Fondatrice', en: 'Founder' },
    role_resident:       { fr: 'Résident',   en: 'Resident' },
    role_residente:      { fr: 'Résidente',  en: 'Resident' },
    role_invite:         { fr: 'Invité',     en: 'Guest' },
    role_invitee:        { fr: 'Invitée',    en: 'Guest' },

    form_name:           { fr: 'Nom complet', en: 'Full name' },
    form_email:          { fr: 'Email', en: 'Email' },
    form_artist:         { fr: 'Artiste souhaité', en: 'Preferred artist' },
    form_no_pref:        { fr: '- Sans préférence -', en: '- No preference -' },
    form_subject:        { fr: 'Type de demande', en: 'Request type' },
    form_subject_new:    { fr: 'Nouveau projet', en: 'New project' },
    form_subject_touch:  { fr: 'Retouche', en: 'Touch-up' },
    form_subject_q:      { fr: 'Question', en: 'Question' },
    form_subject_other:  { fr: 'Autre', en: 'Other' },
    form_placement:      { fr: 'Emplacement et taille approximative', en: 'Placement and approximate size' },
    form_placement_ph:   { fr: 'ex. avant-bras, environ 15 cm', en: 'e.g. forearm, around 15 cm' },
    form_message:        { fr: 'Description du projet', en: 'Project description' },
    form_message_ph:     { fr: 'Décrivez votre idée, ambiance, références, contraintes…', en: 'Describe your idea, mood, references, constraints…' },
    form_availability:   { fr: 'Disponibilités', en: 'Availability' },
    form_availability_ph:{ fr: 'ex. après-midi en semaine, week-ends…', en: 'e.g. weekday afternoons, weekends…' },
    form_submit:         { fr: 'Envoyer le message', en: 'Send message' },
    form_disclaimer_1:   { fr: 'Le bouton ouvre votre client mail.', en: 'This button opens your email client.' },
    form_disclaimer_2:   { fr: 'Si ça ne fonctionne pas, écrivez à', en: "If it doesn't work, email" },
    form_validation:     { fr: 'Merci de remplir au moins votre nom, votre email et la description du projet.', en: 'Please fill in at least your name, email and project description.' },

    label_address:       { fr: 'Adresse', en: 'Address' },
    label_phone:         { fr: 'Téléphone', en: 'Phone' },
    label_direct:        { fr: 'Direct', en: 'Direct' },
    label_hours:         { fr: 'Horaires', en: 'Hours' },
    access_tpg:          { fr: 'Accès TPG', en: 'Public transport' },
    access_cff:          { fr: 'Accès CFF', en: 'Train' },
    access_parking:      { fr: 'Parking', en: 'Parking' },

    mail_greeting:       { fr: 'Bonjour,', en: 'Hello,' },
    mail_name:           { fr: 'Nom', en: 'Name' },
    mail_email:          { fr: 'Email', en: 'Email' },
    mail_artist:         { fr: 'Artiste souhaité', en: 'Preferred artist' },
    mail_no_pref:        { fr: 'Sans préférence', en: 'No preference' },
    mail_subject:        { fr: 'Type de demande', en: 'Request type' },
    mail_placement:      { fr: 'Emplacement / taille', en: 'Placement / size' },
    mail_description:    { fr: 'Description du projet :', en: 'Project description:' },
    mail_availability:   { fr: 'Disponibilités', en: 'Availability' },
    mail_regards:        { fr: 'Cordialement,', en: 'Best regards,' },

    fab_instagram:       { fr: 'Instagram', en: 'Instagram' },
    fab_mail:            { fr: 'Envoyer un email', en: 'Send an email' },
    fab_phone:           { fr: 'Appeler le shop', en: 'Call the shop' },
    fab_map:             { fr: "Voir le plan d'accès", en: 'View directions' },
    fab_hours:           { fr: 'Voir les horaires', en: 'View opening hours' },
    fab_toggle:          { fr: 'Contact rapide', en: 'Quick contact' },

    err_artists:         { fr: 'Impossible de charger les artistes pour le moment.', en: 'Unable to load the artists right now.' },
    err_shop:            { fr: 'Impossible de charger la boutique pour le moment.', en: 'Unable to load the shop right now.' },
    err_faq:             { fr: 'Impossible de charger la FAQ pour le moment.', en: 'Unable to load the FAQ right now.' },

    title_home:          { fr: 'Nuit Noire Tattoo - Genève', en: 'Nuit Noire Tattoo - Geneva' },
    title_artists:       { fr: 'Artistes - Nuit Noire Tattoo', en: 'Artists - Nuit Noire Tattoo' },
    title_shop:          { fr: 'Shop - Nuit Noire Tattoo', en: 'Shop - Nuit Noire Tattoo' },
    title_faq:           { fr: 'FAQ - Nuit Noire Tattoo', en: 'FAQ - Nuit Noire Tattoo' },
    title_contact:       { fr: 'Contact - Nuit Noire Tattoo', en: 'Contact - Nuit Noire Tattoo' }
  };

  let UI = DEFAULTS;

  function ui(key) {
    const entry = UI[key] || DEFAULTS[key];
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    return entry[lang] || entry[DEFAULT_LANG] || entry.en || '';
  }

  // Remplit les éléments statiques marqués data-i18n* dans un scope donné.
  function applyStatic(scope) {
    const root = scope || document;
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const v = ui(el.getAttribute('data-i18n'));
      if (v) el.textContent = v;
    });
    root.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const v = ui(el.getAttribute('data-i18n-ph'));
      if (v) el.setAttribute('placeholder', v);
    });
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const v = ui(el.getAttribute('data-i18n-aria'));
      if (v) el.setAttribute('aria-label', v);
    });
  }

  function setLang(next) {
    if (!SUPPORTED.includes(next) || next === lang) return;
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
    // Reload : approche volontaire pour éviter tout état incohérent
    // (écouteurs doublés, carrousel ré-initialisé, etc.).
    window.location.reload();
  }

  // Reflète la langue sur <html lang> et le titre d'onglet par page.
  function applyDocumentLang() {
    document.documentElement.lang = lang;
    const page = document.body && document.body.dataset ? document.body.dataset.page : null;
    const titleKey = page ? 'title_' + page : null;
    if (titleKey && (UI[titleKey] || DEFAULTS[titleKey])) {
      const tt = ui(titleKey);
      if (tt) document.title = tt;
    }
  }

  // Chargement du dictionnaire CMS (data/ui.json). Ne bloque jamais.
  const ready = fetch('data/ui.json')
    .then(r => (r.ok ? r.json() : null))
    .then(json => { if (json && typeof json === 'object') UI = Object.assign({}, DEFAULTS, json); })
    .catch(() => { /* on garde les DEFAULTS */ })
    .then(() => {
      applyDocumentLang();
      applyStatic(document);
    });

  window.NN = {
    lang: lang,
    t: t,
    ui: ui,
    setLang: setLang,
    applyStatic: applyStatic,
    ready: ready
  };

  // Premier passage immédiat (avant que ui.json soit chargé) pour limiter
  // le flash : <html lang> et titres se mettent à jour, le reste suivra au ready.
  applyDocumentLang();
})();
