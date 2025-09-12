import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyC78l9b2DTNj64y_0fbRKofNupO6NHDmeo',
  authDomain: 'matheus-35023.firebaseapp.com',
  projectId: 'matheus-35023',
  storageBucket: 'matheus-35023.firebasestorage.app',
  messagingSenderId: '1011113149395',
  appId: '1:1011113149395:web:c1f449e0e974ca8ecb2526',
  databaseURL: 'https://matheus-35023.firebaseio.com',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
