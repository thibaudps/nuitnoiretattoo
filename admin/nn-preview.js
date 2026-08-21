/* =============================================================
 * Nuit Noire Tattoo — aperçu en direct dans le CMS
 * -------------------------------------------------------------
 * Affiche, à droite du formulaire, le rendu réel de la page avec
 * le CSS du site. Le volet se met à jour à chaque frappe.
 *
 * Fonctionnement :
 *   1. registerPreviewStyle charge css/main.css (et les polices)
 *      dans l'iframe d'aperçu ;
 *   2. registerPreviewTemplate associe un gabarit à chaque page.
 *      Le nom du gabarit est le nom du FICHIER pour les pages
 *      (homepage, about_page…) et le nom de la COLLECTION pour les
 *      dossiers (artists, products).
 *
 * Le balisage reproduit celui de js/*.js. Si tu modifies le rendu
 * du site, pense à répercuter ici, sinon l'aperçu ment.
 * ============================================================= */

(function () {
  'use strict';

  if (!window.CMS || !window.h || !window.createClass) {
    console.error('[nn-preview] Decap CMS introuvable — charger ce script après decap-cms.js');
    return;
  }

  var h = window.h;
  var createClass = window.createClass;

  /* ---------------------------------------------------------------
   * Feuilles de style injectées dans l'iframe d'aperçu
   * ------------------------------------------------------------- */

  window.CMS.registerPreviewStyle('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&display=swap');
  window.CMS.registerPreviewStyle('/css/main.css');
  window.CMS.registerPreviewStyle([
    /* Le site cale certaines pages sur la hauteur de l'écran via JS.
       Dans le volet d'aperçu on laisse le contenu couler. */
    'html,body{height:auto;overflow:auto}',
    '.about-content{height:auto !important;min-height:0}',
    '.nnpv-wrap{padding:22px 18px 40px}',
    '.nnpv-note{margin:0 0 18px;padding:10px 12px;border-left:2px solid #6b7f70;',
    'background:rgba(255,255,255,.04);color:#a9b3ab;font-size:12px;line-height:1.5;font-family:Inter,sans-serif}',
    '.nnpv-label{margin:26px 0 10px;color:#6f7a72;font-size:10px;letter-spacing:.22em;',
    'text-transform:uppercase;font-family:Inter,sans-serif}',
    '.nnpv-label:first-child{margin-top:0}'
  ].join(''), { raw: true });

  /* ---------------------------------------------------------------
   * Utilitaires de lecture des données de l'entrée
   * ------------------------------------------------------------- */

  var LANG = 'fr';

  function plain(v) {
    return v && typeof v.toJS === 'function' ? v.toJS() : v;
  }

  /* Valeur d'un champ de l'entrée en cours */
  function get(props, name) {
    return plain(props.entry.getIn(['data', name]));
  }

  /* Champ traduisible {fr, en} → texte français */
  function t(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object') return value[LANG] || value.fr || value.en || '';
    return '';
  }

  /* Photo : accepte "/chemin.webp", {src, focus}, {image} (ancien format) */
  function photoSrc(item) {
    if (!item) return '';
    var src = typeof item === 'string' ? item : (item.src || item.image || item.url || '');
    if (!src) return '';
    // Une photo tout juste ajoutée n'existe pas encore sur le site : on
    // récupère l'aperçu local créé par le widget.
    var blobs = window.NNPhotoBlobs || {};
    return blobs[src] || src;
  }

  /* Cadrage → style React, identique à ce que fait js/media.js */
  function photoStyle(item) {
    if (!item || typeof item === 'string' || !item.focus) return undefined;
    var f = item.focus;
    var x = isNaN(Number(f.x)) ? 50 : Number(f.x);
    var y = isNaN(Number(f.y)) ? 50 : Number(f.y);
    var z = isNaN(Number(f.zoom)) || Number(f.zoom) < 1 ? 1 : Number(f.zoom);
    if (x === 50 && y === 50 && z === 1) return undefined;
    var pos = x + '% ' + y + '%';
    return { objectPosition: pos, transformOrigin: pos, transform: 'scale(' + z + ')' };
  }

  function list(v) {
    var arr = plain(v);
    if (!arr) return [];
    return Array.isArray(arr) ? arr : [arr];
  }

  function wrap(children) {
    return h('div', { className: 'nnpv-wrap' }, children);
  }

  function note(text) {
    return h('p', { className: 'nnpv-note', key: 'note' }, text);
  }

  function label(text) {
    return h('p', { className: 'nnpv-label', key: 'l' + text }, text);
  }

  function workItem(item, i, alt) {
    return h('div', { className: 'work-item', key: i },
      h('img', { src: photoSrc(item), style: photoStyle(item), alt: alt || '' })
    );
  }

  /* ---------------------------------------------------------------
   * Accueil
   * ------------------------------------------------------------- */

  var HomePreview = createClass({
    render: function () {
      var props = this.props;
      var phrases = list(get(props, 'phrases'));
      var photos = list(get(props, 'latest_work')).filter(function (p) { return photoSrc(p); });
      var visible = photos.slice(0, 6);

      return wrap([
        label('Phrases de l\'animation'),
        h('div', { key: 'ph', style: { fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: '#e8e2d4', lineHeight: 1.5 } },
          phrases.map(function (p, i) {
            return h('p', { key: i, style: { margin: '0 0 6px' } }, t(p && p.text));
          })
        ),

        label('Texte de présentation'),
        h('p', { key: 'intro', style: { color: '#a9b3ab', fontSize: '14px', lineHeight: 1.8, maxWidth: '640px' } },
          t(get(props, 'intro_text'))),

        label('Grille de photos'),
        h('div', { key: 'head', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' } }, [
          h('span', { key: 'a', style: { fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: '#e8e2d4' } },
            t(get(props, 'latest_work_title'))),
          h('span', { key: 'b', style: { fontSize: '11px', letterSpacing: '.2em', color: '#6f7a72' } },
            get(props, 'instagram_handle') || '')
        ]),
        visible.length
          ? h('div', { key: 'grid', className: 'latest-work-grid' }, visible.map(function (p, i) {
              return workItem(p, i, 'Tatouage Nuit Noire');
            }))
          : note('Aucune photo pour le moment.'),
        photos.length > 6
          ? note('Les ' + (photos.length - 6) + ' dernières photos ne sont pas affichées : la grille s\'arrête à 6.')
          : null
      ]);
    }
  });

  /* ---------------------------------------------------------------
   * Fiche artiste
   * ------------------------------------------------------------- */

  var ROLES_EN = {
    'Fondateur': 'Founder', 'Fondatrice': 'Founder',
    'Résident': 'Resident', 'Résidente': 'Resident',
    'Invité': 'Guest', 'Invitée': 'Guest'
  };

  var ArtistPreview = createClass({
    render: function () {
      var props = this.props;
      var name = get(props, 'name') || 'Sans nom';
      var portrait = get(props, 'portrait');
      var portfolio = list(get(props, 'portfolio')).filter(function (p) { return photoSrc(p); });
      var isGuest = !!get(props, 'guest');
      var bio = get(props, 'bio') || '';
      var insta = get(props, 'instagram');

      if (isGuest) {
        return wrap([
          note('Fiche « guest » : mise en page simplifiée, la photo s\'affiche en entier.'),
          h('section', { key: 's', className: 'artist-section guest-section' }, [
            h('h2', { key: 'n', className: 'artist-name guest-name' }, name),
            portrait ? h('div', { key: 'i', className: 'guest-image' },
              h('img', { src: photoSrc(portrait), alt: name })) : null,
            bio ? h('p', { key: 'b', className: 'guest-text' }, bio) : null,
            insta ? h('a', { key: 'ig', className: 'artist-instagram' }, '@' + insta + ' ↗') : null
          ])
        ]);
      }

      return wrap(
        h('section', { className: 'artist-section' }, [
          h('div', { key: 'intro', className: 'artist-intro' }, [
            h('div', { key: 'p', className: 'artist-portrait' },
              portrait
                ? h('img', { src: photoSrc(portrait), style: photoStyle(portrait), alt: name })
                : null),
            h('div', { key: 'i', className: 'artist-info' }, [
              h('p', { key: 'r', className: 'artist-role' }, get(props, 'role') || ''),
              h('h2', { key: 'n', className: 'artist-name' }, name),
              h('p', { key: 'b', className: 'artist-bio' }, bio),
              insta ? h('a', { key: 'ig', className: 'artist-instagram' }, '@' + insta + ' ↗') : null
            ])
          ]),
          h('div', { key: 'pf', className: 'artist-portfolio' },
            h('div', { className: 'artist-portfolio-grid' },
              portfolio.length
                ? portfolio.map(function (p, i) { return workItem(p, i, 'Tatouage par ' + name); })
                : null))
        ])
      );
    }
  });

  /* ---------------------------------------------------------------
   * Fiche produit
   * ------------------------------------------------------------- */

  var CATS = { print: 'Print', merch: 'Merch' };

  var ProductPreview = createClass({
    render: function () {
      var props = this.props;

      /* Le produit porte desormais une liste "images" (jusqu'a 3). On affiche
         la premiere dans l'apercu, et on lit encore l'ancien champ "image"
         pour les fiches creees avant ce changement. */
      var images = get(props, 'images');
      if (images && typeof images.toJS === 'function') images = images.toJS();
      var image = (Array.isArray(images) && images.length) ? images[0] : get(props, 'image');
      var extra = (Array.isArray(images) ? images.length : 0) - 1;

      /* Meme regle que sur le site : masque a la main, ou stock a zero. */
      var variants = get(props, 'variants');
      if (variants && typeof variants.toJS === 'function') variants = variants.toJS();
      var sized = Array.isArray(variants) ? variants.filter(function (v) { return v && v.size; }) : [];
      var stock = sized.length
        ? sized.reduce(function (sum, v) { return sum + (Number(v.stock) || 0); }, 0)
        : (Number(get(props, 'stock')) || 0);
      var soldOut = get(props, 'available') === false
        || (get(props, 'sellable') !== false && stock <= 0);

      return wrap(
        h('div', { style: { maxWidth: '300px' } },
          h('article', { className: 'product-card' + (soldOut ? ' is-sold-out' : '') }, [
            h('div', { key: 'im', className: 'product-image' }, [
              image
                ? h('div', { key: 't', className: 'product-track' },
                    h('div', { className: 'product-slide' },
                      h('img', { src: photoSrc(image), style: photoStyle(image), alt: '' })))
                : null,
              extra > 0
                ? h('div', { key: 'd', className: 'product-dots' },
                    [0, 1, 2].slice(0, extra + 1).map(function (i) {
                      return h('span', { key: i, className: 'product-dot' + (i === 0 ? ' is-active' : '') });
                    }))
                : null,
              soldOut ? h('span', { key: 'b', className: 'product-ribbon' }, 'Sold out') : null
            ]),
            h('div', { key: 'inf', className: 'product-info' }, [
              h('p', { key: 'c', className: 'product-category' }, CATS[get(props, 'category')] || ''),
              h('h3', { key: 'n', className: 'product-name' }, get(props, 'name') || 'Sans nom'),
              h('p', { key: 'a', className: 'product-artist' }, 'par ' + (get(props, 'artist') || '')),
              get(props, 'description')
                ? h('p', { key: 'd', className: 'product-description' }, get(props, 'description'))
                : null,
              h('p', { key: 'p', className: 'product-price' }, get(props, 'price') || '')
            ])
          ])
        )
      );
    }
  });

  /* ---------------------------------------------------------------
   * À propos
   * ------------------------------------------------------------- */

  var AboutPreview = createClass({
    render: function () {
      var props = this.props;
      var image = get(props, 'image');
      var body = t(get(props, 'body'));
      var paras = String(body).trim().split(/\n\s*\n/).filter(Boolean);

      return wrap(
        h('section', { className: 'about-content' }, [
          image ? h('figure', { key: 'f', className: 'about-photo' },
            h('img', { src: photoSrc(image), style: photoStyle(image), alt: t(get(props, 'image_alt')) })) : null,
          h('div', { key: 'b', className: 'about-body' }, paras.map(function (p, i) {
            return h('p', { key: i }, p.split('\n').map(function (line, j) {
              return j === 0 ? line : [h('br', { key: 'br' + j }), line];
            }));
          }))
        ])
      );
    }
  });

  /* ---------------------------------------------------------------
   * FAQ
   * ------------------------------------------------------------- */

  var FaqPreview = createClass({
    render: function () {
      var items = list(get(this.props, 'items'));
      return wrap([
        note('Sur le site, chaque question s\'ouvre au clic. Ici tout est déplié.'),
        h('div', { key: 'l', className: 'faq-list' }, items.map(function (item, i) {
          return h('details', { key: i, className: 'faq-item', open: true }, [
            h('summary', { key: 's', className: 'faq-summary' }, [
              h('span', { key: 'q', className: 'faq-question' }, t(item && item.question)),
              h('span', { key: 'm', className: 'faq-marker' }, '+')
            ]),
            h('div', { key: 'a', className: 'faq-answer' },
              h('p', {}, t(item && item.answer)))
          ]);
        }))
      ]);
    }
  });

  /* ---------------------------------------------------------------
   * Contact : bloc d'informations
   * ------------------------------------------------------------- */

  var ContactPreview = createClass({
    render: function () {
      var props = this.props;
      function block(lbl, value) {
        if (!value) return null;
        return h('div', { className: 'contact-block', key: lbl }, [
          h('p', { key: 'l', className: 'contact-label' }, lbl),
          h('p', { key: 'v', className: 'contact-value' }, value)
        ]);
      }
      var hoursNote = t(get(props, 'hours_note'));
      return wrap([
        note('Le formulaire et la carte ne sont pas repris ici : ils ne dépendent pas de ce que tu écris.'),
        h('div', { key: 'd', className: 'contact-details' }, [
          block('Adresse', t(get(props, 'address'))),
          block('Téléphone', get(props, 'phone')),
          block('Direct', get(props, 'email')),
          block('Horaires', t(get(props, 'hours')) + (hoursNote ? ' — ' + hoursNote : ''))
        ]),
        label('Introduction du formulaire'),
        h('h3', { key: 'ft', style: { fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: '#e8e2d4', margin: '0 0 10px' } },
          t(get(props, 'form_intro_title'))),
        h('p', { key: 'fx', style: { color: '#a9b3ab', fontSize: '14px', lineHeight: 1.8, maxWidth: '520px' } },
          t(get(props, 'form_intro_text'))),
        get(props, 'form_photos_note')
          ? h('p', { key: 'fn', style: { color: '#6f7a72', fontSize: '13px', lineHeight: 1.7, maxWidth: '520px' } },
              t(get(props, 'form_photos_note')))
          : null
      ]);
    }
  });

  /* ---------------------------------------------------------------
   * Shop : seuls les textes du bas sont visibles sur le site
   * ------------------------------------------------------------- */

  var ShopPagePreview = createClass({
    render: function () {
      var props = this.props;
      return wrap([
        note('L\'étiquette, le titre et le sous-titre ne s\'affichent pas sur le site : le design masque l\'en-tête des sous-pages. Seul le texte ci-dessous est visible.'),
        h('section', { key: 's', className: 'shop-info' },
          h('div', { className: 'shop-info-block' }, [
            h('h3', { key: 'h' }, 'Commander'),
            h('p', { key: 'p' }, t(get(props, 'order_info'))),
            h('a', { key: 'a', className: 'link-underline' }, 'Nous contacter →')
          ]))
      ]);
    }
  });

  /* ---------------------------------------------------------------
   * Artistes : en-tête de page (non affichée sur le site)
   * ------------------------------------------------------------- */

  var ArtistsPagePreview = createClass({
    render: function () {
      var props = this.props;
      return wrap([
        note('Ces trois textes ne sont pas affichés sur le site : le design masque l\'en-tête des sous-pages. Ils restent utiles si tu réactives un jour ces titres.'),
        h('div', { key: 'p', style: { fontFamily: 'Inter, sans-serif', color: '#6f7a72', fontSize: '13px', lineHeight: 2 } }, [
          h('div', { key: 'e' }, 'Étiquette : ' + t(get(props, 'eyebrow'))),
          h('div', { key: 't', style: { fontFamily: 'Cormorant Garamond, serif', fontSize: '30px', color: '#e8e2d4' } },
            t(get(props, 'title'))),
          h('div', { key: 's' }, t(get(props, 'subtitle')))
        ])
      ]);
    }
  });

  /* ---------------------------------------------------------------
   * Enregistrement
   * Pages  → nom du fichier ; dossiers → nom de la collection.
   * ------------------------------------------------------------- */

  window.CMS.registerPreviewTemplate('homepage', HomePreview);
  window.CMS.registerPreviewTemplate('about_page', AboutPreview);
  window.CMS.registerPreviewTemplate('faq_page', FaqPreview);
  window.CMS.registerPreviewTemplate('contact_page', ContactPreview);
  window.CMS.registerPreviewTemplate('shop_page', ShopPagePreview);
  window.CMS.registerPreviewTemplate('artists_page', ArtistsPagePreview);
  window.CMS.registerPreviewTemplate('artists', ArtistPreview);
  window.CMS.registerPreviewTemplate('products', ProductPreview);
})();
