import {
  initializeApp,
  getApps,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  firebaseConfig,
  setPassphrase,
  getPassphrase,
} from './firebase-config.js';
import { encryptString, decryptString } from './crypto.js';
import { fetchResponsavelFinanceiroUsuarios } from './responsavel-financeiro.js';
import { showToast } from './utils.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const profileCache = {};

export async function loadUserProfile(uid) {
  if (!uid) return null;
  if (profileCache[uid]) return profileCache[uid];
  const key = `userProfile:${uid}`;
  try {
    const cached =
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem(key));
    if (cached) {
      const obj = JSON.parse(cached);
      profileCache[uid] = obj;
      return obj;
    }
  } catch {}

  const usuarioSnap = await getDoc(doc(db, 'usuarios', uid));
  const perfilSnap = await getDoc(doc(db, 'perfil', uid));
  const mentSnap = await getDoc(doc(db, 'perfilMentorado', uid));
  if (!usuarioSnap.exists()) return null;
  const usuario = usuarioSnap.data() || {};
  const perfil = perfilSnap.exists() ? perfilSnap.data() : {};
  const perfilMentorado = mentSnap.exists() ? mentSnap.data() : {};

  const data = {
    uid,
    perfil: usuario.perfil || perfil.perfil || 'usuario',
    nome: usuario.nome || perfil.nome || '',
    email: usuario.email || perfil.email || '',
    isAdm: !!usuario.isAdm,
    lojas: usuario.lojas || perfil.lojas || [],
    ...perfil,
    perfilMentorado,
  };
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, JSON.stringify(data));
    }
  } catch {}
  profileCache[uid] = data;
  return data;
}

export function clearUserProfileCache(uid) {
  const key = `userProfile:${uid}`;
  delete profileCache[uid];
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(key);
    }
  } catch {}
}

if (typeof window !== 'undefined') {
  window.loadUserProfile = loadUserProfile;
  window.clearUserProfileCache = clearUserProfileCache;
}
const VISIBILIDADE_GLOBAL_ID = '__todos_conectados__';
let wasLoggedIn = false;
let authListenerRegistered = false;
let explicitLogout = false;
let isExpedicao = false;
const EXPEDICAO_ALLOWED_MENU_IDS = [
  'menu-expedicao',
  'menu-configuracoes',
  'menu-painel-atualizacoes-gerais',
];
let notifUnsub = null;
let expNotifUnsub = null;
let updNotifUnsub = null;
let painelGeralNotifUnsub = null;
let painelMentNotifUnsub = null;
window.isFinanceiroResponsavel = false;
window.responsavelFinanceiro = null;

window.savePassphrase = () => {
  const input = document.getElementById('passphraseInput');
  const pass = input.value.trim();
  if (pass) {
    setPassphrase(pass);

    input.value = '';
    closeModal('passphraseModal');
  } else {
    showToast('Digite uma senha', 'warning');
  }
};

window.saveDisplayName = async () => {
  const input = document.getElementById('displayNameInput');
  const nome = input.value.trim();
  const user = auth.currentUser;
  if (!user || !nome) {
    showToast('Digite um nome', 'warning');
    return;
  }
  try {
    const pass = getPassphrase() || `chave-${user.uid}`;
    let perfil = 'Cliente';
    const uidRef = doc(db, 'uid', user.uid);
    const snap = await getDoc(uidRef);
    if (snap.exists()) {
      const enc = snap.data().encrypted;
      if (enc) {
        try {
          const data = JSON.parse(await decryptString(enc, pass));
          perfil = data.perfil || perfil;
        } catch {}
      }
    }
    await setDoc(
      uidRef,
      {
        uid: user.uid,
        email: user.email,
        nome,
        encrypted: await encryptString(JSON.stringify({ perfil }), pass),
      },
      { merge: true },
    );
    try {
      await updateProfile(user, { displayName: nome });
    } catch {}
    const currentUserEl = document.getElementById('currentUser');
    if (currentUserEl) currentUserEl.textContent = nome;
    input.value = '';
    closeModal('displayNameModal');
    showToast('Nome atualizado!', 'success');
  } catch (e) {
    console.error('Erro ao salvar nome:', e);
    showToast('Erro ao salvar nome', 'error');
  }
};

