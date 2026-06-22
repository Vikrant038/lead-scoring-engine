/* eslint-disable */
// Personas page: upload, delete, and set-active via AJAX with the CSRF token (CSP-safe).
(function () {
  var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
  var uploadStatus = document.getElementById('upload-status');

  function show(el, msg, ok) {
    el.textContent = msg;
    el.className = 'text-sm mt-2 ' + (ok ? 'text-green-600' : 'text-red-600');
  }

  var uploadBtn = document.getElementById('upload-btn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', async function () {
      var input = document.getElementById('persona-file');
      if (!input.files || !input.files[0]) {
        show(uploadStatus, 'Choose a JSON file first.', false);
        return;
      }
      var form = new FormData();
      form.append('file', input.files[0]);
      try {
        var res = await fetch('/api/upload-persona', {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrf },
          body: form,
        });
        var data = await res.json().catch(function () { return {}; });
        if (res.ok) {
          window.location.reload();
        } else {
          show(uploadStatus, (data.error && data.error.message) || 'Upload failed', false);
        }
      } catch (e) {
        show(uploadStatus, 'Network error', false);
      }
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.set-persona'), function (radio) {
    radio.addEventListener('change', async function () {
      await fetch('/api/set-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ personaId: radio.value }),
      });
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.delete-persona'), function (btn) {
    btn.addEventListener('click', async function () {
      if (!window.confirm('Delete this persona?')) return;
      var res = await fetch('/api/persona/' + encodeURIComponent(btn.getAttribute('data-id')), {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf },
      });
      if (res.ok) window.location.reload();
    });
  });
})();
