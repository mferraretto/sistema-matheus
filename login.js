(async () => {
  const [appMod, authMod, firestoreMod, configMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js'),
    import('./firebase-config.js')
  ]);

  const { initializeApp, getApps } = appMod;
  const { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword,
          signOut, sendPasswordResetEmail, onAuthStateChanged } = authMod;
  const { getFirestore, doc, getDoc, collection, query, where, getDocs,
          setDoc, updateDoc, addDoc, serverTimestamp } = firestoreMod;
  const { firebaseConfig, setPassphrase, getPassphrase, clearPassphrase } = configMod;

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let wasLoggedIn = false;
  let authListenerRegistered = false;
  let explicitLogout = false;
  let isExpedicao = false;

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

  window.openModal = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'block';
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
    document.getElementById('currentUser').textContent = user.email;
    document.getElementById('logoutBtn').classList.remove('hidden');

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
      const snap = await getDoc(doc(db, 'usuarios', user.uid));
      const perfil = snap.exists() ? String(snap.data().perfil || '').toLowerCase() : '';
      window.userPerfil = perfil;
      applyPerfilRestrictions(perfil);
      if (perfil === 'expedicao') {
        await checkExpedicao(user);
      }
    } catch (e) {
      console.error('Erro ao carregar perfil do usuário:', e);
    }
  }

  function hideUserArea() {
    document.getElementById('currentUser').textContent = 'Usuário';
    document.getElementById('logoutBtn').classList.add('hidden');
    if (window.sistema) delete window.sistema.uid;
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
          link.parentElement.classList.add('hidden');
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
      link.parentElement.classList.remove('hidden');
    });
  }

  async function checkExpedicao(user) {
    try {
      const q = query(collection(db, 'usuarios'), where('responsavelExpedicaoEmail', '==', user.email));
      const snap = await getDocs(q);
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

  function checkLogin() {
    if (authListenerRegistered) return;
    authListenerRegistered = true;
    onAuthStateChanged(auth, user => {
      if (user) {
        showUserArea(user);
        wasLoggedIn = true;
      } else {
        if (wasLoggedIn && explicitLogout) {
          clearPassphrase();
          explicitLogout = false;
        }
        wasLoggedIn = false;
        hideUserArea();
        const path = window.location.pathname.toLowerCase();
        const file = path.substring(path.lastIndexOf('/') + 1);
        if ((file === '' || file === 'index.html') && !sessionStorage.getItem('loginModalMostrado')) {
          sessionStorage.setItem('loginModalMostrado', 'true');
          openModal('loginModal');
        }
      }
    });
  }

  document.addEventListener('navbarLoaded', () => {
    document.getElementById('loginBtn')?.addEventListener('click', () => openModal('loginModal'));
    document.getElementById('logoutBtn').addEventListener('click', logout);
    if (window.location.search.includes('login=1')) {
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
  });
})();
