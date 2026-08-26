/* =============================================================
 * Nuit Noire Tattoo — widget "ordre du shop" pour Decap CMS
 * -------------------------------------------------------------
 * Chargé dans admin/index.html APRES decap-cms.js.
 *
 *   widget: "nn-order"   → grille de vignettes réorganisable
 *
 * Le widget va chercher tout seul la liste des produits dans la
 * collection "products" du CMS (option `collection:`), affiche une
 * vignette par produit et laisse réorganiser au glisser-déposer.
 *
 * Ce qui est enregistré dans le JSON : uniquement la suite des
 * identifiants (slugs), dans l'ordre voulu.
 *
 *   { "products": ["t-shirt-nn", "nn-cap-blue", "logo-tee"] }
 *
 * Le site ne lit pas ce fichier directement : c'est `build.js` qui
 * s'en sert pour ranger data/products/_index.json dans cet ordre.
 *
 * Règles :
 *   • un produit créé après le dernier enregistrement apparaît à la
 *     fin, marqué « nouveau ». Il suffit d'enregistrer pour le figer ;
 *   • un produit supprimé disparaît de la grille (son slug reste dans
 *     le fichier jusqu'au prochain enregistrement, sans effet) ;
 *   • l'ordre est global : les filtres Flash / Print / Merch de la page
 *     shop conservent l'ordre relatif des produits qu'ils affichent.
 *
 * Options utilisables dans config.yml :
 *   collection: "products"   collection à ordonner (défaut : products)
 *   ratio: "3:4"             format des vignettes
 *   columns: 4               nombre de colonnes
 * ============================================================= */

