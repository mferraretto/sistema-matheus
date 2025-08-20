import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { loadSecureDoc } from './secure-firestore.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { decryptString } from './crypto.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let usuariosCache = [];
let dadosSkusExport = [];
let dadosSaquesExport = [];
let dadosFaturamentoExport = [];
let resumoUsuarios = {};
let kpiUnsubs = [];
let vendasChart;

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  let usuarios = [{ uid: user.uid, nome: user.displayName || user.email }];
  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', user.email)));
    if (!snap.empty) {
      usuarios = snap.docs.map(d => ({ uid: d.id, nome: d.data().nome || d.id }));
    }
  } catch (err) {
    console.error('Erro ao verificar acesso financeiro:', err);
  }
  usuariosCache = usuarios;
  setupFiltros(usuarios);
  await carregar();
  initFaturamentoFeed(usuarios);
  initKpiRealtime();
});

function setupFiltros(usuarios) {
  const userSel = document.getElementById('usuarioFiltro');
  const mesSel = document.getElementById('mesFiltro');
  const metaSection = document.getElementById('metaSection');
  const metaInput = document.getElementById('metaValor');
  const salvarMetaBtn = document.getElementById('salvarMeta');
  if (!userSel || !mesSel) return;
  userSel.innerHTML = '';
  const optTodos = document.createElement('option');
  optTodos.value = 'todos';
  optTodos.textContent = 'Todos';
  userSel.appendChild(optTodos);
  usuarios.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.uid;
    opt.textContent = u.nome;
    userSel.appendChild(opt);
  });
  userSel.value = 'todos';
  mesSel.value = new Date().toISOString().slice(0,7);

  async function atualizarMeta() {
    if (!metaSection) return;
    if (userSel.value === 'todos') {
      metaSection.classList.add('hidden');
      if (metaInput) metaInput.value = '';
      return;
    }
    metaSection.classList.remove('hidden');
    if (!metaInput) return;
    try {
      const metaDoc = await getDoc(doc(db, `uid/${userSel.value}/metasFaturamento`, mesSel.value));
      metaInput.value = metaDoc.exists() ? metaDoc.data().valor || '' : '';
    } catch (_) {
      metaInput.value = '';
    }
  }

  userSel.addEventListener('change', () => { atualizarMeta(); atualizarContexto(); carregar(); });
  mesSel.addEventListener('change', () => { atualizarMeta(); atualizarContexto(); carregar(); });
  if (salvarMetaBtn) salvarMetaBtn.addEventListener('click', salvarMeta);
  atualizarMeta();
  atualizarContexto();

}

async function salvarMeta() {
  const uid = document.getElementById('usuarioFiltro')?.value;
  const mes = document.getElementById('mesFiltro')?.value;
  const input = document.getElementById('metaValor');
  const valor = Number(input?.value || 0);
  if (!uid || uid === 'todos') {
    alert('Selecione um usuário');
    return;
  }
  if (!mes) {
    alert('Selecione um mês');
    return;
  }
  try {
    await setDoc(doc(db, `uid/${uid}/metasFaturamento`, mes), { valor });
    alert('Meta salva com sucesso!');
    await carregar();
  } catch (err) {
    console.error('Erro ao salvar meta:', err);
    alert('Erro ao salvar meta');
  }
}

async function carregar() {
  const mesSel = document.getElementById('mesFiltro');
  let mes = mesSel?.value;
  if (!mes) {
    mes = new Date().toISOString().slice(0,7);
    if (mesSel) mesSel.value = mes;
  }
  const uid = document.getElementById('usuarioFiltro')?.value || 'todos';
  const listaUsuarios = uid === 'todos' ? usuariosCache : usuariosCache.filter(u => u.uid === uid);
  atualizarContexto();
  resumoUsuarios = {};
  listaUsuarios.forEach(u => resumoUsuarios[u.uid] = { uid: u.uid, nome: u.nome });
  await carregarSkus(listaUsuarios, mes);
  await carregarSaques(listaUsuarios, mes);
  await carregarFaturamentoMeta(listaUsuarios, mes);
  renderResumoUsuarios(Object.values(resumoUsuarios));
}

