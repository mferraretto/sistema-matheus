import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function carregarUsuariosFinanceiros(user) {
  const tbody = document.getElementById('mentoradosList');
  const mesAtual = new Date().toISOString().slice(0, 7);
  const q = query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', 'array-contains', user.email));
  onSnapshot(q, async snap => {
    tbody.innerHTML = '';
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-sm text-gray-500">Nenhum usuário encontrado.</td></tr>';
      return;
    }
    for (const docSnap of snap.docs) {
      const dados = docSnap.data();
      const email = dados.email || '';
      let nome = dados.nome;
      if (!nome) {
        try {
          const perfil = await getDoc(doc(db, 'perfilMentorado', docSnap.id));
          if (perfil.exists()) nome = perfil.data().nome;
        } catch (_) {}
      }
      nome = nome || docSnap.id;
      const status = dados.status || '-';
      const inicio = dados.dataInicio?.toDate ? dados.dataInicio.toDate().toLocaleDateString('pt-BR') :
        dados.createdAt?.toDate ? dados.createdAt.toDate().toLocaleDateString('pt-BR') : '-';
      let meta = '-';
      try {
        const metaDoc = await getDoc(doc(db, `uid/${docSnap.id}/metasFaturamento`, mesAtual));
        if (metaDoc.exists()) {
          const valor = Number(metaDoc.data().valor) || 0;
          meta = `R$ ${valor.toLocaleString('pt-BR')}`;
        }
      } catch (_) {}
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="p-2 border-b">${email}</td>
        <td class="p-2 border-b">${inicio}</td>
        <td class="p-2 border-b capitalize">${status}</td>
        <td class="p-2 border-b">${meta}</td>
        <td class="p-2 border-b">${nome}</td>
        <td class="p-2 border-b"><a href="perfil-mentorado.html?uid=${docSnap.id}" class="text-blue-500 hover:underline">Editar</a></td>
      `;
      tbody.appendChild(tr);
    }
  });
}

function initMentoria() {
  onAuthStateChanged(auth, user => {
    if (user) {
      carregarUsuariosFinanceiros(user);
    }
  });
}

window.initMentoria = initMentoria;
