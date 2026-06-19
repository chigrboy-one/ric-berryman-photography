/* contact-lead.js — fire a GA generate_lead event on contact-form submit.
   The form is a Netlify form that POSTs and navigates to /thank-you.html, so
   we send with transport_type:'beacon' (navigator.sendBeacon) which survives
   the page unload. The native 'submit' event only dispatches after the
   browser's required-field validation passes, so this fires on genuine
   submissions only — and it replaces the old thank-you-page event so leads
   aren't counted twice. */
(function () {
  'use strict';
  var form = document.getElementById('v3Form');
  if (!form || typeof gtag === 'undefined') return;
  form.addEventListener('submit', function () {
    var sel = form.querySelector('[name="project-type"]');
    gtag('event', 'generate_lead', {
      form_name: 'contact_v3',
      project_type: sel ? sel.value : '',
      transport_type: 'beacon'
    });
  });
})();
