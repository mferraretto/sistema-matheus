import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, doc, getDoc, query, where } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { decryptString } from './crypto.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let dashboardData = {};
async function carregarDashboard(user, mesSelecionado) {
  const uid = user.uid;
  const baseDate = mesSelecionado ? new Date(mesSelecionado + '-01') : new Date();
  const mesAtual = baseDate.toISOString().slice(0,7);
  const totalDiasMes = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();

  let totalBruto = 0;
  let totalLiquido = 0;
  let totalUnidades = 0;
  const diarioBruto = {};
  const diarioLiquido = {};
  const cancelamentosDiario = {};
  const porLoja = {};
  const mesesComparativos = [];
  for (let i = 0; i < 3; i++) {
    const dt = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
    mesesComparativos.push(dt.toISOString().slice(0,7));
  }
  const comparativo = {};
  mesesComparativos.forEach(m => comparativo[m] = 0);

  const snap = await getDocs(collection(db, `uid/${uid}/faturamento`));
  for (const docSnap of snap.docs) {
    const mesDoc = docSnap.id.slice(0,7);
    if (!mesesComparativos.includes(mesDoc)) continue;
    const lojasSnap = await getDocs(collection(db, `uid/${uid}/faturamento/${docSnap.id}/lojas`));
    for (const lojaDoc of lojasSnap.docs) {
      let dados = lojaDoc.data();
      if (dados.encrypted) {
        const pass = getPassphrase() || `chave-${uid}`;
        let txt;
        try {
          txt = await decryptString(dados.encrypted, pass);
        } catch (e) {
          try { txt = await decryptString(dados.encrypted, uid); } catch (_) {}
        }
        if (txt) dados = JSON.parse(txt);
      }
      const bruto = Number(dados.valorBruto) || 0;
      const liquido = Number(dados.valorLiquido) || 0;
      const qtd = Number(dados.qtdVendas || dados.quantidade) || 0;
      comparativo[mesDoc] = (comparativo[mesDoc] || 0) + liquido;
      if (mesDoc === mesAtual) {
        totalBruto += bruto;
        totalLiquido += liquido;
        totalUnidades += qtd;
        diarioBruto[docSnap.id] = (diarioBruto[docSnap.id] || 0) + bruto;
        diarioLiquido[docSnap.id] = (diarioLiquido[docSnap.id] || 0) + liquido;
        porLoja[lojaDoc.id] = (porLoja[lojaDoc.id] || 0) + liquido;
        cancelamentosDiario[docSnap.id] = (cancelamentosDiario[docSnap.id] || 0) + (Number(dados.valorCancelado) || Number(dados.cancelado) || 0);
      }
    }
  }

  const ticketMedio = totalUnidades ? totalLiquido / totalUnidades : 0;

  let meta = 0;
  try {
    const metaDoc = await getDoc(doc(db, `uid/${uid}/metasFaturamento`, mesAtual));
    if (metaDoc.exists()) meta = Number(metaDoc.data().valor) || 0;
  } catch (err) {
    console.error('Erro ao buscar meta:', err);
  }

  const metaDiaria = meta / totalDiasMes;
  let diasAcima = 0;
  let diasAbaixo = 0;
  Object.keys(diarioLiquido).forEach(dia => {
    if (diarioLiquido[dia] >= metaDiaria) diasAcima++;
    else diasAbaixo++;
  });

  let totalSaques = 0;
  try {
    const resumoDoc = await getDoc(doc(db, 'usuarios', uid, 'comissoes', mesAtual));
    if (resumoDoc.exists()) {
      totalSaques = Number(resumoDoc.data().totalSacado) || 0;
    }
  } catch (err) {
    console.error('Erro ao carregar saques', err);
  }

  let nomeEmpresa = '';
  let responsavel = user.email || '';
  try {
    const perfilDoc = await getDoc(doc(db, 'perfil', uid));
    if (perfilDoc.exists()) {
      const pdata = perfilDoc.data();
      nomeEmpresa = pdata.empresa || '';
      responsavel = pdata.nomeCompleto || responsavel;
    }
  } catch (err) {
    console.error('Erro ao carregar perfil', err);
  }

  let topProdutos = [];
  let produtosCriticos = [];
  let topSkus = [];
  try {
    const prodSnap = await getDocs(collection(db, `uid/${uid}/produtos`));
    const arr = [];
    for (const p of prodSnap.docs) {
      let d = p.data();
      if (d.encrypted) {
        const pass = getPassphrase() || `chave-${uid}`;
        let txt;
        try { txt = await decryptString(d.encrypted, pass); }
        catch (e) {
          try { txt = await decryptString(d.encrypted, uid); } catch (_) {}
        }
        if (txt) d = JSON.parse(txt);
      }
      arr.push({ nome: d.nome || p.id, sku: d.sku || p.id, vendas: Number(d.vendas) || 0, estoque: Number(d.estoque) || 0 });
    }
    topProdutos = arr.filter(p => p.vendas > 0).sort((a, b) => b.vendas - a.vendas).slice(0, 10);
    produtosCriticos = arr.filter(p => p.estoque > 0 && p.vendas === 0);
  } catch (err) {
    console.error('Erro ao carregar produtos', err);
  }

  let rentabilidade = [];
  let topRentaveis = [];
  try {
    const skusSnap = await getDocs(collection(db, `uid/${uid}/skusVendidos`));
    const mapa = {};
    for (const docSnap of skusSnap.docs) {
      if (!docSnap.id.includes(mesAtual)) continue;
      const listaRef = collection(db, `uid/${uid}/skusVendidos/${docSnap.id}/lista`);
      const listaSnap = await getDocs(listaRef);
      listaSnap.forEach(item => {
        const d = item.data();
        const sku = d.sku || item.id;
        const qtd = Number(d.total || d.quantidade) || 0;
        const valor = Number(d.valorLiquido || 0);
        if (!mapa[sku]) mapa[sku] = { qtd: 0, valor: 0 };
        mapa[sku].qtd += qtd;
        mapa[sku].valor += valor;
      });
    }

    topSkus = Object.entries(mapa)
      .map(([sku, dados]) => ({ sku, vendas: dados.qtd }))
      .sort((a, b) => b.vendas - a.vendas)
      .slice(0, 5);

    const { precos } = await carregarProdutosEMetas(uid);
    rentabilidade = Object.entries(mapa)
      .map(([sku, dados]) => {
        const custo = (precos[sku] || 0) * dados.qtd;
        const lucro = dados.valor - custo;
        const margem = dados.valor ? (lucro / dados.valor) * 100 : 0;
        return { sku, receita: dados.valor, custo, lucro, margem };
      })
      .sort((a, b) => b.lucro - a.lucro);
    topRentaveis = rentabilidade.slice(0, 5);
  } catch (err) {
    console.error('Erro ao carregar skus vendidos', err);
  }

  dashboardData = {
    nomeEmpresa,
    responsavel,
    mesAtual,
    totalBruto,
    totalLiquido,
    totalUnidades,
    ticketMedio,
    meta,
    totalSaques,
    diarioBruto,
    diarioLiquido,
    porLoja,
    cancelamentosDiario,
    comparativo,
    topProdutos,
    produtosCriticos,
    topSkus,
    rentabilidade,
    topRentaveis
  };
  window.dashboardData = dashboardData;

  renderKpis(totalBruto, totalLiquido, totalUnidades, ticketMedio, meta, diasAcima, diasAbaixo, totalSaques);
  renderCharts(diarioBruto, diarioLiquido, diasAcima, diasAbaixo, porLoja);
  renderTopSkus(topSkus);
  renderRentabilidade(rentabilidade, topRentaveis);
  renderTopSkusComparativo(topSkus, rentabilidade);
  renderComparativoMeta(totalLiquido, meta, diarioLiquido, totalDiasMes, mesAtual);
  carregarPrevisaoDashboard(uid, baseDate);
  setupTabs();
  setupSubTabs();
}

