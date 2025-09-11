import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';

import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

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
    orderBy
  } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { firebaseConfig, setPassphrase, getPassphrase, clearPassphrase } from './firebase-config.js';
import { encryptString, decryptString } from './crypto.js';
import { fetchResponsavelFinanceiroUsuarios } from './responsavel-financeiro.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let wasLoggedIn = false;
let authListenerRegistered = false;
let explicitLogout = false;
let isExpedicao = false;
let notifUnsub = null;
let expNotifUnsub = null;
let updNotifUnsub = null;
let selectedRole = null;
window.isFinanceiroResponsavel = false;
window.responsavelFinanceiro = null;

// Ping a local file to test online status without CORS issues.
async function pingOnline(timeout = 3000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch('ping.txt?cb=' + Date.now(), {
      cache: 'no-store',
      signal: ctrl.signal
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

// Verifica conectividade com backend/API.
export async function checkBackend() {
  if (!navigator.onLine) return false;
  return await pingOnline();
}


function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    alert(message);
    return;
  }
  const color = type === 'success' ? 'bg-green-500'
               : type === 'error' ? 'bg-red-500'
               : type === 'warning' ? 'bg-yellow-500'
               : 'bg-blue-500';
  const toast = document.createElement('div');
  toast.className = `${color} text-white px-4 py-3 rounded shadow-lg flex items-center justify-between min-w-[250px] animate-fadeIn`;
  toast.innerHTML = `<span class="mr-4">${message}</span><button onclick="this.parentElement.remove()" class="text-white font-bold">×</button>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

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
        encrypted: await encryptString(
          JSON.stringify({ perfil }),
          pass
        )
      },
      { merge: true }
    );
    try {
      await updateProfile(user, { displayName: nome });
    } catch {}
    document.getElementById('currentUser').textContent = nome;
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
  if (el) {
    if (id === 'loginModal') {
      document.getElementById('roleSelection')?.classList.remove('hidden');
      document.getElementById('loginForm')?.classList.add('hidden');
      selectedRole = null;
    }
    el.style.display = 'flex';
  }
};

window.selectRole = (role) => {
  selectedRole = role;
  document.getElementById('roleSelection')?.classList.add('hidden');
  document.getElementById('loginForm')?.classList.remove('hidden');
};

window.closeModal = (id) => {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'none';
    if (id === 'loginModal') {
      document.getElementById('roleSelection')?.classList.remove('hidden');
      document.getElementById('loginForm')?.classList.add('hidden');
      selectedRole = null;
    }
  }
};

window.openRecoverModal = () => {
  closeModal('loginModal');
  openModal('recoverModal');
};

window.login = () => {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const passphrase = document.getElementById('loginPassphrase').value;
  const roleInput = document.querySelector('input[name="userRole"]:checked');
  const role = roleInput ? roleInput.value : (selectedRole || 'usuario');

  setPersistence(auth, browserLocalPersistence)
    .then(() => signInWithEmailAndPassword(auth, email, password))
    .then((cred) => {
      if (passphrase) {
        setPassphrase(passphrase);
      }
      showUserArea(cred.user);
      closeModal('loginModal');
      document.getElementById('loginPassphrase').value = '';
      sessionStorage.setItem('selectedRole', role);
      if (role === 'gestor') {
        window.location.href = 'financeiro.html';
      }
    })
    .catch(err => showToast('Credenciais inválidas! ' + err.message, 'error'));
};

window.logout = () => {
  explicitLogout = true;
  signOut(auth).catch(err => showToast('Erro ao sair: ' + err.message, 'error'));
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
    .catch(err => showToast('Erro ao enviar recuperação: ' + err.message, 'error'));
};


async function showUserArea(user) {
  const nameEl = document.getElementById('currentUser');
  nameEl.textContent = user.email;
  nameEl.onclick = () => {
    const input = document.getElementById('displayNameInput');
    if (input) input.value = nameEl.textContent;
    openModal('displayNameModal');
  };
  // Exibe o botão de logout apenas se estiver presente na navbar
  document.getElementById('logoutBtn')?.classList.remove('hidden');

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
    if (uidData?.nome) {
      nameEl.textContent = uidData.nome;
    }
    if (uidData?.encrypted) {
      const pass = getPassphrase() || `chave-${user.uid}`;
      try {
        const data = JSON.parse(await decryptString(uidData.encrypted, pass));
        if (!uidData?.nome && data.nome) {
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
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    let perfil = '';
    if (snap.exists() && snap.data().perfil) {
      perfil = String(snap.data().perfil).toLowerCase().trim();
    } else {
      perfil = perfilFallback || 'usuario';
    }
    window.userPerfil = perfil;

    if (perfil === 'gestor') {
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

    // 2) se for expedição, executa fluxo especial
    if (perfil === 'expedicao') {
      await checkExpedicao(user);
    }

    // 3) localiza responsável financeiro do usuário, se houver
    try {
      let respEmail = snap.data()?.responsavelFinanceiroEmail;
      if (!respEmail) {
        const altDoc = await getDoc(doc(db, 'uid', user.uid));
        if (altDoc.exists()) respEmail = altDoc.data().responsavelFinanceiroEmail;
      }
      if (respEmail) {
        const respQuery = query(collection(db, 'usuarios'), where('email', '==', respEmail));
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
      const respUsuarios = await fetchResponsavelFinanceiroUsuarios(db, user.email);
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
  nameEl.textContent = 'Usuário';
  nameEl.onclick = null;
  // Oculta o botão de logout apenas se ele existir
  document.getElementById('logoutBtn')?.classList.add('hidden');
  if (window.sistema) delete window.sistema.uid;

  // ⚠️ Reseta para mostrar o modal novamente no próximo login
  localStorage.removeItem('passphraseModalShown');
  isExpedicao = false;
  restoreSidebar();
}

function applyExpedicaoSidebar() {
  const hideLinks = () => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.querySelectorAll('a.sidebar-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (!href.includes('expedicao.html')) {
        link.classList.add('hidden');
      }
    });
  };
  hideLinks();
  document.addEventListener('sidebarLoaded', hideLinks);
}

function restoreSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.querySelectorAll('a.sidebar-link').forEach(link => {
    link.classList.remove('hidden');
  });
}
function applyPerfilRestrictions(perfil) {
  const currentPerfil = (perfil || '').toLowerCase().trim();
  if (!currentPerfil) return;
  document.querySelectorAll('[data-perfil]').forEach(el => {
    const allowed = (el.getAttribute('data-perfil') || '')
      .toLowerCase()
      .split(',')
      .map(p => p.trim());
    if (!allowed.includes(currentPerfil)) {
      el.classList.add('hidden');
    } else {
      el.classList.remove('hidden');
    }
  });
}

function ensureFinanceiroMenu() {
  const menu = document.getElementById('menu-vendas');
  if (!menu) return;
  if (
    window.isFinanceiroResponsavel ||
    window.userPerfil === 'responsavel' ||
    window.userPerfil === 'gestor financeiro'
  ) {
    menu.classList.remove('hidden');
  }
}

function setupBasicSidebar() {
  const menu = document.querySelector('#sidebar .sidebar-menu');
  if (!menu) return;
  menu.querySelectorAll('a.sidebar-link.hidden').forEach(a => a.closest('li')?.remove());
  menu.querySelectorAll('.submenu').forEach(ul => ul.remove());
  menu.querySelectorAll('.submenu-toggle').forEach(btn => {
    btn.parentElement?.classList.remove('justify-between');
    btn.remove();
  });
  const order = ['menu-vendas','menu-expedicao','menu-anuncios','menu-outros','menu-configuracoes','menu-comunicacao'];
  order.forEach(id => {
    const link = document.getElementById(id);
    const li = link?.closest('li');
    if (li) menu.appendChild(li);
  });
  const introLi = document.getElementById('startSidebarTourBtn')?.closest('li');
  const darkLi = document.getElementById('darkModeToggle')?.closest('li');
  if (introLi) menu.appendChild(introLi);
  if (darkLi) menu.appendChild(darkLi);
}

async function checkExpedicao(user) {
  try {
    let snap = await getDocs(query(collection(db, 'usuarios'), where('responsavelExpedicaoEmail', '==', user.email)));
    if (snap.empty) {
      snap = await getDocs(query(collection(db, 'usuarios'), where('gestoresExpedicaoEmails', 'array-contains', user.email)));
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
    const all = [...finNotifs, ...expNotifs, ...updNotifs].sort((a, b) => b.ts - a.ts);
    let count = 0;
    all.forEach(n => {
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
    orderBy('createdAt', 'desc')
  );
  notifUnsub = onSnapshot(qFin, snap => {
    finNotifs = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.autorUid === uid) return;
      const email = data.autorEmail || data.autorNome || '';
      const dataFat = data.dataFaturamento || (data.createdAt?.toDate?.().toLocaleDateString('pt-BR')) || '';
      finNotifs.push({ text: `${email} - ${dataFat}` , ts: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0 });
    });
    render();
  }, err => {
    console.error('Erro no listener de notificações:', err);
  });

  const qUpd = query(
    collection(db, 'financeiroAtualizacoes'),
    where('destinatarios', 'array-contains', uid),
    where('tipo', '==', 'atualizacao'),
    orderBy('createdAt', 'desc')
  );
  updNotifUnsub = onSnapshot(qUpd, snap => {
    updNotifs = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      if (d.autorUid === uid) return;
      const texto = `${d.autorNome || d.autorEmail || ''}: ${d.descricao || ''}`;
      updNotifs.push({ text: texto, ts: d.createdAt?.toDate ? d.createdAt.toDate().getTime() : 0 });
    });
    render();
  }, err => {
    console.error('Erro no listener de notificações de atualizações:', err);
  });

  const qExp = query(
    collection(db, 'expedicaoMensagens'),
    where('destinatarios', 'array-contains', uid),
    orderBy('createdAt', 'desc')
  );
  expNotifUnsub = onSnapshot(qExp, snap => {
    expNotifs = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const texto = `${d.gestorEmail || ''} - ${d.quantidade || 0} etiqueta(s) não enviadas: ${d.motivo || ''}`;
      expNotifs.push({ text: texto, ts: d.createdAt?.toDate ? d.createdAt.toDate().getTime() : 0 });
    });
    render();
  }, err => {
    console.error('Erro no listener de notificações expedição:', err);
  });

  btn.addEventListener('click', () => {
    list.classList.toggle('hidden');
  });
}

function checkLogin() {
  if (authListenerRegistered) return;
  authListenerRegistered = true;
  onAuthStateChanged(auth, user => {
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
      if (notifUnsub) { notifUnsub(); notifUnsub = null; }
      if (expNotifUnsub) { expNotifUnsub(); expNotifUnsub = null; }
      if (updNotifUnsub) { updNotifUnsub(); updNotifUnsub = null; }
      if (!onLoginPage) window.location.href = 'login.html';
    }
  });
}

  document.addEventListener('navbarLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');

    loginBtn?.addEventListener('click', () => {
      openModal('loginModal');
    });

    // Garante que o evento de logout só seja registrado se o botão existir
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
  if (window.userPerfil) {
    applyPerfilRestrictions(window.userPerfil);
    if (['usuario', 'cliente'].includes(window.userPerfil)) setupBasicSidebar();
  }
  ensureFinanceiroMenu();
});

checkLogin();
