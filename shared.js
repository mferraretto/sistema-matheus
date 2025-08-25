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

  function loadTailwind() {
    return new Promise(function(resolve, reject) {
      if (document.querySelector('link[href*="tailwind"]')) { resolve(); return; }
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }
  
  // Toggle submenu visibility with smooth slide animation
  window.toggleMenu = function(menuId) {
    var el = document.getElementById(menuId);
    if (!el) return;
    if (el.classList.contains('max-h-0')) {
      el.classList.remove('max-h-0');
      el.classList.add('max-h-screen');
    } else {
      el.classList.add('max-h-0');
      el.classList.remove('max-h-screen');
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
  // Load Intro.js library if not already loaded
  function loadIntroJs() {
    return new Promise(function(resolve, reject) {
      if (typeof introJs !== 'undefined') {
        resolve();
        return;
      }
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/intro.js/minified/introjs.min.css';
      document.head.appendChild(link);
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/intro.js/minified/intro.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
// Load sidebar HTML into placeholder
  window.loadSidebar = function(containerId, sidebarPath) {
    containerId = containerId || 'sidebar-container';
    sidebarPath = sidebarPath || 'partials/sidebar.html';
    return fetch(BASE_PATH + sidebarPath)
      .then(function(res) {
        if (!res.ok) throw new Error('Sidebar not found');
        return res.text();
      })
      .catch(function(err) {
        console.warn('Falha ao carregar sidebar personalizada:', err);
        return fetch(BASE_PATH + 'partials/sidebar.html').then(function(res) {
          if (!res.ok) throw new Error('Sidebar padrão não encontrada');
          return res.text();
        });
      })
      .then(function(html) {
        var container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = html;
          var event = new CustomEvent('sidebarLoaded', { detail: { containerId: containerId } });
          document.dispatchEvent(event);
        }
      })
      .catch(function(err) {
        console.error('Erro ao carregar sidebar:', err);
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

  window.startSidebarTour = function(force) {
    if (typeof introJs === 'undefined') return;
    if (!force && localStorage.getItem('sidebarTourSeen') === 'true') return;
    var intro = introJs();
    intro.setOptions({
      steps: [
        { element: '#menu-inicio', intro: 'Voltar para a página inicial.' },
        { element: '#menu-vendas', intro: 'Área para acompanhar vendas e sobras.' },
        { element: '#menu-precificacao', intro: 'Ferramentas para precificação de produtos.' },
        { element: '#menu-marketing', intro: 'Ferramentas de marketing e promoções.' },
        { element: '#menu-anuncios', intro: 'Gerencie seus anúncios e utilize IA.' },
        { element: '#menu-expedicao', intro: 'Processos e relatórios de expedição.' },
        { element: '#menu-configuracoes', intro: 'Configurações e gestão de produtos.' },
        { element: '#menu-equipes', intro: 'Gerencie membros e tarefas da equipe.' },
        { element: '#menu-manual', intro: 'Acesse o manual completo do sistema.' }
      ],
      nextLabel: 'Próximo',
      prevLabel: 'Anterior',
      skipLabel: 'Pular',
      doneLabel: 'Finalizar'
    }).oncomplete(function(){ localStorage.setItem('sidebarTourSeen','true'); })
      .onexit(function(){ localStorage.setItem('sidebarTourSeen','true'); })
      .start();
  };

document.addEventListener('DOMContentLoaded', function () {
  loadTailwind().then(function () {
    window.loadSidebar(null, window.CUSTOM_SIDEBAR_PATH).then(function () {
      window.initDarkMode();
    });
    window.loadNavbar();
  });

  // ✅ Só carrega os modais de login se estiver na index.html
  const pathname = window.location.pathname.toLowerCase();
  const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
  if (filename === '' || filename === 'index.html') {
    window.loadAuthModals();
  }

  window.checkColorContrast();
});

// Handle mobile sidebar toggle after navbar loads
document.addEventListener('navbarLoaded', function () {
  var btn = document.querySelector('.mobile-menu-btn');
  if (!btn) return;
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', function () {
    var sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      var isActive = sidebar.classList.toggle('active');
      btn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    }
  });
});

document.addEventListener('sidebarLoaded', function () {
  loadIntroJs().then(function () {
    var btn = document.getElementById('startSidebarTourBtn');
    if (btn) {
      btn.addEventListener('click', function () { window.startSidebarTour(true); });
    }
    window.startSidebarTour(false);
  });
});

})();
