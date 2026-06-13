/* gallery-render.js — renders a [data-gallery] grid from its JSON manifest.
   Runs on every page load. If the manifest is missing (404) the static
   markup already in the container is left untouched as a fallback, so
   nothing breaks before a gallery has ever been edited. */
(function () {
  'use strict';

  function buildItem(it) {
    var fig = document.createElement('figure');
    fig.className = 'arch-item';
    fig.setAttribute('data-cursor', 'view');
    var img = document.createElement('img');
    img.src = it.src;
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
})();