function renderKpis(bruto, liquido, unidades, ticket, meta, diasAcima, diasAbaixo, saques) {
  const pctBruto = meta ? (bruto / meta) * 100 : 0;
  const pctLiquido = meta ? (liquido / meta) * 100 : 0;
  const kpis = document.getElementById('kpis');
  if (!kpis) return;
  kpis.innerHTML = `
    <div class="bg-white rounded-2xl shadow-lg p-4">
      <h3 class="text-sm text-gray-500">Faturamento Bruto</h3>
      <p class="text-2xl font-semibold text-blue-600">R$ ${bruto.toLocaleString('pt-BR')}</p>
    </div>
    <div class="bg-white rounded-2xl shadow-lg p-4">
      <h3 class="text-sm text-gray-500">Faturamento Líquido</h3>
      <p class="text-2xl font-semibold text-blue-600">R$ ${liquido.toLocaleString('pt-BR')}</p>
    </div>
    <div class="bg-white rounded-2xl shadow-lg p-4">
      <h3 class="text-sm text-gray-500">Unidades Vendidas</h3>
      <p class="text-2xl font-semibold text-orange-500">${unidades}</p>
    </div>
    <div class="bg-white rounded-2xl shadow-lg p-4">
      <h3 class="text-sm text-gray-500">Ticket Médio</h3>
      <p class="text-2xl font-semibold text-gray-700">R$ ${ticket.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
    </div>
    <div class="bg-white rounded-2xl shadow-lg p-4">
      <h3 class="text-sm text-gray-500">% Meta Atingida Bruto</h3>
      <p class="text-2xl font-semibold ${pctBruto >= 100 ? 'text-green-600' : 'text-red-600'}">${pctBruto.toFixed(1)}%</p>
    </div>
    <div class="bg-white rounded-2xl shadow-lg p-4">
      <h3 class="text-sm text-gray-500">% Meta Atingida Líquido</h3>
      <p class="text-2xl font-semibold ${pctLiquido >= 100 ? 'text-green-600' : 'text-red-600'}">${pctLiquido.toFixed(1)}%</p>
    </div>
    <div class="bg-white rounded-2xl shadow-lg p-4">
      <h3 class="text-sm text-gray-500">Dias Acima da Meta</h3>
      <p class="text-2xl font-semibold text-green-600">${diasAcima}</p>
    </div>
    <div class="bg-white rounded-2xl shadow-lg p-4">
      <h3 class="text-sm text-gray-500">Dias Abaixo da Meta</h3>
      <p class="text-2xl font-semibold text-red-600">${diasAbaixo}</p>
    </div>
    <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div class="bg-gray-100 px-4 py-2">
        <h3 class="text-sm text-gray-500">Total Saques</h3>
      </div>
      <div class="p-4">
        <p class="text-2xl font-semibold text-gray-700">R$ ${saques.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
      </div>
    </div>
  `;
}

