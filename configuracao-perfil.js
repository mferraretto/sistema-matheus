import {
  initializeApp,
  getApps,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getFirestore,
  doc,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import { loadUserProfile } from './login.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let fotoPerfilData = '';

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
  stores.forEach((s) => addStoreRow(s));
}

async function loadProfile(uid) {
  try {
    const data = await loadUserProfile(uid);
    if (data) {
      fotoPerfilData = data.fotoPerfil || '';
      if (fotoPerfilData) {
        document.getElementById('fotoPreview').src = fotoPerfilData;
      }
      document.getElementById('nomeCompleto').value = data.nomeCompleto || '';
      document.getElementById('nomeExibicao').value = data.nomeExibicao || '';
      document.getElementById('dataNascimento').value =
        data.dataNascimento || '';
      document.getElementById('genero').value = data.genero || '';

      document.getElementById('email').value =
        data.email || auth.currentUser?.email || '';
      document.getElementById('telefone').value = data.telefone || '';
      const end = data.endereco || {};
      document.getElementById('endRua').value = end.rua || '';
      document.getElementById('endNumero').value = end.numero || '';
      document.getElementById('endBairro').value = end.bairro || '';
      document.getElementById('endCidade').value = end.cidade || '';
      document.getElementById('endEstado').value = end.estado || '';
      document.getElementById('endCEP').value = end.cep || '';
      document.getElementById('endPais').value = end.pais || '';

      document.getElementById('login').value = data.login || '';
      document.getElementById('perfilFuncao').value = data.perfilFuncao || '';

      document.getElementById('empresa').value = data.empresa || '';
      document.getElementById('documento').value = data.documento || '';
      document.getElementById('cargo').value = data.cargo || '';
      document.getElementById('areaAtuacao').value = data.areaAtuacao || '';

      renderStores(data.lojas || []);

      document.getElementById('idioma').value = data.idioma || 'pt';
      const notif = data.notificacoes || {};
      document.getElementById('notifEmail').checked = !!notif.email;
      document.getElementById('notifWhats').checked = !!notif.whatsapp;
      document.getElementById('notifPush').checked = !!notif.push;
      document.getElementById('tema').value = data.tema || 'claro';
      document.getElementById('permissoes').value = data.permissoes || '';

      document.getElementById('plataformas').value = data.plataformas || '';
      document.getElementById('infoPessoal').value = data.infoPessoal || '';
    } else {
      renderStores();
      document.getElementById('idioma').value = 'pt';
      document.getElementById('tema').value = 'claro';
      if (auth.currentUser?.email) {
        document.getElementById('email').value = auth.currentUser.email;
      }
    }
  } catch (e) {
    console.error('Erro ao carregar perfil:', e);
    renderStores();
  }
}

async function saveProfile(uid) {
  const stores = Array.from(
    document.querySelectorAll('#lojasContainer .store-row'),
  )
    .map((row) => ({
      nome: row.querySelector('[data-field="nome"]').value.trim(),
      link: row.querySelector('[data-field="link"]').value.trim(),
    }))
    .filter((s) => s.nome || s.link);
  const plataformas = document.getElementById('plataformas').value.trim();
  const infoPessoal = document.getElementById('infoPessoal').value.trim();

  const fotoFile = document.getElementById('fotoPerfil').files[0];
  let fotoPerfil = fotoPerfilData;
  if (fotoFile) {
    try {
      fotoPerfil = await readFileAsDataURL(fotoFile);
    } catch (err) {
      console.error('Erro ao ler foto de perfil:', err);
    }
  }

  const profileData = {
    lojas: stores,
    plataformas,
    infoPessoal,
    fotoPerfil,
    nomeCompleto: document.getElementById('nomeCompleto').value.trim(),
    nomeExibicao: document.getElementById('nomeExibicao').value.trim(),
    dataNascimento: document.getElementById('dataNascimento').value,
    genero: document.getElementById('genero').value,
    email: document.getElementById('email').value.trim(),
    telefone: document.getElementById('telefone').value.trim(),
    endereco: {
      rua: document.getElementById('endRua').value.trim(),
      numero: document.getElementById('endNumero').value.trim(),
      bairro: document.getElementById('endBairro').value.trim(),
      cidade: document.getElementById('endCidade').value.trim(),
      estado: document.getElementById('endEstado').value.trim(),
      cep: document.getElementById('endCEP').value.trim(),
      pais: document.getElementById('endPais').value.trim(),
    },
    login: document.getElementById('login').value.trim(),
    perfilFuncao: document.getElementById('perfilFuncao').value,
    empresa: document.getElementById('empresa').value.trim(),
    documento: document.getElementById('documento').value.trim(),
    cargo: document.getElementById('cargo').value.trim(),
    areaAtuacao: document.getElementById('areaAtuacao').value.trim(),
    idioma: document.getElementById('idioma').value,
    notificacoes: {
      email: document.getElementById('notifEmail').checked,
      whatsapp: document.getElementById('notifWhats').checked,
      push: document.getElementById('notifPush').checked,
    },
    tema: document.getElementById('tema').value,
    permissoes: document.getElementById('permissoes').value.trim(),
  };

  try {
    await setDoc(doc(db, 'perfil', uid), profileData, { merge: true });
    fotoPerfilData = fotoPerfil;
    alert('Perfil salvo com sucesso!');
  } catch (e) {
    console.error('Erro ao salvar perfil:', e);
    alert('Erro ao salvar perfil');
  }
}

function initConfiguracaoPerfil() {
  const form = document.getElementById('profileForm');
  const addBtn = document.getElementById('addStoreBtn');
  const resetBtn = document.getElementById('resetPasswordBtn');
  addBtn.addEventListener('click', () => addStoreRow());
  resetBtn.addEventListener('click', async () => {
    if (!auth.currentUser?.email) {
      alert('E-mail não disponível para redefinição');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      alert('E-mail de redefinição enviado');
    } catch (e) {
      console.error('Erro ao enviar redefinição de senha:', e);
      alert('Erro ao enviar redefinição de senha');
    }
  });

  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    loadProfile(user.uid);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveProfile(user.uid);
    });
  });
}

window.initConfiguracaoPerfil = initConfiguracaoPerfil;
