import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collectionGroup, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

async function carregarAds() {
  const tbody = document.querySelector('#tabelaAds tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">Carregando...</td></tr>';
  try {
    const snap = await getDocs(collectionGroup(db, 'desempenho'));
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const campanha = doc.ref.parent.parent.id;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-2">${d.data || doc.id}</td>
        <td class="px-4 py-2">${campanha}</td>
        <td class="px-4 py-2">${d.produto || ''}</td>
        <td class="px-4 py-2">${d.impressoes || 0}</td>
        <td class="px-4 py-2">${d.cliques || 0}</td>
        <td class="px-4 py-2">R$ ${(parseFloat(d.gasto) || 0).toFixed(2)}</td>
        <td class="px-4 py-2">R$ ${(parseFloat(d.receita) || 0).toFixed(2)}</td>
        <td class="px-4 py-2">${d.vendas || 0}</td>
        <td class="px-4 py-2">${(parseFloat(d.roas) || 0).toFixed(2)}</td>`;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('Erro ao carregar ads', e);
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-red-500 py-4">Erro ao carregar dados</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', carregarAds);
