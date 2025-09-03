import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { decryptString } from './crypto.js';
import { loadSecureDoc } from './secure-firestore.js';
import { atualizarSaque as atualizarSaqueSvc, watchResumoMes as watchResumoMesSvc } from './comissoes-service.js';

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
let resumoUnsub = null;
let currentUser = null;

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  currentUser = user;
  let usuarios = [{ uid: user.uid, nome: user.displayName || user.email }];
  try {
    const [snapUsuarios, snapUid] = await Promise.all([
      getDocs(query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', user.email))),
      getDocs(query(collection(db, 'uid'), where('responsavelFinanceiroEmail', '==', user.email)))
    ]);
    const docs = [...snapUsuarios.docs, ...snapUid.docs];
    if (docs.length) {
      const vistos = new Set();
      usuarios = await Promise.all(
        docs.filter(d => {
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
        })
      );
    }
  } catch (err) {
    console.error('Erro ao verificar acesso financeiro:', err);
  }
  usuariosCache = usuarios;
  setupFiltros(usuarios);
  await carregar();
  initFaturamentoFeed(usuarios);
  initKpiRealtime();
  initKpiVendasDetalhes();
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

  // Evita que cliques nesses filtros acionem links subjacentes
  userSel.addEventListener('click', e => e.stopPropagation());
  mesSel.addEventListener('click', e => e.stopPropagation());
  document.getElementById('usuarioIcon')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof userSel.showPicker === 'function') {
      userSel.showPicker();
    } else {
      userSel.focus();
    }
  });
  document.getElementById('mesIcon')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof mesSel.showPicker === 'function') {
      mesSel.showPicker();
    } else {
      mesSel.focus();
    }
  });

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
  await Promise.all([
    carregarSkus(listaUsuarios, mes),
    carregarSaques(listaUsuarios, mes),
    carregarFaturamentoMeta(listaUsuarios, mes),
    carregarDevolucoes(listaUsuarios, mes)
  ]);
  renderResumoUsuarios(Object.values(resumoUsuarios));
  renderTabelaSaques();
  if (uid !== 'todos') {
    assistirResumoFinanceiro(uid, mes);
  } else {
    if (resumoUnsub) resumoUnsub();
    const cards = document.getElementById('cardsResumoFinanceiro');
    const texto = document.getElementById('faltasTextoFinanceiro');
    const resumo = document.getElementById('resumoSaquesFinanceiro');
    if (cards) cards.innerHTML = '';
    if (texto) texto.textContent = '';
    if (resumo) resumo.textContent = '';
  }
  await Promise.all([
    renderVendasDiaAnterior(listaUsuarios),
    renderPedidosTinyHoje(listaUsuarios)
  ]);
}

