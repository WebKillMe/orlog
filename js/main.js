// ORLOG — bootstrap
(function () {
  'use strict';

  function boot() {
    var root = document.getElementById('app');
    if (!root) {
      console.error('ORLOG: no existe #app');
      return;
    }
    try {
      window.__orlogUI = new window.OrlogUI(root);
    } catch (err) {
      console.error('ORLOG: error al arrancar', err);
      root.innerHTML = '<p style="color:#a83232;padding:2rem;font-family:serif">' +
        'Los dioses guardan silencio: ' + (err && err.message ? err.message : err) + '</p>';
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  if (typeof module !== 'undefined') module.exports = {};
})();
