/* =============================================================
 * Nuit Noire Tattoo — bouton « Dupliquer » dans la liste du CMS
 * -------------------------------------------------------------
 * Chargé dans admin/index.html APRES decap-cms.js.
 *
 * Decap sait déjà dupliquer une fiche, mais la commande est cachée :
 * il faut ouvrir la fiche, cliquer le bouton vert « Publiée » en haut
 * a droite, puis « Dupliquer » dans le menu deroulant.
 *
 * Ce script ajoute un bouton « Dupliquer » directement sur chaque
 * ligne de la liste des produits. Au clic, il ouvre la fiche et
 * declenche la commande native de Decap : on se retrouve sur un
 * nouveau brouillon pre-rempli (photos, prix, stock, descriptions),
 * qu'il reste a renommer puis a publier.
 *
 * ATTENTION — comme nn-admin.css, ce fichier s'accroche a l'interface
 * interne de Decap (le libelle du menu « Dupliquer », la structure de
 * la liste). Il ne peut rien casser : en cas d'echec, il affiche un
 * message expliquant le geste manuel, et le CMS continue de
 * fonctionner normalement. A reverifier apres chaque changement de
 * version de Decap dans admin/index.html. Supprimer la ligne qui
 * charge ce fichier suffit a revenir au comportement d'origine.
 *
 * Collections concernees : voir COLLECTIONS ci-dessous.
 * ============================================================= */

