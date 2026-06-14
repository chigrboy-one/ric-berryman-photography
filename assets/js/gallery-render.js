/* gallery-render.js — renders a [data-gallery] grid from its JSON manifest.
   Runs on every page load. If the manifest is missing (404) the static
   markup already in the container is left untouched as a fallback, so
   nothing breaks before a gallery has ever been edited. */
(function () {
  'use strict';

  function thumbOf(src) {
    var i = src.lastIndexOf('/');
    return i < 0 ? src : src.slice(0, i) + '/thumbs/' + src.slice(i + 1);
  }

  function buildItem(it) {
    var fig = document.createElement('figure');
    fig.className = 'arch-item';
    fig.setAttribute('data-cursor', 'view');
    var img = document.createElement('img');
    // grid shows the light thumbnail; full-res kept on data-full for the lightbox
    img.dataset.full = it.src;
    img.src = thumbOf(it.src);
    img.onerror = function () { if (img.src.indexOf('/thumbs/') !== -1) { img.onerror = null; img.src = it.src; } };
    img.alt = it.alt || '';
    img.loading = 'lazy';
    if (it.w && it.h) img.style.aspectRatio = it.w + ' / ' + it.h;
    fig.appendChild(img);
    return fig;
  }

  function applyManifest(container, manifest) {
    if (!manifest || !Array.isArray(manifest.items)) return;
    container.innerHTML = '';
    manifest.items.forEach(function (it) { container.appendChild(buildItem(it)); });
    container.setAttribute('data-gallery-ready', '1');
    document.dispatchEvent(new CustomEvent('gallery:rendered', { detail: { container: container } }));
  }

  function load(container) {
    var id = container.getAttribute('data-gallery');
    if (!id) return;
    fetch('/data/galleries/' + id + '.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) { if (m) applyManifest(container, m); else container.setAttribute('data-gallery-ready', '1'); })
      .catch(function () { container.setAttribute('data-gallery-ready', '1'); });
  }

  document.querySelectorAll('[data-gallery]').forEach(load);

  /* ---- slot overrides: swap individual fixed images (heroes, figures…) ---- */
  var pageId = document.body && document.body.getAttribute('data-slots');
  if (pageId) {
    fetch('/data/slots/' + pageId + '.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (map) {
        if (!map) return;
        document.querySelectorAll('[data-slot]').forEach(function (img) {
          var k = img.getAttribute('data-slot');
          if (map[k]) img.src = map[k];
        });
        document.dispatchEvent(new CustomEvent('slots:applied'));
      })
      .catch(function () {});
  }
})();
