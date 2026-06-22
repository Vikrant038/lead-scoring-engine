/* eslint-disable */
// Persona editor: PUT the edited JSON with the CSRF token (CSP-safe).
(function () {
  var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
  var personaId = document.body.getAttribute('data-persona-id');
  var textarea = document.getElementById('persona-json');
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
      var res = await fetch('/api/persona/' + encodeURIComponent(personaId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify(parsed),
      });
      var data = await res.json().catch(function () { return {}; });
      show(res.ok ? 'Saved.' : (data.error && data.error.message) || 'Save failed', res.ok);
    } catch (e) {
      show('Network error', false);
    }
  });
})();
