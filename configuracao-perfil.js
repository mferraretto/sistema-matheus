import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function addStoreRow(data = {}) {
  const container = document.getElementById('lojasContainer');
  const row = document.createElement('div');
  row.className = 'store-row flex space-x-2';
  row.innerHTML = `
    <input class="form-control flex-1" placeholder="Nome da loja" value="${data.nome || ''}" data-field="nome">
    <input class="form-control flex-1" placeholder="Link da loja" value="${data.link || ''}" data-field="link">
    <button type="button" class="btn btn-danger remover">✕</button>
  `;
  row.querySelector('.remover').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function renderStores(stores = []) {
  const container = document.getElementById('lojasContainer');
  container.innerHTML = '';
  if (!stores.length) {
    addStoreRow();
    return;
  }
  stores.forEach(s => addStoreRow(s));
}

async function loadProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'perfil', uid));
    if (snap.exists()) {
      const data = snap.data();
      renderStores(data.lojas || []);
      document.getElementById('plataformas').value = data.plataformas || '';
      document.getElementById('infoPessoal').value = data.infoPessoal || '';
    } else {
      renderStores();
    }
  } catch (e) {
    console.error('Erro ao carregar perfil:', e);
    renderStores();
  }
}

async function saveProfile(uid) {
  const stores = Array.from(document.querySelectorAll('#lojasContainer .store-row')).map(row => ({
    nome: row.querySelector('[data-field="nome"]').value.trim(),
    link: row.querySelector('[data-field="link"]').value.trim()
  })).filter(s => s.nome || s.link);
  const plataformas = document.getElementById('plataformas').value.trim();
  const infoPessoal = document.getElementById('infoPessoal').value.trim();
  try {
    await setDoc(doc(db, 'perfil', uid), { lojas: stores, plataformas, infoPessoal }, { merge: true });
    alert('Perfil salvo com sucesso!');
  } catch (e) {
    console.error('Erro ao salvar perfil:', e);
    alert('Erro ao salvar perfil');
  }
}

function initConfiguracaoPerfil() {
  const form = document.getElementById('profileForm');
  const addBtn = document.getElementById('addStoreBtn');
  addBtn.addEventListener('click', () => addStoreRow());

  onAuthStateChanged(auth, user => {
    if (!user) return;
    loadProfile(user.uid);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveProfile(user.uid);
    });
  });
}

window.initConfiguracaoPerfil = initConfiguracaoPerfil;
