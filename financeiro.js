import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, setDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
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

const state = {
  totais: { faturamento: 0, meta: 0, progFat: 0, progMeta: 0, comissoes: 0, pendentes: 0, pagas: 0 },
  vendedores: {}
};

function setKpi(id, val){ const el = document.getElementById(id); if (el) el.textContent = val; }
function setBar(id, pct){ const el = document.getElementById(id); if (el) el.style.width = `${Math.max(0,Math.min(100, pct||0)).toFixed(0)}%`; }
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

  userSel.addEventListener('change', () => { atualizarMeta(); carregar(); });
  mesSel.addEventListener('change', () => { atualizarMeta(); carregar(); });
  if (salvarMetaBtn) salvarMetaBtn.addEventListener('click', salvarMeta);
  atualizarMeta();

  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      target.classList.toggle('hidden');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
      }
    });
  });
  const expSkus = document.getElementById('exportSkus');
  const expSaques = document.getElementById('exportSaques');
  const expFaturamento = document.getElementById('exportFaturamento');
  if (expSkus) expSkus.addEventListener('click', exportarSkus);
  if (expSaques) expSaques.addEventListener('click', exportarSaques);
  if (expFaturamento) expFaturamento.addEventListener('click', exportarFaturamento);
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
  const mes = document.getElementById('mesFiltro')?.value || '';
  const uid = document.getElementById('usuarioFiltro')?.value || 'todos';
  const listaUsuarios = uid === 'todos' ? usuariosCache : usuariosCache.filter(u => u.uid === uid);
  
   state.totais = { faturamento: 0, meta: 0, progFat: 0, progMeta: 0, comissoes: 0, pendentes: 0, pagas: 0 };
  state.vendedores = {};
  
  await carregarSkus(listaUsuarios, mes);
  await carregarSaques(listaUsuarios, mes);
  await carregarFaturamentoMeta(listaUsuarios, mes);
    renderDashboard(mes);
}

