import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, addDoc, updateDoc, doc, getDocs, query, where, onSnapshot, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

let currentUser = null;
let initialLoad = true;

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `fixed bottom-4 right-4 px-4 py-4 rounded-lg shadow-lg text-white ${
    type === 'success' ? 'bg-green-500' :
    type === 'error' ? 'bg-red-500' :
    type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
  }`;
  notification.innerHTML = `
    <div class="flex items-center">
      <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-2"></i>
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  currentUser = user;
  await carregarUsuarios();
  carregarAtualizacoes();
});

async function carregarUsuarios() {
  const select = document.getElementById('destinatarios');
  if (!select) return;
  select.innerHTML = '';
  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', currentUser.email)));
    snap.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.data().nome || d.id;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
  }
}

document.getElementById('formAtualizacao')?.addEventListener('submit', enviarAtualizacao);

async function enviarAtualizacao(e) {
  e.preventDefault();
  if (!currentUser) return;
  const descricao = document.getElementById('descricao').value.trim();
  const destinatarios = Array.from(document.getElementById('destinatarios').selectedOptions).map(o => o.value);
  if (!destinatarios.includes(currentUser.uid)) destinatarios.push(currentUser.uid);
  const arquivos = document.getElementById('arquivos').files;
  const docRef = await addDoc(collection(db, 'financeiroAtualizacoes'), {
    descricao,
    autorUid: currentUser.uid,
    autorNome: currentUser.displayName || currentUser.email,
    destinatarios,
    createdAt: serverTimestamp(),
    anexos: []
  });
  const anexos = [];
  for (const file of arquivos) {
    const path = `financeiroAtualizacoes/${currentUser.uid}/${docRef.id}/${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    anexos.push({ nome: file.name, url });
  }
  if (anexos.length) {
    await updateDoc(docRef, { anexos });
  }
  document.getElementById('descricao').value = '';
  Array.from(document.getElementById('destinatarios').options).forEach(o => o.selected = false);
  document.getElementById('arquivos').value = '';
}

function carregarAtualizacoes() {
  const lista = document.getElementById('listaAtualizacoes');
  if (!lista) return;
  const colRef = collection(db, 'financeiroAtualizacoes');
  const q = query(colRef, orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    if (!initialLoad) {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const dests = data.destinatarios || [];
          if (data.autorUid !== currentUser.uid && dests.includes(currentUser.uid) && data.tipo === 'faturamento') {
            showNotification(data.descricao || 'Novo faturamento registrado');
          }
        }
      });
    }
    lista.innerHTML = '';
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const dests = data.destinatarios || [];
      if (data.autorUid !== currentUser.uid && !dests.includes(currentUser.uid)) return;
      lista.appendChild(renderCard(docSnap.id, data));
    });
    initialLoad = false;
  });
}

function renderCard(id, data) {
  const card = document.createElement('div');
  card.className = 'card p-4';
  const dataStr = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString('pt-BR') : '';
  const anexosHtml = (data.anexos || []).map(a => `<a href="${a.url}" target="_blank" class="text-blue-500 underline block">${a.nome}</a>`).join('');
  card.innerHTML = `
    <p class="text-sm text-gray-500">${dataStr}</p>
    <p class="font-medium">${data.autorNome || ''}</p>
    <p class="mb-2">${data.descricao || ''}</p>
    ${anexosHtml}
  `;
  return card;
}