window.openModal = (id) => {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
};

window.closeModal = (id) => {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
};

window.openRecoverModal = () => {
  closeModal('loginModal');
  openModal('recoverModal');
};

window.login = () => {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const passphrase = document.getElementById('loginPassphrase').value;

  setPersistence(auth, browserLocalPersistence)
    .then(() => signInWithEmailAndPassword(auth, email, password))
    .then((cred) => {
      if (passphrase) {
        setPassphrase(passphrase);
      }
      showUserArea(cred.user);
      closeModal('loginModal');
      document.getElementById('loginPassphrase').value = '';
    })
    .catch((err) =>
      showToast('Credenciais inválidas! ' + err.message, 'error'),
    );
};

window.logout = () => {
  explicitLogout = true;
  signOut(auth).catch((err) =>
    showToast('Erro ao sair: ' + err.message, 'error'),
  );
};

window.sendRecovery = () => {
  const email = document.getElementById('recoverEmail').value;
  if (!email.includes('@')) {
    showToast('E-mail inválido!', 'warning');
    return;
  }
  sendPasswordResetEmail(auth, email)
    .then(() => {
      showToast('E-mail de recuperação enviado!', 'success');
      closeModal('recoverModal');
    })
    .catch((err) =>
      showToast('Erro ao enviar recuperação: ' + err.message, 'error'),
    );
};

async function showUserArea(user) {
  const nameEl = document.getElementById('currentUser');
  if (nameEl) {
    nameEl.textContent = user.email;
    nameEl.onclick = () => {
      const input = document.getElementById('displayNameInput');
      if (input) input.value = nameEl.textContent;
      openModal('displayNameModal');
    };
  }
  // Exibe os botões de logout
  document
    .querySelectorAll('#logoutBtn, #logoutSidebarBtn')
    .forEach((btn) => btn.classList.remove('hidden'));

  window.sistema = window.sistema || {};
  window.sistema.uid = user.uid;
  const senha = getPassphrase();
  if (!senha) {
    const jaExibiuModal = localStorage.getItem('passphraseModalShown');
    if (!jaExibiuModal) {
      openModal('passphraseModal');
      localStorage.setItem('passphraseModalShown', 'true');
    }
  }

  let perfilFallback = '';
  try {
    const uidSnap = await getDoc(doc(db, 'uid', user.uid));
    const uidData = uidSnap.data();
    if (nameEl && uidData?.nome) {
      nameEl.textContent = uidData.nome;
    }
    if (uidData?.encrypted) {
      const pass = getPassphrase() || `chave-${user.uid}`;
      try {
        const data = JSON.parse(await decryptString(uidData.encrypted, pass));
        if (nameEl && !uidData?.nome && data.nome) {
          nameEl.textContent = data.nome;
        }
        if (data.perfil) {
          perfilFallback = String(data.perfil).toLowerCase().trim();
        }
      } catch {}
    }
  } catch (e) {
    console.error('Erro ao carregar nome/perfil do usuário:', e);
  }

  try {
    const profile = await loadUserProfile(user.uid);
    if (nameEl && profile?.nome) {
      nameEl.textContent = profile.nome;
    }
    let perfil = normalizePerfil(
      profile?.perfil || perfilFallback || 'usuario',
    );
    window.userPerfil = perfil;
    window.authUser = user;
    window.userProfile = profile;
    window.userPerms = { perfil, isAdm: profile?.isAdm || false };

    if (['gestor', 'adm'].includes(perfil)) {
      const path = window.location.pathname.toLowerCase();
      if (
        path.endsWith('/index.html') ||
        path.endsWith('/login.html') ||
        path.endsWith('/')
      ) {
        window.location.href = 'financeiro.html';
        return;
      }
    }

    // 1) aplica restrições de UI
    applyPerfilRestrictions(perfil);

    // 2) verifica associação com expedição (gestor ou responsável)
    if (perfil !== 'expedicao') {
      await checkExpedicao(user);
    }

    // 3) localiza responsável financeiro do usuário, se houver
    try {
      let respEmail = profile?.responsavelFinanceiroEmail;
      if (!respEmail) {
        const altDoc = await getDoc(doc(db, 'uid', user.uid));
        if (altDoc.exists())
          respEmail = altDoc.data().responsavelFinanceiroEmail;
      }
      if (respEmail) {
        const respQuery = query(
          collection(db, 'usuarios'),
          where('email', '==', respEmail),
        );
        const respDocs = await getDocs(respQuery);
        if (!respDocs.empty) {
          const d = respDocs.docs[0];
          window.responsavelFinanceiro = { uid: d.id, ...d.data() };
        }
      }
    } catch (e) {
      console.error('Erro ao localizar responsável financeiro do usuário:', e);
    }

    // 4) verifica se usuário é responsável financeiro e garante acesso às sobras
    try {
      const respUsuarios = await fetchResponsavelFinanceiroUsuarios(
        db,
        user.email,
      );
      window.isFinanceiroResponsavel = respUsuarios.length > 0;
      ensureFinanceiroMenu();
    } catch (e) {
      console.error('Erro ao verificar responsável financeiro:', e);
    }
  } catch (e) {
    console.error('Erro ao carregar perfil do usuário:', e);
  }
}

