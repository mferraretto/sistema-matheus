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
  getDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

// ✅ Configuração Firebase única (matheus-35023)
const firebaseConfig = {
  apiKey: "AIzaSyC78l9b2DTNj64y_0fbRKofNupO6NHDmeo",
  authDomain: "matheus-35023.firebaseapp.com",
  projectId: "matheus-35023",
  storageBucket: "matheus-35023.appspot.com",
  messagingSenderId: "1011113149395",
  appId: "1:1011113149395:web:c1f449e0e974ca8ecb2526"
};

// Inicialização única
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

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
      window.location.href = 'index.html'; // redireciona para index.html após login
    }
  }
});
const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
const logout = () => signOut(auth);
const register = (email, password) => createUserWithEmailAndPassword(auth, email, password);
const resetPassword = (email) => sendPasswordResetEmail(auth, email);
// API unificada para uso global
export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
export const register = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);
export const firebaseAuth = {
  auth,
  db,
login,
  logout,
  register,
  resetPassword
};

// Compatibilidade com sistemas antigos
window.firebaseAuth = firebaseAuth;
// Atalhos legados
window.firebaseDb = db;
