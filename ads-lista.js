import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, async (user) => {
  const tbody = document.querySelector('#tabelaAds tbody');
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">Carregando...</td></tr>';

  try {
    const campanhasSnap = await getDocs(collection(db, 'ads'));
    tbody.innerHTML = '';

    for (const campDoc of campanhasSnap.docs) {
      const dadosCampanha = campDoc.data();

      // 🛡️ Filtra apenas as campanhas do usuário logado
      if (dadosCampanha.uid !== user.uid) continue;

      const desempenhoSnap = await getDocs(collection(db, `ads/${campDoc.id}/desempenho`));
      desempenhoSnap.forEach(doc => {
        const d = doc.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="px-4 py-2">${d.data || doc.id}</td>
          <td class="px-4 py-2">${campDoc.id}</td>
          <td class="px-4 py-2">${d.produto || ''}</td>
          <td class="px-4 py-2">${d.impressoes || 0}</td>
          <td class="px-4 py-2">${d.cliques || 0}</td>
          <td class="px-4 py-2">R$ ${(parseFloat(d.gasto) || 0).toFixed(2)}</td>
          <td class="px-4 py-2">R$ ${(parseFloat(d.receita) || 0).toFixed(2)}</td>
          <td class="px-4 py-2">${d.vendas || 0}</td>
          <td class="px-4 py-2">${(parseFloat(d.roas) || 0).toFixed(2)}</td>`;
        tbody.appendChild(tr);
      });
    }

    if (tbody.innerHTML === '') {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-gray-500">Nenhum dado encontrado</td></tr>';
    }

  } catch (e) {
    console.error('Erro ao carregar ads', e);
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-red-500 py-4">Erro ao carregar dados</td></tr>';
  }
});

