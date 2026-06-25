/* cookie-notice.js — lightweight, dismissible analytics-cookie notice.
   This is a NOTICE (not a consent gate): Google Analytics already loads in the
   page head. It informs visitors and links to the privacy policy, and remembers
   the dismissal so it only shows once. Loaded sitewide before </body>. */
(function () {
  'use strict';
  var KEY = 'rbCookieOK';
  try { if (localStorage.getItem(KEY) === '1') return; } catch (e) {}

  function build() {
    if (document.getElementById('rb-cookie')) return;

    var css = document.createElement('style');
    css.textContent =
      '#rb-cookie{position:fixed;left:50%;bottom:1rem;transform:translateX(-50%) translateY(140%);' +
      'z-index:900;width:min(680px,calc(100% - 2rem));display:flex;align-items:center;gap:1rem;flex-wrap:wrap;' +
      'justify-content:center;padding:0.85rem 1.25rem;background:rgba(17,17,17,0.97);' +
      'border:1px solid rgba(232,228,221,0.16);border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,0.5);' +
      'backdrop-filter:blur(6px);transition:transform 0.5s cubic-bezier(0.22,1,0.36,1);}' +
      '#rb-cookie.rb-in{transform:translateX(-50%) translateY(0);}' +
      '#rb-cookie p{margin:0;font-family:"Montserrat",sans-serif;font-weight:300;font-size:0.8rem;' +
      'line-height:1.5;color:rgba(232,228,221,0.82);flex:1 1 280px;}' +
      '#rb-cookie a{color:#e8e4dd;border-bottom:1px solid rgba(217,1,60,0.8);text-decoration:none;white-space:nowrap;}' +
      '#rb-cookie a:hover{color:#d9013c;}' +
      '#rb-cookie button{font-family:"Oswald",sans-serif;font-weight:500;font-size:0.62rem;letter-spacing:0.22em;' +
      'text-transform:uppercase;cursor:pointer;color:#0a0a0a;background:#e8e4dd;border:0;border-radius:999px;' +
      'padding:0.6rem 1.5rem;transition:background 0.3s ease,color 0.3s ease;white-space:nowrap;}' +
      '#rb-cookie button:hover{background:#d9013c;color:#e8e4dd;}' +
      '@media (max-width:520px){#rb-cookie{flex-direction:column;text-align:center;}}';
    document.head.appendChild(css);

    var bar = document.createElement('div');
    bar.id = 'rb-cookie';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie notice');
    bar.innerHTML =
      '<p>This site uses cookies for anonymous analytics. See the ' +
      '<a href="/privacy.html">Privacy&nbsp;Policy</a>.</p>' +
      '<button type="button">Got it</button>';
    document.body.appendChild(bar);

    requestAnimationFrame(function () { bar.classList.add('rb-in'); });

    bar.querySelector('button').addEventListener('click', function () {
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      bar.classList.remove('rb-in');
      setTimeout(function () { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 550);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
