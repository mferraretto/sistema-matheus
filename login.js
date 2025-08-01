import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
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
  document.getElementById(id).style.display = 'block';
};

window.closeModal = (id) => {
  document.getElementById(id).style.display = 'none';
};

window.openRecoverModal = () => {
  closeModal('loginModal');
  openModal('recoverModal');
};

window.login = () => {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const passphrase = document.getElementById('loginPassphrase').value;
  signInWithEmailAndPassword(auth, email, password)
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
  signOut(auth).then(hideUserArea);
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

function showUserArea(user) {
  document.getElementById('currentUser').textContent = user.email;
  document.getElementById('logoutBtn').classList.remove('hidden');
   // Expose user information globally for other scripts
  window.sistema = window.sistema || {};
  window.sistema.currentUserId = user.uid;
   if (!getPassphrase()) {
    openModal('passphraseModal');
  }
}

function hideUserArea() {
  document.getElementById('currentUser').textContent = 'Usuário';
  document.getElementById('logoutBtn').classList.add('hidden');
if (window.sistema) delete window.sistema.currentUserId;
      clearPassphrase();
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
  onAuthStateChanged(auth, user => {
    if (user) {
      showUserArea(user);
    } else {
      hideUserArea();
    }
  });
}

document.addEventListener('navbarLoaded', () => {
  document.getElementById('loginBtn')?.addEventListener('click', () => openModal('loginModal'));
  document.getElementById('logoutBtn').addEventListener('click', logout);

  if (window.location.search.includes('login=1')) {
    openModal('loginModal');
  }

  checkLogin();
});
