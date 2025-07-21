import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyC78l9b2DTNj64y_0fbRKofNupO6NHDmeo",
  authDomain: "matheus-35023.firebaseapp.com",
  projectId: "matheus-35023",
  storageBucket: "matheus-35023.appspot.com",
  messagingSenderId: "1011113149395",
  appId: "1:1011113149395:web:c1f449e0e974ca8ecb2526"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (!window.location.pathname.endsWith('index.html')) {
      window.location.href = 'index.html?login=1';
    }
    return;
  }

  const perfilDoc = await getDoc(doc(db, 'usuarios', user.uid));
  const perfil = perfilDoc.exists() ? perfilDoc.data().perfil : 'Leitor';
  window.usuarioLogado = { uid: user.uid, perfil, email: user.email };
});
