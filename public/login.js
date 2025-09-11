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

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let wasLoggedIn = false;
let authListenerRegistered = false;
let explicitLogout = false;
let isExpedicao = false;
let notifUnsub = null;
let loginModalShown = false; // Nova flag para controlar se o modal já foi mostrado


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
    el.style.display = 'flex';
  }
};

window.closeModal = (id) => {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'none';
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
  if (!nameEl) return; // Se o elemento não existe, sai da função
  
  nameEl.textContent = user.email;
  nameEl.onclick = () => {
    const input = document.getElementById('displayNameInput');
    if (input) input.value = nameEl.textContent;
    openModal('displayNameModal');
  };
  
  // Exibe o botão de logout apenas se estiver presente na navbar
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.classList.remove('hidden');
  }

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

  try {
    const uidSnap = await getDoc(doc(db, 'uid', user.uid));
    const uidData = uidSnap.data();
    if (uidData?.nome) {
      nameEl.textContent = uidData.nome;
    } else if (uidData?.encrypted) {
      const pass = getPassphrase() || `chave-${user.uid}`;
      const data = JSON.parse(await decryptString(uidData.encrypted, pass));
      if (data.nome) {
        nameEl.textContent = data.nome;
      }
    }
  } catch (e) {
    console.error('Erro ao carregar nome do usuário:', e);
  }

  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    const perfil = snap.exists() ? String(snap.data().perfil || '').toLowerCase() : '';
    window.userPerfil = perfil;

    // 1) aplica restrições de UI
    applyPerfilRestrictions(perfil);

    // 2) se for expedição, executa fluxo especial
    if (['expedicao', 'gestor expedicao', 'responsavel expedicao'].includes(perfil)) {
      await checkExpedicao(user);
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
  
  // Oculta o botão de logout apenas se ele existir
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.classList.add('hidden');
  }
  
  if (window.sistema) delete window.sistema.uid;

  // ⚠️ Reseta para mostrar o modal novamente no próximo login
  localStorage.removeItem('passphraseModalShown');
  isExpedicao = false;
  restoreSidebar();
}

function applyExpedicaoSidebar() {
  const applyLayout = () => {
    if (typeof window.buildExpedicaoSidebarLayout === 'function') {
      window.buildExpedicaoSidebarLayout();
      return;
    }
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.querySelectorAll('a.sidebar-link').forEach(link => {
      const li = link.parentElement || link.closest('li');
      const keep = link.id === 'menu-expedicao' || link.closest('#menuExpedicao');
      if (li) {
        if (keep) li.classList.remove('hidden');
        else li.classList.add('hidden');
      }
    });
  };
  applyLayout();
  document.addEventListener('sidebarLoaded', applyLayout);
}

function restoreSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.querySelectorAll('li.hidden, a.sidebar-link.hidden').forEach(el => {
    el.classList.remove('hidden');
  });
}

function applyPerfilRestrictions(perfil) {
  const currentPerfil = (perfil || '').toLowerCase();
  const elements = document.querySelectorAll('[data-perfil]');
  if (!elements || elements.length === 0) return;
  
  elements.forEach(el => {
    if (!el) return;
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
  const q = query(
    collection(db, 'financeiroAtualizacoes'),
    where('destinatarios', 'array-contains', uid),
    where('tipo', '==', 'faturamento'),
    orderBy('createdAt', 'desc')
  );
  notifUnsub = onSnapshot(q, snap => {
    list.innerHTML = '';
    let count = 0;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.autorUid === uid) return;
      const email = data.autorEmail || data.autorNome || '';
      const dataFat = data.dataFaturamento || (data.createdAt?.toDate?.().toLocaleDateString('pt-BR')) || '';
      const item = document.createElement('div');
      item.className = 'px-4 py-2 hover:bg-gray-100';
      item.textContent = `${email} - ${dataFat}`;
      list.appendChild(item);
      count++;
    });
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }, err => {
    console.error('Erro no listener de notificações:', err);
  });
  btn.addEventListener('click', () => {
    list.classList.toggle('hidden');
  });
}

function checkLogin() {
  if (authListenerRegistered) return;
  authListenerRegistered = true;
  
  onAuthStateChanged(auth, user => {
    if (user) {
      showUserArea(user);
      initNotificationListener(user.uid);
      wasLoggedIn = true;
      loginModalShown = false; // Reset flag quando usuário loga
    } else {
      if (wasLoggedIn && explicitLogout) {
        clearPassphrase();
        explicitLogout = false;
      }
      wasLoggedIn = false;
      hideUserArea();
      if (notifUnsub) { notifUnsub(); notifUnsub = null; }

      // Verifica se deve mostrar o modal de login
      const path = window.location.pathname.toLowerCase();
      const file = path.substring(path.lastIndexOf('/') + 1);
      const hasLoginParam = window.location.search.includes('login=1');
      
      // Só mostra o modal se:
      // 1. Estiver na index.html OU
      // 2. Tiver o parâmetro login=1 na URL
      // 3. O modal ainda não foi mostrado nesta sessão
      if ((file === '' || file === 'index.html' || hasLoginParam) && 
          !loginModalShown && 
          !sessionStorage.getItem('loginModalMostrado')) {
        
        loginModalShown = true;
        sessionStorage.setItem('loginModalMostrado', 'true');
        
        // Aguarda um pouco para garantir que os componentes estejam carregados
        setTimeout(() => {
          openModal('loginModal');
        }, 100);
      }
    }
  });
}

document.addEventListener('navbarLoaded', () => {
  document.getElementById('loginBtn')?.addEventListener('click', () => openModal('loginModal'));
  // Garante que o evento de logout só seja registrado se o botão existir
  document.getElementById('logoutBtn')?.addEventListener('click', logout);

  // Verifica se deve abrir o modal de login baseado na URL
  if (window.location.search.includes('login=1')) {
    // Aguarda o estado do Firebase para decidir se deve abrir
    onAuthStateChanged(auth, (user) => {
      if (!user && !loginModalShown) {
        loginModalShown = true;
        sessionStorage.setItem('loginModalMostrado', 'true');
        // Aguarda um pouco para garantir que os componentes estejam carregados
        setTimeout(() => {
          openModal('loginModal');
        }, 100);
      }
    });
  }
  
  checkLogin();
});

document.addEventListener('sidebarLoaded', () => {
  if (window.userPerfil) applyPerfilRestrictions(window.userPerfil);
});