function atualizarContexto() {
  const contextoEl = document.getElementById('contexto');
  const mes = document.getElementById('mesFiltro')?.value;
  const uid = document.getElementById('usuarioFiltro')?.value;
  if (!contextoEl) return;
  const mesTxt = mes ? new Date(mes + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '';
  let usuarioTxt = 'Todos os usuários';
  if (uid && uid !== 'todos') {
    const u = usuariosCache.find(x => x.uid === uid);
    usuarioTxt = u ? u.nome : uid;
  }
  contextoEl.textContent = `${mesTxt} – ${usuarioTxt}`;
}

async function carregarSkus(usuarios, mes) {
  dadosSkusExport = [];
  for (const usuario of usuarios) {
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/skusVendidos`));
    const produtosSnap = await getDocs(collection(db, `uid/${usuario.uid}/produtos`));
    const custos = {};
    produtosSnap.forEach(p => {
      const dados = p.data();
      const chave = dados.sku || p.id;
      custos[chave] = Number(dados.custo || 0);
    });
    const resumo = {};
    for (const docSnap of snap.docs) {
      if (mes && !docSnap.id.includes(mes)) continue;
      const listaRef = collection(db, `uid/${usuario.uid}/skusVendidos/${docSnap.id}/lista`);
      const listaSnap = await getDocs(listaRef);
      listaSnap.forEach(item => {
        const dados = item.data();
        const sku = dados.sku || 'sem-sku';
        const qtd = Number(dados.total || dados.quantidade) || 0;
        const sobraReal = Number(dados.valorLiquido || dados.sobraReal || 0);
        const custo = custos[sku] || 0;
        const sobraEsperada = qtd * custo;
        if (!resumo[sku]) resumo[sku] = { qtd: 0, sobraEsperada: 0, sobraReal: 0 };
        resumo[sku].qtd += qtd;
        resumo[sku].sobraEsperada += sobraEsperada;
        resumo[sku].sobraReal += sobraReal;
      });
    }
    let totalUnidades = 0;
    let topSku = '-';
    let topQtd = 0;
    Object.entries(resumo).forEach(([sku, info]) => {
      totalUnidades += info.qtd;
      if (info.qtd > topQtd) {
        topSku = sku;
        topQtd = info.qtd;
      }
      dadosSkusExport.push({ usuario: usuario.nome, sku, quantidade: info.qtd, sobraEsperada: info.sobraEsperada, sobraReal: info.sobraReal });
    });
    resumoUsuarios[usuario.uid].skus = {
      topSku,
      totalSkus: Object.keys(resumo).length,
      totalUnidades
    };
    resumoUsuarios[usuario.uid].skusDetalhes = resumo;
  }
}

async function carregarSaques(usuarios, mes) {
  dadosSaquesExport = [];
  for (const usuario of usuarios) {
    const pass = getPassphrase() || `chave-${usuario.uid}`;
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/saques`));
    let total = 0;
    let totalComissao = 0;
    let qtdSaques = 0;
    const detalhes = [];
    for (const docSnap of snap.docs) {
      if (mes && !docSnap.id.includes(mes)) continue;
      const dados = await loadSecureDoc(db, `uid/${usuario.uid}/saques`, docSnap.id, pass);
      if (!dados) continue;
      const docTotal = dados.valorTotal || 0;
      let docComissao = 0;
      qtdSaques++;
      const lojasSnap = await getDocs(collection(db, `uid/${usuario.uid}/saques/${docSnap.id}/lojas`));
      for (const lojaDoc of lojasSnap.docs) {
        const lojaDados = await loadSecureDoc(db, `uid/${usuario.uid}/saques/${docSnap.id}/lojas`, lojaDoc.id, pass);
        if (!lojaDados) continue;
        const valor = lojaDados.valor || 0;
        const comissao = lojaDados.comissao || 0;
        docComissao += valor * (comissao / 100);
      }
      total += docTotal;
      totalComissao += docComissao;
      detalhes.push({ data: docSnap.id, valor: docTotal, comissao: docComissao });
    }
    dadosSaquesExport.push({ usuario: usuario.nome, total, comissao: totalComissao });
    resumoUsuarios[usuario.uid].saques = {
      total,
      comissao: totalComissao,
      qtdSaques
    };
    resumoUsuarios[usuario.uid].saquesDetalhes = detalhes;
  }
}

