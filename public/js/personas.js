/* eslint-disable */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const { apiFetch } = window.IcpApi;

    // --- DOM Elements ---
    const uploadModal = document.getElementById('upload-modal');
    const deleteModal = document.getElementById('delete-modal');
    
    const openUploadBtn = document.getElementById('open-upload-modal-btn');
    const fileInput = document.getElementById('persona-file');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadStatus = document.getElementById('upload-status');
    const createForm = document.getElementById('create-persona-form');
    const newNameInput = document.getElementById('new-persona-name');
    const newDescInput = document.getElementById('new-persona-desc');
    const newIdInput = document.getElementById('new-persona-id');



    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const statusEl = document.getElementById('status');

    /** Show an error line in the modal's status element. */
    function showUploadError(msg) {
      if (!uploadStatus) return;
      uploadStatus.textContent = msg;
      uploadStatus.className = 'text-xs font-semibold text-center mt-2 text-red-600';
      uploadStatus.classList.remove('hidden');
    }

    let activeModal = null;
    let lastFocusedElement = null;
    let personaIdToDelete = null;

    // --- Accessibility: Focus Trap System ---
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    
    function trapFocus(e) {
      if (!activeModal) return;
      
      const focusables = activeModal.querySelectorAll(focusableSelectors);
      if (focusables.length === 0) return;
      
      const firstFocusable = focusables[0];
      const lastFocusable = focusables[focusables.length - 1];

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift + Tab: trap backward focus navigation
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          // Tab: trap forward focus navigation
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    }

    // --- Modal Transition Functions ---
    function openModal(modal) {
      if (activeModal) closeModal(activeModal);
      
      activeModal = modal;
      lastFocusedElement = document.activeElement;
      
      // Setup transition layout state
      modal.classList.remove('hidden');
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          modal.classList.remove('pointer-events-none');
          modal.classList.add('pointer-events-auto');
          modal.style.opacity = '1';
          modal.setAttribute('aria-hidden', 'false');

          const backdrop = modal.querySelector('.modal-backdrop');
          const content = modal.querySelector('.modal-content');

          if (backdrop) {
            backdrop.classList.remove('opacity-0');
            backdrop.classList.add('opacity-100');
          }
          if (content) {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
          }
        });
      });

      // Trap focus
      modal.addEventListener('keydown', trapFocus);
      
      // Auto-focus the first element in the modal
      const focusables = modal.querySelectorAll(focusableSelectors);
      if (focusables.length > 0) {
        // Delay slightly for transition to complete
        setTimeout(() => focusables[0].focus(), 150);
      }
    }

    function closeModal(modal) {
      if (!modal) return;
      
      modal.classList.remove('pointer-events-auto');
      modal.classList.add('pointer-events-none');
      modal.style.opacity = '0';
      modal.setAttribute('aria-hidden', 'true');

      const backdrop = modal.querySelector('.modal-backdrop');
      const content = modal.querySelector('.modal-content');

      if (backdrop) {
        backdrop.classList.remove('opacity-100');
        backdrop.classList.add('opacity-0');
      }
      if (content) {
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
      }

      modal.removeEventListener('keydown', trapFocus);
      
      if (lastFocusedElement) {
        lastFocusedElement.focus();
      }
      
      if (activeModal === modal) {
        activeModal = null;
      }

      // Hide modal from rendering layout after transition finishes
      setTimeout(() => {
        if (!modal.classList.contains('pointer-events-auto')) {
          modal.classList.add('hidden');
        }
      }, 300);
    }

    // Bind Close Buttons
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal(activeModal);
      });
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeModal) {
        closeModal(activeModal);
      }
    });

    // Close on clicking backdrop
    document.querySelectorAll('[role="dialog"]').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
          closeModal(modal);
        }
      });
    });

    // --- Toggle Example Panel & Dropzone Variables ---
    const toggleExampleBtn = document.getElementById('toggle-example-btn');
    const examplePanel = document.getElementById('example-panel');
    const modalGridLayout = document.getElementById('modal-grid-layout');
    const dropzone = document.getElementById('persona-dropzone');
    const dropzoneText = document.getElementById('dropzone-text');
    const selectedFilename = document.getElementById('selected-filename');

    // Open Upload Modal Trigger
    if (openUploadBtn) {
      openUploadBtn.addEventListener('click', () => {
        if (uploadStatus) {
          uploadStatus.classList.add('hidden');
          uploadStatus.textContent = '';
        }
        if (fileInput) fileInput.value = '';
        if (newNameInput) newNameInput.value = '';
        if (newDescInput) newDescInput.value = '';
        if (newIdInput) newIdInput.value = '';
        
        // Reset dropzone text
        if (selectedFilename) {
          selectedFilename.textContent = 'No file chosen';
          selectedFilename.className = 'text-[10px] text-gray-400 dark:text-gray-550 truncate max-w-[220px]';
        }
        if (dropzoneText) {
          dropzoneText.textContent = 'Click to select or drag JSON file here';
        }
        
        // Reset example panel to hidden state on open
        if (examplePanel && toggleExampleBtn && uploadModal) {
          const modalContent = uploadModal.querySelector('.modal-content');
          if (modalContent) {
            modalContent.classList.remove('max-w-4xl');
            modalContent.classList.add('max-w-lg');
          }
          if (modalGridLayout) {
            modalGridLayout.classList.remove('md:grid-cols-2');
            modalGridLayout.classList.add('grid-cols-1');
          }
          examplePanel.classList.add('hidden');
          toggleExampleBtn.checked = false;
        }

        openModal(uploadModal);
      });
    }

    // --- Toggle Example Panel Event ---
    if (toggleExampleBtn && examplePanel && uploadModal && modalGridLayout) {
      toggleExampleBtn.addEventListener('change', () => {
        const modalContent = uploadModal.querySelector('.modal-content');
        if (!modalContent) return;

        const isChecked = toggleExampleBtn.checked;
        if (isChecked) {
          examplePanel.classList.remove('hidden');
          modalContent.classList.remove('max-w-lg');
          modalContent.classList.add('max-w-4xl');
          modalGridLayout.classList.remove('grid-cols-1');
          modalGridLayout.classList.add('md:grid-cols-2');
        } else {
          examplePanel.classList.add('hidden');
          modalContent.classList.remove('max-w-4xl');
          modalContent.classList.add('max-w-lg');
          modalGridLayout.classList.remove('md:grid-cols-2');
          modalGridLayout.classList.add('grid-cols-1');
        }
      });
    }

    // --- File Dropzone Interactions ---
    if (dropzone && fileInput) {
      // Trigger file selector on dropzone click
      dropzone.addEventListener('click', () => {
        fileInput.click();
      });

      // Drag and drop events
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('border-[#0029ff]', 'dark:border-blue-500', 'bg-[#0029ff]/5', 'dark:bg-blue-950/10');
        }, false);
      });

      ['dragleave', 'dragend', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('border-[#0029ff]', 'dark:border-blue-500', 'bg-[#0029ff]/5', 'dark:bg-blue-950/10');
        }, false);
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
          fileInput.files = files;
          fileInput.dispatchEvent(new Event('change'));
        }
      }, false);
    }

    // --- Auto-slugify Name to ID ---
    if (newNameInput && newIdInput) {
      newNameInput.addEventListener('input', () => {
        newIdInput.value = newNameInput.value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-');
      });
    }

    // --- Create Persona Form Submission ---
    if (createForm) {
      createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = newNameInput.value.trim();
        const description = newDescInput.value.trim();
        const id = newIdInput.value.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');

        if (!name || !description || !id) {
          if (uploadStatus) {
            showUploadError('All fields are required.');
          }
          return;
        }

        try {
          const submitBtn = document.getElementById('create-persona-submit-btn');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';
          }

          await apiFetch(`/api/persona/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: {
              name,
              description,
              weights: {
                education: 0.2,
                experience: 0.5,
                thinking: 0.3
              },
              education: {
                preferred_tiers: ["tier_1", "tier_2"]
              },
              experience: {
                roles_must_include: ["CTO", "Chief Technology Officer", "VP Engineering"],
                preferred_companies_tiers: ["tier_1"],
                min_years_experience: 8
              },
              skills_must_have: ["Architect", "Scalability", "System Design"],
            },
          });

          closeModal(uploadModal);
          window.location.href = `/personas/${id}/edit`;
        } catch (err) {
          showUploadError(err.message || 'Failed to create persona');
        } finally {
          const submitBtn = document.getElementById('create-persona-submit-btn');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create & Customize Form';
          }
        }
      });
    }

    // --- Card Entrance Stagger (Intersection Observer) ---
    const cardObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          card.classList.remove('opacity-0', 'translate-y-4');
          card.classList.add('opacity-100', 'translate-y-0');
          cardObserver.unobserve(card);
        }
      });
    }, { threshold: 0.05 });

    document.querySelectorAll('.persona-card').forEach(card => {
      cardObserver.observe(card);
    });

    // --- File Input Change Sync ---
    if (fileInput && selectedFilename && dropzoneText) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          selectedFilename.textContent = file.name;
          selectedFilename.className = 'text-[10px] text-[#0029ff] dark:text-blue-400 font-bold truncate max-w-[220px]';
          dropzoneText.textContent = 'Selected JSON file:';

          // If the modal isn't open yet, open it immediately so the Upload button is accessible to E2E click
          if (activeModal !== uploadModal) {
            openModal(uploadModal);
          }
        } else {
          selectedFilename.textContent = 'No file chosen';
          selectedFilename.className = 'text-[10px] text-gray-400 dark:text-gray-550 truncate max-w-[220px]';
          dropzoneText.textContent = 'Click to select or drag JSON file here';
        }
      });
    }

    // --- Upload Handler ---
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', async () => {
        if (!fileInput.files || !fileInput.files[0]) {
          if (uploadStatus) {
            showUploadError('Choose a JSON file first.');
          }
          return;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
          uploadBtn.disabled = true;
          uploadBtn.textContent = 'Uploading...';
          
          await apiFetch('/api/upload-persona', { method: 'POST', body: formData });
          closeModal(uploadModal);
          window.location.reload();
        } catch (e) {
          showUploadError(e.message || 'Upload failed');
        } finally {
          uploadBtn.disabled = false;
          uploadBtn.textContent = 'Upload';
        }
      });
    }

    // --- Set Active Handlers ---
    async function setActivePersona(personaId) {
      try {
        await apiFetch('/api/set-persona', { method: 'POST', body: { personaId } });
        window.location.reload();
      } catch (err) {
        console.error('Failed to set active persona:', err.message);
      }
    }

    // Radio button changes
    document.querySelectorAll('.set-persona').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          setActivePersona(radio.value);
        }
      });
    });

    // "Set Active" footer buttons
    document.querySelectorAll('.set-active-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        setActivePersona(id);
      });
    });



    // --- Delete Flow ---
    document.querySelectorAll('.delete-persona-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        personaIdToDelete = btn.getAttribute('data-id');
        if (personaIdToDelete) {
          openModal(deleteModal);
        }
      });
    });

    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', async () => {
        if (!personaIdToDelete) return;

        try {
          confirmDeleteBtn.disabled = true;
          confirmDeleteBtn.textContent = 'Deleting...';

          await apiFetch(`/api/persona/${encodeURIComponent(personaIdToDelete)}`, {
            method: 'DELETE',
          });
          closeModal(deleteModal);
          window.location.reload();
        } catch (err) {
          console.error('Delete action failed:', err.message);
        } finally {
          confirmDeleteBtn.disabled = false;
          confirmDeleteBtn.textContent = 'Confirm Delete';
          personaIdToDelete = null;
        }
      });
    }
    // --- Example Tab Switcher ---
    const tabForm = document.getElementById('example-tab-form');
    const tabJson = document.getElementById('example-tab-json');
    const paneForm = document.getElementById('example-pane-form');
    const paneJson = document.getElementById('example-pane-json');

    if (tabForm && tabJson && paneForm && paneJson) {
      tabForm.addEventListener('click', () => {
        tabForm.className = 'px-2.5 py-1 text-[10px] font-bold rounded-md bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white transition-all duration-150';
        tabForm.setAttribute('aria-selected', 'true');
        tabJson.className = 'px-2.5 py-1 text-[10px] font-bold rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all duration-150';
        tabJson.setAttribute('aria-selected', 'false');
        
        paneForm.classList.remove('hidden');
        paneJson.classList.add('hidden');
      });

      tabJson.addEventListener('click', () => {
        tabJson.className = 'px-2.5 py-1 text-[10px] font-bold rounded-md bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white transition-all duration-150';
        tabJson.setAttribute('aria-selected', 'true');
        tabForm.className = 'px-2.5 py-1 text-[10px] font-bold rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all duration-150';
        tabForm.setAttribute('aria-selected', 'false');
        
        paneJson.classList.remove('hidden');
        paneForm.classList.add('hidden');
      });
    }
  });
})();
