/**
 * Shared client helpers: CSRF token access, JSON fetch wrapper, and toast notifications.
 * Every page script uses these instead of re-implementing fetch/error/toast plumbing.
 */
(function () {
  function csrfToken() {
    const el = document.querySelector('meta[name="csrf-token"]');
    return el ? el.getAttribute('content') : '';
  }

  /**
   * JSON request with CSRF header. Returns parsed body; throws Error(message) on HTTP failure.
   */
  async function apiFetch(url, options) {
    const opts = options || {};
    const headers = Object.assign({}, opts.headers, { 'X-CSRF-Token': csrfToken() });
    if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data.error && data.error.message) || (data.message || 'Request failed'));
    }
    return data;
  }

  /** Show a transient toast in #toast-container (created on demand). */
  function showToast(message, type) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className =
        'fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className =
      'pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-lg shadow-xl transition-all duration-500 ease-out transform translate-y-8 opacity-0 min-w-[320px] max-w-md';
    if (type === 'success') {
      toast.classList.add('bg-white/80', 'border-emerald-100/80', 'text-emerald-900', 'shadow-emerald-950/5', 'dark:bg-gray-900/85', 'dark:border-emerald-500/20', 'dark:text-emerald-200', 'dark:shadow-black/50');
    } else {
      toast.classList.add('bg-white/80', 'border-rose-100/80', 'text-rose-900', 'shadow-rose-950/5', 'dark:bg-gray-900/85', 'dark:border-rose-500/20', 'dark:text-rose-200', 'dark:shadow-black/50');
    }
    const iconSvg = type === 'success'
      ? '<svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
      : '<svg class="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
    const span = document.createElement('span');
    span.className = 'text-sm font-semibold tracking-wide';
    span.textContent = message; // textContent, never innerHTML: message may contain user data
    toast.innerHTML = iconSvg;
    toast.appendChild(span);
    container.appendChild(toast);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.remove('translate-y-8', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
      });
    });
    setTimeout(function () {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('-translate-y-4', 'opacity-0');
      toast.addEventListener('transitionend', function () { toast.remove(); });
    }, 3000);
  }

  window.IcpApi = { csrfToken, apiFetch, showToast };
})();
