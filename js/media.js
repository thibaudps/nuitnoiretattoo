/* =============================================================
 * Nuit Noire Tattoo — helpers images
 * -------------------------------------------------------------
 * Le CMS enregistre les photos sous la forme :
 *   { "src": "/assets/uploads/x.webp", "focus": { "x": 50, "y": 30, "zoom": 1.2 } }
 *
 * "focus" est le point de cadrage choisi dans le CMS. Il est traduit ici en
 * object-position + transform, ce qui recadre la photo dans le cadre du site
 * sans jamais modifier le fichier d'origine.
 *
 * Les anciens formats restent lus :
 *   "/assets/uploads/x.webp"          (texte brut)
 *   { "image": "/assets/…" }          (ancienne grille d'accueil)
 *   { "src": "/assets/…" }            (ancien portfolio)
 * ============================================================= */

(function () {
  'use strict';

  function src(item) {
    if (!item) return '';
    if (typeof item === 'string') return item;
    return item.src || item.image || item.url || '';
  }

  /* Attribut style à injecter sur la balise <img>. Vide si pas de recadrage. */
  function style(item) {
    if (!item || typeof item === 'string') return '';
    var f = item.focus;
    if (!f) return '';

    var x = Number(f.x);
    var y = Number(f.y);
    var z = Number(f.zoom);
    if (isNaN(x)) x = 50;
    if (isNaN(y)) y = 50;
    if (isNaN(z) || z < 1) z = 1;

    if (x === 50 && y === 50 && z === 1) return '';

    var pos = x + '% ' + y + '%';
    var out = 'object-position:' + pos + ';--nn-origin:' + pos + ';';
    if (z !== 1) out += '--nn-zoom:' + z + ';';
    return out;
  }

  /* Fragment prêt à insérer dans un template : ` style="…"` (ou chaîne vide) */
  function styleAttr(item) {
    var s = style(item);
    return s ? ' style="' + s + '"' : '';
  }

  /* Lien au clic d'une photo, vide si absent ou douteux.
     N'accepte qu'une adresse web, un mail ou un chemin interne : une faute de
     frappe dans le CMS ne produit pas un lien cassé. Sans lien, l'appelant doit
     utiliser une <div> et non un <a href="#">, qui renverrait en haut de page. */
  function link(item) {
    if (!item || typeof item === 'string' || !item.link) return '';
    var clean = String(item.link).trim();
    return /^(https?:\/\/|mailto:|\/|#)/i.test(clean) ? clean : '';
  }

  /* Applique le cadrage sur une <img> existante */
  function apply(img, item) {
    if (!img) return;
    var s = style(item);
    if (s) img.setAttribute('style', s);
    else img.removeAttribute('style');
  }

  window.NNMedia = { src: src, style: style, styleAttr: styleAttr, apply: apply, link: link };
})();
