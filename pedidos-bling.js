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

function setTbodyMessage(tbody, message, classes = '', colspan = 4) {
  tbody.textContent = '';
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = colspan;
  td.className = `text-center py-4 ${classes}`.trim();
  td.textContent = message;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

// -------------------------------------------------------------
// ADICIONE ESTA FUNÇÃO AQUI, ANTES DE `carregarPedidos`
// -------------------------------------------------------------
function atualizarTabelaPedidos(pedidos) {
  const tbody = document.querySelector('#tabelaPedidosBling tbody');
  if (!tbody) return;

  tbody.textContent = ''; // Limpa o corpo da tabela antes de adicionar os novos dados.

  if (pedidos.length === 0) {
    setTbodyMessage(tbody, 'Nenhum pedido encontrado', 'text-gray-500', 4);
    return;
  }

  pedidos.forEach(pedido => {
    const row = document.createElement('tr');
    const cells = [
      pedido.numero,
      pedido.itens.map(item => item.sku).join(', '),
      `R$ ${parseFloat(pedido.valor).toFixed(2)}`,
      `R$ ${parseFloat(pedido.valorLiquido).toFixed(2)}`
    ];
    cells.forEach((text, idx) => {
      const td = document.createElement('td');
      td.textContent = text;
      switch (idx) {
        case 0: td.setAttribute('data-label', 'Pedido'); break;
        case 1: td.setAttribute('data-label', 'SKU'); break;
        case 2: td.setAttribute('data-label', 'Valor Pago'); break;
        case 3: td.setAttribute('data-label', 'Valor Líquido'); break;
      }
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
}
// -------------------------------------------------------------
// FIM DA FUNÇÃO ADICIONADA
// -------------------------------------------------------------

export async function carregarPedidos() {
  const tbody = document.querySelector('#tabelaPedidosBling tbody');
  if (!tbody) return;
  setTbodyMessage(tbody, 'Carregando...');
  try {
 const uid = auth.currentUser.uid;
    const pass = getPassphrase() || `chave-${uid}`;
    const snap = await getDocs(collection(db, `uid/${uid}/pedidosBling`));
const pedidos = [];
    for (const d of snap.docs) {
      const pedido = await loadUserDoc(db, uid, 'pedidosBling', d.id, pass);
      if (pedido) pedidos.push(pedido);
    }
    atualizarTabelaPedidos(pedidos);
  } catch (err) {
    console.error('Erro ao carregar pedidos', err);
    setTbodyMessage(tbody, 'Erro ao carregar pedidos', 'text-red-500');
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