function renderCharts(diarioBruto, diarioLiquido, diasAcima, diasAbaixo, porLoja) {
  const dias = Object.keys(diarioBruto).sort();
  const ctxLinhas = document.getElementById('evolucaoChart');
  if (ctxLinhas) {
    new Chart(ctxLinhas, {
      type: 'line',
      data: {
        labels: dias.map(d => new Date(d).toLocaleDateString('pt-BR')),
        datasets: [
          {
            label: 'Bruto',
            data: dias.map(d => diarioBruto[d]),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.2)',
            tension: 0.3
          },
          {
            label: 'Líquido',
            data: dias.map(d => diarioLiquido[d]),
            borderColor: '#f97316',
            backgroundColor: 'rgba(249,115,22,0.2)',
            tension: 0.3
          }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const ctxBar = document.getElementById('diasMetaChart');
  if (ctxBar) {
    new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: ['Acima da Meta', 'Abaixo da Meta'],
        datasets: [{
          data: [diasAcima, diasAbaixo],
          backgroundColor: ['#86efac', '#fca5a5']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const ctxPie = document.getElementById('lojasPieChart');
  if (ctxPie) {
    const lojas = Object.keys(porLoja);
    new Chart(ctxPie, {
      type: 'pie',
      data: {
        labels: lojas,
        datasets: [{
          data: lojas.map(l => porLoja[l]),
          backgroundColor: ['#3b82f6','#f97316','#6366f1','#10b981','#f59e0b','#ef4444']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const ctxMargem = document.getElementById('margemChart');
  if (ctxMargem) {
    const margens = dias.map(d => {
      const bruto = diarioBruto[d] || 0;
      const liquido = diarioLiquido[d] || 0;
      return bruto ? (liquido / bruto) * 100 : 0;
    });
    new Chart(ctxMargem, {
      type: 'line',
      data: {
        labels: dias.map(d => new Date(d).toLocaleDateString('pt-BR')),
        datasets: [{
          label: 'Margem (%)',
          data: margens,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.2)',
          tension: 0.3
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

function renderTopSkus(lista) {
  const el = document.getElementById('topSkusList');
  if (!el) return;
  el.innerHTML = lista
    .map(p => `<li>${p.sku} - ${p.vendas}</li>`)
    .join('');
}

function renderTopSkusComparativo(lista, rentabilidade) {
  const ctx = document.getElementById('topSkusMargemChart');
  if (!ctx) return;
  const labels = lista.map(p => p.sku);
  const vendas = lista.map(p => p.vendas);
  const margens = lista.map(p => {
    const r = rentabilidade.find(x => x.sku === p.sku);
    return r ? r.margem : 0;
  });
  new Chart(ctx, {
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Vendas', data: vendas, backgroundColor: '#3b82f6', yAxisID: 'y' },
        { type: 'line', label: 'Margem (%)', data: margens, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.2)', yAxisID: 'y1', tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, position: 'left' },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%' } }
      }
    }
  });
}

function renderRentabilidade(lista, top5) {
  const tbody = document.getElementById('tabelaRentabilidade');
  if (tbody) {
    tbody.innerHTML = lista
      .map(p => `
        <tr>
          <td class="px-3 py-2">${p.sku}</td>
          <td class="px-3 py-2 text-right">R$ ${p.receita.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td class="px-3 py-2 text-right">R$ ${p.custo.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td class="px-3 py-2 text-right">R$ ${p.lucro.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          <td class="px-3 py-2 text-right">${p.margem.toFixed(1)}%</td>
        </tr>
      `)
      .join('');
  }
  const topEl = document.getElementById('topRentaveis');
  if (topEl) {
    topEl.innerHTML = top5
      .map(p => `<li>${p.sku} - R$ ${p.lucro.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</li>`)
      .join('');
  }
}

function renderComparativoMeta(liquido, meta, diarioLiquido, totalDiasMes, mesAtual) {
  const barCtx = document.getElementById('metaComparativoChart');
  if (barCtx) {
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Meta', 'Realizado'],
        datasets: [{
          label: 'Valor (R$)',
          data: [meta, liquido],
          backgroundColor: ['#9ca3af', '#3b82f6']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const semanaCtx = document.getElementById('progressoSemanalChart');
  if (semanaCtx) {
    const metaDiaria = meta / totalDiasMes;
    const totalSemanas = Math.ceil(totalDiasMes / 7);
    const labels = [];
    const metaAcum = [];
    const realAcum = [];
    let acumulado = 0;
    for (let s = 1; s <= totalSemanas; s++) {
      const inicio = (s - 1) * 7 + 1;
      const fim = Math.min(s * 7, totalDiasMes);
      for (let dia = inicio; dia <= fim; dia++) {
        const chave = `${mesAtual}-${String(dia).padStart(2, '0')}`;
        acumulado += diarioLiquido[chave] || 0;
      }
      labels.push(`Semana ${s}`);
      realAcum.push(acumulado);
      metaAcum.push(metaDiaria * fim);
    }
    new Chart(semanaCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Realizado',
            data: realAcum,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.2)',
            tension: 0.3
          },
          {
            label: 'Meta',
            data: metaAcum,
            borderColor: '#9ca3af',
            backgroundColor: 'rgba(156,163,175,0.2)',
            tension: 0.3
          }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

function setupTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const tabs = {
    overview: document.getElementById('tab-overview'),
    meta: document.getElementById('tab-meta'),
    estrategica: document.getElementById('tab-estrategica')
  };
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white');
        b.classList.add('bg-gray-300', 'text-gray-700');
      });
      btn.classList.add('bg-blue-600', 'text-white');
      btn.classList.remove('bg-gray-300', 'text-gray-700');
      Object.values(tabs).forEach(t => t.classList.add('hidden'));
      const alvo = tabs[btn.dataset.tab];
      if (alvo) alvo.classList.remove('hidden');
    });
  });
}

function setupSubTabs() {
  const buttons = document.querySelectorAll('.subtab-btn');
  const tabs = {
    resumo: document.getElementById('subtab-resumo'),
    desempenho: document.getElementById('subtab-desempenho'),
    previsao: document.getElementById('subtab-previsao')
  };
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white');
        b.classList.add('bg-gray-300', 'text-gray-700');
      });
      btn.classList.add('bg-blue-600', 'text-white');
      btn.classList.remove('bg-gray-300', 'text-gray-700');
      Object.values(tabs).forEach(t => t.classList.add('hidden'));
      const alvo = tabs[btn.dataset.subtab];
      if (alvo) alvo.classList.remove('hidden');
    });
  });
}

async function carregarPrevisaoDashboard(uid, baseDate = new Date()) {
  const cards = document.getElementById('cardsPrevisao');
  const container = document.getElementById('topSkusPrevisao');
  const chartEl = document.getElementById('previsaoChart');
  if (!cards || !container) return;
  cards.innerHTML = '🔄 Carregando...';
  container.innerHTML = '';

  const proxMes = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  const anoMes = proxMes.toISOString().slice(0,7);

  try {
    const docSnap = await getDoc(doc(db, `uid/${uid}/previsoes`, anoMes));
    if (!docSnap.exists()) {
      cards.innerHTML = '<p class="text-gray-500">Nenhuma previsão disponível.</p>';
      return;
    }
    const previsao = docSnap.data() || {};
    renderPrevisaoCards(cards, previsao);
    renderPrevisaoChart(chartEl, previsao);
    const { precos, metas } = await carregarProdutosEMetas(uid);
    renderPrevisaoTopSkus(container, previsao, precos, metas);
  } catch (err) {
    console.error('Erro ao carregar previsão', err);
    cards.innerHTML = '<p class="text-red-500">Erro ao carregar previsão</p>';
  }
}

async function carregarProdutosEMetas(uid) {
  const precos = {};
  try {
    const snap = await getDocs(collection(db, `uid/${uid}/produtos`));
    for (const p of snap.docs) {
      let d = p.data();
      if (d.encrypted) {
        const pass = getPassphrase() || `chave-${uid}`;
        let txt;
        try { txt = await decryptString(d.encrypted, pass); }
        catch (e) {
          try { txt = await decryptString(d.encrypted, uid); } catch (_) {}
        }
        if (txt) d = JSON.parse(txt);
      }
      const sku = d.sku || p.id;
      precos[sku] = Number(d.custo) || 0;
    }
  } catch (err) {
    console.error('Erro ao carregar produtos', err);
  }

  const metas = {};
  try {
    const q = query(collection(db, 'metasSKU'), where('uid', '==', uid));
    const metasSnap = await getDocs(q);
    metasSnap.forEach(m => {
      const originalSku = m.id.replaceAll('__','/');
      metas[originalSku] = Number(m.data().valor) || 0;
    });
  } catch (err) {
    console.error('Erro ao carregar metasSKU', err);
  }

  Object.keys(precos).forEach(sku => {
    if (metas[sku] === undefined) metas[sku] = precos[sku];
  });
  return { precos, metas };
}

function renderPrevisaoCards(el, previsao) {
  const base = previsao.totalGeral || 0;
  const pess = base * 0.85;
  const otm = base * 1.15;
  el.innerHTML = `
    <div class="bg-red-100 text-red-800 p-4 rounded shadow text-center">
      <div class="font-bold">Pessimista</div><div>${pess.toFixed(0)}</div>
    </div>
    <div class="bg-blue-100 text-blue-800 p-4 rounded shadow text-center">
      <div class="font-bold">Base</div><div>${base.toFixed(0)}</div>
    </div>
    <div class="bg-green-100 text-green-800 p-4 rounded shadow text-center">
      <div class="font-bold">Otimista</div><div>${otm.toFixed(0)}</div>
    </div>`;
}

function renderPrevisaoChart(canvas, previsao) {
  if (!canvas) return;
  const base = previsao.totalGeral || 0;
  const pess = base * 0.85;
  const otm = base * 1.15;
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Pessimista', 'Base', 'Otimista'],
      datasets: [{
        label: 'Projeção',
        data: [pess, base, otm],
        backgroundColor: ['#f87171', '#60a5fa', '#34d399']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderPrevisaoTopSkus(container, previsao, precos, metas) {
  const dadosSkus = Object.entries(previsao.skus || {});
  if (!dadosSkus.length) {
    container.innerHTML = '<p class="text-gray-500">Nenhuma previsão disponível.</p>';
    return;
  }

  const cenarios = [
    { titulo: 'Pessimista', fator: 0.85 },
    { titulo: 'Base', fator: 1 },
    { titulo: 'Otimista', fator: 1.15 }
  ];

  const tabelas = cenarios.map(c => {
    const lista = dadosSkus
      .map(([sku, info]) => {
        const quantidade = (info.total || 0) * c.fator;
        const preco = precos[sku] || 0;
        const sobraUnit = metas[sku] || 0;
        const bruto = quantidade * preco;
        const sobra = quantidade * sobraUnit;
        return { sku, quantidade, bruto, sobra };
      })
      .sort((a,b) => b.quantidade - a.quantidade)
      .slice(0,5);

    if (!lista.length) {
      return '<p class="text-gray-500">Nenhuma previsão disponível.</p>';
    }

    const linhas = lista.map(item => `
        <tr>
          <td class="px-2 py-1 border">${item.sku}</td>
          <td class="px-2 py-1 border">${item.quantidade.toFixed(0)}</td>
          <td class="px-2 py-1 border">R$ ${item.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          <td class="px-2 py-1 border">R$ ${item.sobra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>`).join('');

    return `
      <div class="overflow-x-auto">
        <h4 class="font-bold mb-2 text-center">Top 5 SKUs projeção ${c.titulo}</h4>
        <table class="min-w-full text-sm text-left">
          <thead>
            <tr>
              <th class="px-2 py-1 border">SKU</th>
              <th class="px-2 py-1 border">Quantidade</th>
              <th class="px-2 py-1 border">Bruto Esperado<br>(Valor de venda)</th>
              <th class="px-2 py-1 border">Sobra Esperada<br>(Sobra esperada x quantidade)</th>
            </tr>
          </thead>
          <tbody>
            ${linhas}
          </tbody>
        </table>
      </div>`;
  }).join('');

  container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">${tabelas}</div>`;
}

document.getElementById('exportarFechamentoBtn')?.addEventListener('click', exportarFechamentoMes);

function exportarFechamentoMes() {
  if (!dashboardData || !dashboardData.mesAtual) return;
  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.width = '190mm';
  container.style.margin = '0 auto';
  container.style.boxSizing = 'border-box';
  container.innerHTML = gerarHTMLFechamento();
  document.body.appendChild(container);

  const compCtx = container.querySelector('#comparativoChart');
  if (compCtx) {
    const meses = Object.keys(dashboardData.comparativo).sort();
    new Chart(compCtx, {
      type: 'bar',
      data: {
        labels: meses.map(m => m.split('-').reverse().join('/')),
        datasets: [{
          label: 'Líquido',
          data: meses.map(m => dashboardData.comparativo[m]),
          backgroundColor: '#3b82f6'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const cancelCtx = container.querySelector('#cancelamentoChart');
  if (cancelCtx) {
    const dias = Object.keys(dashboardData.cancelamentosDiario).sort();
    new Chart(cancelCtx, {
      type: 'line',
      data: {
        labels: dias.map(d => new Date(d).toLocaleDateString('pt-BR')),
        datasets: [
          {
            label: 'Cancelado',
            data: dias.map(d => dashboardData.cancelamentosDiario[d]),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.2)',
            tension: 0.3
          },
          {
            label: 'Líquido',
            data: dias.map(d => dashboardData.diarioLiquido[d] || 0),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.2)',
            tension: 0.3
          }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  setTimeout(() => {
    html2pdf().set({
      margin: 10,
      filename: `fechamento-${dashboardData.mesAtual}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(container).save().then(() => container.remove());
  }, 500);
}

function gerarHTMLFechamento() {
  const d = dashboardData;
  const mesBR = new Date(d.mesAtual + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const pctMeta = d.meta ? ((d.totalLiquido / d.meta) * 100).toFixed(1) : '0';
  const dias = Object.keys(d.diarioLiquido).sort();
  const linhasDia = dias.map(di => `<tr><td>${new Date(di).toLocaleDateString('pt-BR')}</td><td>R$ ${(d.diarioBruto[di]||0).toLocaleString('pt-BR')}</td><td>R$ ${(d.diarioLiquido[di]||0).toLocaleString('pt-BR')}</td></tr>`).join('');
  const top = d.topProdutos.length
    ? d.topProdutos.map((p,i)=>`<tr><td>${i+1}</td><td>${p.nome}</td><td>${p.vendas}</td></tr>`).join('')
    : '<tr><td colspan="3">Nenhum produto</td></tr>';
  const criticos = d.produtosCriticos.map(p=>`<li>${p.nome} (Estoque: ${p.estoque})</li>`).join('') || '<li>Nenhum</li>';
  const destaques = d.totalLiquido >= d.meta ? 'Meta atingida no período.' : 'Meta não atingida.';
  const atencao = d.produtosCriticos.length ? 'Atenção aos produtos sem vendas com estoque disponível.' : 'Sem pontos de atenção.';

  return `
      <div style="font-family: Arial, sans-serif; width:100%; max-width:170mm; box-sizing:border-box;">
        <h1 style="text-align:center;">${d.nomeEmpresa || 'Empresa'}</h1>
      <h2 style="text-align:center;">Fechamento ${mesBR}</h2>
      <p style="text-align:center;">Responsável: ${d.responsavel || ''}</p>

      <h3>Resumo Executivo</h3>
      <ul>
        <li>Faturamento Bruto: R$ ${d.totalBruto.toLocaleString('pt-BR')}</li>
        <li>Faturamento Líquido: R$ ${d.totalLiquido.toLocaleString('pt-BR')}</li>
        <li>Ticket Médio: R$ ${d.ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</li>
        <li>Pedidos: ${d.totalUnidades}</li>
        <li>% Meta: ${pctMeta}%</li>
      </ul>
      <p><strong>Destaques:</strong> ${destaques}</p>
      <p><strong>Pontos de atenção:</strong> ${atencao}</p>

      <h3>Desempenho Diário</h3>
      <table border="1" cellspacing="0" cellpadding="4" style="width:100%; font-size:12px;">
        <tr><th>Dia</th><th>Bruto</th><th>Líquido</th></tr>
        ${linhasDia}
      </table>
      <img src="${document.getElementById('evolucaoChart').toDataURL('image/png')}" style="width:100%; height:auto; max-height:300px; page-break-inside:avoid;"/>

      <h3>Comparativo Mensal</h3>
      <div style="width:100%;height:300px;page-break-inside:avoid"><canvas id="comparativoChart"></canvas></div>

      <h3>Ranking de Produtos</h3>
      <table border="1" cellspacing="0" cellpadding="4" style="width:100%; font-size:12px;">
        <tr><th>#</th><th>Produto</th><th>Vendas</th></tr>
        ${top}
      </table>
      <h4>Produtos Críticos</h4>
      <ul>${criticos}</ul>

      <h3>Cancelamentos e Taxas</h3>
      <div style="width:100%;height:300px;page-break-inside:avoid"><canvas id="cancelamentoChart"></canvas></div>

      <h3>Projeção e Recomendações</h3>
      <p>Meta sugerida para o próximo mês: R$ ${(d.totalLiquido*1.05).toLocaleString('pt-BR')}</p>
      <ul>
        <li>Investir em produto ${d.topProdutos[0]?.nome || '-'}</li>
        <li>Revisar preço de ${d.topProdutos[1]?.nome || '-'}</li>
        <li>Melhorar estoque de ${d.produtosCriticos[0]?.nome || '-'}</li>
      </ul>
    </div>
  `;
}

const filtroMes = document.getElementById('filtroMes');
if (filtroMes) {
  filtroMes.value = new Date().toISOString().slice(0,7);
}

onAuthStateChanged(auth, user => {
  if (user) {
    const mesInicial = filtroMes?.value;
    carregarDashboard(user, mesInicial);
    filtroMes?.addEventListener('change', () => {
      carregarDashboard(user, filtroMes.value);
    });
  }
});

