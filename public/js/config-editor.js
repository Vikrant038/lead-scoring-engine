/* eslint-disable */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const { apiFetch } = window.IcpApi;
    const textarea = document.getElementById('config-json');
    const saveBtn = document.getElementById('save-btn');
    const resetBtn = document.getElementById('reset-btn');
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

    const { showToast } = window.IcpApi;

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
          var data = await apiFetch('/api/config', { method: 'POST', body: configPayload });
          updateStatusText('Saved.');
          showToast('Configuration saved successfully', 'success');
          if (data.config) {
            currentConfig = data.config;
            if (!isRawMode) populateForm(currentConfig);
            if (textarea) textarea.value = JSON.stringify(currentConfig, null, 2);
          }
        } catch (err) {
          updateStatusText(err.message);
          showToast(err.message, 'error');
        }
      });
    }

    // --- RESET ---
    if (resetBtn) {
      resetBtn.addEventListener('click', async function () {
        try {
          var data = await apiFetch('/api/config/reset', { method: 'POST' });
          if (data.config) {
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
          updateStatusText(err.message);
          showToast(err.message, 'error');
        }
      });
    }
  });
})();
