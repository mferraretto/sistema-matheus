(function() {
  // Determine base path of current script for loading partials
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();
  var BASE_PATH = '';
  if (currentScript && currentScript.src) {
    BASE_PATH = currentScript.src.split('/').slice(0, -1).join('/') + '/';
  }
  
  // Toggle submenu visibility
  window.toggleMenu = function(menuId) {
    var el = document.getElementById(menuId);
    if (el) {
      el.classList.toggle('hidden');
    }
  };
  
  // Toggle visibility of the Importar Produtos card on the precificação page
  window.toggleImportCard = function() {
    var card = document.getElementById('importarProdutosCard');
    var btn = document.getElementById('toggleImportarBtn');
    if (!card || !btn) return;
    card.classList.toggle('hidden');
    if (card.classList.contains('hidden')) {
      btn.textContent = 'Exibir Importar Produtos';
    } else {
      btn.textContent = 'Esconder Importar Produtos';
    }
  };
 // Load sidebar HTML into placeholder
  window.loadSidebar = function(containerId) {
    containerId = containerId || 'sidebar-container';
    return fetch(BASE_PATH + 'partials/sidebar.html')
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
    return fetch(BASE_PATH + 'partials/navbar.html')
      .then(function(res) { return res.text(); })
      .then(function(html) {
        var container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = html;
            var event = new CustomEvent('navbarLoaded', { detail: { containerId: containerId } });
          document.dispatchEvent(event);
        }
      });
  };
  
  // Load authentication modals into placeholder
  window.loadAuthModals = function(containerId) {
    containerId = containerId || 'auth-modals-container';
    return fetch(BASE_PATH + 'partials/auth-modals.html')
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
// Check elements for text color matching background color
  window.checkColorContrast = function() {
    var all = document.querySelectorAll('*');
    all.forEach(function(el) {
      var style = window.getComputedStyle(el);
      var color = style.color.replace(/\s+/g, '');
      var bg = style.backgroundColor.replace(/\s+/g, '');
      if (color && bg && color === bg) {
        console.warn('Low contrast text detected:', el);
        el.style.outline = '2px dashed red';
      }
    });
  };

  document.addEventListener('DOMContentLoaded', function() {
    window.loadSidebar().then(function() {
      window.initDarkMode();
    });
    window.loadNavbar();
    window.loadAuthModals();
        window.checkColorContrast();
  });
})();
