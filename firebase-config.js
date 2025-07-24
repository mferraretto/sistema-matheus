// Firebase configuration
// Fill these values via environment variables or a protected configuration not checked into version control.
const firebaseConfig = {
  apiKey: window.FIREBASE_API_KEY || '',
  authDomain: window.FIREBASE_AUTH_DOMAIN || '',
  projectId: window.FIREBASE_PROJECT_ID || '',
  storageBucket: window.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: window.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: window.FIREBASE_APP_ID || '',
  databaseURL: window.FIREBASE_DATABASE_URL || ''
};

// Expose to global scope for inline scripts
if (typeof window !== 'undefined') {
  window.firebaseConfig = firebaseConfig;
}

// Export for module environments
if (typeof module !== 'undefined') {
  module.exports = { firebaseConfig };
}
