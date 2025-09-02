import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { loadSecureDoc } from './secure-firestore.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let todosPedidos = [];
let custosProdutos = {};
let usuariosCache = [];

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  let usuarios = [{ uid: user.uid, nome: user.displayName || user.email }];
  try {
    const [snapResp, snapGest] = await Promise.all([
      getDocs(query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', user.email))),
      getDocs(query(collection(db, 'usuarios'), where('gestoresFinanceirosEmails', 'array-contains', user.email)))
    ]);
    const docs = [...snapResp.docs, ...snapGest.docs];
    if (docs.length) {
      const extras = await Promise.all(docs.map(async d => {
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
  setupUsuariosFiltro(usuarios);
  await carregarPedidosTiny();
});

export async function carregarPedidosTiny() {
  const tbody = document.querySelector('#tabelaPedidosTiny tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Carregando...</td></tr>';
  try {
    todosPedidos = [];
    custosProdutos = {};
    await Promise.all(
      usuariosCache.map(async u => {
        const pass = getPassphrase() || `chave-${u.uid}`;
        const [snap, produtosSnap] = await Promise.all([
          getDocs(collection(db, `usuarios/${u.uid}/pedidostiny`)),
          getDocs(collection(db, `uid/${u.uid}/produtos`))
        ]);
        produtosSnap.forEach(p => {
          const dados = p.data();
          const chave = (dados.sku || p.id || '').toLowerCase();
          custosProdutos[chave] = Number(dados.custo || 0);
        });
        for (const d of snap.docs) {
          let pedido = await loadSecureDoc(db, `usuarios/${u.uid}/pedidostiny`, d.id, pass);
          if (!pedido) {
            const raw = d.data();
            if (raw && !raw.encrypted && !raw.encryptedData) pedido = raw;
          }
          if (pedido) todosPedidos.push({ id: d.id, uid: u.uid, usuario: u.nome, ...pedido });
        }
      })
    );
    preencherFiltroLoja(todosPedidos);
    aplicarFiltros();
  } catch (err) {
    console.error('Erro ao carregar pedidos', err);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-red-500">Erro ao carregar pedidos</td></tr>';
  }
}

function setupUsuariosFiltro(usuarios) {
  const select = document.getElementById('usuarioFiltro');
  const grupo = document.getElementById('grupoUsuario');
  if (!select) return;
  select.innerHTML = '<option value="todos">Todos</option>';
  usuarios.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.uid;
    opt.textContent = u.nome;
    select.appendChild(opt);
  });
  grupo?.classList.toggle('hidden', usuarios.length <= 1);
  select.addEventListener('change', aplicarFiltros);
}

function preencherFiltroLoja(pedidos) {
  const select = document.getElementById('filtroLoja');
  if (!select) return;
  select.innerHTML = '<option value="">Todas</option>';
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

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(n) || 0;
  }
  return 0;
}

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcularLiquido(p) {
  const total = toNumber(p.valor || p.total || 0);
  const loja = (p.loja || p.store || '').toLowerCase();
  let taxa = 0;
  if (loja.includes('shopee')) {
    if (Array.isArray(p.itens) && p.itens.length) {
      p.itens.forEach(i => {
        const v = toNumber(i.valor || i.total || i.preco || i.price || 0);
        const comissao = Math.min(v * 0.22, 100);
        taxa += comissao + 4.0;
      });
    } else {
      const comissao = Math.min(total * 0.22, 100);
      taxa = comissao + 4.0;
    }
  } else if (loja.includes('mercado livre') || loja.includes('mercadolivre')) {
    if (Array.isArray(p.itens) && p.itens.length) {
      p.itens.forEach(i => {
        const v = toNumber(i.valor || i.total || i.preco || i.price || 0);
        let fixo = 0;
        if (v < 12.5) fixo = v / 2;
        else if (v < 29) fixo = 6.25;
        else if (v < 50) fixo = 6.5;
        else if (v < 79) fixo = 6.75;
        taxa += v * 0.12 + fixo;
      });
    } else {
      const v = total;
      let fixo = 0;
      if (v < 12.5) fixo = v / 2;
      else if (v < 29) fixo = 6.25;
      else if (v < 50) fixo = 6.5;
      else if (v < 79) fixo = 6.75;
      taxa = v * 0.12 + fixo;
    }
  }
  return total - taxa;
}

function atualizarResumo(pedidos) {
  const resumo = document.getElementById('resumoPedidosTiny');
  if (!resumo) return;
  const totalBruto = pedidos.reduce((s, p) => s + toNumber(p.valor || p.total || 0), 0);
  const totalLiquido = pedidos.reduce((s, p) => s + calcularLiquido(p), 0);
  const quantidade = pedidos.length;
  resumo.innerHTML = `
    <div class="resumo-card"><h4>Valor Bruto</h4><p>${formatCurrency(totalBruto)}</p></div>
    <div class="resumo-card"><h4>Valor Líquido</h4><p>${formatCurrency(totalLiquido)}</p></div>
    <div class="resumo-card"><h4>Pedidos</h4><p>${quantidade}</p></div>
  `;
}

export function aplicarFiltros() {
  const tbody = document.querySelector('#tabelaPedidosTiny tbody');
  if (!tbody) return;
  let filtrados = [...todosPedidos];
  const usuarioSel = document.getElementById('usuarioFiltro')?.value;
  if (usuarioSel && usuarioSel !== 'todos') {
    filtrados = filtrados.filter(p => p.uid === usuarioSel);
  }
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
    const valorBruto = toNumber(p.valor || p.total || 0);
    const liquido = calcularLiquido(p);
    let custoTotal = 0;
    if (Array.isArray(p.itens) && p.itens.length) {
      p.itens.forEach(i => {
        const skuItem = (i.sku || '').toLowerCase();
        const qtd = Number(i.quantidade || i.qtd || i.quantity || 1) || 1;
        const c = custosProdutos[skuItem] || 0;
        custoTotal += c * qtd;
      });
    } else {
      const skuItem = (p.sku || '').toLowerCase();
      const qtd = Number(p.quantidade || p.qtd || p.quantity || 1) || 1;
      const c = custosProdutos[skuItem] || 0;
      custoTotal += c * qtd;
    }
    const idPedido = p.idPedido || p.idpedido || p.id;
    tr.innerHTML = `
        <td data-label="Usuário">${p.usuario || ''}</td>
        <td data-label="Data">${data}</td>
        <td data-label="ID">${idPedido}</td>
        <td data-label="Loja">${lojaPedido}</td>
        <td data-label="SKU">${sku}</td>
        <td data-label="Valor">${formatCurrency(valorBruto)}</td>
        <td data-label="Líquido">${formatCurrency(liquido)}</td>
      `;
    if (custoTotal && liquido < custoTotal * 0.9) tr.classList.add('bg-red-100');
    tbody.appendChild(tr);
  });
  if (!tbody.children.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500">Nenhum pedido encontrado</td></tr>';
  }
  atualizarResumo(filtrados);
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
