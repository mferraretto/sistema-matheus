import {
  initializeApp,
  getApps,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { saveSecureDoc, loadSecureDoc } from './secure-firestore.js';
import logger from './logger.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const auth = getAuth(app);

async function getStoredApiKey() {
  const uid = auth.currentUser?.uid || window.sistema?.uid;
  if (!uid) return null;
  if (window.sistema?.blingApiKey) return window.sistema.blingApiKey;
  try {
    const data = await loadSecureDoc(
      db,
      `uid/${uid}/blingKeys`,
      'apiKey',
      getPassphrase() || `chave-${uid}`,
    );
    if (data && data.key) {
      window.sistema = window.sistema || {};
      window.sistema.blingApiKey = data.key;
      return data.key;
    }
  } catch (err) {
    console.error('Erro ao carregar chave do Bling:', err);
  }
  return null;
}

async function saveApiKey(key) {
  const uid = auth.currentUser?.uid || window.sistema?.uid;
  if (!uid) return;
  try {
    await saveSecureDoc(
      db,
      `uid/${uid}/blingKeys`,
      'apiKey',
      { key, uid },
      getPassphrase() || `chave-${uid}`,
    );
    window.sistema = window.sistema || {};
    window.sistema.blingApiKey = key;
  } catch (err) {
    console.error('Erro ao salvar chave do Bling:', err);
  }
}
export async function importarPedidosBling() {
  const uid = auth.currentUser?.uid || window.sistema?.uid;
  if (!uid) {
    alert('Usuário não autenticado');
    return;
  }
  let apiKey = await getStoredApiKey();
  if (!apiKey) {
    apiKey = prompt('Informe sua API Key do Bling:');
    if (!apiKey) return;
    await saveApiKey(apiKey);
  }

  const url = 'https://proxybling-g6u4niudyq-uc.a.run.app';
  let json;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        endpoint: 'pedidos',
        parametros: '',
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    json = await res.json();
    if (json.retorno && json.retorno.erros) {
      console.error('Erro ao obter pedidos do Bling:', json.retorno.erros);
      alert('Erro ao importar pedidos do Bling');
      return;
    }

    const pedidos = json.retorno?.pedidos || [];
    for (const obj of pedidos) {
      const pedido = obj.pedido || obj;
      const numero = String(pedido.numero);
      await saveSecureDoc(
        db,
        `uid/${uid}/pedidosBling`,
        numero,
        { ...pedido, uid },
        getPassphrase() || `chave-${uid}`,
      );
    }

    atualizarTabelaPedidos(pedidos);
    alert(`${pedidos.length} pedidos importados`);
  } catch (err) {
    logger.warn('Proxy falhou, tentando acesso direto:', err);
    try {
      const directUrl = `https://corsproxy.io/https://bling.com.br/Api/v2/pedidos/json/?apikey=${encodeURIComponent(apiKey)}`;
      const res = await fetch(directUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = await res.json();
      const pedidos = json.retorno?.pedidos || [];
      for (const obj of pedidos) {
        const pedido = obj.pedido || obj;
        const numero = String(pedido.numero);
        await saveSecureDoc(
          db,
          `uid/${uid}/pedidosBling`,
          numero,
          { ...pedido, uid },
          getPassphrase() || `chave-${uid}`,
        );
      }

      atualizarTabelaPedidos(pedidos);
      alert(`${pedidos.length} pedidos importados (direto)`);
    } catch (err2) {
      console.error('Falha ao importar pedidos do Bling:', err2);
      alert('Falha ao importar pedidos do Bling');
    }
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

// Expose functions globally for inline handlers
if (typeof window !== 'undefined') {
  window.importarPedidosBling = importarPedidosBling;
  window.saveBlingApiKey = saveApiKey;
  window.getBlingApiKey = getStoredApiKey;
}
