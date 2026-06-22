/* eslint-disable */
// Email settings form: POST sender details with the CSRF token (CSP-safe).
(function () {
  var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
  var form = document.getElementById('email-form');
  var statusEl = document.getElementById('status');

  function show(msg, ok) {
    statusEl.textContent = msg;
    statusEl.className = 'text-sm ' + (ok ? 'text-green-600' : 'text-red-600');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var body = {
      senderName: document.getElementById('senderName').value,
      company: document.getElementById('company').value,
      tone: document.getElementById('tone').value,
    };
    try {
      var res = await fetch('/api/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify(body),
      });
      var data = await res.json().catch(function () { return {}; });
      show(res.ok ? 'Saved.' : (data.error && data.error.message) || 'Save failed', res.ok);
    } catch (e) {
      show('Network error', false);
    }
  });
})();
