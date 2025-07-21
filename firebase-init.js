import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';

// Load the compat libraries by injecting script tags. The CDN versions are not
// distributed as ES modules, so attempting to import them causes a runtime
// error. We dynamically append the scripts and await their loading before using
// the global `firebase` object they expose.
async function loadCompatScripts() {
  const sources = [
    'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage-compat.js'
  ];
  for (const src of sources) {
    if (document.querySelector(`script[src="${src}"]`)) continue;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }
}

await loadCompatScripts();
const firebase = window.firebase;

const firebaseConfig = {
  apiKey: "AIzaSyC78l9b2DTNj64y_0fbRKofNupO6NHDmeo",
  authDomain: "matheus-35023.firebaseapp.com",
  projectId: "matheus-35023",
  storageBucket: "matheus-35023.appspot.com",
  messagingSenderId: "1011113149395",
  appId: "1:1011113149395:web:c1f449e0e974ca8ecb2526"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

window.firebase = firebase;
window.auth = auth;
window.db = db;
window.storage = storage;

export { app, auth, db, storage };
