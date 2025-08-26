import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, query, where, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  const q = query(
    collection(db, 'expedicaoMensagens'),
    where('destinatarios', 'array-contains', user.uid),
    orderBy('createdAt', 'desc')
  );
  onSnapshot(q, snap => {
    const lista = document.getElementById('listaAtualizacoes');
    lista.innerHTML = '';
    if (snap.empty) {
      lista.innerHTML = '<p class="text-gray-500">Nenhuma atualização.</p>';
      return;
    }
    snap.forEach(doc => {
      const dados = doc.data();
      const item = document.createElement('div');
      item.className = 'p-4 bg-white rounded shadow';
      const dataHora = dados.createdAt?.toDate ? dados.createdAt.toDate().toLocaleString('pt-BR') : '';
      item.innerHTML = `
        <div class="text-sm text-gray-700">Qtd não expedida: ${dados.quantidade}</div>
        <div class="text-sm text-gray-700">Motivo: ${dados.motivo || ''}</div>
        <div class="text-xs text-gray-500 mt-1">${dataHora}</div>
      `;
      lista.appendChild(item);
    });
  });
});

