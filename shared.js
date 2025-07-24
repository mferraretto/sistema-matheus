(function() {
  // Toggle submenu visibility
  window.toggleMenu = function(menuId) {
    var el = document.getElementById(menuId);
    if (el) {
      el.classList.toggle('hidden');
    }
  };

  // Initialize dark mode handling
  window.initDarkMode = function(toggleId, darkClass) {
    toggleId = toggleId || 'darkModeToggle';
    darkClass = darkClass || 'dark';

    var toggle = document.getElementById(toggleId);
    var savedTheme = localStorage.getItem('theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.body.classList.add(darkClass);
      if (toggle) toggle.checked = true;
    }

    if (toggle) {
      toggle.addEventListener('change', function() {
        if (toggle.checked) {
          document.body.classList.add(darkClass);
          localStorage.setItem('theme', 'dark');
        } else {
          document.body.classList.remove(darkClass);
          localStorage.setItem('theme', 'light');
        }
      });
    }
  };

  document.addEventListener('DOMContentLoaded', function() {
    window.initDarkMode();
  });
})();
