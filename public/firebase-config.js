// Firebase configuration
// Fill these values via environment variables or a protected configuration not checked into version control.
export const firebaseConfig = {
      apiKey: "AIzaSyC78l9b2DTNj64y_0fbRKofNupO6NHDmeo",
      authDomain: "matheus-35023.firebaseapp.com",
      projectId: "matheus-35023",
      storageBucket: "matheus-35023.firebasestorage.app",
      messagingSenderId: "1011113149395",
      appId: "1:1011113149395:web:c1f449e0e974ca8ecb2526",
      databaseURL: "https://matheus-35023.firebaseio.com"
   };

// Configurações adicionais para resolver problemas de autenticação
export const firebaseAuthSettings = {
  // Domínios autorizados para autenticação
  authorizedDomains: [
    "matheus-35023.web.app",
    "matheus-35023.firebaseapp.com",
    "localhost",
    "127.0.0.1"
  ],
  
  // Configurações de persistência
  persistence: "local", // browserLocalPersistence
  
  // Timeout para operações de autenticação
  authTimeout: 10000
};

// Utility functions for storing the passphrase securely
export function setPassphrase(pass) {
  if (typeof localStorage !== 'undefined' && pass) {
    localStorage.setItem('sistemaPassphrase', pass);
  }
}

export function getPassphrase() {
  return typeof localStorage !== 'undefined'
    ? localStorage.getItem('sistemaPassphrase')
    : null;
}

export function clearPassphrase() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('sistemaPassphrase');
  }
}

// Função para verificar se o domínio atual está autorizado
export function isDomainAuthorized() {
  if (typeof window === 'undefined') return true;
  
  const currentDomain = window.location.hostname;
  return firebaseAuthSettings.authorizedDomains.some(domain => 
    currentDomain === domain || 
    currentDomain.endsWith('.' + domain) ||
    (domain === 'localhost' && (currentDomain === 'localhost' || currentDomain === '127.0.0.1'))
  );
}

// Expose to global scope for inline scripts
if (typeof window !== 'undefined') {
  window.firebaseConfig = firebaseConfig;
  window.firebaseAuthSettings = firebaseAuthSettings;
  window.setPassphrase = setPassphrase;
  window.getPassphrase = getPassphrase;
  window.clearPassphrase = clearPassphrase;
  window.isDomainAuthorized = isDomainAuthorized;
}

// Export for module environments
if (typeof module !== 'undefined') {
 module.exports = {
    firebaseConfig,
    firebaseAuthSettings,
    setPassphrase,
    getPassphrase,
    clearPassphrase,
    isDomainAuthorized
  };
}
