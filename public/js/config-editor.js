/* eslint-disable */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const csrfTokenEl = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = csrfTokenEl ? csrfTokenEl.getAttribute('content') : '';
    const textarea = document.getElementById('config-json');
    const saveBtn = document.getElementById('save-btn');
    const resetBtn = document.getElementById('reset-btn');
    const toastContainer = document.getElementById('toast-container');
    const statusEl = document.getElementById('status');
    const toggleRawBtn = document.getElementById('toggle-raw-btn');
    const rawPanel = document.getElementById('raw-json-panel');
    const formPanel = document.getElementById('form-panel');

    let isRawMode = false;

    // Load initial config from embedded script tag
    let currentConfig = {};
    try {
      const dataScript = document.getElementById('config-data');
      if (dataScript) currentConfig = JSON.parse(dataScript.textContent || '{}');
    } catch (e) {
      console.error('Failed to parse config data:', e);
    }

    // --- Status & Toast ---
    function updateStatusText(text) {
      if (statusEl) statusEl.textContent = text;
    }

    function showToast(message, type) {
      if (!toastContainer) return;
      var toast = document.createElement('div');
      toast.className = 'pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-lg shadow-xl transition-all duration-500 ease-out transform translate-y-8 opacity-0 min-w-[320px] max-w-md';
      if (type === 'success') {
        toast.classList.add('bg-white/80', 'border-emerald-100/80', 'text-emerald-900', 'shadow-emerald-950/5', 'dark:bg-gray-900/85', 'dark:border-emerald-500/20', 'dark:text-emerald-200', 'dark:shadow-black/50');
      } else {
        toast.classList.add('bg-white/80', 'border-rose-100/80', 'text-rose-900', 'shadow-rose-950/5', 'dark:bg-gray-900/85', 'dark:border-rose-500/20', 'dark:text-rose-200', 'dark:shadow-black/50');
      }
      var iconSvg = type === 'success'
        ? '<svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
        : '<svg class="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
      toast.innerHTML = iconSvg + '<span class="text-sm font-semibold tracking-wide">' + message + '</span>';
      toastContainer.appendChild(toast);
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

    // --- Toggle Raw/Form ---
    if (toggleRawBtn) {
      toggleRawBtn.addEventListener('click', function () {
        isRawMode = !isRawMode;
        if (isRawMode) {
          // Sync form → JSON
          if (textarea) textarea.value = JSON.stringify(collectFormData(), null, 2);
          rawPanel.classList.remove('hidden');
          formPanel.classList.add('hidden');
          toggleRawBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg> Form View';
        } else {
          // Sync JSON → form
          try {
            currentConfig = JSON.parse(textarea.value);
            populateForm(currentConfig);
          } catch (e) { /* keep form as-is */ }
          rawPanel.classList.add('hidden');
          formPanel.classList.remove('hidden');
          toggleRawBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg> Raw JSON';
        }
      });
    }

    // --- Section Accordion ---
    document.querySelectorAll('.section-header').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sectionId = btn.getAttribute('data-section');
        var section = document.getElementById(sectionId);
        var chevron = btn.querySelector('.section-chevron');
        if (!section) return;
        var isCollapsed = section.classList.contains('collapsed');
        if (isCollapsed) {
          section.classList.remove('collapsed');
          section.style.maxHeight = section.scrollHeight + 'px';
          section.style.opacity = '1';
          if (chevron) chevron.style.transform = 'rotate(180deg)';
        } else {
          section.classList.add('collapsed');
          section.style.maxHeight = '0';
          section.style.opacity = '0';
          if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
      });
    });

    // Open first section by default
    var firstSection = document.getElementById('scoring-weights');
    if (firstSection) {
      firstSection.style.maxHeight = firstSection.scrollHeight + 'px';
      firstSection.style.opacity = '1';
      var firstChevron = document.querySelector('[data-section="scoring-weights"] .section-chevron');
      if (firstChevron) firstChevron.style.transform = 'rotate(180deg)';
    }

    // --- Tag Input System ---
    function createTagInput(wrapper, values) {
      wrapper.innerHTML = '';
      var tags = values || [];
      tags.forEach(function (val) { addTag(wrapper, val); });
      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Type and press Enter';
      input.className = 'flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 py-1 px-1';
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          var val = input.value.trim().replace(/,$/, '');
          if (val) {
            addTag(wrapper, val);
            input.value = '';
          }
        }
        if (e.key === 'Backspace' && !input.value) {
          var lastTag = wrapper.querySelector('.tag:last-of-type');
          if (lastTag) lastTag.remove();
        }
      });
      wrapper.appendChild(input);
      wrapper.addEventListener('click', function () { input.focus(); });
    }

    function addTag(wrapper, value) {
      var tag = document.createElement('span');
      tag.className = 'tag inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
      tag.setAttribute('data-value', value);
      tag.innerHTML = '<span class="truncate max-w-[180px]">' + escapeHtml(value) + '</span><button type="button" class="text-gray-400 hover:text-red-500 transition-colors ml-0.5 font-bold text-sm leading-none">&times;</button>';
      tag.querySelector('button').addEventListener('click', function (e) {
        e.stopPropagation();
        tag.remove();
      });
      // Insert before the input
      var input = wrapper.querySelector('input[type="text"]');
      if (input) {
        wrapper.insertBefore(tag, input);
      } else {
        wrapper.appendChild(tag);
      }
    }

    function getTagValues(wrapper) {
      return Array.from(wrapper.querySelectorAll('.tag')).map(function (t) { return t.getAttribute('data-value'); });
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }

    // --- Bucket Rows ---
    var bucketsContainer = document.getElementById('buckets-container');

    function renderBuckets(buckets) {
      if (!bucketsContainer) return;
      bucketsContainer.innerHTML = '';
      (buckets || []).forEach(function (b, i) {
        var row = document.createElement('div');
        row.className = 'grid grid-cols-5 gap-2 items-end';
        row.setAttribute('data-bucket-idx', i);
        row.innerHTML =
          '<div><label class="block text-[10px] text-gray-400 mb-1">Min</label><input type="number" data-bucket="min" value="' + (b.min || 0) + '" class="bucket-input w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0029ff] focus:border-transparent transition-all" /></div>' +
          '<div><label class="block text-[10px] text-gray-400 mb-1">Max</label><input type="number" data-bucket="max" value="' + (b.max || 0) + '" class="bucket-input w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0029ff] focus:border-transparent transition-all" /></div>' +
          '<div><label class="block text-[10px] text-gray-400 mb-1">Bucket</label><select data-bucket="bucket" class="bucket-input w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-2 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0029ff] focus:border-transparent transition-all"><option value="HIGH"' + (b.bucket === 'HIGH' ? ' selected' : '') + '>HIGH</option><option value="MEDIUM"' + (b.bucket === 'MEDIUM' ? ' selected' : '') + '>MEDIUM</option><option value="LOW"' + (b.bucket === 'LOW' ? ' selected' : '') + '>LOW</option><option value="NOT FIT"' + (b.bucket === 'NOT FIT' ? ' selected' : '') + '>NOT FIT</option></select></div>' +
          '<div><label class="block text-[10px] text-gray-400 mb-1">Priority</label><input type="text" data-bucket="priority" value="' + escapeHtml(b.priority || '') + '" class="bucket-input w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0029ff] focus:border-transparent transition-all" /></div>' +
          '<div><label class="block text-[10px] text-gray-400 mb-1">Conversion</label><input type="text" data-bucket="conversion" value="' + escapeHtml(b.conversion || '') + '" class="bucket-input w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0029ff] focus:border-transparent transition-all" /></div>';
        bucketsContainer.appendChild(row);
      });
    }

    function collectBuckets() {
      if (!bucketsContainer) return [];
      return Array.from(bucketsContainer.querySelectorAll('[data-bucket-idx]')).map(function (row) {
        return {
          min: Number(row.querySelector('[data-bucket="min"]').value),
          max: Number(row.querySelector('[data-bucket="max"]').value),
          bucket: row.querySelector('[data-bucket="bucket"]').value,
          priority: row.querySelector('[data-bucket="priority"]').value,
          conversion: row.querySelector('[data-bucket="conversion"]').value,
        };
      });
    }

    // --- Populate Form from Config ---
    function populateForm(cfg) {
      if (!cfg) return;
      // Simple inputs
      document.querySelectorAll('.cfg-input').forEach(function (input) {
        var name = input.getAttribute('name');
        if (!name) return;
        var val = getNestedValue(cfg, name);
        if (val !== undefined) {
          if (input.tagName === 'SELECT') {
            input.value = val;
          } else {
            input.value = val;
          }
        }
      });
      // Checkboxes
      document.querySelectorAll('.cfg-toggle').forEach(function (cb) {
        var name = cb.getAttribute('name');
        if (!name) return;
        var val = getNestedValue(cfg, name);
        cb.checked = !!val;
      });
      // Tag inputs
      document.querySelectorAll('[data-tag-field]').forEach(function (wrapper) {
        var field = wrapper.getAttribute('data-tag-field');
        var values = getNestedValue(cfg, field);
        createTagInput(wrapper, Array.isArray(values) ? values : []);
      });
      // Buckets
      renderBuckets(cfg.buckets || []);
    }

    // --- Collect Form Data into Config Object ---
    function collectFormData() {
      var cfg = JSON.parse(JSON.stringify(currentConfig || {}));
      // Simple inputs
      document.querySelectorAll('.cfg-input').forEach(function (input) {
        var name = input.getAttribute('name');
        if (!name) return;
        var val = input.value;
        if (input.type === 'number') val = Number(val);
        setNestedValue(cfg, name, val);
      });
      // Checkboxes
      document.querySelectorAll('.cfg-toggle').forEach(function (cb) {
        var name = cb.getAttribute('name');
        if (!name) return;
        setNestedValue(cfg, name, cb.checked);
      });
      // Tag inputs
      document.querySelectorAll('[data-tag-field]').forEach(function (wrapper) {
        var field = wrapper.getAttribute('data-tag-field');
        setNestedValue(cfg, field, getTagValues(wrapper));
      });
      // Buckets
      cfg.buckets = collectBuckets();
      return cfg;
    }

    // --- Helpers for nested paths ---
    function getNestedValue(obj, path) {
      return path.split('.').reduce(function (o, k) { return o && o[k]; }, obj);
    }

    function setNestedValue(obj, path, value) {
      var keys = path.split('.');
      var current = obj;
      for (var i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    }

    // --- Initialize form ---
    populateForm(currentConfig);

    // --- SAVE ---
    if (saveBtn) {
      saveBtn.addEventListener('click', async function () {
        var configPayload;
        if (isRawMode) {
          try {
            configPayload = JSON.parse(textarea.value);
          } catch (e) {
            updateStatusText('Invalid JSON: ' + e.message);
            showToast('Invalid JSON: ' + e.message, 'error');
            return;
          }
        } else {
          configPayload = collectFormData();
        }
        try {
          var response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify(configPayload)
          });
          var data = await response.json().catch(function () { return {}; });
          if (response.ok) {
            updateStatusText('Saved.');
            showToast('Configuration saved successfully', 'success');
            if (data.config) {
              currentConfig = data.config;
              if (!isRawMode) populateForm(currentConfig);
              if (textarea) textarea.value = JSON.stringify(currentConfig, null, 2);
            }
          } else {
            var errorMsg = (data.error && data.error.message) || 'Save failed';
            updateStatusText(errorMsg);
            showToast(errorMsg, 'error');
          }
        } catch (err) {
          updateStatusText('Network error');
          showToast('Network error', 'error');
        }
      });
    }

    // --- RESET ---
    if (resetBtn) {
      resetBtn.addEventListener('click', async function () {
        try {
          var response = await fetch('/api/config/reset', {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken }
          });
          var data = await response.json().catch(function () { return {}; });
          if (response.ok && data.config) {
            currentConfig = data.config;
            populateForm(currentConfig);
            if (textarea) textarea.value = JSON.stringify(currentConfig, null, 2);
            updateStatusText('Reset to defaults.');
            showToast('Reset to defaults', 'success');
          } else {
            updateStatusText('Reset failed');
            showToast('Reset failed', 'error');
          }
        } catch (err) {
          updateStatusText('Network error');
          showToast('Network error', 'error');
        }
      });
    }
  });
})();
