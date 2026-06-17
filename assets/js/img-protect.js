/* img-protect.js — light deterrent against casual image saving.
   Blocks the right-click "Save image as…" menu and click-drag-to-desktop
   on photographs. Honest scope: this stops the casual saver, not a
   determined one (DevTools, the network tab, and screenshots still work).
   Deliberately leaves real <img> elements in place so the photos stay
   indexable in Google Images. */
(function () {
  'use strict';

  // images can't be dragged out or selected
  var css =
    'img,picture{-webkit-user-drag:none;-khtml-user-drag:none;-moz-user-drag:none;' +
    '-o-user-drag:none;user-drag:none;user-select:none;-webkit-user-select:none;' +
    '-ms-user-select:none;-webkit-touch-callout:none;}';
  var style = document.createElement('style');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  function overImage(t) {
    return !!(t && (t.tagName === 'IMG' || t.tagName === 'PICTURE' ||
      (t.closest && t.closest('img,picture,.figure-frame,.arch-item,.e-hero,[data-no-save]'))));
  }

  document.addEventListener('contextmenu', function (e) {
    if (overImage(e.target)) e.preventDefault();
  }, { capture: true });

  document.addEventListener('dragstart', function (e) {
    if (e.target && (e.target.tagName === 'IMG' || (e.target.closest && e.target.closest('img,picture')))) {
      e.preventDefault();
    }
  }, { capture: true });
})();