function hideUserArea() {
  const nameEl = document.getElementById('currentUser');
  if (nameEl) {
    nameEl.textContent = 'Usuário';
    nameEl.onclick = null;
  }
  // Oculta os botões de logout
  document
    .querySelectorAll('#logoutBtn, #logoutSidebarBtn')
    .forEach((btn) => btn.classList.add('hidden'));
  if (window.sistema) delete window.sistema.uid;

  // ⚠️ Reseta para mostrar o modal novamente no próximo login
  localStorage.removeItem('passphraseModalShown');
  isExpedicao = false;
  restoreSidebar();
}

function applyExpedicaoSidebar(extraAllowedIds = []) {
  const allowedIds = Array.from(
    new Set([...EXPEDICAO_ALLOWED_MENU_IDS, ...extraAllowedIds]),
  );

  const filter = () => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const allowedLis = allowedIds
      .map((id) => document.getElementById(id)?.closest('li'))
      .filter(Boolean);

    sidebar.querySelectorAll('li').forEach((li) => {
      if (allowedLis.some((ali) => ali === li || ali.contains(li))) {
        li.classList.remove('hidden');
        li.style.display = '';
      } else {
        li.classList.add('hidden');
      }
    });

    const submenu = document.getElementById('menuExpedicao');
    if (submenu) {
      submenu.style.maxHeight = submenu.scrollHeight + 'px';
    }

    const configMenu = document.getElementById('menuConfiguracoes');
    if (configMenu) {
      configMenu.style.maxHeight = configMenu.scrollHeight + 'px';
    }
  };

  filter();
  document.addEventListener('sidebarLoaded', filter);
}

function restoreSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.querySelectorAll('li, a.sidebar-link').forEach((el) => {
    el.classList.remove('hidden');
    if (el.style) el.style.display = '';
  });
}

