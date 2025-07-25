(function() {
  // Toggle submenu visibility
  window.toggleMenu = function(menuId) {
    var el = document.getElementById(menuId);
    if (el) {
      el.classList.toggle('hidden');
    }
  };
 // Load sidebar HTML into placeholder
  window.loadSidebar = function(containerId) {
    containerId = containerId || 'sidebar-container';
    return fetch('partials/sidebar.html')
      .then(function(res) { return res.text(); })
      .then(function(html) {
        var container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = html;
        }
      });
  };
// Load navbar HTML into placeholder
  window.loadNavbar = function(containerId) {
    containerId = containerId || 'navbar-container';
    return fetch('partials/navbar.html')
      .then(function(res) { return res.text(); })
      .then(function(html) {
        var container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = html;
        }
      });
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
    window.loadSidebar().then(function() {
      window.initDarkMode();
    });
    window.loadNavbar();
  });
})();
