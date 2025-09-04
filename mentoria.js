import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function carregarUsuariosFinanceiros(user) {
  const container = document.getElementById('mentoradosList');
  const mesAtual = new Date().toISOString().slice(0, 7);
  const q = query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', user.email));
  onSnapshot(q, async snap => {
    container.innerHTML = '';
    if (snap.empty) {
      container.innerHTML = '<p class="text-sm text-gray-500 col-span-full">Nenhum usuário encontrado.</p>';
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
      const card = document.createElement('div');
      card.className = 'card p-4 space-y-1';
      card.innerHTML = `
        <h3 class="text-lg font-semibold">${nome}</h3>
        <p><span class="font-medium">Email:</span> ${email}</p>
        <p><span class="font-medium">Início:</span> ${inicio}</p>
        <p><span class="font-medium">Status:</span> ${status}</p>
        <p><span class="font-medium">Meta:</span> ${meta}</p>
        <a href="perfil-mentorado.html?uid=${docSnap.id}" class="text-blue-500 hover:underline">Editar</a>
      `;
      container.appendChild(card);
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