function atualizarContexto() {
  const contextoEl = document.getElementById('contexto');
  const dataEl = document.getElementById('dataAtual');
  const mes = document.getElementById('mesFiltro')?.value;
  const uid = document.getElementById('usuarioFiltro')?.value;
  if (contextoEl) {
    const mesTxt = mes ? new Date(mes + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '';
    let usuarioTxt = 'Todos os usuários';
    if (uid && uid !== 'todos') {
      const u = usuariosCache.find(x => x.uid === uid);
      usuarioTxt = u ? u.nome : uid;
    }
    contextoEl.textContent = `${mesTxt} – ${usuarioTxt}`;
  }
  if (dataEl) {
    dataEl.textContent = `Hoje: ${new Date().toLocaleDateString('pt-BR')}`;
  }
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

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
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

async function carregarSkus(usuarios, mes) {
  dadosSkusExport = [];
  const resumoGeral = {};
  const mesData = mes ? new Date(mes + '-01') : null;
  await Promise.all(usuarios.map(async usuario => {
    const pass = getPassphrase() || `chave-${usuario.uid}`;
    const snap = await getDocs(collection(db, `usuarios/${usuario.uid}/pedidostiny`));
    const resumo = {};
    await Promise.all(snap.docs.map(async docSnap => {
      let pedido = await loadSecureDoc(db, `usuarios/${usuario.uid}/pedidostiny`, docSnap.id, pass);
      if (!pedido) {
        const raw = docSnap.data();
        if (raw && !raw.encrypted && !raw.encryptedData) pedido = raw;
      }
      if (!pedido) return;
      const dataStr = pedido.data || pedido.dataPedido || pedido.date || '';
      const data = parseDate(dataStr);
      if (mesData && !sameMonth(data, mesData)) return;
      const itens = Array.isArray(pedido.itens) && pedido.itens.length ? pedido.itens : [pedido];
      itens.forEach(item => {
        const sku = item.sku || pedido.sku || 'sem-sku';
        const qtd = Number(item.quantidade || item.qtd || item.quantity || item.total || 1) || 1;
        if (!resumo[sku]) resumo[sku] = 0;
        resumo[sku] += qtd;
        if (!resumoGeral[sku]) resumoGeral[sku] = 0;
        resumoGeral[sku] += qtd;
      });
    }));
    let totalUnidades = 0;
    let topSku = '-';
    let topQtd = 0;
    Object.entries(resumo).forEach(([sku, qtd]) => {
      totalUnidades += qtd;
      if (qtd > topQtd) {
        topSku = sku;
        topQtd = qtd;
      }
      dadosSkusExport.push({ usuario: usuario.nome, sku, quantidade: qtd, sobraEsperada: 0, sobraReal: 0 });
    });
    resumoUsuarios[usuario.uid].skus = {
      topSku,
      topSkuQtd: topQtd,
      totalSkus: Object.keys(resumo).length,
      totalUnidades
    };
    resumoUsuarios[usuario.uid].skusDetalhes = resumo;
  }));
  renderSkusCard(resumoGeral);
}

async function carregarSaques(usuarios, mes) {
  dadosSaquesExport = [];
  await Promise.all(usuarios.map(async usuario => {
    let total = 0;
    let totalComissao = 0;
    const detalhes = [];
    try {
      const col = collection(db, 'usuarios', usuario.uid, 'comissoes', mes, 'saques');
      const snap = await getDocs(col);
      snap.forEach(docSnap => {
        const dados = docSnap.data();
        const valor = Number(dados.valor) || 0;
        const percentual = Number(dados.percentualPago) || 0;
        const comissao = Number(dados.comissaoPaga) || valor * percentual;
        total += valor;
        totalComissao += comissao;
        detalhes.push({
          id: docSnap.id,
          data: (dados.data || '').substring(0,10),
          dataISO: dados.data || '',
          loja: dados.origem || '-',
          valor,
          percentual,
          comissao
        });
      });
    } catch (e) {
      console.error('Erro ao carregar saques:', e);
    }
    dadosSaquesExport.push({ usuario: usuario.nome, total, comissao: totalComissao });
    resumoUsuarios[usuario.uid].saques = { total, comissao: totalComissao };
    resumoUsuarios[usuario.uid].saquesDetalhes = detalhes;
  }));
}

async function carregarFaturamentoMeta(usuarios, mes) {
  dadosFaturamentoExport = [];
  await Promise.all(usuarios.map(async usuario => {
    let total = 0;
    let totalBruto = 0;
    const diario = {};
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/faturamento`));
    const dias = await Promise.all(
      snap.docs
        .filter(docSnap => !mes || docSnap.id.includes(mes))
        .map(async docSnap => {
          const lojasSnap = await getDocs(collection(db, `uid/${usuario.uid}/faturamento/${docSnap.id}/lojas`));
          let totalDia = 0;
          let totalDiaBruto = 0;
          await Promise.all(lojasSnap.docs.map(async lojaDoc => {
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
            totalDiaBruto += Number(dados.valorBruto) || 0;
          }));
          return { dia: docSnap.id, totalDia, totalDiaBruto };
        })
    );
    dias.forEach(({ dia, totalDia, totalDiaBruto }) => {
      total += totalDia;
      totalBruto += totalDiaBruto;
      diario[dia] = totalDia;
    });
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
      bruto: totalBruto,
      meta,
      esperado,
      diferenca
    };
    resumoUsuarios[usuario.uid].faturamentoDetalhes = { diario, metaDiaria };
  }));
}

async function carregarDevolucoes(usuarios, mes) {
  await Promise.all(usuarios.map(async usuario => {
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/devolucoes`));
    let total = 0;
    snap.forEach(docSnap => {
      if (mes && !docSnap.id.startsWith(mes)) return;
      const dados = docSnap.data();
      total += Number(dados.quantidade || dados.total || 1);
    });
    resumoUsuarios[usuario.uid].devolucoes = total;
  }));
}