async function carregarFaturamentoMeta(usuarios, mes) {
  dadosFaturamentoExport = [];
  for (const usuario of usuarios) {
    let total = 0;
    const diario = {};
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/faturamento`));
    for (const docSnap of snap.docs) {
      if (mes && !docSnap.id.includes(mes)) continue;
      const lojasSnap = await getDocs(collection(db, `uid/${usuario.uid}/faturamento/${docSnap.id}/lojas`));
      let totalDia = 0;
      for (const lojaDoc of lojasSnap.docs) {
        let dados = lojaDoc.data();
        if (dados.encrypted) {
          const pass = getPassphrase() || `chave-${usuario.uid}`;
          let txt;
          try {
            txt = await decryptString(dados.encrypted, pass);
          } catch (e) {
            try { txt = await decryptString(dados.encrypted, usuario.uid); } catch (_) {}
          }
          if (txt) dados = JSON.parse(txt);
        }
        totalDia += Number(dados.valorLiquido) || 0;
      }
      total += totalDia;
      diario[docSnap.id] = totalDia;
    }
    let meta = 0;
    let esperado = 0;
    let diferenca = 0;
    let metaDiaria = 0;
    try {
      const metaDoc = await getDoc(doc(db, `uid/${usuario.uid}/metasFaturamento`, mes));
      if (metaDoc.exists()) meta = Number(metaDoc.data().valor) || 0;
    } catch (err) {
      console.error('Erro ao buscar meta de faturamento:', err);
    }
    if (meta && mes) {
      const [ano, mesNum] = mes.split('-').map(Number);
      const totalDias = new Date(ano, mesNum, 0).getDate();
      let diasDecorridos = totalDias;
      const hoje = new Date();
      if (mes === hoje.toISOString().slice(0,7)) diasDecorridos = hoje.getDate();
      metaDiaria = meta / totalDias;
      esperado = metaDiaria * diasDecorridos;
      diferenca = total - esperado;
    }
    dadosFaturamentoExport.push({ usuario: usuario.nome, faturado: total, meta, esperado, diferenca });
    resumoUsuarios[usuario.uid].faturamento = {
      faturado: total,
      meta,
      esperado,
      diferenca
    };
    resumoUsuarios[usuario.uid].faturamentoDetalhes = { diario, metaDiaria };
  }
}

async function calcularFaturamentoDia(uid, dia) {
  const lojasSnap = await getDocs(collection(db, `uid/${uid}/faturamento/${dia}/lojas`));
  let totalDia = 0;
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
    totalDia += Number(dados.valorLiquido) || 0;
  }
  return totalDia;
}

function initFaturamentoFeed(usuarios) {
  const card = document.getElementById('faturamentoUpdatesCard');
  const feed = document.getElementById('faturamentoFeed');
  if (!card || !feed) return;
  feed.innerHTML = '';
  usuarios.forEach(u => {
    const ref = collection(db, `uid/${u.uid}/faturamento`);
    let initialized = false;
    onSnapshot(ref, snapshot => {
      if (!initialized) { initialized = true; return; }
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added' || change.type === 'modified') {
          const totalDia = await calcularFaturamentoDia(u.uid, change.doc.id);
          const item = document.createElement('div');
          item.className = 'border-b pb-1 text-sm';
          item.textContent = `${u.nome} - ${formatarData(change.doc.id)}: R$ ${totalDia.toLocaleString('pt-BR')}`;
          feed.prepend(item);
          card.classList.remove('hidden');
          while (feed.children.length > 20) feed.removeChild(feed.lastChild);
        }
      });
    });
  });
}

function initKpiRealtime() {
  const userSel = document.getElementById('usuarioFiltro');
  const mesSel = document.getElementById('mesFiltro');
  if (userSel) userSel.addEventListener('change', subscribeKPIs);
  if (mesSel) mesSel.addEventListener('change', subscribeKPIs);
  subscribeKPIs();
}

function subscribeKPIs() {
  kpiUnsubs.forEach(fn => fn());
  kpiUnsubs = [];
  const uid = document.getElementById('usuarioFiltro')?.value;
  const mes = document.getElementById('mesFiltro')?.value;
  const vendasEl = document.getElementById('kpiVendasDia');
  const metaEl = document.getElementById('kpiMetaAtingida');
  const metaBar = document.getElementById('kpiMetaProgress');
  const metaWrap = document.getElementById('kpiMetaProgressWrapper');
  const devEl = document.getElementById('kpiDevolucoes');
  if (!vendasEl || !metaEl || !devEl) return;
  if (!uid || uid === 'todos') {
    vendasEl.textContent = '-';
    metaEl.textContent = '-';
    devEl.textContent = '-';
    return;
  }
  const diaAtual = new Date().toISOString().slice(0,10);
  let metaValor = 0;
  const metaRef = doc(db, `uid/${uid}/metasFaturamento`, mes);
  const unsubMeta = onSnapshot(metaRef, snap => {
    metaValor = snap.exists() ? Number(snap.data().valor) || 0 : 0;
  });
  kpiUnsubs.push(unsubMeta);

  const faturamentoRef = collection(db, `uid/${uid}/faturamento`);
  const unsubFat = onSnapshot(faturamentoRef, async snap => {
    let totalMes = 0;
    let vendasDia = 0;
    const diarios = [];
    for (const d of snap.docs) {
      if (mes && !d.id.includes(mes)) continue;
      const totalDia = await calcularFaturamentoDia(uid, d.id);
      totalMes += totalDia;
      if (d.id === diaAtual) vendasDia = totalDia;
      diarios.push({ data: d.id, valor: totalDia });
    }
    vendasEl.textContent = `R$ ${vendasDia.toLocaleString('pt-BR')}`;
    const prog = metaValor ? Math.min(100, (totalMes / metaValor) * 100) : 0;
    metaEl.textContent = metaValor ? `${prog.toFixed(1)}%` : '0%';
    if (metaBar && metaWrap) {
      metaBar.style.width = `${prog.toFixed(0)}%`;
      metaWrap.classList.remove('text-green-600','text-yellow-500','text-red-600');
      metaEl.classList.remove('text-green-600','text-yellow-500','text-red-600');
      if (prog >= 100) {
        metaWrap.classList.add('text-green-600');
        metaEl.classList.add('text-green-600');
      } else if (prog >= 50) {
        metaWrap.classList.add('text-yellow-500');
        metaEl.classList.add('text-yellow-500');
      } else {
        metaWrap.classList.add('text-red-600');
        metaEl.classList.add('text-red-600');
      }
    }
    diarios.sort((a,b) => a.data.localeCompare(b.data));
    updateSalesChart(diarios.map(d => formatarData(d.data)), diarios.map(d => d.valor));
  });
  kpiUnsubs.push(unsubFat);

  const devolucoesRef = collection(db, `uid/${uid}/devolucoes`);
  const unsubDev = onSnapshot(devolucoesRef, snap => {
    const hoje = new Date().toISOString().slice(0,10);
    let qtd = 0;
    snap.forEach(docSnap => {
      if (docSnap.id.includes(hoje)) {
        const dados = docSnap.data();
        qtd += Number(dados.quantidade || dados.total || 1);
      }
    });
    devEl.textContent = qtd;
  });
  kpiUnsubs.push(unsubDev);
}

function updateSalesChart(labels, data) {
  const ctx = document.getElementById('vendasChart')?.getContext('2d');
  if (!ctx) return;
  if (vendasChart) {
    vendasChart.data.labels = labels;
    vendasChart.data.datasets[0].data = data;
    vendasChart.update();
  } else {
    vendasChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Vendas',
          data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.2)',
          tension: 0.3
        }]
      },
      options: { scales: { y: { beginAtZero: true } } }
    });
  }
}

function renderResumoUsuarios(lista) {
  const container = document.getElementById('cardsContainer');
  if (!container) return;
  container.innerHTML = '';
  lista.forEach(u => {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    row.appendChild(createSkusCard(u));
    row.appendChild(createSaquesCard(u));
    row.appendChild(createFaturamentoCard(u));
    container.appendChild(row);
  });
}

function createSkusCard(u) {
  const card = document.createElement('div');
  card.className = 'card card-blue';
  card.innerHTML = `
    <div class="card-header justify-between">
      <h2 class="text-lg font-bold flex items-center gap-2"><i class="fa fa-chart-bar"></i> ${u.nome} - SKUs Vendidos</h2>
      <button class="btn btn-secondary text-sm ver-mais">Ver mais</button>
    </div>
    <div class="card-body">
      <div class="grid grid-cols-3 text-center gap-2">
        <div>
          <div class="text-2xl font-extrabold">${u.skus?.topSku || '-'}</div>
          <div class="text-sm text-gray-500">Top SKU</div>
        </div>
        <div>
          <div class="text-2xl font-extrabold">${u.skus?.totalSkus || 0}</div>
          <div class="text-sm text-gray-500">SKUs</div>
        </div>
        <div>
          <div class="text-2xl font-extrabold">${u.skus?.totalUnidades || 0}</div>
          <div class="text-sm text-gray-500">Unidades</div>
        </div>
      </div>
    </div>`;
  card.querySelector('.ver-mais')?.addEventListener('click', () => {
    const detalhes = u.skusDetalhes || {};
    const linhas = Object.entries(detalhes)
      .map(([sku, info]) => `<tr><td>${sku}</td><td>${info.qtd}</td><td>R$ ${info.sobraEsperada.toLocaleString('pt-BR')}</td><td>R$ ${info.sobraReal.toLocaleString('pt-BR')}</td></tr>`)
      .join('');
    const tabela = `<table class="data-table w-full text-sm"><thead><tr><th>SKU</th><th>Unidades</th><th>Sobra Esperada</th><th>Sobra Real</th></tr></thead><tbody>${linhas}</tbody></table>`;
    showModal(`${u.nome} - SKUs Vendidos`, tabela);
  });
  return card;
}

function createSaquesCard(u) {
  const card = document.createElement('div');
  card.className = 'card card-green';
  card.innerHTML = `
    <div class="card-header justify-between">
      <h2 class="text-lg font-bold flex items-center gap-2"><i class="fa fa-money-bill-wave"></i> ${u.nome} - Saques e Comissões</h2>
      <button class="btn btn-secondary text-sm ver-mais">Ver mais</button>
    </div>
    <div class="card-body">
      <div class="grid grid-cols-3 text-center gap-2">
        <div>
          <div class="text-2xl font-extrabold text-green-600">R$ ${(u.saques?.total || 0).toLocaleString('pt-BR')}</div>
          <div class="text-sm text-gray-500">Total</div>
        </div>
        <div>
          <div class="text-2xl font-extrabold text-green-600">R$ ${(u.saques?.comissao || 0).toLocaleString('pt-BR')}</div>
          <div class="text-sm text-gray-500">Comissões</div>
        </div>
        <div>
          <div class="text-2xl font-extrabold">${u.saques?.qtdSaques || 0}</div>
          <div class="text-sm text-gray-500">Total de Saques</div>
        </div>
      </div>
    </div>`;
  card.querySelector('.ver-mais')?.addEventListener('click', () => {
    const detalhes = u.saquesDetalhes || [];
    const linhas = detalhes
      .map(d => `<tr><td>${formatarData(d.data)}</td><td>R$ ${d.valor.toLocaleString('pt-BR')}</td><td>R$ ${d.comissao.toLocaleString('pt-BR')}</td></tr>`)
      .join('');
    const tabela = `<table class="data-table w-full text-sm"><thead><tr><th>Data</th><th>Valor</th><th>Comissão</th></tr></thead><tbody>${linhas}</tbody></table>`;
    showModal(`${u.nome} - Saques`, tabela);
  });
  return card;
}

function createFaturamentoCard(u) {
  const card = document.createElement('div');
  card.className = 'card card-orange';
  const progresso = u.faturamento?.meta ? Math.min(100, (u.faturamento.faturado / u.faturamento.meta) * 100) : 0;
  const statusColor = progresso >= 100 ? 'text-green-600' : progresso >= 50 ? 'text-yellow-500' : 'text-red-600';
  card.innerHTML = `
    <div class="card-header justify-between">
      <h2 class="text-lg font-bold flex items-center gap-2"><i class="fa fa-chart-line"></i> ${u.nome} - Faturamento x Meta</h2>
      <button class="btn btn-secondary text-sm ver-mais">Ver mais</button>
    </div>
    <div class="card-body space-y-2">
      <div class="grid grid-cols-3 text-center gap-2">
        <div>
          <div class="text-2xl font-extrabold ${statusColor}">R$ ${(u.faturamento?.faturado || 0).toLocaleString('pt-BR')}</div>
          <div class="text-sm text-gray-500">Faturado</div>
        </div>
        <div>
          <div class="text-2xl font-extrabold">R$ ${(u.faturamento?.meta || 0).toLocaleString('pt-BR')}</div>
          <div class="text-sm text-gray-500">Meta</div>
        </div>
        <div>
          <div class="text-2xl font-extrabold">R$ ${(u.faturamento?.esperado || 0).toLocaleString('pt-BR')}</div>
          <div class="text-sm text-gray-500">Esperado até hoje</div>
        </div>
      </div>
      <div class="progress ${statusColor}"><div class="progress-bar" style="width: ${progresso.toFixed(0)}%"></div></div>
    </div>`;
  card.querySelector('.ver-mais')?.addEventListener('click', () => {
    const diario = u.faturamentoDetalhes?.diario || {};
    const metaDiaria = u.faturamentoDetalhes?.metaDiaria || 0;
    const linhas = Object.entries(diario)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, valor]) => {
        const diff = valor - metaDiaria;
        return `<tr><td>${formatarData(data)}</td><td>R$ ${valor.toLocaleString('pt-BR')}</td><td>R$ ${metaDiaria.toLocaleString('pt-BR')}</td><td>R$ ${diff.toLocaleString('pt-BR')}</td></tr>`;
      })
      .join('');
    const tabela = `<table class="data-table w-full text-sm"><thead><tr><th>Data</th><th>Faturado</th><th>Meta Diária</th><th>Diferença</th></tr></thead><tbody>${linhas}</tbody></table>`;
    showModal(`${u.nome} - Faturamento Diário`, tabela);
  });
  return card;
}

function formatarData(str) {
  // Evita problemas de fuso horário ao converter datas (ex.: "2024-05-01" 
  // sendo interpretado como 30/04 em localidades UTC-3). Quando a string
  // está no formato YYYY-MM-DD construímos a data utilizando o construtor
  // `new Date(ano, mesIndex, dia)` que considera o fuso local sem deslocar
  // para UTC.
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(str);
  if (match) {
    const [_, a, m, d] = match;
    const data = new Date(Number(a), Number(m) - 1, Number(d));
    return data.toLocaleDateString('pt-BR');
  }
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleDateString('pt-BR');
}

function showModal(titulo, corpo) {
  let modal = document.getElementById('detalhesModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'detalhesModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3 id="detalhesTitulo" class="text-xl font-bold mb-4"></h3>
        <div id="detalhesCorpo" class="space-y-2"></div>
        <div class="mt-4 text-right">
          <button id="detalhesFechar" class="btn btn-primary">Fechar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    modal.querySelector('#detalhesFechar').addEventListener('click', () => modal.style.display = 'none');
  }
  modal.querySelector('#detalhesTitulo').textContent = titulo;
  modal.querySelector('#detalhesCorpo').innerHTML = corpo;
  modal.style.display = 'flex';
}

function exportarSkus() {
  if (!dadosSkusExport.length) {
    alert('Sem dados para exportar');
    return;
  }
  exportarCSV(dadosSkusExport, ['usuario','sku','quantidade','sobraEsperada','sobraReal'], 'skus_vendidos');
}

function exportarSaques() {
  if (!dadosSaquesExport.length) {
    alert('Sem dados para exportar');
    return;
  }
  exportarCSV(dadosSaquesExport, ['usuario','total','comissao'], 'saques');
}

function exportarFaturamento() {
  if (!dadosFaturamentoExport.length) {
    alert('Sem dados para exportar');
    return;
  }
  exportarCSV(dadosFaturamentoExport, ['usuario','faturado','meta','esperado','diferenca'], 'faturamento_meta');
}

function exportarCSV(dados, campos, nome) {
  const linhas = [campos.join(';')];
  dados.forEach(l => {
    linhas.push(campos.map(c => l[c]).join(';'));
  });
  const csv = linhas.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

