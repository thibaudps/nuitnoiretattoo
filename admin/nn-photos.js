/* =============================================================
 * Nuit Noire Tattoo — widgets photos pour Decap CMS
 * -------------------------------------------------------------
 * Deux widgets maison, chargés dans admin/index.html APRES decap-cms.js :
 *
 *   widget: "nn-gallery"  → une galerie complète (accueil, portfolios)
 *   widget: "nn-photo"    → une seule photo (portrait, à propos, produit)
 *
 * Ce qu'ils apportent par rapport aux listes Decap classiques :
 *   • on ajoute 20 photos d'un coup (sélection multiple ou glisser-déposer),
 *     sans créer une section par photo ;
 *   • les vignettes sont affichées au format réel du site (aperçu) ;
 *   • réorganisation par glisser-déposer ;
 *   • recadrage non destructif : on déplace la photo dans le cadre et on
 *     zoome. Le fichier d'origine n'est jamais modifié, seul un point de
 *     cadrage est enregistré dans le JSON et appliqué par le site.
 *   • les photos trop lourdes sont automatiquement redimensionnées et
 *     converties en .webp avant l'envoi (le repo ne gonfle pas).
 *
 * Format enregistré dans le JSON :
 *   galerie : [ { "src": "/assets/uploads/x.webp",
 *                 "focus": { "x": 50, "y": 30, "zoom": 1.2 },   ← seulement si recadré
 *                 "link": "https://…" } ]                        ← seulement si renseigné
 *   photo   : { "src": "/assets/uploads/x.webp", "focus": { … } }
 *
 * Les anciens formats ("/assets/…" en texte brut, { "image": … },
 * { "src": … }) restent lus sans rien casser.
 *
 * Options utilisables dans config.yml :
 *   ratio: "3:4"        format du cadre affiché sur le site ("auto" = pas de recadrage)
 *   columns: 3          nb de colonnes de l'aperçu (galerie)
 *   max_visible: 6      au-delà, les photos sont grisées (non affichées sur le site)
 *   allow_link: true    active le champ "lien" par photo (accueil)
 *   max_width: 2000     redimensionnement auto à l'envoi (px)
 *   quality: 0.82       qualité webp
 * ============================================================= */

