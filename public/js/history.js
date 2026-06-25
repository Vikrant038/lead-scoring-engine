document.addEventListener('DOMContentLoaded', () => {
  // Read CSRF Token from meta tag
  const csrfTokenElement = document.querySelector('meta[name="csrf-token"]');
  const csrfToken = csrfTokenElement ? csrfTokenElement.getAttribute('content') : '';

  // --- Count-Up Stat Cards Animation ---
  function animateCounters() {
    const counters = document.querySelectorAll('[data-count-to]');
    counters.forEach(counter => {
      const target = parseFloat(counter.getAttribute('data-count-to')) || 0;
      const isDecimal = counter.getAttribute('data-is-decimal') === 'true';
      const duration = 1000; // 1 second animation duration
      let startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const current = progress * target;

        if (isDecimal) {
          counter.textContent = current.toFixed(1);
        } else {
          counter.textContent = Math.floor(current);
        }

        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          counter.textContent = isDecimal ? target.toFixed(1) : target;
        }
      }

      window.requestAnimationFrame(step);
    });
  }

  // Trigger counters on load
  animateCounters();

  // --- Sort by Score Toggle ---
  const sortBtn = document.getElementById('sort-score-button');
  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      const tableBody = document.querySelector('tbody');
      if (!tableBody) return;

      const rows = Array.from(tableBody.querySelectorAll('tr[data-score]'));
      const currentOrder = sortBtn.getAttribute('data-sort-order');
      const newOrder = currentOrder === 'desc' ? 'asc' : 'desc';

      rows.sort((a, b) => {
        const scoreA = parseFloat(a.getAttribute('data-score')) || 0;
        const scoreB = parseFloat(b.getAttribute('data-score')) || 0;
        return newOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
      });

      // Re-append rows in sorted order, keeping detail rows immediately below main row
      rows.forEach(row => {
        tableBody.appendChild(row);
        const recordId = row.getAttribute('data-record-id');
        const detailsRow = document.getElementById(`details-row-${recordId}`);
        if (detailsRow) {
          tableBody.appendChild(detailsRow);
        }
      });

      sortBtn.setAttribute('data-sort-order', newOrder);
      const orderText = newOrder === 'desc' ? 'High → Low' : 'Low → High';
      sortBtn.querySelector('span').textContent = `Sort by Score (${orderText})`;
    });
  }

  // --- Details Panel Toggle ---
  const detailsButtons = document.querySelectorAll('.details-toggle-btn');
  detailsButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const recordId = btn.getAttribute('aria-controls').replace('details-', '');
      const detailsRow = document.getElementById(`details-row-${recordId}`);
      const detailsPanel = document.getElementById(`details-${recordId}`);
      if (!detailsRow || !detailsPanel) return;

      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !isExpanded);

      if (isExpanded) {
        // Collapse panel
        detailsPanel.style.maxHeight = '0px';
        detailsPanel.style.opacity = '0';
        setTimeout(() => {
          detailsRow.classList.add('hidden');
        }, 500);
      } else {
        // Expand panel
        detailsRow.classList.remove('hidden');
        setTimeout(() => {
          detailsPanel.style.maxHeight = `${detailsPanel.scrollHeight + 100}px`;
          detailsPanel.style.opacity = '1';
          observeProgressBars(detailsPanel);
        }, 50);
      }
    });
  });

  // --- Progress Bars Animation via IntersectionObserver ---
  const progressObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fill = entry.target;
        const targetWidth = fill.getAttribute('data-width') || '0';
        fill.style.width = `${targetWidth}%`;
        progressObserver.unobserve(fill);
      }
    });
  }, { threshold: 0.1 });

  function observeProgressBars(container) {
    const fills = container.querySelectorAll('.progress-bar-fill');
    fills.forEach(fill => {
      progressObserver.observe(fill);
    });
  }

  // --- Copy to Clipboard for Email Drafts ---
  const copyButtons = document.querySelectorAll('.copy-email-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const section = btn.closest('.email-section');
      if (!section) return;

      const bodyText = section.querySelector('.email-body').textContent;
      const tooltip = btn.querySelector('.copy-tooltip');

      try {
        await navigator.clipboard.writeText(bodyText);

        if (tooltip) {
          tooltip.classList.remove('hidden');
          setTimeout(() => tooltip.classList.add('opacity-100'), 10);

          setTimeout(() => {
            tooltip.classList.remove('opacity-100');
            setTimeout(() => tooltip.classList.add('hidden'), 200);
          }, 2000);
        }
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    });
  });

  // --- Regenerate Outreach Email Logic ---
  const regenerateButtons = document.querySelectorAll('.regenerate-email-btn');
  regenerateButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const section = btn.closest('.email-section');
      if (!section) return;

      const recordId = section.getAttribute('data-record-id');
      const container = section.querySelector('.email-content-container');
      const subjectEl = section.querySelector('.email-subject');
      const bodyEl = section.querySelector('.email-body');

      btn.disabled = true;
      btn.textContent = 'Regenerating...';
      if (container) container.classList.add('opacity-40');

      try {
        // Try POST first
        let res = await fetch(`/api/regenerate-email/${recordId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          }
        });

        // Fallback to GET if POST is not supported/mapped
        if (res.status === 404 || res.status === 405) {
          res = await fetch(`/api/regenerate-email/${recordId}`);
        }

        if (!res.ok) throw new Error('Regeneration request failed.');

        const data = await res.json();
        if (data.success && data.email) {
          if (container) {
            container.classList.add('opacity-0');
            setTimeout(() => {
              if (subjectEl) subjectEl.textContent = data.email.subject;
              if (bodyEl) bodyEl.textContent = data.email.body;
              container.classList.remove('opacity-0');
              container.classList.remove('opacity-40');
            }, 300);
          }
        }
      } catch (err) {
        console.error('Failed to regenerate outreach email:', err);
        if (container) container.classList.remove('opacity-40');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Regenerate Email';
      }
    });
  });

  // --- Clear My Data Logic ---
  const clearDataBtn = document.getElementById('clear-data-button');
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all data? This will permanently delete your session history.')) {
        try {
          const res = await fetch('/api/clear-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken
            }
          });
          if (res.ok) {
            window.location.reload();
          } else {
            console.error('Failed to clear session data.');
          }
        } catch (err) {
          console.error('Network error during data clear:', err);
        }
      }
    });
  }
});