async function carregarSkus(usuarios, mes) {
  const container = document.getElementById('resumoSkus');
  if (!container) return;
  container.innerHTML = '';
  dadosSkusExport = [];

  for (const usuario of usuarios) {
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/skusVendidos`));
    const produtosSnap = await getDocs(collection(db, `uid/${usuario.uid}/produtos`));

    // mapa de custos por SKU
    const custos = {};
    produtosSnap.forEach(p => {
      const dados = p.data();
      const chave = dados.sku || p.id;
      custos[chave] = Number(dados.custo || 0);
    });

    // consolida SKUs do mês
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

    // >>> integra com o painel do novo layout (por vendedor)
    const totalSkus = Object.keys(resumo).length;
    let unidades = 0, topSku = '—', topQtd = -1;
    Object.entries(resumo).forEach(([sku, info]) => {
      unidades += info.qtd || 0;
      if (info.qtd > topQtd) { topQtd = info.qtd; topSku = sku; }
    });
    if (!state.vendedores[usuario.uid]) state.vendedores[usuario.uid] = { nome: usuario.nome };
    state.vendedores[usuario.uid].skus = totalSkus;
    state.vendedores[usuario.uid].unidades = unidades;
    state.vendedores[usuario.uid].topSku = topSku;

    // --- mantém a listagem textual na página (se desejar)
    const section = document.createElement('div');
    section.className = 'mb-4';
    const titulo = document.createElement('h3');
    titulo.className = 'font-bold';
    titulo.textContent = usuario.nome;
    section.appendChild(titulo);

    if (!Object.keys(resumo).length) {
      const p = document.createElement('p');
      p.className = 'text-gray-500';
      p.textContent = 'Nenhum SKU encontrado.';
      section.appendChild(p);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'list-disc pl-4 space-y-1';
      Object.entries(resumo).forEach(([sku, info]) => {
        dadosSkusExport.push({
          usuario: usuario.nome,
          sku,
          quantidade: info.qtd,
          sobraEsperada: info.sobraEsperada,
          sobraReal: info.sobraReal
        });
        const li = document.createElement('li');
        li.textContent =
          `${sku}: ${info.qtd} | Sobra Esperada: R$ ${info.sobraEsperada.toLocaleString('pt-BR')} | ` +
          `Sobra Real: R$ ${info.sobraReal.toLocaleString('pt-BR')}`;
        ul.appendChild(li);
      });
      section.appendChild(ul);
    }

    container.appendChild(section);
  }
}


async function carregarSaques(usuarios, mes) {
  const container = document.getElementById('resumoSaques');
  if (!container) return;
  container.innerHTML = 'Carregando...';
  dadosSaquesExport = [];
  let totalGeral = 0;
  let totalComissaoGeral = 0;
  container.innerHTML = '';

  for (const usuario of usuarios) {
    const pass = getPassphrase() || `chave-${usuario.uid}`;
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/saques`));
    let total = 0;
    let totalComissao = 0;

    for (const docSnap of snap.docs) {
      if (mes && !docSnap.id.includes(mes)) continue;

      const dados = await loadSecureDoc(db, `uid/${usuario.uid}/saques`, docSnap.id, pass);
      if (!dados) continue;
      total += Number(dados.valorTotal) || 0;

      const lojasSnap = await getDocs(collection(db, `uid/${usuario.uid}/saques/${docSnap.id}/lojas`));
      for (const lojaDoc of lojasSnap.docs) {
        const lojaDados = await loadSecureDoc(db, `uid/${usuario.uid}/saques/${docSnap.id}/lojas`, lojaDoc.id, pass);
        if (!lojaDados) continue;
        const valor = Number(lojaDados.valor) || 0;
        const comissao = Number(lojaDados.comissao) || 0;
        totalComissao += valor * (comissao / 100);
      }
    }

    totalGeral += total;
    totalComissaoGeral += totalComissao;

    // guarda por vendedor para os cards individuais
    if (!state.vendedores[usuario.uid]) state.vendedores[usuario.uid] = { nome: usuario.nome };
    state.vendedores[usuario.uid].comissoes = totalComissao;

    // acumula para o KPI de Comissões (topo)
    state.totais.comissoes += totalComissao;

    // mantém a listagem textual da seção (se quiser o resumo na página)
    dadosSaquesExport.push({ usuario: usuario.nome, total, comissao: totalComissao });

    const section = document.createElement('div');
    section.className = 'mb-4';
    const titulo = document.createElement('h3');
    titulo.className = 'font-bold';
    titulo.textContent = usuario.nome;
    section.appendChild(titulo);

    const p = document.createElement('p');
    p.textContent = `Total: R$ ${total.toLocaleString('pt-BR')} | Comissões: R$ ${totalComissao.toLocaleString('pt-BR')}`;
    section.appendChild(p);

    container.appendChild(section);
  }

  const resumoP = document.createElement('p');
  resumoP.innerHTML =
    `Total de Saques: <strong>R$ ${totalGeral.toLocaleString('pt-BR')}</strong><br>` +
    `Total de Comissões: <strong>R$ ${totalComissaoGeral.toLocaleString('pt-BR')}</strong>`;
  container.appendChild(resumoP);
}


