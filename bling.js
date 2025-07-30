import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const BLING_API_KEY = 'f9c9f25ac92629f5e6ea58cbeb0ab499e51046118d68fbe87a097f03802e87c093b7e9b3';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function importarPedidosBling() {
  const url = `https://bling.com.br/Api/v2/pedidos/json/?apikey=${BLING_API_KEY}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.retorno && json.retorno.erros) {
      console.error('Erro ao obter pedidos do Bling:', json.retorno.erros);
      alert('Erro ao importar pedidos do Bling');
      return;
    }

    const pedidos = json.retorno?.pedidos || [];
    for (const obj of pedidos) {
      const pedido = obj.pedido || obj;
      const numero = String(pedido.numero);
      await setDoc(doc(db, 'pedidosBling', numero), pedido);
    }

    atualizarTabelaPedidos(pedidos);
    alert(`${pedidos.length} pedidos importados`);
  } catch (err) {
    console.error('Falha ao importar pedidos do Bling:', err);
    alert('Falha ao importar pedidos do Bling');
  }
}

function atualizarTabelaPedidos(pedidos) {
  const tbody = document.querySelector('#tabelaPedidosBling tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const obj of pedidos) {
    const p = obj.pedido || obj;
    const numero = p.numero || '';
    const item = Array.isArray(p.itens) ? p.itens[0]?.item : p.itens?.item;
    const sku = item?.codigo || '';
    const valorPago = parseFloat(p.totalvenda || p.total || 0);
    const liquido = valorPago; // valor líquido aproximado
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${numero}</td>
      <td>${sku}</td>
      <td>R$ ${valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td>R$ ${liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
    `;
    tbody.appendChild(tr);
  }
}

// Expose function globally for inline button handler
if (typeof window !== 'undefined') {
  window.importarPedidosBling = importarPedidosBling;
}