function normalizePerfil(perfil) {
  const p = (perfil || '').toLowerCase().trim();
  if (!p) return '';
  const base = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['adm', 'admin', 'administrador'].includes(base)) return 'adm';
  if (['usuario completo', 'usuario'].includes(base)) return 'usuario';
  if (['usuario basico', 'cliente'].includes(base)) return 'cliente';
  if (
    [
      'gestor',
      'mentor',
      'responsavel',
      'gestor financeiro',
      'responsavel financeiro',
    ].includes(base)
  )
    return 'gestor';
  if (['expedicao', 'gestor expedicao', 'gestor de expedicao'].includes(base))
    return 'expedicao';
  return base;
}
function applyPerfilRestrictions(perfil) {
  const currentPerfil = normalizePerfil(perfil);
  if (!currentPerfil) return;
  if (currentPerfil === 'expedicao') {
    applyExpedicaoSidebar();
    return;
  }
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const menuLinks = Array.from(sidebar.querySelectorAll('a[id^="menu-"]'));
  const allIds = menuLinks.map((a) => a.id);

  const nivelMenus = {
    adm: allIds,
    usuario: [
      'menu-vendas',
      'menu-saques',
      'menu-etiquetas',
      'menu-precificacao',
      'menu-marketing',
      'menu-anuncios',
      'menu-expedicao',
      'menu-gestao-contas',
      'menu-acompanhamento',
      'menu-outros',
      'menu-configuracoes',
      'menu-comunicacao',
      'menu-painel-atualizacoes-gerais',
      'menu-painel-atualizacoes-mentorados',
    ],
    cliente: [
      'menu-vendas',
      'menu-saques',
      'menu-etiquetas',
      'menu-precificacao',
      'menu-expedicao',
      'menu-configuracoes',
      'menu-comunicacao',
      'menu-painel-atualizacoes-gerais',
      'menu-painel-atualizacoes-mentorados',
    ],
    gestor: [
      'menu-gestao',
      'menu-financeiro',
      'menu-atualizacoes',
      'menu-painel-atualizacoes-gerais',
      'menu-painel-atualizacoes-mentorados',
      'menu-saques',
      'menu-produtos-precos',
      'menu-acompanhamento-gestor',
      'menu-mentoria',
      'menu-perfil-mentorado',
      'menu-equipes',
      'menu-produtos',
      'menu-sku-associado',
      'menu-desempenho',
    ],
    expedicao: EXPEDICAO_ALLOWED_MENU_IDS,
  };

  const allowed = nivelMenus[currentPerfil];
  if (allowed) {
    menuLinks.forEach((link) => {
      const li = link.closest('li');
      if (allowed.includes(link.id)) {
        li.classList.remove('hidden');
      } else {
        li.classList.add('hidden');
      }
    });
  }

  document.querySelectorAll('[data-perfil]').forEach((el) => {
    const allowedPerfis = (el.getAttribute('data-perfil') || '')
      .toLowerCase()
      .split(',')
      .map((p) => normalizePerfil(p));
    const show =
      currentPerfil === 'adm' || allowedPerfis.includes(currentPerfil);
    if (!show) {
      el.classList.add('hidden');
    } else {
      el.classList.remove('hidden');
    }
  });
}

function ensureFinanceiroMenu() {
  const menu = document.getElementById('menu-vendas');
  if (!menu) return;
  if (window.isFinanceiroResponsavel || window.userPerfil === 'gestor') {
    menu.classList.remove('hidden');
  }
}

async function checkExpedicao(user) {
  try {
    let snap = await getDocs(
      query(
        collection(db, 'usuarios'),
        where('responsavelExpedicaoEmail', '==', user.email),
      ),
    );
    if (snap.empty) {
      snap = await getDocs(
        query(
          collection(db, 'usuarios'),
          where('gestoresExpedicaoEmails', 'array-contains', user.email),
        ),
      );
    }
    if (!snap.empty) {
      isExpedicao = true;
      applyExpedicaoSidebar(['menu-comunicacao']);
      const path = window.location.pathname.toLowerCase();
      if (!path.endsWith('/expedicao.html')) {
        window.location.href = 'expedicao.html';
      }
    }
  } catch (e) {
    console.error('Erro ao verificar expedição:', e);
  }
}

window.requireLogin = (event) => {
  if (!auth.currentUser) {
    event.preventDefault();
    openModal('loginModal');
    return false;
  }
  return true;
};