async function calcularFaturamentoDiaDetalhado(uid, dia) {
  const lojasSnap = await getDocs(collection(db, `uid/${uid}/faturamento/${dia}/lojas`));
  let liquido = 0;
  let bruto = 0;
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
    liquido += Number(dados.valorLiquido) || 0;
    bruto += Number(dados.valorBruto) || 0;
  }
  return { liquido, bruto };
}

async function getFaturamentoRegistrosDia(uid, dia) {
  const lojasSnap = await getDocs(collection(db, `uid/${uid}/faturamento/${dia}/lojas`));
  const registros = [];
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
    registros.push({
      loja: lojaDoc.id,
      valorBruto: Number(dados.valorBruto) || 0,
      valorLiquido: Number(dados.valorLiquido) || 0
    });
  }
  return registros;
}

async function calcularFaturamentoDia(uid, dia) {
  const { liquido } = await calcularFaturamentoDiaDetalhado(uid, dia);
  return liquido;
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

function initKpiVendasDetalhes() {
  const btn = document.getElementById('kpiVendasDetalhes');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const uid = document.getElementById('usuarioFiltro')?.value;
    if (!uid || uid === 'todos') {
      alert('Selecione um usuário');
      return;
    }
    const dia = new Date();
    dia.setDate(dia.getDate() - 1);
    const diaStr = dia.toISOString().slice(0,10);
    const registros = await getFaturamentoRegistrosDia(uid, diaStr);
    if (!registros.length) {
      alert('Sem registros de faturamento no dia anterior');
      return;
    }
    const linhas = registros
      .map(r => `<tr><td>${r.loja}</td><td>R$ ${r.valorBruto.toLocaleString('pt-BR')}</td><td>R$ ${r.valorLiquido.toLocaleString('pt-BR')}</td></tr>`)
      .join('');
    const tabela = `<table class="data-table w-full text-sm"><thead><tr><th>Loja</th><th>Bruto</th><th>Líquido</th></tr></thead><tbody>${linhas}</tbody></table>`;
    showModal(`Faturamento Diário - ${formatarData(diaStr)}`, tabela);
  });
}

