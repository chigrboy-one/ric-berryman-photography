/* gallery-edit.js — in-page drag-and-drop editor for [data-gallery] grids.
   Loads ONLY when the URL has ?edit and we're on localhost. Lets you:
     • drag image tiles to reorder
     • drop image files from Finder onto the grid to add them
     • click a tile's × to remove it
     • Save → writes the gallery manifest to /data/galleries/<id>.json and
       copies any newly-added images into the gallery's asset folder, all on
       your real disk via the File System Access API (Chrome/Edge).
   The site itself never ships this in edit mode — it's gated to localhost. */
(function () {
  'use strict';

  var isLocal = ['localhost', '127.0.0.1', '0.0.0.0'].indexOf(location.hostname) !== -1;
  // activate via ?edit, #edit, or a sticky localStorage toggle (set once,
  // stays on for the session — handy, and survives URL normalization)
  try { if (/[?&]edit\b/.test(location.search) || /edit/.test(location.hash)) localStorage.setItem('rbEdit', '1'); } catch (e) {}
  var wantsEdit = false;
  try { wantsEdit = localStorage.getItem('rbEdit') === '1'; } catch (e) {}
  wantsEdit = wantsEdit || /[?&]edit\b/.test(location.search) || /edit/.test(location.hash);
  if (!isLocal || !wantsEdit) return;

  var FS_OK = 'showDirectoryPicker' in window;

  /* ---------- tiny IndexedDB store for the saved directory handle ---------- */
  function idb(cb) {
    var req = indexedDB.open('rb-studio', 1);
    req.onupgradeneeded = function () { req.result.createObjectStore('handles'); };
    req.onsuccess = function () { cb(req.result); };
    req.onerror = function () { cb(null); };
  }
  function idbGet(key) {
    return new Promise(function (res) {
      idb(function (db) {
        if (!db) return res(null);
        var t = db.transaction('handles', 'readonly').objectStore('handles').get(key);
        t.onsuccess = function () { res(t.result || null); };
        t.onerror = function () { res(null); };
      });
    });
  }
  function idbSet(key, val) {
    return new Promise(function (res) {
      idb(function (db) {
        if (!db) return res();
        var t = db.transaction('handles', 'readwrite').objectStore('handles').put(val, key);
        t.onsuccess = function () { res(); };
        t.onerror = function () { res(); };
      });
    });
  }

  var rootHandle = null;     // handle to the project root folder
  var pendingFiles = {};     // src path -> File (newly added, not yet written)

  function setStatus(msg, kind) {
    var el = document.getElementById('ge-status');
    if (el) { el.textContent = msg; el.className = 'ge-status' + (kind ? ' ge-' + kind : ''); }
  }

  async function ensureRoot() {
    if (rootHandle) {
      if ((await rootHandle.queryPermission({ mode: 'readwrite' })) === 'granted') return rootHandle;
      if ((await rootHandle.requestPermission({ mode: 'readwrite' })) === 'granted') return rootHandle;
    }
    var saved = await idbGet('root');
    if (saved) {
      rootHandle = saved;
      if ((await rootHandle.queryPermission({ mode: 'readwrite' })) === 'granted') return rootHandle;
      if ((await rootHandle.requestPermission({ mode: 'readwrite' })) === 'granted') return rootHandle;
    }
    var ok = window.confirm(
      'ONE-TIME SETUP\n\n' +
      'Next you\'ll pick your website PROJECT folder — the one that contains the "assets" and "data" folders.\n\n' +
      '• You are NOT choosing a file or overwriting anything by hand.\n' +
      '• The editor writes the right files inside it for you.\n' +
      '• Chrome remembers it, so you only do this once.\n\n' +
      'Tip: in the picker press ⌘⇧G and paste the project path if it\'s hard to find.'
    );
    if (!ok) throw new Error('Setup cancelled');
    var picked = await window.showDirectoryPicker({ id: 'rb-root', mode: 'readwrite', startIn: 'desktop' });
    // sanity-check it's really the site root
    try { await picked.getDirectoryHandle('assets'); }
    catch (e) { throw new Error('That folder has no "assets" inside — pick the project root folder and try Save again.'); }
    rootHandle = picked;
    await idbSet('root', rootHandle);
    return rootHandle;
  }

  async function dirFromPath(root, path) {
    var parts = path.split('/').filter(Boolean);
    var h = root;
    for (var i = 0; i < parts.length; i++) h = await h.getDirectoryHandle(parts[i], { create: true });
    return h;
  }

  async function writeFile(dirHandle, name, blob) {
    var fh = await dirHandle.getFileHandle(name, { create: true });
    var w = await fh.createWritable();
    await w.write(blob);
    await w.close();
  }

  /* ---------- per-gallery editor ---------- */
  function initGallery(container) {
    var galleryId = container.getAttribute('data-gallery');
    var assetDir = container.getAttribute('data-gallery-dir') || 'assets/images';
    var dragEl = null;

    function decorate(fig) {
      if (fig.__geDone) return;
      fig.__geDone = true;
      fig.setAttribute('draggable', 'true');
      // stop the inner <img> from hijacking the drag (native image drag)
      var im = fig.querySelector('img');
      if (im) im.setAttribute('draggable', 'false');
      var rm = document.createElement('button');
      rm.className = 'ge-remove'; rm.type = 'button'; rm.title = 'Remove'; rm.textContent = '×';
      rm.addEventListener('click', function (e) {
        e.stopPropagation(); e.preventDefault();
        fig.remove(); markDirty();
      });
      fig.appendChild(rm);
      fig.addEventListener('dragstart', function (e) {
        dragEl = fig; fig.classList.add('ge-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', 'tile'); } catch (_) {}
        }
      });
      fig.addEventListener('dragend', function () { fig.classList.remove('ge-dragging'); dragEl = null; markDirty(); });
    }

    function afterElement(x, y) {
      var els = Array.prototype.slice.call(container.querySelectorAll('.arch-item:not(.ge-dragging)'));
      var closest = { dist: Infinity, el: null };
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (d < closest.dist) closest = { dist: d, el: el };
      });
      return closest.el;
    }

    container.addEventListener('dragover', function (e) {
      e.preventDefault();
      if (!dragEl) { container.classList.add('ge-filedrop'); return; }
      var ref = afterElement(e.clientX, e.clientY);
      if (ref && ref !== dragEl) {
        var r = ref.getBoundingClientRect();
        var before = e.clientY < r.top + r.height / 2 || e.clientX < r.left + r.width / 2;
        container.insertBefore(dragEl, before ? ref : ref.nextSibling);
      }
    });
    container.addEventListener('dragleave', function (e) {
      if (e.target === container) container.classList.remove('ge-filedrop');
    });
    container.addEventListener('drop', function (e) {
      e.preventDefault();
      container.classList.remove('ge-filedrop');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) addFiles(files);
    });

    function addFiles(fileList) {
      Array.prototype.forEach.call(fileList, function (file) {
        if (!/^image\//.test(file.type)) return;
        var name = file.name.replace(/[^\w.\-]+/g, '-');
        var src = assetDir + '/' + name;
        pendingFiles[src] = file;
        var url = URL.createObjectURL(file);
        var fig = document.createElement('figure');
        fig.className = 'arch-item ge-new';
        var img = document.createElement('img');
        img.src = url; img.loading = 'lazy';
        var bmp = new Image();
        bmp.onload = function () { img.style.aspectRatio = bmp.naturalWidth + ' / ' + bmp.naturalHeight; fig.dataset.w = bmp.naturalWidth; fig.dataset.h = bmp.naturalHeight; };
        bmp.src = url;
        fig.appendChild(img);
        fig.dataset.src = src;
        container.appendChild(fig);
        decorate(fig);
      });
      markDirty();
    }

    function serialize() {
      var items = [];
      container.querySelectorAll('.arch-item').forEach(function (fig) {
        var img = fig.querySelector('img');
        var src = fig.dataset.src || img.getAttribute('src');
        var w = fig.dataset.w, h = fig.dataset.h;
        if (!w && img.naturalWidth) { w = img.naturalWidth; h = img.naturalHeight; }
        var o = { src: src };
        if (w && h) { o.w = +w; o.h = +h; }
        if (img.alt) o.alt = img.alt;
        items.push(o);
      });
      return { dir: assetDir, items: items };
    }

    container.querySelectorAll('.arch-item').forEach(decorate);
    container.__geSerialize = serialize;
    container.__geId = galleryId;
  }

  var dirty = false;
  function markDirty() { dirty = true; setStatus('Unsaved changes', 'warn'); }

  /* ---------- slot swap (fixed single images: heroes, figures, cards…) ---------- */
  var slotsDir = (document.body.getAttribute('data-slots-dir') || 'assets/images');
  var slotsPage = document.body.getAttribute('data-slots');

  function replaceSlot(img, file) {
    if (!/^image\//.test(file.type)) return;
    var name = file.name.replace(/[^\w.\-]+/g, '-');
    var src = slotsDir + '/' + name;
    pendingFiles[src] = file;
    img.dataset.newsrc = src;
    img.src = URL.createObjectURL(file);
    img.classList.add('ge-slot-changed');
    markDirty();
  }

  function initSlots() {
    document.querySelectorAll('[data-slot]').forEach(function (img) {
      if (img.__geSlot) return;
      img.__geSlot = true;
      img.classList.add('ge-slot');
      var wrap = img.parentElement || img;
      wrap.classList.add('ge-slot-wrap');
      if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
      var badge = document.createElement('span');
      badge.className = 'ge-slot-badge'; badge.textContent = 'REPLACE';
      wrap.appendChild(badge);
      img.setAttribute('draggable', 'false');
      function over(e) { e.preventDefault(); e.stopPropagation(); img.classList.add('ge-slot-over'); }
      function leave() { img.classList.remove('ge-slot-over'); }
      img.addEventListener('dragover', over);
      img.addEventListener('dragenter', over);
      img.addEventListener('dragleave', leave);
      img.addEventListener('drop', function (e) {
        e.preventDefault(); e.stopPropagation(); leave();
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) replaceSlot(img, f);
      });
      badge.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = function () { if (inp.files[0]) replaceSlot(img, inp.files[0]); };
        inp.click();
      });
    });
  }

  function serializeSlots() {
    var map = {};
    document.querySelectorAll('[data-slot]').forEach(function (img) {
      map[img.getAttribute('data-slot')] = img.dataset.newsrc || img.getAttribute('src');
    });
    return map;
  }

  async function saveAll() {
    if (!FS_OK) { setStatus('This browser can’t save to disk — use Chrome or Edge.', 'err'); return; }
    try {
      setStatus('Saving…');
      var root = await ensureRoot();
      var galleries = document.querySelectorAll('[data-gallery]');
      for (var i = 0; i < galleries.length; i++) {
        var c = galleries[i];
        if (!c.__geSerialize) continue;
        var manifest = c.__geSerialize();
        // copy any newly-added images into their asset folder
        for (var j = 0; j < manifest.items.length; j++) {
          var src = manifest.items[j].src;
          if (pendingFiles[src]) {
            var dirPath = src.slice(0, src.lastIndexOf('/'));
            var fname = src.slice(src.lastIndexOf('/') + 1);
            var dh = await dirFromPath(root, dirPath);
            await writeFile(dh, fname, pendingFiles[src]);
            delete pendingFiles[src];
          }
        }
        var gdir = await dirFromPath(root, 'data/galleries');
        await writeFile(gdir, c.__geId + '.json', new Blob([JSON.stringify(manifest, null, 1)], { type: 'application/json' }));
      }
      // slot swaps for this page
      if (slotsPage && document.querySelector('[data-slot]')) {
        var map = serializeSlots();
        for (var k in map) {
          if (pendingFiles[map[k]]) {
            var p = map[k];
            var dd = await dirFromPath(root, p.slice(0, p.lastIndexOf('/')));
            await writeFile(dd, p.slice(p.lastIndexOf('/') + 1), pendingFiles[p]);
            delete pendingFiles[p];
          }
        }
        var sdir = await dirFromPath(root, 'data/slots');
        await writeFile(sdir, slotsPage + '.json', new Blob([JSON.stringify(map, null, 1)], { type: 'application/json' }));
      }
      dirty = false;
      setStatus('Saved ✓  — commit & push to publish', 'ok');
    } catch (err) {
      setStatus('Save cancelled / failed: ' + (err && err.message || err), 'err');
    }
  }

  /* ---------- toolbar ---------- */
  function buildToolbar() {
    var bar = document.createElement('div');
    bar.className = 'ge-bar';
    bar.innerHTML =
      '<span class="ge-tag">EDIT MODE</span>' +
      '<span class="ge-hint">drag to reorder · drop files to add · × to remove</span>' +
      '<span id="ge-status" class="ge-status">Ready</span>' +
      '<button id="ge-save" type="button">Save</button>';
    document.body.appendChild(bar);
    document.getElementById('ge-save').addEventListener('click', saveAll);
    if (!FS_OK) setStatus('Saving needs Chrome or Edge (File System Access).', 'warn');
    addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  }

  function boot() {
    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/assets/css/gallery-edit.css';
    document.head.appendChild(css);
    document.body.classList.add('ge-editing');
    buildToolbar();
    document.querySelectorAll('[data-gallery]').forEach(initGallery);
    initSlots();
  }
  // re-init a gallery if the renderer rebuilds it from a manifest after we loaded
  document.addEventListener('gallery:rendered', function (e) { if (document.body.classList.contains('ge-editing')) initGallery(e.detail.container); });
  document.addEventListener('slots:applied', function () { if (document.body.classList.contains('ge-editing')) initSlots(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