function initNotificationListener(uid) {
  const btn = document.getElementById('notificationBtn');
  const badge = document.getElementById('notificationBadge');
  const list = document.getElementById('notificationList');
  if (!btn || !badge || !list) return;
  if (notifUnsub) notifUnsub();
  if (expNotifUnsub) expNotifUnsub();
  if (updNotifUnsub) updNotifUnsub();
  if (painelGeralNotifUnsub) painelGeralNotifUnsub();
  if (painelMentNotifUnsub) painelMentNotifUnsub();

  let finNotifs = [];
  let expNotifs = [];
  let updNotifs = [];
  let painelGeralNotifs = [];
  let painelMentNotifs = [];

  const storageKey = `notificationsRead:${uid}`;
  const loadStoredRead = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
      return new Set();
    } catch (e) {
      console.warn('Não foi possível carregar notificações lidas:', e);
      return new Set();
    }
  };

  let readNotifications = loadStoredRead();

  const persistRead = () => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(Array.from(readNotifications)),
      );
    } catch (e) {
      console.warn('Não foi possível salvar notificações lidas:', e);
    }
  };

  const markNotificationAsRead = (id) => {
    if (!id || readNotifications.has(id)) return false;
    readNotifications.add(id);
    persistRead();
    return true;
  };

  const markAllNotificationsAsRead = (ids) => {
    let updated = false;
    ids.forEach((id) => {
      if (!readNotifications.has(id)) {
        readNotifications.add(id);
        updated = true;
      }
    });
    if (updated) persistRead();
    return updated;
  };

  const render = () => {
    list.innerHTML = '';
    const all = [
      ...finNotifs,
      ...expNotifs,
      ...updNotifs,
      ...painelGeralNotifs,
      ...painelMentNotifs,
    ].sort((a, b) => b.ts - a.ts);

    if (!all.length) {
      const empty = document.createElement('div');
      empty.className = 'px-4 py-3 text-sm text-gray-500';
      empty.textContent = 'Nenhuma notificação disponível.';
      list.appendChild(empty);
      badge.classList.add('hidden');
      return;
    }

    const unread = all.filter((n) => !readNotifications.has(n.id));
    const read = all.filter((n) => readNotifications.has(n.id));
    const unreadCount = unread.length;

    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    const createItem = (notif, isRead) => {
      const wrapper = document.createElement('div');
      wrapper.className =
        'px-4 py-2 border-b last:border-none hover:bg-gray-100 transition-colors';
      if (isRead) {
        wrapper.classList.add('bg-gray-50', 'text-gray-500');
      }

      const mainBtn = document.createElement('button');
      mainBtn.type = 'button';
      mainBtn.className = `text-left w-full text-sm ${
        isRead ? 'opacity-75 cursor-pointer' : 'font-medium text-gray-700'
      }`;
      mainBtn.textContent = notif.text;
      mainBtn.addEventListener('click', () => {
        const hasChanged = markNotificationAsRead(notif.id);
        if (hasChanged) render();
        list.classList.add('hidden');
        if (notif.url) window.location.href = notif.url;
      });
      wrapper.appendChild(mainBtn);

      if (!isRead) {
        const actions = document.createElement('div');
        actions.className = 'mt-1 flex justify-end';
        const markBtn = document.createElement('button');
        markBtn.type = 'button';
        markBtn.className =
          'text-xs text-brand hover:underline focus:outline-none focus:ring-0';
        markBtn.textContent = 'Marcar como lida';
        markBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          const hasChanged = markNotificationAsRead(notif.id);
          if (hasChanged) render();
        });
        actions.appendChild(markBtn);
        wrapper.appendChild(actions);
      }

      return wrapper;
    };

    if (unread.length) {
      const title = document.createElement('div');
      title.className = 'px-4 pt-2 pb-1 text-xs font-semibold text-gray-500';
      title.textContent = 'Novas notificações';
      list.appendChild(title);
      unread.forEach((notif) => {
        list.appendChild(createItem(notif, false));
      });

      const markAll = document.createElement('button');
      markAll.type = 'button';
      markAll.className =
        'w-full px-4 py-2 text-xs text-brand font-medium hover:bg-gray-100';
      markAll.textContent = 'Marcar todas como lidas';
      markAll.addEventListener('click', () => {
        const changed = markAllNotificationsAsRead(unread.map((n) => n.id));
        if (changed) render();
      });
      list.appendChild(markAll);
    } else {
      const emptyUnread = document.createElement('div');
      emptyUnread.className = 'px-4 py-3 text-xs text-gray-500';
      emptyUnread.textContent = 'Você não possui notificações novas.';
      list.appendChild(emptyUnread);
    }

    if (read.length) {
      const title = document.createElement('div');
      title.className = 'px-4 pt-3 pb-1 text-xs font-semibold text-gray-400';
      title.textContent = 'Notificações lidas';
      list.appendChild(title);
      read.forEach((notif) => {
        list.appendChild(createItem(notif, true));
      });
    }
  };

  render();

  const qFin = query(
    collection(db, 'financeiroAtualizacoes'),
    where('destinatarios', 'array-contains', uid),
    where('tipo', '==', 'faturamento'),
    orderBy('createdAt', 'desc'),
  );
  notifUnsub = onSnapshot(
    qFin,
    (snap) => {
      finNotifs = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.autorUid === uid) return;
        const email = data.autorEmail || data.autorNome || '';
        const dataFat =
          data.dataFaturamento ||
          data.createdAt?.toDate?.().toLocaleDateString('pt-BR') ||
          '';
        finNotifs.push({
          id: `fin:${docSnap.id}`,
          text: `${email} - ${dataFat}`,
          ts: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0,
          url: 'financeiro.html',
        });
      });
      render();
    },
    (err) => {
      console.error('Erro no listener de notificações:', err);
    },
  );

  const qUpd = query(
    collection(db, 'financeiroAtualizacoes'),
    where('destinatarios', 'array-contains', uid),
    where('tipo', '==', 'atualizacao'),
    orderBy('createdAt', 'desc'),
  );
  updNotifUnsub = onSnapshot(
    qUpd,
    (snap) => {
      updNotifs = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.autorUid === uid) return;
        const texto = `${d.autorNome || d.autorEmail || ''}: ${d.descricao || ''}`;
        updNotifs.push({
          id: `upd:${docSnap.id}`,
          text: texto,
          ts: d.createdAt?.toDate ? d.createdAt.toDate().getTime() : 0,
          url: 'atualizacoes.html',
        });
      });
      render();
    },
    (err) => {
      console.error('Erro no listener de notificações de atualizações:', err);
    },
  );

  const painelTexto = (data, origem) => {
    const autor = data.autorNome || data.autorEmail || 'Equipe';
    const mensagem = data.texto || data.descricao || '';
    if (mensagem) {
      return `[${origem}] ${autor}: ${mensagem}`;
    }
    return `[${origem}] ${autor} compartilhou uma atualização.`;
  };

  const painelGeralQuery = query(
    collection(db, 'painelAtualizacoesGerais'),
    where('categoria', '==', 'mensagem'),
    where('participantes', 'array-contains', uid),
    orderBy('createdAt', 'desc'),
    limit(20),
  );
  painelGeralNotifUnsub = onSnapshot(
    painelGeralQuery,
    (snap) => {
      painelGeralNotifs = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (data.autorUid === uid) return;
        painelGeralNotifs.push({
          id: `pg:${docSnap.id}`,
          text: painelTexto(data, 'Painel Geral'),
          ts: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0,
          url: 'painel-atualizacoes-gerais.html',
        });
      });
      render();
    },
    (err) => {
      console.error('Erro no listener de notificações do painel geral:', err);
    },
  );

  const painelMentQuery = query(
    collection(db, 'painelAtualizacoesMentorados'),
    where('categoria', '==', 'mensagem'),
    orderBy('createdAt', 'desc'),
    limit(20),
  );
  painelMentNotifUnsub = onSnapshot(
    painelMentQuery,
    (snap) => {
      painelMentNotifs = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const participantes = Array.isArray(data.participantes)
          ? data.participantes
          : [];
        const permitido =
          participantes.includes(uid) ||
          participantes.includes(VISIBILIDADE_GLOBAL_ID);
        if (!permitido) return;
        if (data.autorUid === uid) return;
        painelMentNotifs.push({
          id: `pm:${docSnap.id}`,
          text: painelTexto(data, 'Painel Mentorados'),
          ts: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0,
          url: 'painel-atualizacoes-mentorados.html',
        });
      });
      render();
    },
    (err) => {
      console.error(
        'Erro no listener de notificações do painel de mentorados:',
        err,
      );
    },
  );

  const qExp = query(
    collection(db, 'expedicaoMensagens'),
    where('destinatarios', 'array-contains', uid),
    orderBy('createdAt', 'desc'),
  );
  expNotifUnsub = onSnapshot(
    qExp,
    (snap) => {
      expNotifs = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const texto = `${d.gestorEmail || ''} - ${d.quantidade || 0} etiqueta(s) não enviadas: ${d.motivo || ''}`;
        expNotifs.push({
          id: `exp:${docSnap.id}`,
          text: texto,
          ts: d.createdAt?.toDate ? d.createdAt.toDate().getTime() : 0,
          url: 'expedicao.html',
        });
      });
      render();
    },
    (err) => {
      console.error('Erro no listener de notificações expedição:', err);
    },
  );

  if (!btn.dataset.notifInitialized) {
    btn.addEventListener('click', () => {
      list.classList.toggle('hidden');
    });
    btn.dataset.notifInitialized = 'true';
  }
}

