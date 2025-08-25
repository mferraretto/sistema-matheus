import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function renderMentorado(id, data) {
  const card = document.createElement('div');
  card.className = 'card';
  const progresso = data.progresso || 0;
  card.innerHTML = `
    <div class="card-header flex justify-between items-center">
      <h3 class="font-bold">${data.nome || 'Sem nome'}</h3>
      <span class="text-sm">${data.status || 'Sem status'}</span>
    </div>
    <div class="card-body space-y-2">
      <p class="text-sm">Último contato: ${data.ultimoContato || '-'}</p>
      <div class="w-full bg-gray-200 rounded h-2">
        <div class="bg-blue-500 h-2 rounded" style="width: ${progresso}%"></div>
      </div>
      <p class="text-xs text-gray-500">Progresso: ${progresso}%</p>
    </div>
  `;
  return card;
}

function carregarMentorados(user) {
  const list = document.getElementById('mentoradosList');
  const q = query(collection(db, 'mentorados'), where('mentorUid', '==', user.uid));
  onSnapshot(q, snap => {
    list.innerHTML = '';
    if (snap.empty) {
      list.innerHTML = '<p class="text-sm text-gray-500">Nenhum mentorado encontrado.</p>';
      return;
    }
    snap.forEach(docSnap => {
      list.appendChild(renderMentorado(docSnap.id, docSnap.data()));
    });
  });
}

function initMentoria() {
  onAuthStateChanged(auth, user => {
    if (user) {
      carregarMentorados(user);
    }
  });
}

window.initMentoria = initMentoria;
