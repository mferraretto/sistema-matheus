import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';

import 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage-compat.js';

const firebaseConfig = {
  apiKey: "AIzaSyC78l9b2DTNj64y_0fbRKofNupO6NHDmeo",
  authDomain: "matheus-35023.firebaseapp.com",
  projectId: "matheus-35023",
  storageBucket: "matheus-35023.appspot.com",
  messagingSenderId: "1011113149395",
  appId: "1:1011113149395:web:c1f449e0e974ca8ecb2526"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);


const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

window.auth = auth;
window.db = db;

export { app, auth, db, storage };