async function subscribeKPIs() {
  kpiUnsubs.forEach(fn => fn());
  kpiUnsubs = [];
  const uid = document.getElementById('usuarioFiltro')?.value;
  const mes = document.getElementById('mesFiltro')?.value;
  const brutoEl = document.getElementById('kpiVendasBruto');
  const liquidoEl = document.getElementById('kpiVendasLiquido');
  const skusEl = document.getElementById('kpiVendasSkus');
  const metaEl = document.getElementById('kpiMetaAtingida');
  const metaProjEl = document.getElementById('kpiMetaProjection');
  const metaBar = document.getElementById('kpiMetaProgress');
  const metaWrap = document.getElementById('kpiMetaProgressWrapper');
  const metaMulti = document.getElementById('kpiMetaMulti');
  const devEl = document.getElementById('kpiDevolucoes');
  if (!brutoEl || !liquidoEl || !skusEl || !metaEl || !devEl) return;
  if (!uid) {
    brutoEl.textContent = '-';
    liquidoEl.textContent = '-';
    skusEl.textContent = '-';
    metaEl.textContent = '-';
    if (metaProjEl) metaProjEl.textContent = 'Proj: -';
    devEl.textContent = '-';
    return;
  }
  if (uid === 'todos') {
    brutoEl.textContent = '-';
    liquidoEl.textContent = '-';
    skusEl.textContent = '-';
    devEl.textContent = '-';
    if (metaEl && metaProjEl && metaWrap && metaMulti) {
      metaEl.classList.add('hidden');
      metaProjEl.classList.add('hidden');
      metaWrap.classList.add('hidden');
      metaMulti.classList.remove('hidden');
      metaMulti.innerHTML = '';
      for (const u of usuariosCache) {
        let metaValor = 0;
        try {
          const metaDoc = await getDoc(doc(db, `uid/${u.uid}/metasFaturamento`, mes));
          if (metaDoc.exists()) metaValor = Number(metaDoc.data().valor) || 0;
        } catch (_) {}
        const fatSnap = await getDocs(collection(db, `uid/${u.uid}/faturamento`));
        let totalMes = 0;
        for (const d of fatSnap.docs) {
          if (mes && !d.id.startsWith(mes)) continue;
          const { liquido: totalDia } = await calcularFaturamentoDiaDetalhado(u.uid, d.id);
          totalMes += totalDia;
        }
        const [ano, mesNum] = mes.split('-').map(Number);
        const totalDias = new Date(ano, mesNum, 0).getDate();
        const hoje = new Date();
        let diasDecorridos = totalDias;
        if (mes === hoje.toISOString().slice(0,7)) diasDecorridos = hoje.getDate();
        const mediaDiaria = diasDecorridos ? totalMes / diasDecorridos : 0;
        const projTotal = mediaDiaria * totalDias;
        const prog = metaValor ? Math.min(100, (totalMes / metaValor) * 100) : 0;
        const projPerc = metaValor ? (projTotal / metaValor) * 100 : 0;
        const color = prog >= 100 ? 'text-green-600' : prog >= 50 ? 'text-yellow-500' : 'text-red-600';
        const item = document.createElement('div');
        item.innerHTML = `\n          <div class="text-sm font-medium">${u.nome}</div>\n          <div class="flex items-baseline gap-2">\n            <span class="text-2xl font-bold ${color}">${metaValor ? prog.toFixed(1) : '0'}%</span>\n            <span class="text-xs text-gray-500">Proj: ${metaValor ? projPerc.toFixed(1) : '0'}%</span>\n          </div>\n          <div class="progress mt-1 ${color}">\n            <div class="progress-bar" style="width:${prog.toFixed(0)}%"></div>\n          </div>`;
        metaMulti.appendChild(item);
      }
    }
    // Monta gráfico agregando faturamento de todos os usuários
    const agregados = {};
    for (const u of usuariosCache) {
      const fatSnap = await getDocs(collection(db, `uid/${u.uid}/faturamento`));
      for (const d of fatSnap.docs) {
        if (mes && !d.id.startsWith(mes)) continue;
        const { liquido: totalDia } = await calcularFaturamentoDiaDetalhado(u.uid, d.id);
        agregados[d.id] = (agregados[d.id] || 0) + totalDia;
      }
    }
    const labels = Object.keys(agregados).sort();
    const data = labels.map(l => agregados[l]);
    updateSalesChart(labels.map(formatarData), data);
    return;
  }
  if (metaEl && metaProjEl && metaWrap && metaMulti) {
    metaEl.classList.remove('hidden');
    metaProjEl.classList.remove('hidden');
    metaWrap.classList.remove('hidden');
    metaMulti.classList.add('hidden');
    metaMulti.innerHTML = '';
  }
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const diaAnterior = ontem.toISOString().slice(0,10);
  let metaValor = 0;
  const metaRef = doc(db, `uid/${uid}/metasFaturamento`, mes);
  const unsubMeta = onSnapshot(metaRef, snap => {
    metaValor = snap.exists() ? Number(snap.data().valor) || 0 : 0;
  });
  kpiUnsubs.push(unsubMeta);

  const faturamentoRef = collection(db, `uid/${uid}/faturamento`);
  const unsubFat = onSnapshot(faturamentoRef, async snap => {
    let totalMes = 0;
    let vendasLiquido = 0;
    let vendasBruto = 0;
    const diarios = [];
    for (const d of snap.docs) {
      const { liquido: totalDia, bruto: brutoDia } = await calcularFaturamentoDiaDetalhado(uid, d.id);
      if (d.id === diaAnterior) {
        vendasLiquido = totalDia;
        vendasBruto = brutoDia;
      }
      if (mes && !d.id.startsWith(mes)) continue;
      totalMes += totalDia;
      diarios.push({ data: d.id, valor: totalDia });
    }
    brutoEl.textContent = `R$ ${vendasBruto.toLocaleString('pt-BR')}`;
    liquidoEl.textContent = `R$ ${vendasLiquido.toLocaleString('pt-BR')}`;
    const prog = metaValor ? Math.min(100, (totalMes / metaValor) * 100) : 0;
    const [ano, mesNum] = mes.split('-').map(Number);
    const totalDias = new Date(ano, mesNum, 0).getDate();
    const hoje = new Date();
    let diasDecorridos = totalDias;
    if (mes === hoje.toISOString().slice(0,7)) diasDecorridos = hoje.getDate();
    const mediaDiaria = diasDecorridos ? totalMes / diasDecorridos : 0;
    const projTotal = mediaDiaria * totalDias;
    const projPerc = metaValor ? (projTotal / metaValor) * 100 : 0;
    metaEl.textContent = metaValor ? `${prog.toFixed(1)}%` : '0%';
    if (metaProjEl) metaProjEl.textContent = metaValor ? `Proj: ${projPerc.toFixed(1)}%` : 'Proj: 0%';
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

  const skusRef = collection(db, `uid/${uid}/skusVendidos/${diaAnterior}/lista`);
  const unsubSkus = onSnapshot(skusRef, snap => {
    let totalSkus = 0;
    snap.forEach(item => {
      const dados = item.data();
      totalSkus += Number(dados.total || dados.quantidade) || 0;
    });
    skusEl.textContent = totalSkus;
  });
  kpiUnsubs.push(unsubSkus);

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
  const overview = document.getElementById('overviewCards');
  if (!container || !overview) return;
  container.innerHTML = '';
  overview.innerHTML = '';

  const totalBruto = lista.reduce((s, u) => s + (u.faturamento?.bruto || 0), 0);
  const totalLiquido = lista.reduce((s, u) => s + (u.faturamento?.faturado || 0), 0);
  const metaTotal = lista.reduce((s, u) => s + (u.faturamento?.meta || 0), 0);
  const devolTotal = lista.reduce((s, u) => s + (u.devolucoes || 0), 0);
  const perc = metaTotal ? (totalLiquido / metaTotal) * 100 : 0;
  const percColor = perc >= 100 ? 'text-green-600' : perc >= 50 ? 'text-yellow-500' : 'text-red-600';

  overview.innerHTML = `
    <div class="card p-4 flex items-center gap-2 text-green-600"><i class="fa fa-money-bill text-2xl"></i><div><div class="text-sm text-gray-500">Total Faturado</div><div class="text-xl font-bold">R$ ${totalBruto.toLocaleString('pt-BR')}</div></div></div>
    <div class="card p-4 flex items-center gap-2 text-green-600"><i class="fa fa-wallet text-2xl"></i><div><div class="text-sm text-gray-500">Total Líquido</div><div class="text-xl font-bold">R$ ${totalLiquido.toLocaleString('pt-BR')}</div></div></div>
    <div class="card p-4 flex items-center gap-2"><i class="fa fa-bullseye text-blue-600 text-2xl"></i><div><div class="text-sm text-gray-500">Meta Mensal</div><div class="text-xl font-bold">R$ ${metaTotal.toLocaleString('pt-BR')}</div></div></div>
    <div class="card p-4 flex items-center gap-2 ${percColor}"><i class="fa fa-chart-line text-2xl"></i><div><div class="text-sm text-gray-500">% da Meta</div><div class="text-xl font-bold">${perc.toFixed(1)}%</div></div></div>
    <div class="card p-4 flex items-center gap-2 text-orange-500"><i class="fa fa-undo text-2xl"></i><div><div class="text-sm text-gray-500">Devoluções</div><div class="text-xl font-bold">${devolTotal}</div></div></div>`;

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
  lista.forEach(u => grid.appendChild(createResumoCard(u)));
  container.appendChild(grid);
}

function createResumoCard(u) {
  const progresso = u.faturamento?.meta ? Math.min(100, (u.faturamento.faturado / u.faturamento.meta) * 100) : 0;
  const statusColor = progresso >= 100 ? 'text-green-600' : progresso >= 50 ? 'text-yellow-500' : 'text-red-600';
  const card = document.createElement('div');
  card.className = 'card p-4 flex flex-col gap-2';
  card.innerHTML = `
    <h3 class="font-bold">${u.nome} – ${progresso.toFixed(0)}% da meta</h3>
    <div class="text-sm">Faturado: R$ ${(u.faturamento?.faturado || 0).toLocaleString('pt-BR')}</div>
    <div class="text-sm">Top SKU: ${u.skus?.topSku || '-'} – ${u.skus?.topSkuQtd || 0}u</div>
    <div class="text-sm">Saques: R$ ${(u.saques?.total || 0).toLocaleString('pt-BR')}</div>
    <div class="text-sm">Comissão: R$ ${(u.saques?.comissao || 0).toLocaleString('pt-BR')}</div>
    <div class="progress ${statusColor}"><div class="progress-bar" style="width:${progresso.toFixed(0)}%"></div></div>`;
  return card;
}

function renderSkusCard(resumo) {
  const card = document.getElementById('skusMesCard');
  const topCard = document.getElementById('topSkusCard');
  if (!card || !topCard) return;
  const entries = Object.entries(resumo).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    card.classList.add('hidden');
    topCard.classList.add('hidden');
    card.innerHTML = '';
    topCard.innerHTML = '';
    return;
  }
  card.classList.remove('hidden');
  topCard.classList.remove('hidden');

  let html = '<h4 class="text-sm text-gray-500 mb-2">SKUs vendidos no mês</h4>';
  html += '<ul class="text-sm space-y-1">';
  entries.forEach(([sku, qtd]) => {
    html += `<li>${sku}: ${qtd}</li>`;
  });
  html += '</ul>';
  card.innerHTML = html;

  let topHtml = '<h4 class="text-sm text-gray-500 mb-2">Top 5 SKUs</h4>';
  topHtml += '<ul class="text-sm space-y-1">';
  entries.slice(0, 5).forEach(([sku, qtd]) => {
    topHtml += `<li>${sku}: ${qtd}</li>`;
  });
  topHtml += '</ul>';
  topCard.innerHTML = topHtml;
}

async function calcularFaturamentoDiaDetalhadoGestor(responsavelUid, uid, dia) {
  const lojasSnap = await getDocs(collection(db, `uid/${responsavelUid}/uid/${uid}/faturamento/${dia}/lojas`));
  let liquido = 0;
  let bruto = 0;
  for (const lojaDoc of lojasSnap.docs) {
    let dados = lojaDoc.data();
    if (dados.encrypted) {
      let txt;
      const candidates = [getPassphrase(), currentUser?.email, `chave-${uid}`, uid];
      for (const p of candidates) {
        if (!p) continue;
        try {
          txt = await decryptString(dados.encrypted, p);
          if (txt) break;
        } catch (_) {}
      }
      if (txt) dados = JSON.parse(txt);
    }
    liquido += Number(dados.valorLiquido) || 0;
    bruto += Number(dados.valorBruto) || 0;
  }
  return { liquido, bruto };
}

async function calcularVendasDiaGestor(responsavelUid, uid, dia) {
  try {
    const resumoDoc = await getDoc(doc(db, 'uid', responsavelUid, 'uid', uid, 'faturamento', dia));
    if (resumoDoc.exists()) {
      let dados = resumoDoc.data();
      if (dados.encrypted) {
        let txt;
        const candidates = [getPassphrase(), currentUser?.email, `chave-${uid}`, uid];
        for (const p of candidates) {
          if (!p) continue;
          try {
            txt = await decryptString(dados.encrypted, p);
            if (txt) break;
          } catch (_) {}
        }
        if (txt) dados = JSON.parse(txt);
      }
      return Number(dados.vendas || dados.qtdVendas || dados.quantidade) || 0;
    }
  } catch (e) {
    console.error('Erro ao calcular vendas do dia:', e);
  }
  return 0;
}

async function renderVendasDiaAnterior(lista) {
  const container = document.getElementById('vendasDiaAnterior');
  if (!container) return;
  container.innerHTML = '';
  const dia = new Date();
  dia.setDate(dia.getDate() - 1);
  const diaStr = dia.toISOString().slice(0,10);
  const cards = await Promise.all(lista.map(async u => {
    const { liquido, bruto } = await calcularFaturamentoDiaDetalhadoGestor(currentUser.uid, u.uid, diaStr);
    const vendas = await calcularVendasDiaGestor(currentUser.uid, u.uid, diaStr);
    const card = document.createElement('div');
    card.className = 'card p-4';
    card.innerHTML = `
      <h4 class="font-bold mb-2">${u.nome}</h4>
      <div>Bruto dia: R$ ${bruto.toLocaleString('pt-BR')}</div>
      <div>Líquido dia: R$ ${liquido.toLocaleString('pt-BR')}</div>
      <div>Qtd dia: ${vendas}</div>`;
    return card;
  }));
  cards.forEach(card => container.appendChild(card));
}

async function renderPedidosTinyHoje(lista) {
  const container = document.getElementById('financeiroUsuarios');
  if (!container) return;
  container.innerHTML = '';
  const hoje = new Date();
  const cards = await Promise.all(lista.map(async u => {
    const pass = getPassphrase() || `chave-${u.uid}`;
    const snap = await getDocs(collection(db, `usuarios/${u.uid}/pedidostiny`));
    let bruto = 0;
    let liquido = 0;
    let pedidos = 0;
    for (const d of snap.docs) {
      let pedido = await loadSecureDoc(db, `usuarios/${u.uid}/pedidostiny`, d.id, pass);
      if (!pedido) {
        const raw = d.data();
        if (raw && !raw.encrypted && !raw.encryptedData) pedido = raw;
      }
      if (!pedido) continue;
      const dataStr = pedido.data || pedido.dataPedido || pedido.date || '';
      const data = parseDate(dataStr);
      if (!sameDay(data, hoje)) continue;
      bruto += toNumber(pedido.valor || pedido.total || 0);
      liquido += calcularLiquido(pedido);
      pedidos++;
    }
    const card = document.createElement('div');
    card.className = 'card p-4 text-sm';
    card.innerHTML = `
      <h4 class="font-bold mb-2">${u.nome}</h4>
      <div>Valor Bruto: ${formatCurrency(bruto)}</div>
      <div>Valor Líquido: ${formatCurrency(liquido)}</div>
      <div>Pedidos: ${pedidos}</div>`;
    return card;
  }));
  cards.forEach(c => container.appendChild(c));
}

function renderTabelaSaques() {
  const uid = document.getElementById('usuarioFiltro')?.value;
  const section = document.getElementById('saquesGestor');
  const tbody = document.getElementById('tbodySaquesFinanceiro');
  const resumo = document.getElementById('resumoSaquesFinanceiro');
  const chkAll = document.getElementById('chkSaquesFinanceiro');
  if (!section || !tbody || !resumo || !chkAll) return;
  if (!uid || uid === 'todos') {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  const dados = (resumoUsuarios[uid]?.saquesDetalhes) || [];
  dados.sort((a,b) => (a.data || '').localeCompare(b.data || ''));
  tbody.innerHTML = '';
  chkAll.checked = false;
  dados.forEach(s => {
    const pago = (s.percentual || 0) > 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-4 py-2"><input type="checkbox" class="chk-saque-fin" data-id="${s.id}"></td>
      <td class="px-4 py-2">${s.data || ''}</td>
      <td class="px-4 py-2">${s.loja || ''}</td>
      <td class="px-4 py-2 text-right">R$ ${s.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="px-4 py-2 text-right">${(s.percentual * 100).toFixed(0)}%</td>
      <td class="px-4 py-2 text-right">R$ ${s.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="px-4 py-2 text-center ${pago ? 'text-green-600' : 'text-red-600'}">${pago ? 'PAGO' : 'A PAGAR'}</td>`;
    tbody.appendChild(tr);
  });
  resumo.textContent = '';
}

function assistirResumoFinanceiro(uid, anoMes) {
  if (resumoUnsub) resumoUnsub();
  resumoUnsub = watchResumoMesSvc({
    db,
    uid,
    anoMes,
    onChange: r => {
      const cards = document.getElementById('cardsResumoFinanceiro');
      const texto = document.getElementById('faltasTextoFinanceiro');
      const resumo = document.getElementById('resumoSaquesFinanceiro');
      if (!cards || !texto || !resumo) return;
      if (!r) {
        cards.innerHTML = '<p class="text-gray-500">Sem dados</p>';
        texto.textContent = '';
        resumo.textContent = '';
        return;
      }
      cards.innerHTML = `
        <div>
          <div class="text-sm text-gray-500">Total sacado</div>
          <div class="text-xl font-bold">R$ ${r.totalSacado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div>
          <div class="text-sm text-gray-500">Total comissão</div>
          <div class="text-xl font-bold">R$ ${(r.comissaoPrevista || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="text-sm text-gray-500">${(r.taxaFinal * 100).toFixed(0)}%</div>
        </div>
        <div>
          <div class="text-sm text-gray-500">Total comissão paga</div>
          <div class="text-xl font-bold">R$ ${(r.comissaoRecebida || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div>
          <div class="text-sm text-gray-500">Total comissão falta pagar</div>
          <div class="text-xl font-bold">R$ ${((r.comissaoPrevista || 0) - (r.comissaoRecebida || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      `;
      texto.textContent = `Faltam R$${r.faltamPara4.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para 4% | R$${r.faltamPara5.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para 5%`;
      resumo.textContent =
        `Total Saque: R$ ${r.totalSacado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ` +
        `Total Comissão: R$ ${(r.comissaoPrevista || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ` +
        `Total já pago: R$ ${(r.comissaoRecebida || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ` +
        `Total a pagar: R$ ${((r.comissaoPrevista || 0) - (r.comissaoRecebida || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  });
}

async function marcarSaquesSelecionados() {
  const uid = document.getElementById('usuarioFiltro')?.value;
  const mes = document.getElementById('mesFiltro')?.value;
  const perc = parseFloat(document.getElementById('percentualMarcar')?.value || '0');
  if (!uid || uid === 'todos' || !mes) return;
  const checks = Array.from(document.querySelectorAll('.chk-saque-fin:checked'));
  for (const chk of checks) {
    const id = chk.dataset.id;
    const dados = (resumoUsuarios[uid]?.saquesDetalhes || []).find(s => s.id === id);
    if (!dados) continue;
    await atualizarSaqueSvc({
      db,
      uid,
      anoMes: mes,
      saqueId: id,
      dataISO: dados.dataISO,
      valor: dados.valor,
      percentualPago: perc,
      origem: dados.loja
    });
  }
  await carregar();
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

document.getElementById('btnMarcarPago')?.addEventListener('click', marcarSaquesSelecionados);
document.getElementById('chkSaquesFinanceiro')?.addEventListener('change', e => {
  document.querySelectorAll('.chk-saque-fin').forEach(ch => (ch.checked = e.target.checked));
});

// PWA install handling
if ('serviceWorker' in navigator) {
  // Use a relative path so GitHub Pages serves the correct file when hosted in a subdirectory
  navigator.serviceWorker
    .register('service-worker.js')
    .catch(err => console.error('SW registration failed', err));
}

let deferredPrompt;
const installBtn = document.getElementById('installAppBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn?.classList.remove('hidden');
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add('hidden');
});