(function () {
  'use strict';

  if (!window.CMS || !window.h || !window.createClass) {
    console.error('[nn-order] Decap CMS introuvable — ce script doit être chargé après decap-cms.js');
    return;
  }

  var h = window.h;
  var createClass = window.createClass;

  /* ---------------------------------------------------------------
   * Utilitaires (mêmes conventions que nn-photos.js)
   * ------------------------------------------------------------- */

  function toPlain(v) {
    return v && typeof v.toJS === 'function' ? v.toJS() : v;
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }

  function opt(field, name, fallback) {
    if (!field || typeof field.get !== 'function') return fallback;
    var v = field.get(name);
    return v === undefined || v === null ? fallback : toPlain(v);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(className, text, title) {
    var b = el('button', className, text);
    b.type = 'button';
    if (title) b.title = title;
    return b;
  }

  function parseRatio(str) {
    if (!str || str === 'auto') return null;
    var m = String(str).split(/[:/]/);
    var w = num(m[0], 0), hh = num(m[1], 0);
    if (!w || !hh) return null;
    return w / hh;
  }

  /* Première photo d'un produit, quel que soit le format enregistré. */
  function firstImage(data) {
    var list = data && (data.images || data.image || data.portfolio);
    if (!list) return null;
    if (!Array.isArray(list)) list = [list];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it) continue;
      if (typeof it === 'string') return { src: it, x: 50, y: 50, z: 1 };
      var src = it.src || it.image || it.url;
      if (!src) continue;
      var f = it.focus || {};
      return {
        src: src,
        x: num(f.x, 50),
        y: num(f.y, 50),
        z: num(f.zoom, 1)
      };
    }
    return null;
  }

  var CATEGORIES = { flash: 'Flash', print: 'Print', merch: 'Merch' };

  /* Les fichiers techniques du dossier (data/products/_index.json, généré par
     build.js) ne sont pas des produits : ils ne doivent jamais apparaitre ici.
     Ils sont invisibles en ligne, mais visibles quand le CMS tourne en local. */
  function keepEntry(hit) {
    var slug = hit && hit.slug;
    return !!slug && slug.charAt(0) !== '_';
  }

  /* ---------------------------------------------------------------
   * Styles
   * ------------------------------------------------------------- */

  var CSS = [
    '.nno{font-family:inherit}',
    '.nno-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:10px}',
    '.nno-count{font-size:12px;color:#7a828c}',
    '.nno-btn{border:0;border-radius:4px;padding:7px 13px;font-size:13px;font-weight:600;cursor:pointer;background:#eceef2;color:#3d454f;line-height:1.2}',
    '.nno-btn:hover{background:#dfe3ea}',
    '.nno-area{background:#141414;border:1px solid #d9dde3;border-radius:6px;padding:10px}',
    '.nno-grid{display:grid;gap:8px}',
    '.nno-empty{grid-column:1/-1;padding:26px 12px;text-align:center;color:#8b929b;font-size:13px;border:1px dashed #3a3a3a;border-radius:4px}',
    '.nno-card{position:relative;background:#1e1e1e;border-radius:4px;overflow:hidden;cursor:grab;color:#f4efe4}',
    '.nno-card.is-dragging{opacity:.35}',
    '.nno-card.is-over{outline:2px solid #e8e2d4;outline-offset:-2px}',
    '.nno-thumb{position:relative;overflow:hidden;background:#0d0d0d}',
    '.nno-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
    '.nno-noimg{display:flex;align-items:center;justify-content:center;height:100%;color:#5a5a5a;font-size:11px}',
    '.nno-idx{position:absolute;top:4px;left:4px;background:rgba(0,0,0,.65);color:#fff;font-size:10px;line-height:1;padding:3px 5px;border-radius:3px;pointer-events:none}',
    '.nno-flag{position:absolute;top:4px;right:4px;background:#e8e2d4;color:#12211a;font-size:9px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;line-height:1;padding:3px 5px;border-radius:3px;pointer-events:none}',
    '.nno-flag.is-off{background:#6b7280;color:#fff}',
    '.nno-meta{padding:6px 7px 8px}',
    '.nno-name{font-size:12px;line-height:1.3;margin:0 0 2px;word-break:break-word;color:#f4efe4}',
    '.nno-cat{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#8b929b;margin:0}',
    '.nno-moves{display:flex;gap:3px;margin-top:6px}',
    '.nno-move{flex:1;border:0;border-radius:3px;background:#2c2c2c;color:#cfcfcf;font-size:12px;line-height:1;padding:5px 0;cursor:pointer}',
    '.nno-move:hover{background:#e8e2d4;color:#12211a}',
    '.nno-move[disabled]{opacity:.35;cursor:default}',
    '.nno-hint{font-size:12px;color:#7a828c;margin:8px 0 0;line-height:1.45}',
    '.nno-err{font-size:13px;color:#c0392b;margin:0 0 8px}'
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('nn-order-css')) return;
    var style = el('style');
    style.id = 'nn-order-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ---------------------------------------------------------------
   * Widget
   * ------------------------------------------------------------- */

  var Control = createClass({
    displayName: 'NnOrderControl',

    componentDidMount: function () {
      injectStyles();
      this.entries = [];      // [{ slug, name, category, available, image }]
      this.order = this.readValue();
      this.loading = true;
      this.error = '';
      this.buildUI();
      this.render_();
      this.loadEntries();
    },

    componentDidUpdate: function () {
      // Valeur modifiée ailleurs (chargement de la fiche, annulation…)
      if (this.props.value !== this.lastEmitted) {
        var incoming = this.readValue();
        if (incoming.join('|') !== this.order.join('|')) {
          this.order = incoming;
          this.render_();
        }
      }
    },

    readValue: function () {
      var v = toPlain(this.props.value);
      if (!v) return [];
      if (!Array.isArray(v)) v = [v];
      return v.map(function (s) {
        if (typeof s === 'string') return s;
        return (s && (s.slug || s.id)) || '';
      }).filter(Boolean);
    },

    options: function () {
      var field = this.props.field;
      return {
        collection: opt(field, 'collection', 'products'),
        ratio: parseRatio(opt(field, 'ratio', '3:4')),
        columns: num(opt(field, 'columns', 4), 4)
      };
    },

    /* -------- chargement de la liste des produits -------- */

    loadEntries: function () {
      var self = this;
      var o = this.options();
      var id = this.props.forID || this.props.uniqueFieldId || 'nn-order';

      function done(list) {
        self.entries = list;
        self.loading = false;
        self.render_();
      }

      var attempt;
      try {
        attempt = this.props.query(id, o.collection, ['name'], '');
      } catch (e) {
        attempt = null;
      }

      if (attempt && typeof attempt.then === 'function') {
        attempt.then(function (res) {
          if (!res || !res.payload || !res.payload.hits) throw new Error('réponse inattendue');
          done(res.payload.hits.filter(keepEntry).map(function (hit) { return self.toEntry(hit); }));
        }).catch(function (err) {
          console.warn('[nn-order] lecture via le CMS impossible, repli sur _index.json', err);
          self.loadFallback(o.collection);
        });
        return;
      }
      this.loadFallback(o.collection);
    },

    /* Repli : l'index généré par build.js (état du dernier déploiement). */
    loadFallback: function (collection) {
      var self = this;
      fetch('/data/' + collection + '/_index.json')
        .then(function (r) { return r.json(); })
        .then(function (index) {
          var items = (index && index.items) || [];
          self.entries = items.map(function (data) {
            return { slug: data.slug, data: data };
          }).filter(keepEntry).map(function (hit) { return self.toEntry(hit); });
          self.loading = false;
          self.render_();
        })
        .catch(function (err) {
          console.error('[nn-order] impossible de charger les produits', err);
          self.loading = false;
          self.error = 'Impossible de charger la liste des produits. Rechargez la page ; '
            + 'si le problème persiste, l\'ordre enregistré reste appliqué au site.';
          self.render_();
        });
    },

    toEntry: function (hit) {
      var data = hit.data;
      if (!data && hit.raw) {
        try { data = JSON.parse(hit.raw); } catch (e) { data = {}; }
      }
      data = toPlain(data) || {};
      return {
        slug: hit.slug,
        name: data.name || hit.slug,
        category: data.category || '',
        available: data.available !== false,
        image: firstImage(data)
      };
    },

    /* -------- ordre courant, fusionné avec les produits réels -------- */

    visibleList: function () {
      var bySlug = {};
      this.entries.forEach(function (e) { bySlug[e.slug] = e; });

      var seen = {};
      var out = [];
      this.order.forEach(function (slug) {
        if (bySlug[slug] && !seen[slug]) {
          seen[slug] = true;
          out.push({ entry: bySlug[slug], isNew: false });
        }
      });
      // Produits jamais rangés : à la fin, par ordre alphabétique.
      var rest = this.entries.filter(function (e) { return !seen[e.slug]; });
      rest.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      rest.forEach(function (e) { out.push({ entry: e, isNew: true }); });
      return out;
    },

    commitList: function (list) {
      this.order = list.map(function (row) { return row.entry.slug; });
      this.lastEmitted = this.order.slice();
      this.props.onChange(this.order.slice());
    },

    move: function (from, to) {
      var list = this.visibleList();
      if (to < 0 || to >= list.length || from === to) return;
      var moved = list.splice(from, 1)[0];
      list.splice(to, 0, moved);
      this.commitList(list);
      this.render_();
    },

    /* -------- interface -------- */

    buildUI: function () {
      var self = this;
      var root = this.root;
      root.className = (this.props.classNameWrapper || '') + ' nno';
      root.innerHTML = '';

      var bar = el('div', 'nno-bar');
      this.status = el('span', 'nno-count');
      bar.appendChild(this.status);
      this.btnAlpha = button('nno-btn', 'Ranger par nom', 'Remettre tous les produits par ordre alphabétique');
      bar.appendChild(this.btnAlpha);
      root.appendChild(bar);

      this.errorBox = el('p', 'nno-err');
      this.errorBox.style.display = 'none';
      root.appendChild(this.errorBox);

      this.area = el('div', 'nno-area');
      this.grid = el('div', 'nno-grid');
      this.area.appendChild(this.grid);
      root.appendChild(this.area);

      root.appendChild(el('p', 'nno-hint',
        'Glissez les vignettes pour changer l\'ordre de la grille du shop. '
        + 'La première vignette est le premier produit affiché en ligne. '
        + 'Les produits ajoutés depuis le dernier enregistrement apparaissent à la fin, marqués « nouveau ».'));

      this.btnAlpha.addEventListener('click', function () {
        var list = self.visibleList().slice();
        list.sort(function (a, b) { return String(a.entry.name).localeCompare(String(b.entry.name)); });
        self.commitList(list);
        self.render_();
      });
    },

    render_: function () {
      var self = this;
      var o = this.options();
      this.grid.style.gridTemplateColumns = 'repeat(' + o.columns + ', minmax(0, 1fr))';
      this.grid.innerHTML = '';

      this.errorBox.style.display = this.error ? 'block' : 'none';
      this.errorBox.textContent = this.error || '';

      if (this.loading) {
        this.grid.appendChild(el('div', 'nno-empty', 'Chargement des produits…'));
        this.status.textContent = '';
        return;
      }

      var list = this.visibleList();

      if (!list.length) {
        this.grid.appendChild(el('div', 'nno-empty', 'Aucun produit pour le moment.'));
        this.status.textContent = '';
        return;
      }

      list.forEach(function (row, i) {
        var card = el('div', 'nno-card');
        card.dataset.index = String(i);

        var thumb = el('div', 'nno-thumb');
        if (o.ratio) thumb.style.aspectRatio = o.ratio.toFixed(4);
        if (row.entry.image) {
          var img = el('img');
          img.src = row.entry.image.src;
          img.alt = '';
          img.loading = 'lazy';
          var pos = row.entry.image.x + '% ' + row.entry.image.y + '%';
          img.style.objectPosition = pos;
          if (row.entry.image.z !== 1) {
            img.style.transformOrigin = pos;
            img.style.transform = 'scale(' + row.entry.image.z + ')';
          }
          img.addEventListener('error', function () {
            thumb.innerHTML = '';
            thumb.appendChild(el('div', 'nno-noimg', 'photo indisponible'));
          });
          thumb.appendChild(img);
        } else {
          thumb.appendChild(el('div', 'nno-noimg', 'sans photo'));
        }
        thumb.appendChild(el('span', 'nno-idx', String(i + 1)));
        if (row.isNew) thumb.appendChild(el('span', 'nno-flag', 'nouveau'));
        else if (!row.entry.available) thumb.appendChild(el('span', 'nno-flag is-off', 'masqué'));
        card.appendChild(thumb);

        var meta = el('div', 'nno-meta');
        meta.appendChild(el('p', 'nno-name', row.entry.name));
        meta.appendChild(el('p', 'nno-cat', CATEGORIES[row.entry.category] || row.entry.category || ''));

        var moves = el('div', 'nno-moves');
        var up = button('nno-move', '←', 'Reculer d\'une place');
        var down = button('nno-move', '→', 'Avancer d\'une place');
        up.disabled = i === 0;
        down.disabled = i === list.length - 1;
        up.addEventListener('click', function (e) { e.stopPropagation(); self.move(i, i - 1); });
        down.addEventListener('click', function (e) { e.stopPropagation(); self.move(i, i + 1); });
        moves.appendChild(up);
        moves.appendChild(down);
        meta.appendChild(moves);
        card.appendChild(meta);

        /* Glisser-déposer */
        card.draggable = true;
        card.addEventListener('dragstart', function (e) {
          self.dragFrom = i;
          card.classList.add('is-dragging');
          try {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(i));
          } catch (err) {}
        });
        card.addEventListener('dragend', function () {
          card.classList.remove('is-dragging');
          self.dragFrom = null;
        });
        card.addEventListener('dragover', function (e) {
          if (self.dragFrom === null || self.dragFrom === undefined) return;
          e.preventDefault();
          e.stopPropagation();
          card.classList.add('is-over');
        });
        card.addEventListener('dragleave', function () {
          card.classList.remove('is-over');
        });
        card.addEventListener('drop', function (e) {
          if (self.dragFrom === null || self.dragFrom === undefined) return;
          e.preventDefault();
          e.stopPropagation();
          card.classList.remove('is-over');
          var from = self.dragFrom;
          self.dragFrom = null;
          self.move(from, i);
        });

        self.grid.appendChild(card);
      });

      var n = list.length;
      var news = list.filter(function (r) { return r.isNew; }).length;
      this.status.textContent = n + (n > 1 ? ' produits' : ' produit')
        + (news ? ' — ' + news + (news > 1 ? ' nouveaux à ranger' : ' nouveau à ranger') : '');
    },

    render: function () {
      var self = this;
      return h('div', {
        ref: function (node) { if (node) self.root = node; }
      });
    }
  });

  var Preview = createClass({
    render: function () {
      var v = toPlain(this.props.value) || [];
      return h('ol', null, v.map(function (slug, i) {
        return h('li', { key: i }, String(slug));
      }));
    }
  });

  window.CMS.registerWidget('nn-order', Control, Preview);
})();
