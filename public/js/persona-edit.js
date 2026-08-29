/* eslint-disable */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const csrfTokenEl = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = csrfTokenEl ? csrfTokenEl.getAttribute('content') : '';
    const personaId = document.body.getAttribute('data-persona-id');
    const textarea = document.getElementById('persona-json');
    const saveBtn = document.getElementById('save-btn');
    const toastContainer = document.getElementById('toast-container');
    const statusEl = document.getElementById('status');
    const toggleRawBtn = document.getElementById('toggle-raw-btn');
    const rawPanel = document.getElementById('raw-json-panel');
    const formPanel = document.getElementById('form-panel');

    let isRawMode = false;
    let currentPersona = {};

    // Load initial persona data from embedded script tag
    try {
      const dataScript = document.getElementById('persona-data');
      if (dataScript) currentPersona = JSON.parse(dataScript.textContent || '{}');
    } catch (e) {
      console.error('Failed to parse persona data:', e);
    }

    // --- Status & Toast ---
    function updateStatusText(text) {
      if (statusEl) statusEl.textContent = text;
    }

    const showToast = window.IcpApi.showToast;

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
            currentPersona = JSON.parse(textarea.value);
            populateForm(currentPersona);
          } catch (e) {
            console.error('Failed to parse raw JSON:', e);
          }
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
          expandSection(section, chevron);
        } else {
          collapseSection(section, chevron);
        }
      });
    });

    function expandSection(section, chevron) {
      section.classList.remove('collapsed');
      section.style.maxHeight = section.scrollHeight + 'px';
      section.style.opacity = '1';
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    }

    function collapseSection(section, chevron) {
      section.classList.add('collapsed');
      section.style.maxHeight = '0';
      section.style.opacity = '0';
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }

    // Toggle Section Enablement via switches
    function setupEnableSwitch(switchId, sectionId, containerId) {
      const enableSwitch = document.getElementById(switchId);
      const section = document.getElementById(sectionId);
      const container = document.getElementById(containerId);
      const header = document.querySelector(`[data-section="${sectionId}"]`);
      const chevron = header ? header.querySelector('.section-chevron') : null;

      if (!enableSwitch) return;

      enableSwitch.addEventListener('change', function () {
        if (enableSwitch.checked) {
          if (container) {
            container.classList.remove('opacity-50', 'pointer-events-none');
          }
          if (section && section.classList.contains('collapsed')) {
            expandSection(section, chevron);
          }
        } else {
          if (container) {
            container.classList.add('opacity-50', 'pointer-events-none');
          }
        }
      });
    }

    setupEnableSwitch('weights-enable', 'weights-section', 'weights-inputs-container');
    setupEnableSwitch('education-enable', 'education-section', 'education-inputs-container');
    setupEnableSwitch('experience-enable', 'experience-section', 'experience-inputs-container');
    setupEnableSwitch('skills-enable', 'skills-section', 'skills-inputs-container');

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

    // --- Populate Form from Persona ---
    function populateForm(persona) {
      // Basic info
      const nameInput = document.getElementById('persona-name-input');
      const descInput = document.getElementById('persona-desc-input');
      if (nameInput) nameInput.value = persona.name || '';
      if (descInput) descInput.value = persona.description || '';

      // Weights
      const wEnable = document.getElementById('weights-enable');
      const wContainer = document.getElementById('weights-inputs-container');
      if (wEnable) {
        wEnable.checked = !!persona.weights;
        if (wEnable.checked) {
          if (wContainer) wContainer.classList.remove('opacity-50', 'pointer-events-none');
        } else {
          if (wContainer) wContainer.classList.add('opacity-50', 'pointer-events-none');
        }
      }
      const edW = document.querySelector('input[name="weights.education"]');
      const exW = document.querySelector('input[name="weights.experience"]');
      const thW = document.querySelector('input[name="weights.thinking"]');
      if (edW) edW.value = persona.weights ? (persona.weights.education ?? 0) : 0;
      if (exW) exW.value = persona.weights ? (persona.weights.experience ?? 0) : 0;
      if (thW) thW.value = persona.weights ? (persona.weights.thinking ?? 0) : 0;

      // Education
      const eduEnable = document.getElementById('education-enable');
      const eduContainer = document.getElementById('education-inputs-container');
      if (eduEnable) {
        eduEnable.checked = !!persona.education;
        if (eduEnable.checked) {
          if (eduContainer) eduContainer.classList.remove('opacity-50', 'pointer-events-none');
        } else {
          if (eduContainer) eduContainer.classList.add('opacity-50', 'pointer-events-none');
        }
      }
      const eduTiers = document.querySelectorAll('input[name="education.preferred_tiers"]');
      eduTiers.forEach(cb => {
        cb.checked = persona.education && Array.isArray(persona.education.preferred_tiers)
          ? persona.education.preferred_tiers.includes(cb.value)
          : false;
      });

      // Experience
      const expEnable = document.getElementById('experience-enable');
      const expContainer = document.getElementById('experience-inputs-container');
      if (expEnable) {
        expEnable.checked = !!persona.experience;
        if (expEnable.checked) {
          if (expContainer) expContainer.classList.remove('opacity-50', 'pointer-events-none');
        } else {
          if (expContainer) expContainer.classList.add('opacity-50', 'pointer-events-none');
        }
      }
      // Tag input for roles_must_include
      const rolesWrapper = document.querySelector('[data-tag-field="experience.roles_must_include"]');
      if (rolesWrapper) {
        createTagInput(rolesWrapper, persona.experience ? persona.experience.roles_must_include : []);
      }
      // Checkboxes for preferred_companies_tiers
      const compTiers = document.querySelectorAll('input[name="experience.preferred_companies_tiers"]');
      compTiers.forEach(cb => {
        cb.checked = persona.experience && Array.isArray(persona.experience.preferred_companies_tiers)
          ? persona.experience.preferred_companies_tiers.includes(cb.value)
          : false;
      });
      // Min years experience
      const minYearsInput = document.querySelector('input[name="experience.min_years_experience"]');
      if (minYearsInput) {
        minYearsInput.value = persona.experience ? (persona.experience.min_years_experience ?? '') : '';
      }

      // Skills Must Have
      const skillsEnable = document.getElementById('skills-enable');
      const skillsContainer = document.getElementById('skills-inputs-container');
      if (skillsEnable) {
        skillsEnable.checked = !!persona.skills_must_have;
        if (skillsEnable.checked) {
          if (skillsContainer) skillsContainer.classList.remove('opacity-50', 'pointer-events-none');
        } else {
          if (skillsContainer) skillsContainer.classList.add('opacity-50', 'pointer-events-none');
        }
      }
      const skillsWrapper = document.querySelector('[data-tag-field="skills_must_have"]');
      if (skillsWrapper) {
        createTagInput(skillsWrapper, persona.skills_must_have || []);
      }
    }

    // --- Collect Form Data to JSON ---
    function collectFormData() {
      const data = {
        name: document.getElementById('persona-name-input').value.trim(),
        description: document.getElementById('persona-desc-input').value.trim()
      };

      // Weights
      const wEnable = document.getElementById('weights-enable');
      if (wEnable && wEnable.checked) {
        data.weights = {
          education: Number(document.querySelector('input[name="weights.education"]').value || 0),
          experience: Number(document.querySelector('input[name="weights.experience"]').value || 0),
          thinking: Number(document.querySelector('input[name="weights.thinking"]').value || 0)
        };
      }

      // Education
      const eduEnable = document.getElementById('education-enable');
      if (eduEnable && eduEnable.checked) {
        const checkedTiers = Array.from(document.querySelectorAll('input[name="education.preferred_tiers"]:checked'))
          .map(cb => cb.value);
        data.education = {
          preferred_tiers: checkedTiers
        };
      }

      // Experience
      const expEnable = document.getElementById('experience-enable');
      if (expEnable && expEnable.checked) {
        const rolesWrapper = document.querySelector('[data-tag-field="experience.roles_must_include"]');
        const checkedCompTiers = Array.from(document.querySelectorAll('input[name="experience.preferred_companies_tiers"]:checked'))
          .map(cb => cb.value);
        const minYearsVal = document.querySelector('input[name="experience.min_years_experience"]').value;

        data.experience = {};
        
        if (rolesWrapper) {
          const roles = getTagValues(rolesWrapper);
          if (roles.length > 0) data.experience.roles_must_include = roles;
        }
        if (checkedCompTiers.length > 0) {
          data.experience.preferred_companies_tiers = checkedCompTiers;
        }
        if (minYearsVal !== '') {
          data.experience.min_years_experience = Number(minYearsVal);
        }
      }

      // Skills
      const skillsEnable = document.getElementById('skills-enable');
      if (skillsEnable && skillsEnable.checked) {
        const skillsWrapper = document.querySelector('[data-tag-field="skills_must_have"]');
        if (skillsWrapper) {
          const skills = getTagValues(skillsWrapper);
          if (skills.length > 0) {
            data.skills_must_have = skills;
          }
        }
      }

      return data;
    }

    // Populate initial form
    populateForm(currentPersona);

    // --- Save Handler ---
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        let payload;
        if (isRawMode) {
          try {
            payload = JSON.parse(textarea.value);
          } catch (e) {
            showToast('Invalid JSON syntax: ' + e.message, 'error');
            return;
          }
        } else {
          payload = collectFormData();
        }

        // Basic client-side validation
        if (!payload.name || payload.name.trim() === '') {
          showToast('Persona Name is required.', 'error');
          return;
        }
        if (!payload.description || payload.description.trim() === '') {
          showToast('Description is required.', 'error');
          return;
        }

        try {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Saving...';
          updateStatusText('Saving...');

          const res = await fetch(`/api/persona/${encodeURIComponent(personaId)}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(payload)
          });

          const data = await res.json().catch(() => ({}));

          if (res.ok) {
            showToast('Persona saved successfully!', 'success');
            updateStatusText('Saved.');
            setTimeout(() => {
              window.location.href = '/personas';
            }, 1000);
          } else {
            const errorMsg = (data.error && data.error.message) || 'Failed to save persona';
            showToast(errorMsg, 'error');
            updateStatusText('Save failed.');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
          }
        } catch (err) {
          showToast('Network error during save.', 'error');
          updateStatusText('Network error.');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
        }
      });
    }
  });
})();
