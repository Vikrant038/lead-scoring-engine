document.addEventListener('DOMContentLoaded', () => {
  // Read CSRF Token from meta tag
  const csrfTokenElement = document.querySelector('meta[name="csrf-token"]');
  const csrfToken = csrfTokenElement ? csrfTokenElement.getAttribute('content') : '';

  // CTA Button smooth scroll
  const ctaButton = document.getElementById('cta-button');
  if (ctaButton) {
    ctaButton.addEventListener('click', () => {
      const scoringSection = document.getElementById('scoring-section');
      if (scoringSection) {
        scoringSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // --- Custom Dropdown Logic ---
  const dropdownButton = document.getElementById('persona-dropdown-button');
  const dropdownList = document.getElementById('persona-dropdown-list');
  const selectedPersonaText = document.getElementById('selected-persona-text');
  const personaDescription = document.getElementById('persona-description');
  const dropdownOptions = dropdownList ? dropdownList.querySelectorAll('li[role="option"]') : [];

  function openDropdown() {
    if (dropdownButton && dropdownList) {
      dropdownButton.setAttribute('aria-expanded', 'true');
      dropdownList.classList.remove('opacity-0', 'max-h-0');
      dropdownList.classList.add('opacity-100', 'max-h-[300px]');
      const activeOption = dropdownList.querySelector('[aria-selected="true"]') || dropdownOptions[0];
      if (activeOption) {
        activeOption.focus();
      }
    }
  }

  function closeDropdown() {
    if (dropdownButton && dropdownList) {
      dropdownButton.setAttribute('aria-expanded', 'false');
      dropdownList.classList.remove('opacity-100', 'max-h-[300px]');
      dropdownList.classList.add('opacity-0', 'max-h-0');
      dropdownButton.focus();
    }
  }

  function toggleDropdown() {
    const isOpen = dropdownButton.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  if (dropdownButton) {
    dropdownButton.addEventListener('click', toggleDropdown);
    dropdownButton.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDropdown();
      }
    });
  }

  if (dropdownList) {
    dropdownList.addEventListener('keydown', (e) => {
      const activeElement = document.activeElement;
      if (!activeElement || activeElement.getAttribute('role') !== 'option') return;

      const optionsArr = Array.from(dropdownOptions);
      const currentIndex = optionsArr.indexOf(activeElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % optionsArr.length;
        optionsArr[nextIndex].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + optionsArr.length) % optionsArr.length;
        optionsArr[prevIndex].focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectOption(activeElement);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown();
      }
    });
  }

  async function selectOption(option) {
    const personaId = option.getAttribute('data-value');
    const personaName = option.querySelector('span').textContent;
    const description = option.getAttribute('data-description');

    selectedPersonaText.textContent = personaName;

    // Sync hidden native select element for E2E tests and accessibility
    const nativeSelect = document.getElementById('persona-select');
    if (nativeSelect) {
      nativeSelect.value = personaId;
      nativeSelect.dispatchEvent(new Event('change'));
    }

    personaDescription.classList.add('opacity-0');
    setTimeout(() => {
      personaDescription.textContent = description || 'No description available for the active persona.';
      personaDescription.classList.remove('opacity-0');
    }, 150);

    dropdownOptions.forEach(opt => {
      const isSel = opt === option;
      opt.setAttribute('aria-selected', isSel ? 'true' : 'false');
      const span = opt.querySelector('span');
      if (isSel) {
        span.classList.add('font-semibold', 'text-[#0029ff]', 'dark:text-blue-400');
        span.classList.remove('font-normal');
        if (!opt.querySelector('.check-icon')) {
          const check = document.createElement('span');
          check.className = 'check-icon absolute inset-y-0 right-0 flex items-center pr-3 text-[#0029ff] dark:text-blue-400';
          check.innerHTML = `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
          opt.appendChild(check);
        }
      } else {
        span.classList.remove('font-semibold', 'text-[#0029ff]', 'dark:text-blue-400');
        span.classList.add('font-normal');
        const check = opt.querySelector('.check-icon');
        if (check) opt.removeChild(check);
      }
    });

    closeDropdown();

    try {
      const res = await fetch('/api/set-persona', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ personaId })
      });
      if (res.ok) {
        // Dynamic header badge update
        const headerBadgeText = document.querySelector('[aria-describedby="persona-tooltip"] .font-bold');
        if (headerBadgeText) {
          headerBadgeText.textContent = personaName;
        }
        const tooltip = document.getElementById('persona-tooltip');
        if (tooltip) {
          tooltip.textContent = `Current Profile: ${personaName}`;
        }
      }
    } catch (err) {
      console.error('Failed to set scoring persona:', err);
    }
  }

  document.addEventListener('click', (e) => {
    if (dropdownButton && !dropdownButton.contains(e.target) && dropdownList && !dropdownList.contains(e.target)) {
      if (dropdownButton.getAttribute('aria-expanded') === 'true') {
        dropdownButton.setAttribute('aria-expanded', 'false');
        dropdownList.classList.remove('opacity-100', 'max-h-[300px]');
        dropdownList.classList.add('opacity-0', 'max-h-0');
      }
    }
  });

  dropdownOptions.forEach(opt => {
    opt.addEventListener('click', () => selectOption(opt));
  });

  // --- Drag and Drop File Upload Logic ---
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const uploadError = document.getElementById('upload-error');
  const uploadErrorText = document.getElementById('upload-error-text');

  function showError(msg) {
    if (uploadError && uploadErrorText) {
      uploadErrorText.textContent = msg;
      uploadError.classList.remove('hidden');
    }
  }

  function hideError() {
    if (uploadError) {
      uploadError.classList.add('hidden');
    }
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-gray-300');
      dropzone.classList.add('border-[#0029ff]', 'bg-blue-50/50');
    });

    const resetDropzoneStyle = () => {
      dropzone.classList.remove('border-[#0029ff]', 'bg-blue-50/50');
      dropzone.classList.add('border-gray-300');
    };

    dropzone.addEventListener('dragleave', resetDropzoneStyle);
    dropzone.addEventListener('dragend', resetDropzoneStyle);

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      resetDropzoneStyle();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        handleFileUpload(fileInput.files[0]);
      }
    });
  }

  const demoBatchCard = document.getElementById('demo-batch-card');
  const demoBatchBtn = document.getElementById('demo-batch-btn');
  const currentUserId = document.body.dataset.userId || 'guest';
  const userDemoKey = `demo_batch_run_${currentUserId}`;

  if (demoBatchCard) {
    if (localStorage.getItem(userDemoKey) === 'true') {
      demoBatchCard.classList.add('hidden');
    }
  }

  if (demoBatchBtn) {
    demoBatchBtn.addEventListener('click', () => {
      runDemoBatch();
    });
  }

  // --- Upload Handler & Polling Logic ---
  let activeJobPollInterval = null;

  async function runDemoBatch() {
    hideError();
    if (demoBatchCard) {
      demoBatchCard.classList.add('hidden');
    }
    localStorage.setItem(userDemoKey, 'true');

    try {
      const statusContainer = document.getElementById('job-status-container');
      const filenameEl = document.getElementById('job-filename');
      const progressBar = document.getElementById('job-progress-bar');
      const statusBadge = document.getElementById('job-status-badge');
      const logArea = document.getElementById('job-log-area');
      const spinner = document.getElementById('job-spinner');

      if (filenameEl) filenameEl.textContent = 'demo-fallback.json';
      if (progressBar) progressBar.style.width = '0%';
      if (logArea) logArea.innerHTML = '';
      if (statusBadge) {
        statusBadge.textContent = 'Processing';
        statusBadge.className = 'px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-[#0029ff] uppercase tracking-wider';
      }
      if (spinner) spinner.classList.remove('hidden');
      if (statusContainer) statusContainer.classList.remove('hidden');

      setTimeout(() => {
        if (statusContainer) statusContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);

      const res = await fetch('/api/demo-batch', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Demo batch start failed.');
      }

      const data = await res.json();
      pollJobStatus(data.jobId);
    } catch (err) {
      showError(err.message || 'An unexpected error occurred starting demo batch.');
      const statusContainer = document.getElementById('job-status-container');
      if (statusContainer) statusContainer.classList.add('hidden');
    }
  }

  async function handleFileUpload(file) {
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      showError('Only JSON lead list files are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('File size exceeds the 5MB maximum limit.');
      return;
    }

    hideError();

    const formData = new FormData();
    formData.append('file', file);

    try {
      const statusContainer = document.getElementById('job-status-container');
      const filenameEl = document.getElementById('job-filename');
      const progressBar = document.getElementById('job-progress-bar');
      const statusBadge = document.getElementById('job-status-badge');
      const logArea = document.getElementById('job-log-area');
      const spinner = document.getElementById('job-spinner');

      if (filenameEl) filenameEl.textContent = file.name;
      if (progressBar) progressBar.style.width = '0%';
      if (logArea) logArea.innerHTML = '';
      if (statusBadge) {
        statusBadge.textContent = 'Uploading';
        statusBadge.className = 'px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-[#0029ff] uppercase tracking-wider';
      }
      if (spinner) spinner.classList.remove('hidden');
      if (statusContainer) statusContainer.classList.remove('hidden');

      // Scroll to job status
      setTimeout(() => {
        if (statusContainer) statusContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Server upload failed.');
      }

      const data = await res.json();
      pollJobStatus(data.jobId);

    } catch (err) {
      showError(err.message || 'An unexpected error occurred during upload.');
      const statusContainer = document.getElementById('job-status-container');
      if (statusContainer) statusContainer.classList.add('hidden');
    }
  }

  function pollJobStatus(jobId) {
    if (activeJobPollInterval) {
      clearInterval(activeJobPollInterval);
    }

    const progressBar = document.getElementById('job-progress-bar');
    const statusBadge = document.getElementById('job-status-badge');
    const logArea = document.getElementById('job-log-area');
    const spinner = document.getElementById('job-spinner');

    let processedLogsCount = 0;

    async function checkJob() {
      try {
        const res = await fetch(`/api/job/${jobId}`);
        if (!res.ok) throw new Error('Could not retrieve job status');

        const job = await res.json();

        if (progressBar) progressBar.style.width = `${job.progress}%`;
        if (statusBadge) statusBadge.textContent = job.status;

        if (job.status === 'completed') {
          if (statusBadge) statusBadge.className = 'px-2.5 py-1 text-xs font-bold rounded-full bg-green-50 text-green-700 uppercase tracking-wider';
          if (spinner) spinner.classList.add('hidden');
          clearInterval(activeJobPollInterval);
          fetchQueue();
          showBatchCompletedToast();
        } else if (job.status === 'error') {
          if (statusBadge) statusBadge.className = 'px-2.5 py-1 text-xs font-bold rounded-full bg-red-50 text-red-700 uppercase tracking-wider';
          if (spinner) spinner.classList.add('hidden');
          clearInterval(activeJobPollInterval);
          fetchQueue();
        } else {
          if (statusBadge) statusBadge.className = 'px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-[#0029ff] uppercase tracking-wider';
          if (spinner) spinner.classList.remove('hidden');
        }

        if (job.logs && job.logs.length > processedLogsCount && logArea) {
          for (let i = processedLogsCount; i < job.logs.length; i++) {
            const logLine = document.createElement('div');
            logLine.className = 'log-entry text-gray-300';
            logLine.textContent = job.logs[i];
            logArea.appendChild(logLine);
          }
          processedLogsCount = job.logs.length;
          logArea.scrollTop = logArea.scrollHeight;
        }

      } catch (err) {
        console.error('Job polling error:', err);
      }
    }

    checkJob();
    activeJobPollInterval = setInterval(checkJob, 2000);
  }

  // --- Scoring Queue Logic ---
  async function fetchQueue() {
    const queueContainer = document.getElementById('queue-container');
    const queueCount = document.getElementById('queue-count');
    const queueEmpty = document.getElementById('queue-empty');

    if (!queueContainer || !queueCount || !queueEmpty) return;

    try {
      const res = await fetch('/api/queue');
      if (!res.ok) throw new Error('Failed to retrieve queue list');

      const data = await res.json();
      const jobs = data.jobs || [];
      const pendingJobs = jobs.filter(job => job.status === 'queued' || job.status === 'processing');

      queueCount.textContent = pendingJobs.length;

      if (pendingJobs.length === 0) {
        Array.from(queueContainer.children).forEach(child => {
          if (child !== queueEmpty) child.remove();
        });
        queueEmpty.classList.remove('hidden');
        return;
      }

      queueEmpty.classList.add('hidden');

      const existingCards = queueContainer.querySelectorAll('[data-job-id]');
      const existingIds = Array.from(existingCards).map(card => card.getAttribute('data-job-id'));
      const pendingIds = pendingJobs.map(job => job.id);

      existingCards.forEach(card => {
        const cid = card.getAttribute('data-job-id');
        if (!pendingIds.includes(cid)) {
          card.classList.add('opacity-0', 'translate-x-10');
          setTimeout(() => card.remove(), 300);
        }
      });

      pendingJobs.forEach(job => {
        let card = queueContainer.querySelector(`[data-job-id="${job.id}"]`);
        if (!card) {
          card = document.createElement('div');
          card.setAttribute('data-job-id', job.id);
          card.className = 'queue-card-enter p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between shadow-sm transition-all duration-300';
          card.innerHTML = `
            <div class="flex flex-col min-w-0 mr-4">
              <span class="text-sm font-semibold text-gray-800 truncate">${job.fileName}</span>
              <span class="text-xs text-gray-500 mt-0.5">Progress: <span class="job-progress-text">${job.progress}%</span></span>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="status-indicator w-2.5 h-2.5 rounded-full"></span>
              <span class="status-text text-xs font-semibold text-gray-600 capitalize">${job.status}</span>
            </div>
          `;
          queueContainer.appendChild(card);
        } else {
          const progText = card.querySelector('.job-progress-text');
          const statusText = card.querySelector('.status-text');
          if (progText) progText.textContent = `${job.progress}%`;
          if (statusText) statusText.textContent = job.status;
        }

        const indicator = card.querySelector('.status-indicator');
        if (indicator) {
          if (job.status === 'processing') {
            indicator.className = 'status-indicator w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse';
          } else {
            indicator.className = 'status-indicator w-2.5 h-2.5 rounded-full bg-yellow-400';
          }
        }
      });

    } catch (err) {
      console.error('Queue fetching error:', err);
    }
  }

  // Poll queue every 5s
  setInterval(fetchQueue, 5000);
  fetchQueue();
});

function showBatchCompletedToast() {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto bg-black text-white dark:bg-black dark:text-white border-2 border-[#0029ff] dark:border-blue-400 rounded-xl py-3 px-4 shadow-2xl shadow-blue-500/40 transition-all duration-300 transform translate-x-full opacity-0 flex items-center justify-between gap-3.5 min-w-[270px] backdrop-blur-xl';

  toast.innerHTML = `
    <div class="flex items-center gap-2.5 min-w-0">
      <span class="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-sm shadow-green-400/50"></span>
      <span class="text-xs font-extrabold tracking-wide truncate">Batch Complete!</span>
    </div>
    <div class="flex items-center gap-2 flex-shrink-0">
      <a href="/history" class="px-3 pt-1 pb-1.5 bg-[#0029ff] hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-extrabold rounded-lg transition-all shadow-md shadow-blue-500/30 flex items-center gap-1.5">
        <span>History</span>
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
      </a>
      <button type="button" class="dismiss-toast text-gray-400 hover:text-white p-1 rounded-md transition-colors">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-x-full', 'opacity-0');
    toast.classList.add('translate-x-0', 'opacity-100');
  });

  const dismissBtns = toast.querySelectorAll('.dismiss-toast');
  dismissBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      toast.classList.remove('translate-x-0', 'opacity-100');
      toast.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    });
  });
}


