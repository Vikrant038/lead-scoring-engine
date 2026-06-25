document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu toggle logic
  const menuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');
  const hamburgerIcon = document.getElementById('hamburger-icon');
  const closeIcon = document.getElementById('close-icon');

  if (menuButton && mobileMenu) {
    menuButton.addEventListener('click', () => {
      const isExpanded = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', !isExpanded);

      if (isExpanded) {
        mobileMenu.classList.add('hidden');
        hamburgerIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
      } else {
        mobileMenu.classList.remove('hidden');
        hamburgerIcon.classList.add('hidden');
        closeIcon.classList.remove('hidden');
      }
    });
  }

  // --- Theme Toggle Logic ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
  const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

  function updateThemeUI(isDark) {
    if (isDark) {
      document.documentElement.classList.add('dark');
      themeToggleDarkIcon?.classList.add('hidden');
      themeToggleLightIcon?.classList.remove('hidden');
    } else {
      document.documentElement.classList.remove('dark');
      themeToggleDarkIcon?.classList.remove('hidden');
      themeToggleLightIcon?.classList.add('hidden');
    }
  }

  // Initialize UI based on current root class
  const isDarkInitial = document.documentElement.classList.contains('dark');
  updateThemeUI(isDarkInitial);

  themeToggleBtn?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    const newDark = !isDark;
    updateThemeUI(newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  });

  // Sync theme changes across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme') {
      const isDark = e.newValue === 'dark';
      updateThemeUI(isDark);
    }
  });

  // Enable transitions after initial paint
  setTimeout(() => {
    document.documentElement.classList.add('theme-transition');
  }, 50);

  // Active navigation link highlighting (Accessibility: aria-current="page")
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('[data-nav-link]');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    // Match exact route or check if the current path starts with the link href (excluding root '/')
    if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
});
