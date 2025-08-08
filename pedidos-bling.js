import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { loadUserDoc } from './secure-firestore.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  await carregarPedidos();
});

// -------------------------------------------------------------
// ADICIONE ESTA FUNÇÃO AQUI, ANTES DE `carregarPedidos`
// -------------------------------------------------------------
function atualizarTabelaPedidos(pedidos) {
  const tbody = document.querySelector('#tabelaPedidosBling tbody');
  if (!tbody) return;

  tbody.innerHTML = ''; // Limpa o corpo da tabela antes de adicionar os novos dados.

  if (pedidos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Nenhum pedido encontrado</td></tr>';
    return;
  }

  pedidos.forEach(pedido => {
    const row = document.createElement('tr');
    // Certifique-se de que a estrutura do seu objeto 'pedido' corresponde a esta.
    row.innerHTML = `
      <td data-label="Pedido">${pedido.numero}</td>
      <td data-label="SKU">${pedido.itens.map(item => item.sku).join(', ')}</td>
      <td data-label="Valor Pago">R$ ${parseFloat(pedido.valor).toFixed(2)}</td>
      <td data-label="Valor Líquido">R$ ${parseFloat(pedido.valorLiquido).toFixed(2)}</td>
    `;
    tbody.appendChild(row);
  });
}
// -------------------------------------------------------------
// FIM DA FUNÇÃO ADICIONADA
// -------------------------------------------------------------

export async function carregarPedidos() {
  const tbody = document.querySelector('#tabelaPedidosBling tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Carregando...</td></tr>';
  try {
 const uid = auth.currentUser.uid;
    const pass = getPassphrase() || `chave-${uid}`;
    const snap = await getDocs(collection(db, `uid/${uid}/pedidosBling`));
const pedidos = [];
    for (const d of snap.docs) {
      const pedido = await loadUserDoc(db, uid, 'pedidosBling', d.id, pass);
      if (pedido) pedidos.push(pedido);
    }
    // -------------------------------------------------------------
    // SUBSTITUA ESTE TRECHO
    // -------------------------------------------------------------
    // tbody.innerHTML = '';
    // if (window.atualizarTabelaPedidos) {
    //   window.atualizarTabelaPedidos(pedidos);
    // }
    // if (!tbody.children.length) {
    //   tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Nenhum pedido encontrado</td></tr>';
    // }
    // -------------------------------------------------------------
    // POR ESTE AQUI
    // -------------------------------------------------------------
    atualizarTabelaPedidos(pedidos);
    // -------------------------------------------------------------
  } catch (err) {
    console.error('Erro ao carregar pedidos', err);
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Erro ao carregar pedidos</td></tr>';
  }
}

if (typeof window !== 'undefined') {
  window.carregarPedidosBling = carregarPedidos;
}

// -------------------------------------------------------------
// E ADICIONE TAMBÉM ESTA LINHA PARA TORNAR A FUNÇÃO ACESSÍVEL
// -------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.atualizarTabelaPedidos = atualizarTabelaPedidos;
}
// -------------------------------------------------------------