async function carregarFaturamentoMeta(usuarios, mes) {
  const container = document.getElementById('resumoFaturamento');
  if (!container) return;
  container.innerHTML = 'Carregando...';
  dadosFaturamentoExport = [];
  container.innerHTML = '';

  for (const usuario of usuarios) {
    let total = 0;

    // soma faturamento líquido por mês/loja
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/faturamento`));
    for (const docSnap of snap.docs) {
      if (mes && !docSnap.id.includes(mes)) continue;

      const lojasSnap = await getDocs(collection(db, `uid/${usuario.uid}/faturamento/${docSnap.id}/lojas`));
      for (const lojaDoc of lojasSnap.docs) {
        let dados = lojaDoc.data();
        if (dados.encrypted) {
          const pass = getPassphrase() || `chave-${usuario.uid}`;
          let txt;
          try { txt = await decryptString(dados.encrypted, pass); }
          catch (e) { try { txt = await decryptString(dados.encrypted, usuario.uid); } catch (_) {} }
          if (txt) dados = JSON.parse(txt);
        }
        total += Number(dados.valorLiquido) || 0;
      }
    }

    // meta do mês (por usuário)
    let meta = 0, esperado = 0, diferenca = 0;
    try {
      const metaDoc = await getDoc(doc(db, `uid/${usuario.uid}/metasFaturamento`, mes));
      if (metaDoc.exists()) meta = Number(metaDoc.data().valor) || 0;
    } catch (err) {
      console.error('Erro ao buscar meta de faturamento:', err);
    }

    // esperado até hoje (projeção linear pela quantidade de dias)
    if (meta && mes) {
      const [ano, mesNum] = mes.split('-').map(Number);
      const totalDias = new Date(ano, mesNum, 0).getDate();
      const hoje = new Date();
      const diasDecorridos = (mes === hoje.toISOString().slice(0,7)) ? hoje.getDate() : totalDias;
      const metaDiaria = meta / totalDias;
      esperado = metaDiaria * diasDecorridos;
      diferenca = total - esperado;
    }

    // export e listagem textual (se quiser manter o resumo na página)
    dadosFaturamentoExport.push({ usuario: usuario.nome, faturado: total, meta, esperado, diferenca });

    const section = document.createElement('div');
    section.className = 'mb-4';
    const titulo = document.createElement('h3');
    titulo.className = 'font-bold';
    titulo.textContent = usuario.nome;
    section.appendChild(titulo);
    const p = document.createElement('p');
    p.textContent =
      `Faturado: R$ ${total.toLocaleString('pt-BR')} | ` +
      `Meta: R$ ${meta.toLocaleString('pt-BR')} | ` +
      `Esperado até hoje: R$ ${esperado.toLocaleString('pt-BR')} | ` +
      `Diferença: R$ ${diferenca.toLocaleString('pt-BR')}`;
    section.appendChild(p);
    container.appendChild(section);

    // >>> integra com os cards/painéis do novo layout
    if (!state.vendedores[usuario.uid]) state.vendedores[usuario.uid] = { nome: usuario.nome };
    state.vendedores[usuario.uid].faturado = total;
    state.vendedores[usuario.uid].meta = meta;
    state.vendedores[usuario.uid].prog = meta ? (total / meta) * 100 : 0;

    state.totais.faturamento += total;
    state.totais.meta += meta;
  }
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
// >>> ADICIONE AO FINAL DO ARQUIVO:
function renderDashboard(mesSelecionado){
  // ---- KPIs Topo ----
  const progFat = state.totais.meta ? (state.totais.faturamento / state.totais.meta)*100 : 0;
  const hoje = new Date(); 
  let progMeta = 0;
  if (state.totais.meta && mesSelecionado){
    const [ano, m] = mesSelecionado.split('-').map(Number);
    const totalDias = new Date(ano, m, 0).getDate();
    const diasDec = (mesSelecionado === hoje.toISOString().slice(0,7)) ? hoje.getDate() : totalDias;
    progMeta = (diasDec/totalDias)*100;
  }
  state.totais.progFat = progFat;
  state.totais.progMeta = progMeta;

  setKpi('kpiFaturamento', state.totais.faturamento.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
  setKpi('kpiMeta', state.totais.meta.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
  setKpi('kpiComissoes', state.totais.comissoes.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
  setKpi('kpiFaturamentoPct', `${Math.round(progFat)}%`);
  setKpi('kpiMetaPct', `${Math.round(progMeta)}%`);
  setKpi('kpiPendentes', state.totais.pendentes);
  setKpi('kpiPagas', state.totais.pagas);
  setBar('kpiFaturamentoBar', progFat);
  setBar('kpiMetaBar', progMeta);

  // ---- Painéis por vendedor ----
  Object.entries(state.vendedores).forEach(([uid, v])=>{
    if (/carlos/i.test(v.nome)){
      if (v.faturado != null) setKpi('carlosFat', v.faturado.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
      if (v.meta != null) setKpi('carlosMeta', v.meta.toLocaleString('pt-BR',{style:'currency','currency':'BRL'}));
      if (v.prog != null) setBar('carlosBar', v.prog);
      if (v.comissoes != null) setKpi('carlosComissoes', v.comissoes.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
      if (v.skus != null) document.getElementById('carlosSkus').textContent = v.skus;
      if (v.unidades != null) document.getElementById('carlosUnidades').textContent = v.unidades;
      if (v.topSku) document.getElementById('carlosTopSku').textContent = `Top SKU: ${v.topSku}`;
    }
    // Repita para outros vendedores (Ana, João, etc.)
  });
}

