/* eslint-disable */
// History page: regenerate/expand outreach emails, copy to clipboard, clear session data (CSP-safe).
(function () {
  var csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

  function panelFor(id) {
    return document.querySelector('.email-panel[data-id="' + CSS.escape(id) + '"]');
  }

  Array.prototype.forEach.call(document.querySelectorAll('.regenerate-email'), function (btn) {
    btn.addEventListener('click', async function () {
      var id = btn.getAttribute('data-id');
      var panel = panelFor(id);
      btn.textContent = '⏳ Generating…';
      try {
        var res = await fetch('/api/regenerate-email/' + encodeURIComponent(id));
        var data = await res.json().catch(function () { return {}; });
        if (res.ok && data.email) {
          panel.querySelector('.email-subject').textContent = data.email.subject || '';
          panel.querySelector('.email-body').textContent = data.email.body || '';
          panel.classList.remove('hidden');
        } else {
          panel.querySelector('.email-body').textContent =
            'No email available (AI disabled or generation failed).';
          panel.classList.remove('hidden');
        }
      } catch (e) {
        panel.querySelector('.email-body').textContent = 'Network error.';
        panel.classList.remove('hidden');
      }
      btn.textContent = '📧 Email';
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.copy-email'), function (btn) {
    btn.addEventListener('click', function () {
      var panel = panelFor(btn.getAttribute('data-id'));
      var text =
        'Subject: ' + panel.querySelector('.email-subject').textContent + '\n\n' +
        panel.querySelector('.email-body').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(text);
    });
  });

  var clearBtn = document.getElementById('clear-data');
  if (clearBtn) {
    clearBtn.addEventListener('click', async function () {
      if (!window.confirm('Delete all your uploaded files and results?')) return;
      var res = await fetch('/api/clear-data', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
      });
      if (res.ok) window.location.href = '/history';
    });
  }
})();
