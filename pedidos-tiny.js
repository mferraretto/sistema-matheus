import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { loadSecureDoc } from './secure-firestore.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let todosPedidos = [];

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
    todosPedidos = pedidos;
    preencherFiltroLoja(pedidos);
    aplicarFiltros();
  } catch (err) {
    console.error('Erro ao carregar pedidos', err);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Erro ao carregar pedidos</td></tr>';
  }
}

function preencherFiltroLoja(pedidos) {
  const select = document.getElementById('filtroLoja');
  if (!select) return;
  const lojas = [...new Set(pedidos.map(p => p.loja || p.store || '').filter(Boolean))].sort();
  lojas.forEach(loja => {
    const opt = document.createElement('option');
    opt.value = loja;
    opt.textContent = loja;
    select.appendChild(opt);
  });
}

function parseDate(str) {
  if (!str) return new Date('');
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    if (str.includes('-') && parts[0].length === 4) {
      return new Date(str);
    }
    const [d, m, y] = parts;
    return new Date(`${y}-${m}-${d}`);
  }
  return new Date(str);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function aplicarFiltros() {
  const tbody = document.querySelector('#tabelaPedidosTiny tbody');
  if (!tbody) return;
  let filtrados = [...todosPedidos];
  const tipo = document.getElementById('tipoData')?.value;
  const dia = document.getElementById('dataDia')?.value;
  const mes = document.getElementById('dataMes')?.value;
  const inicio = document.getElementById('dataInicio')?.value;
  const fim = document.getElementById('dataFim')?.value;
  const loja = document.getElementById('filtroLoja')?.value;
  const skuFiltro = document.getElementById('filtroSku')?.value?.toLowerCase();

  filtrados = filtrados.filter(p => {
    const dataStr = p.data || p.dataPedido || p.date || '';
    const data = parseDate(dataStr);
    if (tipo === 'dia' && dia) {
      const d = parseDate(dia);
      if (!sameDay(data, d)) return false;
    } else if (tipo === 'mes' && mes) {
      const m = parseDate(`${mes}-01`);
      if (data.getFullYear() !== m.getFullYear() || data.getMonth() !== m.getMonth()) return false;
    } else if (tipo === 'personalizado' && inicio && fim) {
      const i = parseDate(inicio);
      const f = parseDate(fim);
      if (data < i || data > f) return false;
    }

    const lojaPedido = (p.loja || p.store || '').toLowerCase();
    if (loja && lojaPedido !== loja.toLowerCase()) return false;

    const sku = (p.sku || (Array.isArray(p.itens) ? p.itens.map(i => i.sku).join(', ') : '')).toLowerCase();
    if (skuFiltro && !sku.includes(skuFiltro)) return false;
    return true;
  });

  tbody.innerHTML = '';
  filtrados.forEach(p => {
    const tr = document.createElement('tr');
    const data = p.data || p.dataPedido || p.date || '';
    const lojaPedido = p.loja || p.store || '';
    const sku = p.sku || (Array.isArray(p.itens) ? p.itens.map(i => i.sku).join(', ') : '');
    const valor = p.valor || p.total || '';
    const idPedido = p.idPedido || p.idpedido || p.id;
    tr.innerHTML = `
        <td data-label="Data">${data}</td>
        <td data-label="ID">${idPedido}</td>
        <td data-label="Loja">${lojaPedido}</td>
        <td data-label="SKU">${sku}</td>
        <td data-label="Valor">${valor}</td>
      `;
    tbody.appendChild(tr);
  });
  if (!tbody.children.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Nenhum pedido encontrado</td></tr>';
  }
}

function atualizarTipoData() {
  const tipo = document.getElementById('tipoData')?.value;
  document.getElementById('grupoDia')?.classList.toggle('hidden', tipo !== 'dia');
  document.getElementById('grupoMes')?.classList.toggle('hidden', tipo !== 'mes');
  const perso = tipo !== 'personalizado';
  document.getElementById('grupoInicio')?.classList.toggle('hidden', perso);
  document.getElementById('grupoFim')?.classList.toggle('hidden', perso);
}

document.getElementById('aplicarFiltros')?.addEventListener('click', e => {
  e.preventDefault();
  aplicarFiltros();
});
['tipoData', 'dataDia', 'dataMes', 'dataInicio', 'dataFim', 'filtroLoja'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', aplicarFiltros);
});
document.getElementById('filtroSku')?.addEventListener('input', aplicarFiltros);
document.getElementById('tipoData')?.addEventListener('change', atualizarTipoData);

atualizarTipoData();

if (typeof window !== 'undefined') {
  window.carregarPedidosTiny = carregarPedidosTiny;
}
