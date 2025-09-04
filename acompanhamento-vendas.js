import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, query, where, orderBy, startAt, endAt, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { loadSecureDoc } from './secure-firestore.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let usuariosCache = [];

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  let usuarios = [{ uid: user.uid, nome: user.displayName || user.email }];
  try {
    const [snap1, snap2] = await Promise.all([
      getDocs(query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', user.email))),
      getDocs(query(collection(db, 'usuarios'), where('gestoresFinanceirosEmails', 'array-contains', user.email)))
    ]);
    const docs = [...snap1.docs, ...snap2.docs];
    if (docs.length) {
      const vistos = new Set();
      const extras = await Promise.all(docs.filter(d => {
        if (vistos.has(d.id)) return false;
        vistos.add(d.id);
        return true;
      }).map(async d => {
        let nome = d.data().nome;
        if (!nome) {
          try {
            const perfil = await getDoc(doc(db, 'perfilMentorado', d.id));
            if (perfil.exists()) nome = perfil.data().nome;
          } catch (_) {}
        }
        return { uid: d.id, nome: nome || d.data().email || d.id };
      }));
      usuarios = usuarios.concat(extras);
    }
  } catch (err) {
    console.error('Erro ao verificar acesso financeiro:', err);
  }
  usuariosCache = usuarios;
  setupFiltros(usuarios);
  await carregar();
});

function setupFiltros(usuarios) {
  const userSel = document.getElementById('usuarioFiltro');
  const mesSel = document.getElementById('mesFiltro');
  if (!userSel || !mesSel) return;
  userSel.innerHTML = '<option value="todos">Todos</option>';
  usuarios.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.uid;
    opt.textContent = u.nome;
    userSel.appendChild(opt);
  });
  userSel.value = 'todos';
  mesSel.value = formatMes(new Date());
  userSel.addEventListener('change', carregar);
  mesSel.addEventListener('change', carregar);
}

async function carregar() {
  const mes = document.getElementById('mesFiltro')?.value;
  const uid = document.getElementById('usuarioFiltro')?.value || 'todos';
  const listaUsuarios = uid === 'todos' ? usuariosCache : usuariosCache.filter(u => u.uid === uid);
  await carregarSkus(listaUsuarios, mes);
}

async function carregarSkus(usuarios, mes) {
  const resumoGeral = {};
  const mesData = mes ? parseMes(mes) : null;
  for (const usuario of usuarios) {
    const pass = getPassphrase() || `chave-${usuario.uid}`;
    const baseCol = collection(db, `usuarios/${usuario.uid}/pedidostiny`);
    let q = baseCol;
    if (mesData) {
      const inicio = new Date(mesData.getFullYear(), mesData.getMonth(), 1).toISOString().split('T')[0];
      const fim = new Date(mesData.getFullYear(), mesData.getMonth() + 1, 0).toISOString().split('T')[0];
      q = query(baseCol, orderBy('data'), startAt(inicio), endAt(fim));
    }
    const snap = await getDocs(q);
    const promessas = snap.docs.map(async docSnap => {
      let pedido = await loadSecureDoc(db, `usuarios/${usuario.uid}/pedidostiny`, docSnap.id, pass);
      if (!pedido) {
        const raw = docSnap.data();
        if (raw && !raw.encrypted && !raw.encryptedData) pedido = raw;
      }
      if (!pedido) return {};
      const dataStr = pedido.data || pedido.dataPedido || pedido.date || '';
      const data = parseDate(dataStr);
      if (mesData && !sameMonth(data, mesData)) return {};
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
  renderSkusCard(resumoGeral);
}

function renderSkusCard(resumo) {
  const card = document.getElementById('skusMesCard');
  const topCard = document.getElementById('topSkusCard');
  if (!card || !topCard) return;
  const entries = Object.entries(resumo).sort((a, b) => b[1] - a[1]);
  card.innerHTML = '';
  topCard.innerHTML = '';
  if (!entries.length) {
    card.classList.add('hidden');
    topCard.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  topCard.classList.remove('hidden');
  let html = '<h4 class="text-sm text-gray-500 mb-2">SKUs vendidos no mês</h4><ul class="text-sm space-y-1">';
  entries.forEach(([sku, qtd]) => { html += `<li>${sku}: ${qtd}</li>`; });
  html += '</ul>';
  card.innerHTML = html;
  let topHtml = '<h4 class="text-sm text-gray-500 mb-2">Top 5 SKUs</h4><ul class="text-sm space-y-1">';
  entries.slice(0,5).forEach(([sku, qtd]) => { topHtml += `<li>${sku}: ${qtd}</li>`; });
  topHtml += '</ul>';
  topCard.innerHTML = topHtml;
}

function parseDate(str) {
  if (!str) return new Date('');
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    if (str.includes('-') && parts[0].length === 4) {
      return new Date(str);
    }
    const [d, m, y] = parts;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(str);
}

function parseMes(str) {
  const [ano, mes] = (str || '').split('-').map(Number);
  if (!ano || !mes) return new Date('');
  return new Date(ano, mes - 1, 1);
}

function formatMes(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
