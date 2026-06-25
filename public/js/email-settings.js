/* eslint-disable */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    // Read CSRF Token from meta tag
    const csrfTokenEl = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = csrfTokenEl ? csrfTokenEl.getAttribute('content') : '';

    const form = document.getElementById('email-form');
    const toneInput = document.getElementById('tone');
    const pillButtons = document.querySelectorAll('.tone-pill');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    const statusEl = document.getElementById('status');
    const successOverlay = document.getElementById('success-overlay');
    const successCheckmark = document.getElementById('success-checkmark');

    function updateStatusText(text) {
      if (statusEl) {
        statusEl.textContent = text;
      }
    }

    // --- Pill Radio UI Syncer ---
    function updatePillsUI(value) {
      const normalizedVal = (value || '').toLowerCase().trim();
      pillButtons.forEach(btn => {
        const btnVal = btn.getAttribute('data-tone-val');
        const isMatched = btnVal === normalizedVal;

        btn.setAttribute('aria-checked', isMatched ? 'true' : 'false');

        if (isMatched) {
          // Selected state: filled with #0029ff, text white, border transparent
          btn.classList.add('bg-[#0029ff]', 'text-white', 'border-transparent');
          btn.classList.remove('border-gray-200', 'dark:border-gray-800', 'text-gray-700', 'dark:text-gray-300', 'bg-white', 'dark:bg-gray-900');
        } else {
          // Unselected state
          btn.classList.remove('bg-[#0029ff]', 'text-white', 'border-transparent');
          btn.classList.add('border-gray-200', 'dark:border-gray-800', 'text-gray-700', 'dark:text-gray-300', 'bg-white', 'dark:bg-gray-900');
        }
      });
    }

    // Bind click events to custom pills
    pillButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-tone-val');
        if (toneInput) {
          toneInput.value = val;
          // Trigger change event to notify any other listeners
          toneInput.dispatchEvent(new Event('change'));
        }
        updatePillsUI(val);
      });
    });

    // Sync from hidden input changes (e.g. when Playwright .fill() changes the value)
    if (toneInput) {
      const syncFromInput = () => updatePillsUI(toneInput.value);
      toneInput.addEventListener('input', syncFromInput);
      toneInput.addEventListener('change', syncFromInput);
      
      // Initial Sync on load
      syncFromInput();
    }

    // --- Form Submission Flow ---
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const senderName = document.getElementById('senderName').value;
        const company = document.getElementById('company').value;
        const tone = toneInput ? toneInput.value : 'friendly';

        // Set Loading UI state
        if (submitBtn) submitBtn.disabled = true;
        if (btnText) btnText.classList.add('hidden');
        if (btnSpinner) btnSpinner.classList.remove('hidden');
        updateStatusText('');

        try {
          const res = await fetch('/api/email-settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({ senderName, company, tone })
          });

          const data = await res.json().catch(() => ({}));

          if (res.ok) {
            updateStatusText('Saved.');
            
            // Show premium success scale/fade animations
            if (successOverlay) {
              successOverlay.classList.remove('pointer-events-none', 'opacity-0', 'scale-95');
              successOverlay.classList.add('opacity-100', 'scale-100');
            }
            if (successCheckmark) {
              successCheckmark.classList.add('success-checkmark-scale');
            }
            const successText = document.querySelector('.success-text-anim');
            if (successText) {
              successText.classList.remove('opacity-0');
              successText.classList.add('opacity-100');
            }

            // Redirect to history dashboard after 1 second
            setTimeout(() => {
              window.location.href = '/history';
            }, 1000);
          } else {
            const errorMsg = (data.error && data.error.message) || 'Save failed';
            updateStatusText(errorMsg);
            
            // Restore button UI state
            if (submitBtn) submitBtn.disabled = false;
            if (btnText) btnText.classList.remove('hidden');
            if (btnSpinner) btnSpinner.classList.add('hidden');
          }
        } catch (err) {
          updateStatusText('Network error');
          
          // Restore button UI state
          if (submitBtn) submitBtn.disabled = false;
          if (btnText) btnText.classList.remove('hidden');
          if (btnSpinner) btnSpinner.classList.add('hidden');
        }
      });
    }
  });
})();
