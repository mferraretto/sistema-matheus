import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { loadSecureDoc } from './secure-firestore.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  await carregarPedidosTiny();
});

export async function carregarPedidosTiny() {
  const tbody = document.querySelector('#tabelaPedidosTiny tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Carregando...</td></tr>';
  try {
    const uid = auth.currentUser.uid;
    const pass = getPassphrase() || `chave-${uid}`;
    const snap = await getDocs(collection(db, `usuarios/${uid}/pedidostiny`));
    const pedidos = [];
    for (const d of snap.docs) {
      let pedido = await loadSecureDoc(db, `usuarios/${uid}/pedidostiny`, d.id, pass);
      if (!pedido) {
        const raw = d.data();
        if (raw && !raw.encrypted && !raw.encryptedData) pedido = raw;
      }
      if (pedido) pedidos.push({ id: d.id, ...pedido });
    }
    tbody.innerHTML = '';
    pedidos.forEach(p => {
      const tr = document.createElement('tr');
      const data = p.data || p.dataPedido || p.date || '';
      const loja = p.loja || p.store || '';
      const sku = p.sku || (Array.isArray(p.itens) ? p.itens.map(i => i.sku).join(', ') : '');
      const valor = p.valor || p.total || '';
      const idPedido = p.idpedido || p.id;
      tr.innerHTML = `
        <td data-label="Data">${data}</td>
        <td data-label="ID">${idPedido}</td>
        <td data-label="Loja">${loja}</td>
        <td data-label="SKU">${sku}</td>
        <td data-label="Valor">${valor}</td>
      `;
      tbody.appendChild(tr);
    });
    if (!tbody.children.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Nenhum pedido encontrado</td></tr>';
    }
  } catch (err) {
    console.error('Erro ao carregar pedidos', err);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Erro ao carregar pedidos</td></tr>';
  }
}

if (typeof window !== 'undefined') {
  window.carregarPedidosTiny = carregarPedidosTiny;
}
