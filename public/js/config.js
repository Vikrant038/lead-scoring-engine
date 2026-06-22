/* eslint-disable */
// Config editor: save / reset via AJAX with the CSRF token (CSP-safe; no inline scripts).
(function () {
  var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
  var textarea = document.getElementById('config-json');
  var statusEl = document.getElementById('status');

  function show(msg, ok) {
    statusEl.textContent = msg;
    statusEl.className = 'text-sm ' + (ok ? 'text-green-600' : 'text-red-600');
  }

  document.getElementById('save-btn').addEventListener('click', async function () {
    var parsed;
    try {
      parsed = JSON.parse(textarea.value);
    } catch (e) {
      show('Invalid JSON: ' + e.message, false);
      return;
    }
    try {
      var res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify(parsed),
      });
      var data = await res.json().catch(function () { return {}; });
      if (res.ok) {
        show('Saved.', true);
      } else {
        show((data.error && data.error.message) || 'Save failed', false);
      }
    } catch (e) {
      show('Network error', false);
    }
  });

  document.getElementById('reset-btn').addEventListener('click', async function () {
    try {
      var res = await fetch('/api/config/reset', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
      });
      var data = await res.json().catch(function () { return {}; });
      if (res.ok && data.config) {
        textarea.value = JSON.stringify(data.config, null, 2);
        show('Reset to defaults.', true);
      } else {
        show('Reset failed', false);
      }
    } catch (e) {
      show('Network error', false);
    }
  });
})();
