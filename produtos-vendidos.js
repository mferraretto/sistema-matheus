import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { loadSecureDocFromSnap } from './secure-firestore.js';
import { carregarUsuariosFinanceiros } from './responsavel-financeiro.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let usuariosCache = [];

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  try {
    const { usuarios, isGestor, isResponsavelFinanceiro, perfil } = await carregarUsuariosFinanceiros(db, user);
    if (!isGestor && !isResponsavelFinanceiro && perfil !== 'mentor') {
      window.location.href = 'index.html';
      return;
    }
    usuariosCache = usuarios;
  } catch (err) {
    console.error('Erro ao verificar acesso financeiro:', err);
    usuariosCache = [{ uid: user.uid, nome: user.displayName || user.email }];
  }
  setupFiltro();
  await carregar();
});

function setupFiltro() {
  const inicioEl = document.getElementById('inicioFiltro');
  const fimEl = document.getElementById('fimFiltro');
  const hoje = new Date();
  const inicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const fimPadrao = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
  if (inicioEl) inicioEl.value = inicioPadrao;
  if (fimEl) fimEl.value = fimPadrao;
  document.getElementById('btnAplicar')?.addEventListener('click', carregar);
}

async function carregar() {
  const inicio = document.getElementById('inicioFiltro')?.value;
  const fim = document.getElementById('fimFiltro')?.value;
  if (!inicio || !fim) return;
  await carregarSkus(usuariosCache, inicio, fim);
}

function parseDate(str) {
  if (!str) return new Date('');
  if (str.includes('T') || str.includes(' ')) {
    const d = new Date(str);
    if (!isNaN(d)) return d;
  }
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    let y, m, d;
    if (str.includes('-') && parts[0].length === 4) {
      [y, m, d] = parts;
    } else {
      [d, m, y] = parts;
    }
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(str);
}

async function carregarSkus(usuarios, inicio, fim) {
  const resumoGeral = {};
  const inicioDate = parseDate(inicio);
  const fimDate = parseDate(fim);

  for (const usuario of usuarios) {
    const pass = getPassphrase() || `chave-${usuario.uid}`;
    const snap = await getDocs(collection(db, `usuarios/${usuario.uid}/pedidostiny`));
    for (const docSnap of snap.docs) {
      const pedido = await loadSecureDocFromSnap(docSnap, pass);
      if (!pedido) continue;

      const dataPedido = parseDate(pedido.data || pedido.dataPedido || pedido.date);
      if (isNaN(dataPedido) || dataPedido < inicioDate || dataPedido > fimDate) continue;

      const itens = Array.isArray(pedido.itens) && pedido.itens.length ? pedido.itens : [pedido];
      itens.forEach(item => {
        const sku = item.sku || pedido.sku || 'sem-sku';
        const qtd = Number(item.quantidade || item.qtd || item.quantity || item.total || 1) || 1;
        resumoGeral[sku] = (resumoGeral[sku] || 0) + qtd;
      });
    }
  }

  renderLista(resumoGeral);
}

function renderLista(resumo) {
  const lista = document.getElementById('listaSkus');
  if (!lista) return;

  const entries = Object.entries(resumo);
  if (!entries.length) {
    lista.innerHTML = '<p class="text-sm text-gray-500">Nenhum SKU encontrado.</p>';
    return;
  }

  const renderTabela = sortBy => {
    const items = [...entries];
    if (sortBy === 'sku') {
      items.sort((a, b) => a[0].localeCompare(b[0]));
    } else {
      items.sort((a, b) => b[1] - a[1]);
    }

    let html = '<table class="min-w-full text-sm"><thead><tr>' +
      '<th id="thSku" class="text-left cursor-pointer">SKU</th>' +
      '<th id="thQtd" class="text-left cursor-pointer">Quantidade</th>' +
      '</tr></thead><tbody>';

    items.forEach(([sku, qtd]) => {
      html += `<tr><td class="pr-4">${sku}</td><td>${qtd}</td></tr>`;
    });

    html += '</tbody></table>';
    lista.innerHTML = html;

    document.getElementById('thSku')?.addEventListener('click', () => renderTabela('sku'));
    document.getElementById('thQtd')?.addEventListener('click', () => renderTabela('qtd'));
  };

  renderTabela('qtd');
}
