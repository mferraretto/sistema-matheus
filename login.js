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
let wasLoggedIn = false;
let authListenerRegistered = false;
let explicitLogout = false;
let isExpedicao = false;
let notifUnsub = null;
let expNotifUnsub = null;
let updNotifUnsub = null;
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

function applyExpedicaoSidebar() {
  const filter = () => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const allowedIds = [
      'menu-expedicao',
      'menu-configuracoes',
      'menu-comunicacao',
    ];
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
  if (['adm', 'admin', 'administrador'].includes(p)) return 'adm';
  if (['usuario completo', 'usuario'].includes(p)) return 'usuario';
  if (['usuario basico', 'cliente'].includes(p)) return 'cliente';
  if (
    [
      'gestor',
      'mentor',
      'responsavel',
      'gestor financeiro',
      'responsavel financeiro',
    ].includes(p)
  )
    return 'gestor';
  return p;
}
function applyPerfilRestrictions(perfil) {
  const currentPerfil = normalizePerfil(perfil);
  if (!currentPerfil) return;
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
    expedicao: [
      'menu-expedicao',
      'menu-configuracoes',
      'menu-comunicacao',
      'menu-painel-atualizacoes-gerais',
      'menu-painel-atualizacoes-mentorados',
    ],
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
      applyExpedicaoSidebar();
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

  let finNotifs = [];
  let expNotifs = [];
  let updNotifs = [];

  const render = () => {
    list.innerHTML = '';
    const all = [...finNotifs, ...expNotifs, ...updNotifs].sort(
      (a, b) => b.ts - a.ts,
    );
    let count = 0;
    all.forEach((n) => {
      const item = document.createElement('div');
      item.className = 'px-4 py-2 hover:bg-gray-100';
      item.textContent = n.text;
      list.appendChild(item);
      count++;
    });
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  };

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
          text: `${email} - ${dataFat}`,
          ts: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0,
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
          text: texto,
          ts: d.createdAt?.toDate ? d.createdAt.toDate().getTime() : 0,
        });
      });
      render();
    },
    (err) => {
      console.error('Erro no listener de notificações de atualizações:', err);
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
          text: texto,
          ts: d.createdAt?.toDate ? d.createdAt.toDate().getTime() : 0,
        });
      });
      render();
    },
    (err) => {
      console.error('Erro no listener de notificações expedição:', err);
    },
  );

  btn.addEventListener('click', () => {
    list.classList.toggle('hidden');
  });
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
