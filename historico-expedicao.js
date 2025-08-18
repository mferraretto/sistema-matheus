import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  const tbody = document.querySelector('#historicoTable tbody');
  const q = query(collection(db, 'historicoExpedicao'), orderBy('timestamp', 'desc'), limit(500));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const data = doc.data();
    const tr = document.createElement('tr');
    const dataStr = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate().toLocaleString('pt-BR') : '';
    tr.innerHTML = `
      <td class="border-t px-2 py-1">${dataStr}</td>
      <td class="border-t px-2 py-1">${data.usuario || ''}</td>
      <td class="border-t px-2 py-1">${data.acao || ''}</td>
      <td class="border-t px-2 py-1">${data.detalhes || ''}</td>
    `;
    tbody.appendChild(tr);
  });
});
