/* eslint-disable */
// Upload dropzone + queue polling (FR-10-009). CSP-safe: no inline scripts; reads config from DOM.
(function () {
  const csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
  const pollInterval = Number(document.body.getAttribute('data-poll-interval')) || 2000;
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const errorEl = document.getElementById('upload-error');
  const queueEl = document.getElementById('queue');

  function showError(msg) {
    errorEl.textContent = msg || '';
  }

  async function upload(file) {
    showError('');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showError((data.error && data.error.message) || 'Upload failed');
      }
    } catch (e) {
      showError('Network error during upload');
    }
  }

  function handleFiles(files) {
    Array.prototype.forEach.call(files, upload);
  }

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-black');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('border-black'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-black');
    handleFiles(e.dataTransfer.files);
  });

  async function poll() {
    try {
      const res = await fetch('/api/queue');
      const data = await res.json();
      if (!data.jobs || data.jobs.length === 0) {
        queueEl.innerHTML = '<li class="text-gray-500">No jobs yet.</li>';
        return;
      }
      queueEl.innerHTML = data.jobs
        .map(
          (j) =>
            '<li class="bg-white p-3 rounded border border-gray-100">' +
            '<div class="flex justify-between"><span>' +
            j.fileName +
            '</span><span>' +
            j.status +
            ' · ' +
            j.progress +
            '%</span></div></li>'
        )
        .join('');
    } catch (e) {
      /* transient; retry on next tick */
    }
  }

  poll();
  setInterval(poll, pollInterval);
})();