(function () {
  'use strict';

  if (!window.CMS || !window.h || !window.createClass) {
    console.error('[nn-photos] Decap CMS introuvable — ce script doit être chargé après decap-cms.js');
    return;
  }

  var h = window.h;
  var createClass = window.createClass;

  /* Aperçus locaux des fichiers tout juste envoyés (pas encore commités) :
     chemin public → blob URL. Sinon la vignette afficherait un 404 tant que
     l'entrée n'est pas enregistrée.
     Exposé pour que le volet d'aperçu (nn-preview.js) affiche lui aussi les
     photos qui viennent d'être ajoutées. */
  var BLOBS = window.NNPhotoBlobs || (window.NNPhotoBlobs = {});

  /* ---------------------------------------------------------------
   * Petits utilitaires
   * ------------------------------------------------------------- */

  function toPlain(v) {
    return v && typeof v.toJS === 'function' ? v.toJS() : v;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
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

  function uid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'nn-' + Math.random().toString(36).slice(2) + Date.now();
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

  /* "3:4" → 0.75 ; "auto" → null */
  function parseRatio(str) {
    if (!str || str === 'auto') return null;
    var m = String(str).split(/[:/]/);
    var w = num(m[0], 0), hh = num(m[1], 0);
    if (!w || !hh) return null;
    return w / hh;
  }

  /* Chemin public d'un fichier envoyé : /assets/uploads/<nom> */
  function publicPath(config, repoPath) {
    var folder = '/assets/uploads';
    if (config) {
      var v = typeof config.get === 'function' ? config.get('public_folder') : config.public_folder;
      if (v) folder = v;
    }
    var base = String(repoPath).split('/').pop();
    return folder.replace(/\/+$/, '') + '/' + base;
  }

  /* URL utilisable pour l'affichage dans le CMS */
  function displaySrc(src) {
    return BLOBS[src] || src;
  }

  /* ---------------------------------------------------------------
   * Normalisation / sérialisation des valeurs
   * ------------------------------------------------------------- */

  function normalizeItem(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
      return raw ? { src: raw, x: 50, y: 50, z: 1, link: '' } : null;
    }
    var o = toPlain(raw) || {};
    var src = o.src || o.image || o.url || '';
    if (!src) return null;
    var f = o.focus || {};
    return {
      src: src,
      x: clamp(num(f.x, 50), 0, 100),
      y: clamp(num(f.y, 50), 0, 100),
      z: clamp(num(f.zoom, 1), 1, 4),
      link: o.link || ''
    };
  }

  function normalizeList(value) {
    var arr = toPlain(value);
    if (!arr) return [];
    if (!Array.isArray(arr)) arr = [arr];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var it = normalizeItem(arr[i]);
      if (it) out.push(it);
    }
    return out;
  }

  function isDefaultFocus(it) {
    return Math.round(it.x) === 50 && Math.round(it.y) === 50 && Math.abs(it.z - 1) < 0.005;
  }

  function serializeItem(it, allowLink) {
    var out = { src: it.src };
    if (!isDefaultFocus(it)) {
      out.focus = {
        x: Math.round(it.x),
        y: Math.round(it.y),
        zoom: Math.round(it.z * 100) / 100
      };
    }
    if (allowLink && it.link) out.link = it.link;
    return out;
  }

  /* ---------------------------------------------------------------
   * Application du cadrage sur une <img> (aperçu CMS)
   * ------------------------------------------------------------- */

  function applyFocus(img, it) {
    var pos = it.x + '% ' + it.y + '%';
    img.style.objectPosition = pos;
    img.style.transformOrigin = pos;
    img.style.transform = it.z === 1 ? '' : 'scale(' + it.z + ')';
  }

  /* ---------------------------------------------------------------
   * Optimisation avant envoi : redimensionnement + conversion webp
   * ------------------------------------------------------------- */

  function loadBitmap(file) {
    if (typeof window.createImageBitmap === 'function') {
      return window.createImageBitmap(file, { imageOrientation: 'from-image' })
        .catch(function () { return window.createImageBitmap(file); })
        .catch(function () { return loadViaImg(file); });
    }
    return loadViaImg(file);
  }

  function loadViaImg(file) {
    return new Promise(function (resolve, reject) {
      var img = new window.Image();
      var url = URL.createObjectURL(file);
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function (e) { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  /* Filet de sécurité : si le décodage bloque, on envoie l'original. */
  function withTimeout(promise, ms, fallback) {
    return Promise.race([
      promise,
      new Promise(function (resolve) {
        setTimeout(function () { resolve(fallback); }, ms);
      })
    ]);
  }

  function optimizeFile(file, options) {
    // On ne touche ni au SVG ni au GIF (animation), ni aux fichiers non-image.
    if (!/^image\//.test(file.type) || /svg|gif/.test(file.type)) {
      return Promise.resolve(file);
    }
    try {
      return withTimeout(optimizeFileInner(file, options), 20000, file);
    } catch (e) {
      console.warn('[nn-photos] optimisation impossible, envoi de l\'original', e);
      return Promise.resolve(file);
    }
  }

  function optimizeFileInner(file, options) {
    var maxDim = num(options.maxWidth, 2000);
    var quality = num(options.quality, 0.82);

    return loadBitmap(file).then(function (bmp) {
      var w = bmp.width || bmp.naturalWidth;
      var hh = bmp.height || bmp.naturalHeight;
      if (!w || !hh) return file;

      var scale = Math.min(1, maxDim / Math.max(w, hh));
      // Déjà petite et légère : on garde l'original tel quel.
      if (scale === 1 && file.size < 500 * 1024) return file;

      var tw = Math.round(w * scale);
      var th = Math.round(hh * scale);
      var canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      var ctx = canvas.getContext('2d');
      if (!ctx || !canvas.toBlob) return file;
      ctx.drawImage(bmp, 0, 0, tw, th);
      if (bmp.close) bmp.close();

      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          if (!blob || blob.size >= file.size) return resolve(file);
          var name = file.name.replace(/\.[^.]+$/, '') + '.webp';
          try {
            resolve(new File([blob], name, { type: 'image/webp' }));
          } catch (e) {
            blob.name = name;
            resolve(blob);
          }
        }, 'image/webp', quality);
      });
    }).catch(function (e) {
      console.warn('[nn-photos] optimisation impossible, envoi de l\'original', e);
      return file;
    });
  }

  /* ---------------------------------------------------------------
   * Styles de l'interface
   * ------------------------------------------------------------- */

  var CSS = [
    '.nnp{font-family:inherit}',
    '.nnp-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:10px}',
    '.nnp-btn{border:0;border-radius:4px;padding:7px 13px;font-size:13px;font-weight:600;cursor:pointer;background:var(--nn-accent,#3a69c7);color:var(--nn-cream,#fff);line-height:1.2}',
    '.nnp-btn:hover{background:var(--nn-accent-hover,#2f57a6)}',
    '.nnp-btn.is-ghost{background:#eceef2;color:#3d454f}',
    '.nnp-btn.is-ghost:hover{background:#dfe3ea}',
    '.nnp-btn.is-danger{background:#fbeaea;color:#c0392b}',
    '.nnp-btn[disabled]{opacity:.55;cursor:default}',
    '.nnp-count{margin-left:auto;font-size:12px;color:#7a828c}',
    '.nnp-stagearea{background:#141414;border:1px solid #d9dde3;border-radius:6px;padding:10px}',
    '.nnp-grid{display:grid;gap:6px}',
    '.nnp-empty{grid-column:1/-1;padding:26px 12px;text-align:center;color:#8b929b;font-size:13px;border:1px dashed #3a3a3a;border-radius:4px}',
    '.nnp-tile{position:relative;background:#1e1e1e;overflow:hidden;cursor:grab}',
    '.nnp-tile img{width:100%;height:100%;object-fit:cover;display:block}',
    '.nnp-tile.is-auto img{height:auto;object-fit:contain}',
    '.nnp-tile.is-dragging{opacity:.35}',
    '.nnp-tile.is-over{outline:2px solid var(--nn-accent,#3a69c7);outline-offset:-2px}',
    '.nnp-tile.is-hidden{opacity:.35}',
    '.nnp-tile.is-hidden::after{content:"non affichée";position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.72);color:#fff;font-size:10px;text-align:center;padding:2px}',
    '.nnp-idx{position:absolute;top:4px;left:4px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;line-height:1;padding:3px 5px;border-radius:3px;pointer-events:none}',
    '.nnp-acts{position:absolute;top:4px;right:4px;display:flex;gap:3px;opacity:0;transition:opacity .15s}',
    '.nnp-tile:hover .nnp-acts,.nnp-tile.is-active .nnp-acts{opacity:1}',
    '.nnp-act{border:0;border-radius:3px;background:rgba(0,0,0,.65);color:#fff;font-size:11px;line-height:1;padding:5px 6px;cursor:pointer}',
    '.nnp-act:hover{background:var(--nn-accent,#3a69c7)}',
    '.nnp-act.is-del:hover{background:#c0392b}',
    '.nnp-tile.is-active{outline:2px solid var(--nn-accent,#3a69c7);outline-offset:-2px}',
    '.nnp-drop{outline:2px dashed var(--nn-accent,#3a69c7);outline-offset:-4px}',
    '.nnp-edit{margin-top:10px;border:1px solid #d9dde3;border-radius:6px;padding:12px;display:flex;gap:16px;flex-wrap:wrap;background:#f7f8fa}',
    '.nnp-stage{position:relative;overflow:hidden;background:#141414;width:210px;flex:0 0 auto;cursor:grab;touch-action:none;user-select:none}',
    '.nnp-stage.is-grabbing{cursor:grabbing}',
    '.nnp-stage img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}',
    '.nnp-stage.is-auto img{height:auto}',
    '.nnp-ctrls{flex:1 1 220px;min-width:200px;display:flex;flex-direction:column;gap:10px;font-size:13px;color:#3d454f}',
    '.nnp-ctrls label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#7a828c;margin-bottom:4px}',
    '.nnp-ctrls input[type=range]{width:100%}',
    '.nnp-ctrls input[type=text]{width:100%;padding:6px 8px;border:1px solid #cfd4db;border-radius:4px;font-size:13px}',
    '.nnp-hint{font-size:12px;color:#7a828c;margin:0;line-height:1.45}',
    '.nnp-row{display:flex;gap:8px;flex-wrap:wrap}',
    '.nnp-file{display:none}',
    '.nnp-progress{font-size:12px;color:var(--nn-accent,#3a69c7)}'
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('nn-photos-css')) return;
    var style = el('style');
    style.id = 'nn-photos-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ---------------------------------------------------------------
   * Fabrique de widget
   * ------------------------------------------------------------- */

  function makeControl(multiple) {
    return createClass({
      displayName: multiple ? 'NnGalleryControl' : 'NnPhotoControl',

      /* -------- cycle de vie React (le DOM est géré à la main) -------- */

      componentDidMount: function () {
        injectStyles();
        this.mediaControlID = uid();
        this.items = multiple
          ? normalizeList(this.props.value)
          : [].concat(normalizeItem(this.props.value) || []);
        this.activeIndex = -1;
        this.busy = false;
        this.buildUI();
        this.renderItems();
      },

      componentDidUpdate: function () {
        this.consumeMediaLibrary();
        // Valeur modifiée ailleurs (chargement, annulation…) : on resynchronise.
        if (this.props.value !== this.lastEmitted) {
          var incoming = multiple
            ? normalizeList(this.props.value)
            : [].concat(normalizeItem(this.props.value) || []);
          if (JSON.stringify(incoming) !== JSON.stringify(this.items)) {
            this.items = incoming;
            this.activeIndex = -1;
            this.renderItems();
          }
        }
      },

      componentWillUnmount: function () {
        if (this.props.onRemoveMediaControl) {
          this.props.onRemoveMediaControl(this.mediaControlID);
        }
      },

      /* -------- options -------- */

      options: function () {
        var field = this.props.field;
        return {
          ratio: parseRatio(opt(field, 'ratio', '3:4')),
          columns: num(opt(field, 'columns', 3), 3),
          maxVisible: num(opt(field, 'max_visible', 0), 0),
          allowLink: !!opt(field, 'allow_link', false),
          maxWidth: num(opt(field, 'max_width', 2000), 2000),
          quality: num(opt(field, 'quality', 0.82), 0.82)
        };
      },

      /* -------- enregistrement -------- */

      commit: function () {
        var o = this.options();
        var value;
        if (multiple) {
          value = this.items.map(function (it) { return serializeItem(it, o.allowLink); });
        } else {
          value = this.items.length ? serializeItem(this.items[0], o.allowLink) : '';
        }
        this.lastEmitted = value;
        this.props.onChange(value);
      },

      /* -------- construction de l'interface -------- */

      buildUI: function () {
        var self = this;
        var o = this.options();
        var root = this.root;
        root.className = (this.props.classNameWrapper || '') + ' nnp';
        root.innerHTML = '';

        // Barre d'actions
        var bar = el('div', 'nnp-bar');
        this.btnAdd = button('nnp-btn', multiple ? 'Ajouter des photos' : 'Choisir une photo');
        this.btnLib = button('nnp-btn is-ghost', 'Médiathèque', 'Choisir une image déjà envoyée');
        bar.appendChild(this.btnAdd);
        bar.appendChild(this.btnLib);
        this.status = el('span', 'nnp-count');
        bar.appendChild(this.status);
        root.appendChild(bar);

        // Zone d'aperçu
        this.area = el('div', 'nnp-stagearea');
        this.grid = el('div', 'nnp-grid');
        this.grid.style.gridTemplateColumns = multiple
          ? 'repeat(' + o.columns + ', 1fr)'
          : 'minmax(0, 220px)';
        this.area.appendChild(this.grid);
        root.appendChild(this.area);

        // Panneau de recadrage
        this.editor = el('div', 'nnp-edit');
        this.editor.style.display = 'none';
        root.appendChild(this.editor);
        this.buildEditor();

        // Champ fichier caché
        this.fileInput = el('input', 'nnp-file');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'image/*';
        if (multiple) this.fileInput.multiple = true;
        root.appendChild(this.fileInput);

        this.btnAdd.addEventListener('click', function () { self.fileInput.click(); });
        this.btnLib.addEventListener('click', function () { self.openLibrary(-1); });
        this.fileInput.addEventListener('change', function () {
          var files = Array.prototype.slice.call(self.fileInput.files || []);
          self.fileInput.value = '';
          if (files.length) self.handleFiles(files);
        });

        // Glisser-déposer de fichiers sur la zone d'aperçu
        ['dragenter', 'dragover'].forEach(function (evt) {
          self.area.addEventListener(evt, function (e) {
            if (!self.hasFiles(e)) return;
            e.preventDefault();
            self.area.classList.add('nnp-drop');
          });
        });
        ['dragleave', 'drop'].forEach(function (evt) {
          self.area.addEventListener(evt, function (e) {
            if (evt === 'drop' && self.hasFiles(e)) {
              e.preventDefault();
              self.handleFiles(Array.prototype.slice.call(e.dataTransfer.files));
            }
            self.area.classList.remove('nnp-drop');
          });
        });
      },

      hasFiles: function (e) {
        var dt = e.dataTransfer;
        if (!dt) return false;
        var types = dt.types || [];
        for (var i = 0; i < types.length; i++) {
          if (types[i] === 'Files') return true;
        }
        return false;
      },

      /* -------- panneau de recadrage -------- */

      buildEditor: function () {
        var self = this;
        var o = this.options();

        this.stage = el('div', 'nnp-stage');
        this.stageImg = el('img');
        this.stage.appendChild(this.stageImg);
        if (o.ratio) {
          this.stage.style.aspectRatio = o.ratio.toFixed(4);
        } else {
          this.stage.classList.add('is-auto');
        }
        this.editor.appendChild(this.stage);

        var ctrls = el('div', 'nnp-ctrls');

        var zoomWrap = el('div');
        zoomWrap.appendChild(el('label', null, 'Zoom'));
        this.zoom = el('input');
        this.zoom.type = 'range';
        this.zoom.min = '1';
        this.zoom.max = '3';
        this.zoom.step = '0.01';
        zoomWrap.appendChild(this.zoom);
        ctrls.appendChild(zoomWrap);

        if (o.allowLink) {
          var linkWrap = el('div');
          linkWrap.appendChild(el('label', null, 'Lien au clic (optionnel)'));
          this.link = el('input');
          this.link.type = 'text';
          this.link.placeholder = 'https://instagram.com/p/…';
          linkWrap.appendChild(this.link);
          ctrls.appendChild(linkWrap);
        }

        var row = el('div', 'nnp-row');
        this.btnReset = button('nnp-btn is-ghost', 'Recentrer');
        this.btnDone = button('nnp-btn', 'Terminé');
        row.appendChild(this.btnReset);
        row.appendChild(this.btnDone);
        ctrls.appendChild(row);

        ctrls.appendChild(el('p', 'nnp-hint',
          o.ratio
            ? 'Glissez la photo pour choisir la partie visible, la molette ou le curseur pour zoomer. Le fichier d\'origine n\'est pas modifié.'
            : 'Cette photo s\'affiche en entier sur le site : pas de recadrage nécessaire.'));

        this.editor.appendChild(ctrls);

        this.zoom.addEventListener('input', function () {
          var it = self.items[self.activeIndex];
          if (!it) return;
          it.z = num(self.zoom.value, 1);
          self.refreshActive();
        });
        this.zoom.addEventListener('change', function () { self.commit(); });

        if (this.link) {
          this.link.addEventListener('input', function () {
            var it = self.items[self.activeIndex];
            if (!it) return;
            it.link = self.link.value.trim();
          });
          this.link.addEventListener('change', function () { self.commit(); });
        }

        this.btnReset.addEventListener('click', function () {
          var it = self.items[self.activeIndex];
          if (!it) return;
          it.x = 50; it.y = 50; it.z = 1;
          self.zoom.value = '1';
          self.refreshActive();
          self.commit();
        });

        this.btnDone.addEventListener('click', function () { self.closeEditor(); });

        this.stage.addEventListener('wheel', function (e) {
          var it = self.items[self.activeIndex];
          if (!it || !o.ratio) return;
          e.preventDefault();
          it.z = clamp(it.z + (e.deltaY < 0 ? 0.06 : -0.06), 1, 3);
          self.zoom.value = String(it.z);
          self.refreshActive();
          clearTimeout(self.wheelTimer);
          self.wheelTimer = setTimeout(function () { self.commit(); }, 350);
        }, { passive: false });

        this.stage.addEventListener('pointerdown', function (e) {
          var it = self.items[self.activeIndex];
          if (!it || !o.ratio) return;
          var img = self.stageImg;
          if (!img.naturalWidth) return;

          var box = self.stage.getBoundingClientRect();
          var cover = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
          var overX = it.z * img.naturalWidth * cover - box.width;
          var overY = it.z * img.naturalHeight * cover - box.height;
          var startX = e.clientX, startY = e.clientY;
          var baseX = it.x, baseY = it.y;
          var moved = false;

          self.stage.setPointerCapture(e.pointerId);
          self.stage.classList.add('is-grabbing');

          function onMove(ev) {
            var dx = ev.clientX - startX;
            var dy = ev.clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
            if (overX > 0.5) it.x = clamp(baseX - dx * 100 / overX, 0, 100);
            if (overY > 0.5) it.y = clamp(baseY - dy * 100 / overY, 0, 100);
            self.refreshActive();
          }
          function onUp(ev) {
            self.stage.removeEventListener('pointermove', onMove);
            self.stage.removeEventListener('pointerup', onUp);
            self.stage.removeEventListener('pointercancel', onUp);
            self.stage.classList.remove('is-grabbing');
            try { self.stage.releasePointerCapture(ev.pointerId); } catch (err) {}
            if (moved) self.commit();
          }
          self.stage.addEventListener('pointermove', onMove);
          self.stage.addEventListener('pointerup', onUp);
          self.stage.addEventListener('pointercancel', onUp);
        });
      },

      openEditor: function (index) {
        var it = this.items[index];
        if (!it) return;
        this.activeIndex = index;
        this.editor.style.display = 'flex';
        this.stageImg.src = displaySrc(it.src);
        this.zoom.value = String(it.z);
        if (this.link) this.link.value = it.link || '';
        applyFocus(this.stageImg, it);
        this.markActive();
      },

      closeEditor: function () {
        this.activeIndex = -1;
        this.editor.style.display = 'none';
        this.markActive();
      },

      markActive: function () {
        var tiles = this.grid.querySelectorAll('.nnp-tile');
        for (var i = 0; i < tiles.length; i++) {
          tiles[i].classList.toggle('is-active', i === this.activeIndex);
        }
      },

      /* Répercute le cadrage en cours sur le panneau ET sur la vignette */
      refreshActive: function () {
        var it = this.items[this.activeIndex];
        if (!it) return;
        applyFocus(this.stageImg, it);
        var tile = this.grid.querySelectorAll('.nnp-tile')[this.activeIndex];
        if (tile) {
          var img = tile.querySelector('img');
          if (img) applyFocus(img, it);
        }
      },

      /* -------- grille de vignettes -------- */

      renderItems: function () {
        var self = this;
        var o = this.options();
        this.grid.innerHTML = '';

        if (!this.items.length) {
          var empty = el('div', 'nnp-empty',
            multiple
              ? 'Aucune photo. Cliquez sur « Ajouter des photos » ou déposez vos fichiers ici.'
              : 'Aucune photo. Cliquez sur « Choisir une photo » ou déposez un fichier ici.');
          this.grid.appendChild(empty);
        }

        this.items.forEach(function (it, i) {
          var tile = el('div', 'nnp-tile');
          tile.dataset.index = String(i);
          if (o.ratio) tile.style.aspectRatio = o.ratio.toFixed(4);
          else tile.classList.add('is-auto');
          if (o.maxVisible && i >= o.maxVisible) tile.classList.add('is-hidden');

          var img = el('img');
          img.src = displaySrc(it.src);
          img.alt = '';
          img.addEventListener('load', function () { applyFocus(img, it); });
          applyFocus(img, it);
          tile.appendChild(img);

          if (multiple) tile.appendChild(el('span', 'nnp-idx', String(i + 1)));

          var acts = el('div', 'nnp-acts');
          var bCrop = button('nnp-act', '⤢', 'Recadrer');
          var bSwap = button('nnp-act', '⇄', 'Remplacer par une image de la médiathèque');
          var bDel = button('nnp-act is-del', '✕', 'Retirer');
          acts.appendChild(bCrop);
          acts.appendChild(bSwap);
          acts.appendChild(bDel);
          tile.appendChild(acts);

          bCrop.addEventListener('click', function (e) {
            e.stopPropagation();
            self.openEditor(i);
          });
          bSwap.addEventListener('click', function (e) {
            e.stopPropagation();
            self.openLibrary(i);
          });
          bDel.addEventListener('click', function (e) {
            e.stopPropagation();
            self.items.splice(i, 1);
            if (self.activeIndex === i) self.closeEditor();
            self.renderItems();
            self.commit();
          });
          tile.addEventListener('click', function () { self.openEditor(i); });

          // Réorganisation par glisser-déposer (galerie seulement)
          if (multiple) {
            tile.draggable = true;
            tile.addEventListener('dragstart', function (e) {
              self.dragFrom = i;
              tile.classList.add('is-dragging');
              try {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(i));
              } catch (err) {}
            });
            tile.addEventListener('dragend', function () {
              tile.classList.remove('is-dragging');
              self.dragFrom = null;
            });
            tile.addEventListener('dragover', function (e) {
              if (self.dragFrom === null || self.dragFrom === undefined) return;
              e.preventDefault();
              e.stopPropagation();
              tile.classList.add('is-over');
            });
            tile.addEventListener('dragleave', function () {
              tile.classList.remove('is-over');
            });
            tile.addEventListener('drop', function (e) {
              if (self.dragFrom === null || self.dragFrom === undefined) return;
              e.preventDefault();
              e.stopPropagation();
              tile.classList.remove('is-over');
              var from = self.dragFrom;
              var to = i;
              self.dragFrom = null;
              if (from === to) return;
              var moved = self.items.splice(from, 1)[0];
              self.items.splice(to, 0, moved);
              self.closeEditor();
              self.renderItems();
              self.commit();
            });
          }

          self.grid.appendChild(tile);
        });

        this.updateStatus();
        this.markActive();
      },

      updateStatus: function (message) {
        var o = this.options();
        if (message) {
          this.status.className = 'nnp-count nnp-progress';
          this.status.textContent = message;
          return;
        }
        this.status.className = 'nnp-count';
        if (!multiple) {
          this.status.textContent = this.items.length ? '1 photo' : '';
          return;
        }
        var n = this.items.length;
        var txt = n + (n > 1 ? ' photos' : ' photo');
        if (o.maxVisible && n > o.maxVisible) {
          txt += ' — seules les ' + o.maxVisible + ' premières sont affichées sur le site';
        }
        this.status.textContent = txt;
      },

      setBusy: function (busy) {
        this.busy = busy;
        this.btnAdd.disabled = busy;
        this.btnLib.disabled = busy;
      },

      /* -------- envoi de fichiers -------- */

      handleFiles: function (files) {
        var self = this;
        var o = this.options();
        files = files.filter(function (f) { return /^image\//.test(f.type); });
        if (!files.length) return;
        if (!multiple) files = files.slice(0, 1);

        this.setBusy(true);
        var added = [];
        var chain = Promise.resolve();

        files.forEach(function (file, idx) {
          chain = chain.then(function () {
            self.updateStatus('Envoi ' + (idx + 1) + '/' + files.length + '…');
            return optimizeFile(file, o).then(function (prepared) {
              return Promise.resolve(
                self.props.onPersistMedia(prepared, { field: self.props.field })
              ).then(function (res) {
                var payload = res && res.payload;
                var mediaFile = payload && (payload.path ? payload : payload.file);
                if (!mediaFile || !mediaFile.path) return;
                var pub = publicPath(self.props.config, mediaFile.path);
                BLOBS[pub] = URL.createObjectURL(prepared);
                added.push(pub);
              });
            });
          });
        });

        chain.then(function () {
          self.appendSources(added);
        }).catch(function (err) {
          console.error('[nn-photos] envoi impossible', err);
          window.alert('Une photo n\'a pas pu être envoyée. Détail dans la console du navigateur.');
        }).then(function () {
          self.setBusy(false);
          self.updateStatus();
        });
      },

      appendSources: function (sources, replaceIndex) {
        if (!sources || !sources.length) return;
        var items = sources.map(function (src) {
          return { src: src, x: 50, y: 50, z: 1, link: '' };
        });

        if (typeof replaceIndex === 'number' && replaceIndex >= 0 && this.items[replaceIndex]) {
          // On remplace la photo, on garde le cadrage existant.
          this.items[replaceIndex].src = items[0].src;
        } else if (multiple) {
          this.items = this.items.concat(items);
        } else {
          this.items = [items[0]];
        }

        this.renderItems();
        this.commit();
        if (!multiple || typeof replaceIndex === 'number') {
          var idx = typeof replaceIndex === 'number' && replaceIndex >= 0 ? replaceIndex : 0;
          this.openEditor(idx);
        }
      },

      /* -------- médiathèque Decap -------- */

      openLibrary: function (replaceIndex) {
        this.pendingReplace = typeof replaceIndex === 'number' ? replaceIndex : -1;
        this.mediaBucket = [];
        this.props.onOpenMediaLibrary({
          controlID: this.mediaControlID,
          forImage: true,
          privateUpload: false,
          value: this.mediaBucket,
          allowMultiple: multiple && this.pendingReplace < 0,
          field: this.props.field
        });
      },

      consumeMediaLibrary: function () {
        var paths = this.props.mediaPaths && this.props.mediaPaths.get
          ? this.props.mediaPaths.get(this.mediaControlID)
          : null;
        if (!paths) return;
        var list = toPlain(paths);
        if (!Array.isArray(list)) list = [list];
        list = list.filter(Boolean);
        this.props.onRemoveInsertedMedia(this.mediaControlID);
        if (!list.length) return;
        var replaceIndex = this.pendingReplace;
        this.pendingReplace = -1;
        this.appendSources(list, replaceIndex >= 0 ? replaceIndex : undefined);
      },

      /* -------- rendu React : un simple conteneur -------- */

      render: function () {
        var self = this;
        return h('div', {
          ref: function (node) { if (node) self.root = node; }
        });
      }
    });
  }

  /* Aperçu (volet de prévisualisation Decap, désactivé sur ce site) */
  var Preview = createClass({
    render: function () {
      var items = normalizeList(this.props.value);
      return h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' } },
        items.map(function (it, i) {
          return h('img', {
            key: i,
            src: it.src,
            style: {
              width: '100%',
              aspectRatio: '3/4',
              objectFit: 'cover',
              objectPosition: it.x + '% ' + it.y + '%',
              transform: it.z === 1 ? '' : 'scale(' + it.z + ')',
              transformOrigin: it.x + '% ' + it.y + '%'
            }
          });
        })
      );
    }
  });

  window.CMS.registerWidget('nn-gallery', makeControl(true), Preview);
  window.CMS.registerWidget('nn-photo', makeControl(false), Preview);
})();
