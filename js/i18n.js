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
    nav_home:            { fr: 'Accueil',      en: 'Home' },
    nav_artists:         { fr: 'Artistes',     en: 'Artists' },
    nav_shop:            { fr: 'Boutique',     en: 'Shop' },
    nav_about:           { fr: 'À propos',     en: 'About' },
    home_view_artists:   { fr: 'Voir les artistes →', en: 'View the artists →' },

    shop_filter_all:     { fr: 'Tout',     en: 'All' },
    shop_filter_print:   { fr: 'Prints',   en: 'Prints' },
    shop_filter_merch:   { fr: 'Merch',    en: 'Merch' },
    shop_empty:          { fr: 'Aucun produit dans cette catégorie pour le moment.', en: 'No products in this category yet.' },
    shop_by:             { fr: 'par',      en: 'by' },
    shop_reserved:       { fr: 'Réservé',  en: 'Reserved' },
    shop_order_heading:  { fr: 'Commander', en: 'Order' },
    shop_contact_us:     { fr: 'Nous contacter →', en: 'Contact us →' },
    cat_print:           { fr: 'Print',    en: 'Print' },
    cat_merch:           { fr: 'Merch',    en: 'Merch' },

    /* --- Boutique en ligne : fiche produit --- */
    shop_size:           { fr: 'Taille', en: 'Size' },
    shop_add_to_cart:    { fr: 'Ajouter au panier', en: 'Add to cart' },
    shop_added:          { fr: 'Ajouté ✓', en: 'Added ✓' },
    shop_cart_full:      { fr: 'Panier plein', en: 'Cart full' },
    shop_sold_out:       { fr: 'Épuisé', en: 'Sold out' },
    shop_sold_out_note:  { fr: 'Épuisé pour le moment.', en: 'Currently sold out.' },
    shop_low_stock:      { fr: 'Plus que {n} en stock', en: 'Only {n} left' },

    /* --- Boutique en ligne : panier --- */
    cart_eyebrow:        { fr: 'Boutique', en: 'Shop' },
    cart_title:          { fr: 'Panier', en: 'Cart' },
    cart_empty:          { fr: 'Votre panier est vide.', en: 'Your cart is empty.' },
    cart_back_to_shop:   { fr: 'Retour à la boutique →', en: 'Back to the shop →' },
    cart_remove:         { fr: 'Retirer cet article', en: 'Remove this item' },
    cart_country:        { fr: 'Pays de livraison', en: 'Shipping country' },
    cart_choose_country: { fr: '— Choisir un pays —', en: '— Choose a country —' },
    cart_subtotal:       { fr: 'Sous-total', en: 'Subtotal' },
    cart_shipping:       { fr: 'Frais de port', en: 'Shipping' },
    cart_shipping_pending: { fr: 'à calculer', en: 'to be calculated' },
    cart_shipping_free:  { fr: 'Offerts', en: 'Free' },
    cart_total:          { fr: 'Total', en: 'Total' },
    cart_delivery_estimate: { fr: 'Livraison estimée sous {min} à {max} jours ouvrés.', en: 'Estimated delivery in {min} to {max} business days.' },
    cart_pay:            { fr: 'Passer au paiement', en: 'Proceed to payment' },
    cart_pay_hint:       { fr: 'Choisissez un pays de livraison pour continuer.', en: 'Choose a shipping country to continue.' },
    cart_redirecting:    { fr: 'Redirection…', en: 'Redirecting…' },
    cart_secure:         { fr: 'Paiement sécurisé par Stripe. Aucune inscription nécessaire, aucune donnée bancaire ne transite par notre site.', en: 'Secure payment by Stripe. No account needed, no card details pass through our site.' },
    cart_load_error:     { fr: 'Impossible de charger le panier pour le moment.', en: 'Unable to load the cart right now.' },
    cart_error_stock:    { fr: "Un article de votre panier vient de partir. Le panier a été mis à jour, vérifiez-le avant de continuer.", en: 'An item in your cart has just sold out. The cart has been updated, please check it before continuing.' },
    cart_error_generic:  { fr: 'Le paiement n\'a pas pu être ouvert. Réessayez dans un instant.', en: 'Checkout could not be opened. Please try again in a moment.' },
    cart_error_network:  { fr: 'Connexion impossible. Vérifiez votre réseau et réessayez.', en: 'Connection failed. Check your network and try again.' },
    cart_notice_removed: { fr: '{item} n\'est plus disponible et a été retiré de votre panier.', en: '{item} is no longer available and was removed from your cart.' },
    cart_notice_reduced: { fr: 'Il ne reste que {n} exemplaire(s) de {item} : la quantité a été ajustée.', en: 'Only {n} left of {item}: the quantity was adjusted.' },

    /* --- Boutique en ligne : confirmation --- */
    thanks_eyebrow:      { fr: 'Commande confirmée', en: 'Order confirmed' },
    thanks_title:        { fr: 'Merci', en: 'Thank you' },
    thanks_body:         { fr: "Votre paiement a bien été reçu. Un reçu vous a été envoyé par email. Nous préparons votre colis et vous écrivons dès qu'il part du shop.", en: 'Your payment went through. A receipt has been emailed to you. We are preparing your parcel and will write as soon as it leaves the shop.' },
    thanks_ref:          { fr: 'Référence', en: 'Reference' },
    thanks_back:         { fr: 'Retour à la boutique', en: 'Back to the shop' },

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
    title_contact:       { fr: 'Contact - Nuit Noire Tattoo', en: 'Contact - Nuit Noire Tattoo' },
    title_about:         { fr: 'À propos - Nuit Noire Tattoo', en: 'About - Nuit Noire Tattoo' },
    title_cart:          { fr: 'Panier - Nuit Noire Tattoo', en: 'Cart - Nuit Noire Tattoo' },
    title_thanks:        { fr: 'Merci - Nuit Noire Tattoo', en: 'Thank you - Nuit Noire Tattoo' }
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

    // IMPORTANT (SEO) : le <title> ecrit dans chaque fichier HTML est la version
    // francaise de reference, optimisee pour la recherche. On ne l'ecrase JAMAIS
    // en francais : sinon les valeurs courtes de data/ui.json (title_home, etc.)
    // reprennent le dessus et Google indexe le titre reduit, puisqu'il utilise
    // le titre rendu apres execution du JS et non celui du source.
    // On ne surcharge donc que pour l'anglais.
    if (lang === DEFAULT_LANG) return;

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
