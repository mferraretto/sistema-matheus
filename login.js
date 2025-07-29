import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

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
  signInWithEmailAndPassword(auth, email, password)
    .then((cred) => {
      showUserArea(cred.user);
      closeModal('loginModal');
    })
    .catch(err => alert('Credenciais inválidas! ' + err.message));
};

window.logout = () => {
  signOut(auth).then(hideUserArea);
};

window.sendRecovery = () => {
  const email = document.getElementById('recoverEmail').value;
  if (!email.includes('@')) {
    alert('E-mail inválido!');
    return;
  }
  sendPasswordResetEmail(auth, email)
    .then(() => {
      alert('E-mail de recuperação enviado!');
      closeModal('recoverModal');
    })
    .catch(err => alert('Erro ao enviar recuperação: ' + err.message));
};

function showUserArea(user) {
  document.getElementById('currentUser').textContent = user.email;
  document.getElementById('logoutBtn').classList.remove('hidden');
   // Expose user information globally for other scripts
  window.sistema = window.sistema || {};
  window.sistema.currentUserId = user.uid;
}

function hideUserArea() {
  document.getElementById('currentUser').textContent = 'Usuário';
  document.getElementById('logoutBtn').classList.add('hidden');
    if (window.sistema) delete window.sistema.currentUserId;
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
