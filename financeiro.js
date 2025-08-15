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
let resumoUsuarios = {};

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
  const mes = document.getElementById('mesFiltro')?.value || '';
  const uid = document.getElementById('usuarioFiltro')?.value || 'todos';
  const listaUsuarios = uid === 'todos' ? usuariosCache : usuariosCache.filter(u => u.uid === uid);
  atualizarContexto();
  resumoUsuarios = {};
  listaUsuarios.forEach(u => resumoUsuarios[u.uid] = { nome: u.nome });
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
    for (const docSnap of snap.docs) {
      if (mes && !docSnap.id.includes(mes)) continue;
      const dados = await loadSecureDoc(db, `uid/${usuario.uid}/saques`, docSnap.id, pass);
      if (!dados) continue;
      total += dados.valorTotal || 0;
      qtdSaques++;
      const lojasSnap = await getDocs(collection(db, `uid/${usuario.uid}/saques/${docSnap.id}/lojas`));
      for (const lojaDoc of lojasSnap.docs) {
        const lojaDados = await loadSecureDoc(db, `uid/${usuario.uid}/saques/${docSnap.id}/lojas`, lojaDoc.id, pass);
        if (!lojaDados) continue;
        const valor = lojaDados.valor || 0;
        const comissao = lojaDados.comissao || 0;
        totalComissao += valor * (comissao / 100);
      }
    }
    dadosSaquesExport.push({ usuario: usuario.nome, total, comissao: totalComissao });
    resumoUsuarios[usuario.uid].saques = {
      total,
      comissao: totalComissao,
      qtdSaques
    };
  }
}

async function carregarFaturamentoMeta(usuarios, mes) {
  dadosFaturamentoExport = [];
  for (const usuario of usuarios) {
    let total = 0;
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/faturamento`));
    for (const docSnap of snap.docs) {
      if (mes && !docSnap.id.includes(mes)) continue;
      const lojasSnap = await getDocs(collection(db, `uid/${usuario.uid}/faturamento/${docSnap.id}/lojas`));
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
        total += Number(dados.valorLiquido) || 0;
      }
    }
    let meta = 0;
    let esperado = 0;
    let diferenca = 0;
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
      const metaDiaria = meta / totalDias;
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
    <div class="card-header">
      <h2 class="text-lg font-bold flex items-center gap-2"><i class="fa fa-chart-bar"></i> ${u.nome} - SKUs Vendidos</h2>
    </div>
    <div class="card-body">
      <div class="grid grid-cols-3 text-center gap-2">
        <div>
          <div class="text-xl font-bold">${u.skus?.topSku || '-'}</div>
          <div class="text-sm text-gray-500">Top SKU</div>
        </div>
        <div>
          <div class="text-xl font-bold">${u.skus?.totalSkus || 0}</div>
          <div class="text-sm text-gray-500">SKUs</div>
        </div>
        <div>
          <div class="text-xl font-bold">${u.skus?.totalUnidades || 0}</div>
          <div class="text-sm text-gray-500">Unidades</div>
        </div>
      </div>
    </div>`;
  return card;
}

function createSaquesCard(u) {
  const card = document.createElement('div');
  card.className = 'card card-green';
  card.innerHTML = `
    <div class="card-header">
      <h2 class="text-lg font-bold flex items-center gap-2"><i class="fa fa-money-bill-wave"></i> ${u.nome} - Saques e Comissões</h2>
    </div>
    <div class="card-body">
      <div class="grid grid-cols-3 text-center gap-2">
        <div>
          <div class="text-xl font-bold">R$ ${(u.saques?.total || 0).toLocaleString('pt-BR')}</div>
          <div class="text-sm text-gray-500">Total</div>
        </div>
        <div>
          <div class="text-xl font-bold">R$ ${(u.saques?.comissao || 0).toLocaleString('pt-BR')}</div>
          <div class="text-sm text-gray-500">Comissões</div>
        </div>
        <div>
          <div class="text-xl font-bold">${u.saques?.qtdSaques || 0}</div>
          <div class="text-sm text-gray-500">Total de Saques</div>
        </div>
      </div>
    </div>`;
  return card;
}

function createFaturamentoCard(u) {
  const card = document.createElement('div');
  card.className = 'card card-orange';
  const progresso = u.faturamento?.meta ? Math.min(100, (u.faturamento.faturado / u.faturamento.meta) * 100) : 0;
  card.innerHTML = `
    <div class="card-header">
      <h2 class="text-lg font-bold flex items-center gap-2"><i class="fa fa-chart-line"></i> ${u.nome} - Faturamento x Meta</h2>
    </div>
    <div class="card-body space-y-2">
      <div class="grid grid-cols-3 text-center gap-2">
        <div>
          <div class="text-xl font-bold">R$ ${(u.faturamento?.faturado || 0).toLocaleString('pt-BR')}</div>
          <div class="text-sm text-gray-500">Faturado</div>
        </div>
        <div>
          <div class="text-xl font-bold">R$ ${(u.faturamento?.meta || 0).toLocaleString('pt-BR')}</div>
          <div class="text-sm text-gray-500">Meta</div>
        </div>
        <div>
          <div class="text-xl font-bold">R$ ${(u.faturamento?.esperado || 0).toLocaleString('pt-BR')}</div>
          <div class="text-sm text-gray-500">Esperado até hoje</div>
        </div>
      </div>
      <div class="progress text-orange-600"><div class="progress-bar" style="width: ${progresso.toFixed(0)}%"></div></div>
    </div>`;
  return card;
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

