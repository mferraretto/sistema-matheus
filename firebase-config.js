import { firebaseConfig, app, db, auth } from './src/firebase.js';

if (typeof window !== 'undefined') {
  window.firebaseConfig = firebaseConfig;
}

export { firebaseConfig, app, db, auth };
