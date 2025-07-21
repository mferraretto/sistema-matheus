// firebase-auth.js
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { 
  getAuth, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { 
  getFirestore, 
  doc, 
  getDoc 
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const firebaseConfig = { /* ... */ };

// Inicialização única
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Gerenciamento de estado de autenticação
onAuthStateChanged(auth, async (user) => {
  const currentPath = window.location.pathname;
  const isLoginPage = currentPath.endsWith('index.html') || currentPath.endsWith('/');
  
  if (!user && !isLoginPage) {
    window.location.href = 'index.html?login=1';
    return;
  }

  if (user) {
    const perfilDoc = await getDoc(doc(db, 'usuarios', user.uid));
    window.usuarioLogado = {
      uid: user.uid,
      perfil: perfilDoc.exists() ? perfilDoc.data().perfil : 'Leitor',
      email: user.email
    };
    
    if (isLoginPage) {
      window.location.href = 'home.html'; // Redirecionar logados para home
    }
  }
});

// API unificada
export const firebaseAuth = {
  auth,
  db,
  login: (email, password) => signInWithEmailAndPassword(auth, email, password),
  logout: () => signOut(auth),
  register: (email, password) => createUserWithEmailAndPassword(auth, email, password),
  resetPassword: (email) => sendPasswordResetEmail(auth, email)
};

// Para compatibilidade com módulos antigos
window.firebaseAuth = firebaseAuth;
