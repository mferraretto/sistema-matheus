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

  // Support repositories that serve pages from a subdirectory (e.g. GitHub Pages "public" folder)
  // ROOT_PATH points to the repo root while BASE_PATH remains the current script folder
  var ROOT_PATH = BASE_PATH.replace(/public\/$/, '');

  function fetchWithFallback(urls, idx) {
    idx = idx || 0;
    if (idx >= urls.length) return Promise.reject(new Error('Not found'));
    return fetch(urls[idx]).then(function(res) {
      if (!res.ok) throw new Error('Not found');
      return res.text();
    }).catch(function() {
      return fetchWithFallback(urls, idx + 1);
    });
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

    var paths = [
      ROOT_PATH + sidebarPath,
      BASE_PATH + sidebarPath,
      '/' + sidebarPath,
      ROOT_PATH + 'partials/sidebar.html',
      BASE_PATH + 'partials/sidebar.html',
      '/partials/sidebar.html'
    ];

    return fetchWithFallback(paths)
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
    var paths = [
      ROOT_PATH + 'partials/navbar.html',
      BASE_PATH + 'partials/navbar.html',
      '/partials/navbar.html'
    ];
    return fetchWithFallback(paths)
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
    var paths = [
      ROOT_PATH + 'partials/auth-modals.html',
      BASE_PATH + 'partials/auth-modals.html',
      '/partials/auth-modals.html'
    ];
    return fetchWithFallback(paths)
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
      darkClass = darkClass || 'dark-mode';

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

function initShared() {
  function start() {
    if (window.ensureLayout) {
      window.ensureLayout().then(function () {
        window.initDarkMode();
      });
    } else {
      window.initDarkMode();
    }
  }

  loadTailwind().then(start).catch(function () {
    start();
  });

  // ✅ Só carrega os modais de login se estiver na index.html
  const pathname = window.location.pathname.toLowerCase();
  const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
  if (filename === '' || filename === 'index.html') {
    window.loadAuthModals();
  }

  window.checkColorContrast();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShared);
} else {
  initShared();
}

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
  document.body.classList.add('has-sidebar');
  loadIntroJs().then(function () {
    var btn = document.getElementById('startSidebarTourBtn');
    if (btn) {
      btn.addEventListener('click', function () { window.startSidebarTour(true); });
    }
    window.startSidebarTour(false);
  });
});

})();

/** === LAYOUT PERSISTENTE DO SIDEBAR/NAV === **/
window.CUSTOM_SIDEBAR_PATH = window.CUSTOM_SIDEBAR_PATH || 'partials/sidebar-gestor.html';
window.CUSTOM_NAVBAR_PATH  = window.CUSTOM_NAVBAR_PATH  || 'partials/navbar.html';
const PARTIALS_VERSION = '2025-08-25-02'; // mude quando atualizar parciais

function toggleSidebar(){
  const sb = document.getElementById('sidebar-container');
  if (!sb) return;
  sb.classList.toggle('-translate-x-full');
}

async function loadPartial(selector, path){
  // cria o container se não existir (algumas telas substituem o body)
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement(selector.startsWith('#') ? 'div' : 'aside');
    const id = selector.replace('#', '');
    el.id = id;
    if (id === 'sidebar-container') {
      el.className = 'fixed inset-y-0 left-0 w-64 max-w-[80vw] bg-purple-700 text-white overflow-auto z-40 transition-transform duration-200 ease-out -translate-x-full lg:translate-x-0 shadow-lg';
      document.body.prepend(el);
      // garante margem do conteúdo no desktop
      document.querySelector('.main-content')?.classList.add('lg:ml-64');
    } else {
      // navbar acima do main
      document.body.insertBefore(el, document.querySelector('main') || null);
      el.classList.add('lg:pl-64');
    }
  }

  // sempre força rede p/ evitar cache velho do SW
  const base = `${location.origin}${location.pathname.replace(/[^/]+$/, '')}`;
  let url = new URL(path, base).toString();
  url += (url.includes('?') ? '&' : '?') + 'v=' + PARTIALS_VERSION;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    const html = await res.text();
    el.innerHTML = html;

    // reexecuta <script> internos do parcial
    el.querySelectorAll('script').forEach(old=>{
      const s = document.createElement('script');
      s.type = old.type || 'text/javascript';
      if (old.src) {
        const srcUrl = new URL(old.getAttribute('src'), url).toString();
        s.src = srcUrl + (srcUrl.includes('?') ? '&' : '?') + 'v=' + PARTIALS_VERSION;
      } else {
        s.text = old.textContent || '';
      }
      old.replaceWith(s);
    });

    // dispara eventos para compatibilidade
    const evtName = selector === '#sidebar-container' ? 'sidebarLoaded' : selector === '#navbar-container' ? 'navbarLoaded' : null;
    if (evtName) {
      document.dispatchEvent(new CustomEvent(evtName, { detail: { selector } }));
    }

    // no desktop, sempre aberto
    if (selector === '#sidebar-container' && matchMedia('(min-width:1024px)').matches) {
      el.classList.remove('-translate-x-full','hidden');
      // limpa qualquer estado salvo que esconda
      try { localStorage.removeItem('sidebarClosed'); } catch(e){}
      document.cookie = 'sidebarClosed=; Max-Age=0; path=/';
    }
  } catch (err) {
    console.error('[partials] falha', path, err);
    el.innerHTML = `<div class="p-3 bg-red-50 text-red-700 text-sm rounded">Erro ao carregar <code>${path}</code>.</div>`;
  }
}

async function ensureLayout(){
  await Promise.all([
    loadPartial('#sidebar-container', window.CUSTOM_SIDEBAR_PATH),
    loadPartial('#navbar-container',  window.CUSTOM_NAVBAR_PATH),
  ]);
}

// roda em várias fases para cobrir login/redirect/back-forward-cache
['DOMContentLoaded','load','pageshow','focus'].forEach(evt=>{
  window.addEventListener(evt, ensureLayout, { once: false });
});

// se algum script remover os containers, recolocamos
const mo = new MutationObserver(() => {
  if (!document.getElementById('sidebar-container')) ensureLayout();
  if (!document.getElementById('navbar-container'))  ensureLayout();
});
mo.observe(document.documentElement, { childList: true, subtree: true });

// ao redimensionar para desktop, garante aberto
window.addEventListener('resize', ()=>{
  const sb = document.getElementById('sidebar-container');
  if (sb && matchMedia('(min-width:1024px)').matches) {
    sb.classList.remove('-translate-x-full','hidden');
  }
});

// expõe global
window.toggleSidebar = window.toggleSidebar || toggleSidebar;
window.ensureLayout  = ensureLayout;
