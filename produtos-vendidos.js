import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, query, orderBy, startAt, endAt, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { loadSecureDoc } from './secure-firestore.js';
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

async function carregarSkus(usuarios, inicio, fim) {
  const resumoGeral = {};
  for (const usuario of usuarios) {
    const pass = getPassphrase() || `chave-${usuario.uid}`;
    const baseCol = collection(db, `usuarios/${usuario.uid}/pedidostiny`);
    const q = query(baseCol, orderBy('data'), startAt(inicio), endAt(fim));
    const snap = await getDocs(q);
    const promessas = snap.docs.map(async docSnap => {
      let pedido = await loadSecureDoc(db, `usuarios/${usuario.uid}/pedidostiny`, docSnap.id, pass);
      if (!pedido) {
        const raw = docSnap.data();
        if (raw && !raw.encrypted && !raw.encryptedData) pedido = raw;
      }
      if (!pedido) return {};
      const itens = Array.isArray(pedido.itens) && pedido.itens.length ? pedido.itens : [pedido];
      const resumoLocal = {};
      itens.forEach(item => {
        const sku = item.sku || pedido.sku || 'sem-sku';
        const qtd = Number(item.quantidade || item.qtd || item.quantity || item.total || 1) || 1;
        resumoLocal[sku] = (resumoLocal[sku] || 0) + qtd;
      });
      return resumoLocal;
    });
    const resultados = await Promise.all(promessas);
    resultados.forEach(res => {
      Object.entries(res).forEach(([sku, qtd]) => {
        resumoGeral[sku] = (resumoGeral[sku] || 0) + qtd;
      });
    });
  }
  renderLista(resumoGeral);
}

function renderLista(resumo) {
  const lista = document.getElementById('listaSkus');
  if (!lista) return;
  const entries = Object.entries(resumo).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    lista.innerHTML = '<p class="text-sm text-gray-500">Nenhum SKU encontrado.</p>';
    return;
  }
  let html = '<table class="min-w-full text-sm"><thead><tr><th class="text-left">SKU</th><th class="text-left">Quantidade</th></tr></thead><tbody>';
  entries.forEach(([sku, qtd]) => {
    html += `<tr><td class="pr-4">${sku}</td><td>${qtd}</td></tr>`;
  });
  html += '</tbody></table>';
  lista.innerHTML = html;
}