function checkLogin() {
  if (authListenerRegistered) return;
  authListenerRegistered = true;
  onAuthStateChanged(auth, (user) => {
    const path = window.location.pathname.toLowerCase();
    const onLoginPage = path.endsWith('login.html');
    if (user) {
      showUserArea(user);
      initNotificationListener(user.uid);
      wasLoggedIn = true;
      if (onLoginPage) window.location.href = 'index.html';
    } else {
      wasLoggedIn = false;
      hideUserArea();
      if (notifUnsub) {
        notifUnsub();
        notifUnsub = null;
      }
      if (expNotifUnsub) {
        expNotifUnsub();
        expNotifUnsub = null;
      }
      if (updNotifUnsub) {
        updNotifUnsub();
        updNotifUnsub = null;
      }
      if (painelGeralNotifUnsub) {
        painelGeralNotifUnsub();
        painelGeralNotifUnsub = null;
      }
      if (painelMentNotifUnsub) {
        painelMentNotifUnsub();
        painelMentNotifUnsub = null;
      }
      if (!onLoginPage) window.location.href = 'login.html';
    }
  });
}

document.addEventListener('navbarLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');

  loginBtn?.addEventListener('click', () => {
    openModal('loginModal');
  });

  // Garante que o evento de logout seja registrado no navbar
  document.getElementById('logoutBtn')?.addEventListener('click', logout);

  if (window.location.search.includes('login=1')) {
    // Espera o estado do Firebase para decidir se deve abrir
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        openModal('loginModal');
      }
    });
  }
  checkLogin();
});

document.addEventListener('sidebarLoaded', () => {
  if (window.userPerfil) applyPerfilRestrictions(window.userPerfil);
  ensureFinanceiroMenu();

  // Garante o evento de logout no sidebar
  document
    .getElementById('logoutSidebarBtn')
    ?.addEventListener('click', logout);
  if (auth.currentUser) {
    document
      .querySelectorAll('#logoutBtn, #logoutSidebarBtn')
      .forEach((btn) => btn.classList.remove('hidden'));
  }
});

checkLogin();
