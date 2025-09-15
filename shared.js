(function () {
  // Determine base path of current script for loading partials
  var currentScript =
    document.currentScript ||
    (function () {
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
  window.ROOT_PATH = ROOT_PATH;

  // Toggle submenu visibility using max-height for smooth transitions
  window.toggleMenu = function (menuId, btn) {
    var el = document.getElementById(menuId);
    if (!el) return;
    var isOpen = el.style.maxHeight && el.style.maxHeight !== '0px';
    el.style.maxHeight = isOpen ? '0px' : el.scrollHeight + 'px';
    if (btn) {
      btn.classList.toggle('open', !isOpen);
    }
  };

  function fetchWithFallback(urls, idx) {
    idx = idx || 0;
    if (idx >= urls.length) return Promise.reject(new Error('Not found'));
    return fetch(urls[idx])
      .then(function (res) {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .catch(function () {
        return fetchWithFallback(urls, idx + 1);
      });
  }

  function loadTailwind() {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('link[href*="tailwind"]')) {
        resolve();
        return;
      }
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href =
        'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  // Load Intro.js library if not already loaded
  function loadIntroJs() {
    return new Promise(function (resolve, reject) {
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
  window.loadSidebar = function (containerId, sidebarPath) {
    containerId = containerId || 'sidebar-container';
    sidebarPath = sidebarPath || 'partials/sidebar.html';

    var paths = [];
    if (/^https?:\/\//.test(sidebarPath)) {
      paths = [sidebarPath];
    } else if (sidebarPath.startsWith('/')) {
      var rel = sidebarPath.replace(/^\//, '');
      paths = [ROOT_PATH + rel, BASE_PATH + rel, sidebarPath];
    } else {
      paths = [
        ROOT_PATH + sidebarPath,
        BASE_PATH + sidebarPath,
        ROOT_PATH + 'partials/sidebar.html',
        BASE_PATH + 'partials/sidebar.html',
        '/partials/sidebar.html',
      ];
    }

    return fetchWithFallback(paths)
      .then(function (html) {
        var container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = html;
          var event = new CustomEvent('sidebarLoaded', {
            detail: { containerId: containerId },
          });
          document.dispatchEvent(event);
        }
      })
      .catch(function (err) {
        console.error('Erro ao carregar sidebar:', err);
      });
  };
  // Load navbar HTML into placeholder
  window.loadNavbar = function (containerId, navbarPath) {
    containerId = containerId || 'navbar-container';
    navbarPath = navbarPath || 'partials/navbar.html';

    var paths = [];
    if (/^https?:\/\//.test(navbarPath)) {
      paths = [navbarPath];
    } else if (navbarPath.startsWith('/')) {
      var rel = navbarPath.replace(/^\//, '');
      paths = [ROOT_PATH + rel, BASE_PATH + rel, navbarPath];
    } else {
      paths = [
        ROOT_PATH + navbarPath,
        BASE_PATH + navbarPath,
        ROOT_PATH + 'partials/navbar.html',
        BASE_PATH + 'partials/navbar.html',
        '/partials/navbar.html',
      ];
    }

    return fetchWithFallback(paths).then(function (html) {
      var container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = html;
        var event = new CustomEvent('navbarLoaded', {
          detail: { containerId: containerId },
        });
        document.dispatchEvent(event);
      }
    });
  };

  // Load authentication modals into placeholder
  window.loadAuthModals = function (containerId) {
    containerId = containerId || 'auth-modals-container';
    var paths = [
      ROOT_PATH + 'partials/auth-modals.html',
      BASE_PATH + 'partials/auth-modals.html',
      '/partials/auth-modals.html',
    ];
    return fetchWithFallback(paths).then(function (html) {
      var container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = html;
      }
    });
  };
  // Initialize dark mode handling
  window.initDarkMode = function (toggleId, darkClass) {
    toggleId = toggleId || 'darkModeToggle';
    darkClass = darkClass || 'dark-mode';

    var toggle = document.getElementById(toggleId);
    var savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark') {
      document.body.classList.add(darkClass);
      if (toggle) toggle.checked = true;
    }

    if (toggle) {
      toggle.addEventListener('change', function () {
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
  window.checkColorContrast = function () {
    var all = document.querySelectorAll('*');
    all.forEach(function (el) {
      var style = window.getComputedStyle(el);
      var color = style.color.replace(/\s+/g, '');
      var bg = style.backgroundColor.replace(/\s+/g, '');
      if (color && bg && color === bg) {
        el.style.outline = '2px dashed red';
      }
    });
  };

  window.startSidebarTour = function (force) {
    if (typeof introJs === 'undefined') return;
    if (!force && localStorage.getItem('sidebarTourSeen') === 'true') return;
    var intro = introJs.tour();
    intro
      .setOptions({
        steps: [
          {
            element: '#menu-vendas',
            intro: 'Área para acompanhar vendas e sobras.',
          },
          {
            element: '#menu-precificacao',
            intro: 'Ferramentas para precificação de produtos.',
          },
          {
            element: '#menu-marketing',
            intro: 'Ferramentas de marketing e promoções.',
          },
          {
            element: '#menu-anuncios',
            intro: 'Gerencie seus anúncios e utilize IA.',
          },
          {
            element: '#menu-expedicao',
            intro: 'Processos e relatórios de expedição.',
          },
          {
            element: '#menu-configuracoes',
            intro: 'Configurações e gestão de produtos.',
          },
          {
            element: '#menu-equipes',
            intro: 'Gerencie membros e tarefas da equipe.',
          },
          {
            element: '#menu-manual',
            intro: 'Acesse o manual completo do sistema.',
          },
        ],
        nextLabel: 'Próximo',
        prevLabel: 'Anterior',
        skipLabel: 'Pular',
        doneLabel: 'Finalizar',
      })
      .oncomplete(function () {
        localStorage.setItem('sidebarTourSeen', 'true');
      })
      .onexit(function () {
        localStorage.setItem('sidebarTourSeen', 'true');
      })
      .start();
  };

  function initShared() {
    function start() {
      if (window.ensureLayout) {
        // ensureLayout will initialize dark mode after loading partials
        window.ensureLayout();
      } else {
        window.initDarkMode();
      }
    }

    loadTailwind()
      .then(start)
      .catch(function () {
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

  document.addEventListener('sidebarLoaded', function () {
    document.body.classList.add('has-sidebar');
    document.querySelectorAll('#sidebar .submenu').forEach(function (el) {
      el.style.maxHeight = '0px';
    });
    loadIntroJs().then(function () {
      var btn = document.getElementById('startSidebarTourBtn');
      if (btn) {
        btn.addEventListener('click', function () {
          window.startSidebarTour(true);
        });
      }
      window.startSidebarTour(false);
    });
  });
})();

/** === LAYOUT PERSISTENTE DO SIDEBAR/NAV === **/
window.CUSTOM_SIDEBAR_PATH =
  window.CUSTOM_SIDEBAR_PATH || 'partials/sidebar.html';
window.CUSTOM_NAVBAR_PATH = window.CUSTOM_NAVBAR_PATH || 'partials/navbar.html';
const PARTIALS_VERSION = '2025-08-25-02'; // mude quando atualizar parciais

function toggleSidebar() {
  const sb = document.getElementById('sidebar-container');
  if (!sb) return;

  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', toggleSidebar);
  }

  const isOpen = sb.classList.toggle('open');
  overlay.classList.toggle('show', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

async function loadPartial(selector, path) {
  // cria o container se não existir (algumas telas substituem o body)
  let el = document.querySelector(selector);
  const id = selector.replace('#', '');
  if (!el) {
    el = document.createElement(selector.startsWith('#') ? 'div' : 'aside');
    el.id = id;
    if (id === 'sidebar-container') {
      el.className =
        'fixed inset-y-0 left-0 w-64 max-w-[80vw] overflow-auto z-40 transition-transform duration-200 ease-out shadow-lg';
      document.body.prepend(el);
      // garante margem do conteúdo no desktop
      document.querySelector('.main-content')?.classList.add('lg:ml-64');
    } else {
      // navbar acima do main
      document.body.insertBefore(el, document.querySelector('main') || null);
    }
  } else {
    if (id === 'sidebar-container') {
      el.classList.add(
        'fixed',
        'inset-y-0',
        'left-0',
        'w-64',
        'max-w-[80vw]',
        'overflow-auto',
        'z-40',
        'transition-transform',
        'duration-200',
        'ease-out',
        'shadow-lg',
      );
      document.querySelector('.main-content')?.classList.add('lg:ml-64');
    }
  }

  // sempre força rede p/ evitar cache velho do SW
  const base = window.ROOT_PATH || `${location.origin}/`;
  let url;
  if (/^https?:\/\//.test(path)) {
    url = path;
  } else {
    url = new URL(path.replace(/^\//, ''), base).toString();
  }
  url += (url.includes('?') ? '&' : '?') + 'v=' + PARTIALS_VERSION;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    const html = await res.text();
    el.innerHTML = html;

    // reexecuta <script> internos do parcial
    el.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      s.type = old.type || 'text/javascript';
      if (old.src) {
        const srcUrl = new URL(old.getAttribute('src'), url).toString();
        s.src =
          srcUrl + (srcUrl.includes('?') ? '&' : '?') + 'v=' + PARTIALS_VERSION;
      } else {
        s.text = old.textContent || '';
      }
      old.replaceWith(s);
    });

    // dispara eventos para compatibilidade
    const evtName =
      selector === '#sidebar-container'
        ? 'sidebarLoaded'
        : selector === '#navbar-container'
          ? 'navbarLoaded'
          : null;
    if (evtName) {
      document.dispatchEvent(
        new CustomEvent(evtName, { detail: { selector } }),
      );
    }

    // no desktop, sempre aberto
    if (
      selector === '#sidebar-container' &&
      matchMedia('(min-width:1024px)').matches
    ) {
      el.classList.add('open');
      // limpa qualquer estado salvo que esconda
      try {
        localStorage.removeItem('sidebarClosed');
      } catch (e) {}
      document.cookie = 'sidebarClosed=; Max-Age=0; path=/';
    }
  } catch (err) {
    console.error('[partials] falha', path, err);
    el.innerHTML = `<div class="p-3 bg-red-50 text-red-700 text-sm rounded">Erro ao carregar <code>${path}</code>.</div>`;
  }
}

async function ensureLayout() {
  await Promise.all([
    loadPartial('#sidebar-container', window.CUSTOM_SIDEBAR_PATH),
    loadPartial('#navbar-container', window.CUSTOM_NAVBAR_PATH),
  ]);
  // Reapply dark mode listeners after layout reloads
  if (typeof window.initDarkMode === 'function') {
    window.initDarkMode();
  }
}

// roda em momentos essenciais para evitar recargas desnecessárias
// evita acumular listeners em execuções repetidas do script
if (!window._layoutListenersBound) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', ensureLayout, { once: true });
  } else {
    ensureLayout();
  }
  window.addEventListener('pageshow', ensureLayout, { once: true });
  window._layoutListenersBound = true;
}

// se algum script remover os containers, recolocamos
const mo = new MutationObserver(() => {
  if (!document.getElementById('sidebar-container')) ensureLayout();
  if (!document.getElementById('navbar-container')) ensureLayout();
});
mo.observe(document.documentElement, { childList: true, subtree: true });

// ao redimensionar para desktop, garante aberto
window.addEventListener('resize', () => {
  const sb = document.getElementById('sidebar-container');
  const overlay = document.getElementById('sidebar-overlay');
  if (sb && matchMedia('(min-width:1024px)').matches) {
    sb.classList.add('open');
    overlay?.classList.remove('show');
    document.body.style.overflow = '';
  }
});

// expõe global
window.toggleSidebar = window.toggleSidebar || toggleSidebar;
window.ensureLayout = ensureLayout;

let searchPages = [];

function collectSearchPages() {
  searchPages = Array.from(document.querySelectorAll('#sidebar a.sidebar-link'))
    .map((a) => ({
      title: a.textContent.trim(),
      href: a.getAttribute('href'),
    }))
    .filter((p) => p.title && p.href);
}

document.addEventListener('sidebarLoaded', collectSearchPages);

document.addEventListener('navbarLoaded', () => {
  const toggle = document.getElementById('sidebarToggle');
  if (toggle) {
    const clone = toggle.cloneNode(true);
    toggle.replaceWith(clone);
    clone.addEventListener('click', toggleSidebar);
  }
});

document.addEventListener('navbarLoaded', () => {
  const input = document.getElementById('navbarSearch');
  const results = document.getElementById('navbarSearchResults');
  if (!input || !results) return;

  function renderResults() {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      results.innerHTML = '';
      results.classList.add('hidden');
      return;
    }
    if (!searchPages.length) collectSearchPages();
    const filtered = searchPages.filter((p) =>
      p.title.toLowerCase().includes(q),
    );
    if (!filtered.length) {
      results.innerHTML =
        '<div class="px-3 py-2 text-sm text-gray-500">Nenhum resultado</div>';
      results.classList.remove('hidden');
      return;
    }
    results.innerHTML = filtered
      .map((p) => `<a href="${p.href}">${p.title}</a>`)
      .join('');
    results.classList.remove('hidden');
  }

  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector('a');
      if (first) window.location.href = first.getAttribute('href');
    }
  });
  input.addEventListener('blur', () =>
    setTimeout(() => results.classList.add('hidden'), 200),
  );
});

let userMenuClickRegistered = false;
document.addEventListener('navbarLoaded', () => {
  const btn = document.getElementById('userMenuBtn');
  const menu = document.getElementById('userMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    menu.classList.toggle('hidden');
  });
  if (!userMenuClickRegistered) {
    document.addEventListener('click', (e) => {
      const b = document.getElementById('userMenuBtn');
      const m = document.getElementById('userMenu');
      if (!b || !m) return;
      if (!b.contains(e.target) && !m.contains(e.target)) {
        m.classList.add('hidden');
      }
    });
    userMenuClickRegistered = true;
  }
});

// Controle de visibilidade do sidebar baseado no perfil do usuário
document.addEventListener('sidebarLoaded', async () => {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || sidebar.dataset.permsApplied) return;
  sidebar.dataset.permsApplied = 'true';

  const [
    { initializeApp, getApps },
    { getAuth, onAuthStateChanged },
    { getFirestore, doc, getDoc },
    { firebaseConfig },
  ] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js'),
    import('./firebase-config.js'),
  ]);

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const ADMIN_GESTOR_MENU_IDS = [
    'menu-gestao',
    'menu-financeiro',
    'menu-atualizacoes',
    'menu-comunicacao',
    'menu-saques',
    'menu-acompanhamento-gestor',
    'menu-mentoria',
    'menu-perfil-mentorado',
    'menu-equipes',
    'menu-produtos',
    'menu-sku-associado',
    'menu-desempenho',
  ];

  const CLIENTE_HIDDEN_MENU_IDS = ADMIN_GESTOR_MENU_IDS.filter(
    (id) => id !== 'menu-comunicacao',
  );

  function showOnly(ids) {
    document.querySelectorAll('#sidebar .sidebar-link').forEach((a) => {
      const li = a.closest('li') || a.parentElement;
      if (li) li.style.display = 'none';
    });
    ids.forEach((id) => {
      const el = document.getElementById(id);
      const li = el && (el.closest('li') || el.parentElement);
      if (li) li.style.display = '';
    });
  }

  function hideIds(ids) {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      const li = el && (el.closest('li') || el.parentElement);
      if (li) li.style.display = 'none';
    });
  }

  function buildGestorSidebarLayout() {
    const menu = document.querySelector('#sidebar .sidebar-menu');
    if (!menu) return;

    const getLi = (id) => {
      const el = document.getElementById(id);
      return el ? el.closest('li') : null;
    };

    const atualizacoes = getLi('menu-atualizacoes');
    const financeiro = getLi('menu-financeiro');
    const saques = getLi('menu-saques');
    const gestao = getLi('menu-gestao');
    const acompGestor = getLi('menu-acompanhamento-gestor');
    const mentoria = getLi('menu-mentoria');
    const perfilMentorado = getLi('menu-perfil-mentorado');
    const produtos = getLi('menu-produtos');
    const skuAssociado = getLi('menu-sku-associado');
    const comunicacao = getLi('menu-comunicacao');
    const equipes = getLi('menu-equipes');
    const desempenho = getLi('menu-desempenho');

    function createGroup(mainLi, submenuId, items) {
      if (!mainLi) return null;
      const a = mainLi.querySelector('a.sidebar-link');
      if (!a) return null;

      const div = document.createElement('div');
      div.className = 'sidebar-item flex items-center justify-between';
      div.appendChild(a);

      const btn = document.createElement('button');
      btn.className = 'submenu-toggle p-2';
      btn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>';
      btn.addEventListener('click', () => toggleMenu(submenuId, btn));
      div.appendChild(btn);

      const ul = document.createElement('ul');
      ul.id = submenuId;
      ul.className =
        'submenu space-y-1 overflow-hidden transition-all duration-300';
      ul.style.maxHeight = '0';
      items.forEach((item) => {
        if (item) ul.appendChild(item);
      });

      mainLi.innerHTML = '';
      mainLi.appendChild(div);
      mainLi.appendChild(ul);
      return mainLi;
    }

    const financeiroGroup = createGroup(financeiro, 'menuFinanceiro', [saques]);
    const gestaoGroup = createGroup(gestao, 'menuGestao', [
      acompGestor,
      mentoria,
      perfilMentorado,
      produtos,
      skuAssociado,
    ]);
    const comunicacaoGroup = createGroup(comunicacao, 'menuComunicacao', [
      equipes,
    ]);

    menu.innerHTML = '';
    [
      atualizacoes,
      financeiroGroup,
      gestaoGroup,
      comunicacaoGroup,
      desempenho,
    ].forEach((li) => {
      if (li) {
        li.style.display = '';
        menu.appendChild(li);
      }
    });
  }

  function buildClienteSidebarLayout() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.add('client-layout');
    }
  }

  async function applySidebarPermissions(uid) {
    try {
      const snap = await getDoc(doc(db, 'usuarios', uid));
      const perfil = ((snap.exists() && String(snap.data().perfil || '')) || '')
        .trim()
        .toLowerCase();

      const isADM = ['adm', 'admin', 'administrador'].includes(perfil);
      const isGestor = [
        'gestor',
        'mentor',
        'responsavel',
        'gestor financeiro',
        'responsavel financeiro',
      ].includes(perfil);
      const isCliente = ['cliente', 'user', 'usuario'].includes(perfil);

      if (isADM) {
        document.querySelectorAll('#sidebar .sidebar-link').forEach((a) => {
          const li = a.closest('li') || a.parentElement;
          if (li) li.style.display = '';
        });
      } else if (isGestor) {
        showOnly(ADMIN_GESTOR_MENU_IDS);
        if (!['gestor', 'responsavel financeiro'].includes(perfil)) {
          hideIds(['menu-sku-associado']);
        }
        buildGestorSidebarLayout();
      } else if (isCliente) {
        hideIds(CLIENTE_HIDDEN_MENU_IDS);
        document.querySelectorAll('#sidebar .sidebar-link').forEach((a) => {
          const li = a.closest('li') || a.parentElement;
          if (li && !CLIENTE_HIDDEN_MENU_IDS.includes(a.id))
            li.style.display = '';
        });
        buildClienteSidebarLayout();
      }
    } catch (e) {
      console.error('Erro ao aplicar permissões do sidebar:', e);
    }
  }

  const auth = getAuth(app);
  onAuthStateChanged(auth, (user) => {
    if (user) applySidebarPermissions(user.uid);
  });
});