(function () {
  'use strict';

  /* Collections (nom technique dans config.yml) ou le bouton apparait. */
  var COLLECTIONS = ['products'];

  /* Libelles possibles de la commande native, selon la langue. */
  var DUPLICATE_LABEL = /dupliqu|duplicate|duplicar|duplizieren|kopi/i;

  /* Boutons deroulants a ignorer quand on cherche celui de la fiche. */
  var IGNORE_DROPDOWN = /ajout rapide|quick add|trier|grouper|sort by|group by/i;

  var MANUAL_HELP = 'La duplication automatique n\'a pas abouti. '
    + 'Depuis la fiche ouverte : cliquez le bouton vert « Publiée » en haut, '
    + 'puis « Dupliquer ».';

  /* ---------------------------------------------------------------
   * Petits utilitaires
   * ------------------------------------------------------------- */

  function injectStyles() {
    if (document.getElementById('nn-duplicate-css')) return;
    var style = document.createElement('style');
    style.id = 'nn-duplicate-css';
    style.textContent = [
      '.nnd-host{position:relative}',
      '.nnd-btn{position:absolute;top:12px;right:14px;z-index:5;',
      '  border:1px solid #d4d7dd;border-radius:4px;background:#fff;color:#3d454f;',
      '  font-size:12px;font-weight:600;line-height:1;padding:7px 10px;cursor:pointer;',
      '  opacity:0;transition:opacity .12s,background .12s}',
      '.nnd-host:hover .nnd-btn,.nnd-btn:focus{opacity:1}',
      /* Sur tablette il n\'y a pas de survol : le bouton reste visible. */
      '@media (hover: none){.nnd-btn{opacity:1}}',
      '.nnd-btn:hover{background:#12211a;color:#e8e2d4;border-color:#12211a}',
      '.nnd-btn[disabled]{opacity:1;cursor:default;background:#eceef2;color:#7a828c}',
      '.nnd-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9999;',
      '  max-width:560px;background:#12211a;color:#e8e2d4;font-size:13px;line-height:1.45;',
      '  padding:12px 16px;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.28)}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function toast(message, ms) {
    injectStyles();
    var node = document.createElement('div');
    node.className = 'nnd-toast';
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, ms || 4000);
  }

  /* Attend qu'une condition soit vraie. Renvoie une promesse. */
  function waitFor(test, timeout, interval) {
    var deadline = Date.now() + (timeout || 12000);
    var step = interval || 150;
    return new Promise(function (resolve, reject) {
      (function tick() {
        var result;
        try { result = test(); } catch (e) { result = null; }
        if (result) return resolve(result);
        if (Date.now() > deadline) return reject(new Error('délai dépassé'));
        setTimeout(tick, step);
      })();
    });
  }

  /* ---------------------------------------------------------------
   * Declenchement de la duplication native
   * ------------------------------------------------------------- */

  /* Boutons deroulants candidats dans la barre d'outils de la fiche. */
  function dropdownButtons() {
    var all = [].slice.call(document.querySelectorAll('[aria-haspopup="true"]'));
    return all.filter(function (b) {
      var text = (b.textContent || '').trim();
      return text && !IGNORE_DROPDOWN.test(text);
    });
  }

  function findDuplicateItem() {
    var items = [].slice.call(document.querySelectorAll('[role="menuitem"]'));
    for (var i = 0; i < items.length; i++) {
      if (DUPLICATE_LABEL.test(items[i].textContent || '')) return items[i];
    }
    return null;
  }

  function closeMenus() {
    document.body.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', keyCode: 27, bubbles: true
    }));
  }

  /* La fiche est consideree chargee quand un champ porte une valeur. */
  function editorLooksLoaded() {
    var fields = document.querySelectorAll('#nc-root input[type="text"], #nc-root textarea, #nc-root input:not([type])');
    for (var i = 0; i < fields.length; i++) {
      if ((fields[i].value || '').trim()) return true;
    }
    return false;
  }

  function triggerNativeDuplicate() {
    var buttons = dropdownButtons();
    if (!buttons.length) return Promise.reject(new Error('menu introuvable'));

    function tryButton(index) {
      if (index >= buttons.length) return Promise.reject(new Error('commande introuvable'));
      buttons[index].click();
      return waitFor(findDuplicateItem, 1200, 100)
        .then(function (item) { item.click(); return true; })
        .catch(function () {
          closeMenus();
          return tryButton(index + 1);
        });
    }
    return tryButton(0);
  }

  function duplicateEntry(collection, slug, btn) {
    var target = '#/collections/' + collection + '/entries/' + slug;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Duplication…';
    }
    window.location.hash = target;

    waitFor(function () {
      return window.location.hash.indexOf(target) === 0 && editorLooksLoaded();
    }, 15000)
      .then(function () {
        // Petite pause : le formulaire vient d'etre peuple.
        return new Promise(function (r) { setTimeout(r, 500); });
      })
      .then(triggerNativeDuplicate)
      .then(function () {
        return waitFor(function () {
          return /\/new$/.test(window.location.hash);
        }, 6000);
      })
      .then(function () {
        toast('Copie créée. Changez le nom du produit, puis publiez.', 6000);
      })
      .catch(function (err) {
        console.warn('[nn-duplicate] duplication automatique impossible', err);
        toast(MANUAL_HELP, 9000);
      });
  }

  /* ---------------------------------------------------------------
   * Injection du bouton dans la liste
   * ------------------------------------------------------------- */

  function decorate() {
    injectStyles();
    COLLECTIONS.forEach(function (collection) {
      var prefix = '#/collections/' + collection + '/entries/';
      var links = document.querySelectorAll('a[href^="' + prefix + '"]');
      [].forEach.call(links, function (link) {
        var host = link.parentNode;
        if (!host || host.nodeType !== 1) return;
        if (host.querySelector(':scope > .nnd-btn')) return;

        var slug = link.getAttribute('href').slice(prefix.length);
        if (!slug || slug.indexOf('/') !== -1) return;
        // data/products/_index.json est un fichier technique, pas un produit.
        if (slug.charAt(0) === '_') return;

        host.classList.add('nnd-host');

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nnd-btn';
        btn.textContent = 'Dupliquer';
        btn.title = 'Créer une copie de ce produit';
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          duplicateEntry(collection, slug, btn);
        });
        host.appendChild(btn);
      });
    });
  }

  var pending = null;
  function scheduleDecorate() {
    if (pending) return;
    pending = setTimeout(function () {
      pending = null;
      decorate();
    }, 120);
  }

  function start() {
    decorate();
    var observer = new MutationObserver(scheduleDecorate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', scheduleDecorate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
