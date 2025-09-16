import {
  initializeApp,
  getApps,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  setDoc,
  serverTimestamp,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  getAuth,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import { carregarUsuariosFinanceiros } from './responsavel-financeiro.js';
import { showToast } from './utils.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const state = {
  currentUser: null,
  destinatarios: [],
  destinatariosMap: new Map(),
  temPermissao: false,
};

const elements = {
  fileInput: null,
  importButton: null,
  reloadButton: null,
  historicoTabela: null,
  fecharDetalhesButton: null,
};

document.addEventListener('DOMContentLoaded', () => {
  elements.fileInput = document.getElementById('planilhaPrecos');
  elements.importButton = document.getElementById('btnImportarPlanilha');
  elements.reloadButton = document.getElementById('btnRecarregarHistorico');
  elements.historicoTabela = document.getElementById('historicoImportacoes');
  elements.fecharDetalhesButton = document.getElementById('btnFecharDetalhes');

  elements.importButton?.addEventListener('click', handleImportacao);
  elements.reloadButton?.addEventListener('click', () => carregarHistorico());
  elements.fecharDetalhesButton?.addEventListener('click', fecharDetalhes);
  elements.historicoTabela?.addEventListener('click', (event) => {
    const botao = event.target.closest('button[data-import-id]');
    if (botao) {
      mostrarDetalhes(botao.dataset.importId);
    }
  });
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  state.currentUser = user;
  try {
    await prepararAmbiente();
  } catch (err) {
    console.error('Erro ao preparar aba Produtos/Preços:', err);
    showToast('Não foi possível carregar os dados iniciais.', 'error');
  }
});

async function prepararAmbiente() {
  await carregarDestinatarios();
  renderizarDestinatarios();
  if (state.temPermissao) {
    await carregarHistorico();
  }
}

async function carregarDestinatarios() {
  const lista = new Map();
  lista.clear?.();
  state.temPermissao = false;

  if (!state.currentUser) return;

  try {
    const { usuarios, isGestor, isResponsavelFinanceiro } =
      await carregarUsuariosFinanceiros(db, state.currentUser);

    state.temPermissao = isGestor || isResponsavelFinanceiro;

    if (!state.temPermissao) {
      bloquearImportacao();
      return;
    }

    if (Array.isArray(usuarios)) {
      usuarios.forEach((u) => {
        if (!u?.uid) return;
        const nome = u.nome || u.email || u.uid;
        const email = u.email || '';
        lista.set(u.uid, { uid: u.uid, nome, email });
      });
    }
  } catch (err) {
    console.warn('Não foi possível carregar usuários financeiros:', err);
  }

  // garante que o usuário atual esteja incluído
  if (state.currentUser?.uid) {
    const nome =
      state.currentUser.displayName || state.currentUser.email || 'Você';
    const email = state.currentUser.email || '';
    lista.set(state.currentUser.uid, {
      uid: state.currentUser.uid,
      nome,
      email,
    });
  }

  // tenta localizar mentorados na subcoleção perfilMentorado/{uid}/usuarios
  try {
    const subCol = collection(
      db,
      `perfilMentorado/${state.currentUser.uid}/usuarios`,
    );
    const snap = await getDocs(subCol);
    snap.forEach((docSnap) => {
      if (!docSnap.id) return;
      const data = docSnap.data() || {};
      const nome = data.nome || data.email || docSnap.id;
      const email = data.email || '';
      lista.set(docSnap.id, { uid: docSnap.id, nome, email });
    });
  } catch (err) {
    console.debug('Sem subcoleção de mentorados ou acesso restrito:', err);
  }

  // verifica possíveis estruturas dentro do documento perfilMentorado do gestor
  try {
    const perfilDoc = await getDoc(
      doc(db, 'perfilMentorado', state.currentUser.uid),
    );
    if (perfilDoc.exists()) {
      const data = perfilDoc.data() || {};
      const candidatos = [
        data.mentorados,
        data.mentoradosIds,
        data.mentoradosUids,
        data.usuarios,
        data.users,
        data.lista,
        data.listaUsuarios,
      ];
      candidatos.forEach((item) => coletarDestinatarios(item, lista));
    }
  } catch (err) {
    console.debug('Não foi possível carregar perfilMentorado do gestor:', err);
  }

  const valores = Array.from(lista.values()).filter((item) => item?.uid);
  valores.sort((a, b) =>
    (a.nome || '').localeCompare(b.nome || '', 'pt-BR', {
      sensitivity: 'base',
    }),
  );

  state.destinatarios = valores;
  state.destinatariosMap = new Map(valores.map((item) => [item.uid, item]));
}

function coletarDestinatarios(fonte, destinoMap) {
  if (!fonte) return;
  if (Array.isArray(fonte)) {
    fonte.forEach((item) => {
      if (!item) return;
      if (typeof item === 'string') {
        destinoMap.set(item, { uid: item, nome: item, email: '' });
      } else if (typeof item === 'object') {
        const uid = item.uid || item.id || item.userId || item.email;
        if (!uid) return;
        const nome = item.nome || item.name || item.email || uid;
        const email = item.email || '';
        destinoMap.set(uid, { uid, nome, email });
      }
    });
    return;
  }
  if (typeof fonte === 'object') {
    Object.entries(fonte).forEach(([uid, value]) => {
      if (!uid) return;
      if (typeof value === 'object' && value) {
        const nome = value.nome || value.name || value.email || uid;
        const email = value.email || '';
        destinoMap.set(uid, { uid, nome, email });
      } else {
        const nome = typeof value === 'string' && value ? value : uid;
        destinoMap.set(uid, { uid, nome, email: '' });
      }
    });
  }
}

function bloquearImportacao() {
  const container = document.getElementById('destinatariosList');
  if (container) {
    container.innerHTML =
      '<p class="text-sm text-gray-500">Apenas gestores ou responsáveis financeiros podem acessar esta aba.</p>';
  }
  const total = document.getElementById('destinatariosTotal');
  if (total) total.textContent = '';
  if (elements.fileInput) elements.fileInput.disabled = true;
  if (elements.importButton) {
    elements.importButton.disabled = true;
    elements.importButton.classList.add('opacity-60', 'cursor-not-allowed');
  }
}

function renderizarDestinatarios() {
  const container = document.getElementById('destinatariosList');
  const total = document.getElementById('destinatariosTotal');
  if (!container) return;

  container.innerHTML = '';

  if (!state.temPermissao) {
    return;
  }

  if (!state.destinatarios.length) {
    container.innerHTML =
      '<p class="text-sm text-gray-500">Nenhum usuário associado encontrado.</p>';
    if (total) total.textContent = '';
    return;
  }

  state.destinatarios.forEach((item) => {
    const badge = document.createElement('span');
    badge.className =
      'inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700';
    badge.textContent = item.nome;
    badge.title = item.email ? `${item.nome} • ${item.email}` : item.nome;
    container.appendChild(badge);
  });

  if (total) {
    const quantidade = state.destinatarios.length;
    total.textContent = `${quantidade} destinatário${
      quantidade > 1 ? 's' : ''
    }`;
  }
}

async function handleImportacao() {
  if (!state.temPermissao) {
    showToast('Acesso restrito à importação.', 'warning');
    return;
  }
  if (!state.currentUser) {
    showToast('Usuário não autenticado.', 'error');
    return;
  }
  if (!state.destinatarios.length) {
    showToast('Nenhum destinatário encontrado para replicação.', 'warning');
    return;
  }
  if (!elements.fileInput) {
    showToast('Campo de arquivo não encontrado.', 'error');
    return;
  }

  const arquivo = elements.fileInput.files[0];
  if (!arquivo) {
    showToast('Selecione um arquivo primeiro!', 'warning');
    return;
  }

  const hoje = new Date().toISOString().slice(0, 10);
  let dataReferencia = window.prompt(
    'Informe a data de referência da planilha (AAAA-MM-DD):',
    hoje,
  );

  if (dataReferencia === null) {
    return;
  }

  dataReferencia = dataReferencia.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataReferencia)) {
    showToast('Data inválida. Utilize o formato AAAA-MM-DD.', 'error');
    return;
  }

  toggleImportButton(true);
  try {
    const itens = await lerPlanilha(arquivo);
    if (!itens.length) {
      showToast('Nenhum item válido encontrado na planilha.', 'warning');
      return;
    }

    const sincronizacao = await atualizarPrecosSistema(
      itens,
      dataReferencia,
      arquivo.name,
    );

    await salvarImportacao(itens, dataReferencia, arquivo.name);

    let mensagem = 'Planilha importada com sucesso!';
    if (sincronizacao?.atualizados) {
      const plural = sincronizacao.atualizados === 1 ? '' : 's';
      mensagem += ` ${sincronizacao.atualizados} preço${plural} atualizado${plural}.`;
    } else if (sincronizacao?.encontrados) {
      mensagem += ' Nenhum preço existente precisava de atualização.';
    }

    showToast(mensagem, 'success');
    if (elements.fileInput) elements.fileInput.value = '';
    await carregarHistorico();
  } catch (err) {
    console.error('Erro ao importar planilha de produtos:', err);
    showToast(
      'Erro ao importar planilha. Verifique o arquivo e tente novamente.',
      'error',
    );
  } finally {
    toggleImportButton(false);
  }
}

function toggleImportButton(loading) {
  if (!elements.importButton) return;
  elements.importButton.disabled = loading;
  elements.importButton.classList.toggle('opacity-60', loading);
  if (loading) {
    elements.importButton.textContent = 'Importando...';
  } else {
    elements.importButton.textContent = 'Importar planilha';
  }
}

async function lerPlanilha(arquivo) {
  if (typeof XLSX === 'undefined') {
    throw new Error('Biblioteca XLSX não carregada');
  }

  const extensao = (arquivo.name || '').toLowerCase();
  const isCsv = extensao.endsWith('.csv');

  const rows = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = (event) => {
      try {
        let workbook;
        if (isCsv) {
          const conteudo = event.target?.result;
          workbook = XLSX.read(conteudo, { type: 'string' });
        } else {
          const data = new Uint8Array(event.target?.result || []);
          workbook = XLSX.read(data, { type: 'array' });
        }
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    if (isCsv) {
      reader.readAsText(arquivo, 'utf-8');
    } else {
      reader.readAsArrayBuffer(arquivo);
    }
  });

  if (!Array.isArray(rows) || rows.length === 0) return [];

  const [cabecalhosBrutos, ...linhas] = rows;
  if (!cabecalhosBrutos || cabecalhosBrutos.length === 0) return [];

  const cabecalhos = cabecalhosBrutos.map((c) => normalizarTexto(c));

  const indiceSku = encontrarIndiceCabecalho(cabecalhos, [
    'sku',
    'código',
    'codigo',
    'cod',
    'item',
  ]);
  const indiceProduto = encontrarIndiceCabecalho(cabecalhos, [
    'produto',
    'nome do produto',
    'descricao',
    'descrição',
    'nome',
  ]);
  const indiceSobra = encontrarIndiceCabecalho(cabecalhos, [
    'sobra (r$)',
    'sobra',
    'valor',
    'preço',
    'preco',
  ]);

  const resultado = [];
  linhas.forEach((linha, linhaIndex) => {
    if (!Array.isArray(linha)) return;
    const sku = indiceSku >= 0 ? String(linha[indiceSku] || '').trim() : '';
    const produto =
      indiceProduto >= 0 ? String(linha[indiceProduto] || '').trim() : '';
    const sobraRaw = indiceSobra >= 0 ? linha[indiceSobra] : undefined;
    const sobra = converterNumero(sobraRaw);
    if (!sku && !produto && sobra == null) return;
    resultado.push({ sku, produto, sobra, ordem: linhaIndex + 1 });
  });

  return resultado;
}

function normalizarTexto(valor) {
  return String(valor || '')
    .toLowerCase()
    .trim();
}

function encontrarIndiceCabecalho(cabecalhos, candidatos) {
  return cabecalhos.findIndex((cab) => candidatos.includes(cab));
}

function converterNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? Number(valor) : null;
  }
  const texto = String(valor)
    .trim()
    .replace(/[^0-9,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarSkuChave(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase();
}

function numerosSaoQuaseIguais(a, b, tolerancia = 0.009) {
  if (a == null || b == null) return false;
  const numA = Number(a);
  const numB = Number(b);
  if (!Number.isFinite(numA) || !Number.isFinite(numB)) return false;
  return Math.abs(numA - numB) <= tolerancia;
}

const CAMPOS_PRECO_PRIORIDADE = [
  'precoTabela',
  'precoMinimo',
  'preco',
  'precoVenda',
  'precoAtual',
  'valor',
  'sobra',
];

function extrairCampoPreco(dados) {
  if (!dados || typeof dados !== 'object') {
    return { campo: 'precoTabela', valor: null };
  }

  for (const campo of CAMPOS_PRECO_PRIORIDADE) {
    if (!Object.prototype.hasOwnProperty.call(dados, campo)) continue;
    const valor = converterNumero(dados[campo]);
    if (valor != null) {
      return { campo, valor };
    }
  }

  return { campo: 'precoTabela', valor: null };
}

async function atualizarPrecosSistema(produtos, dataReferencia, arquivoNome) {
  if (!Array.isArray(produtos) || !produtos.length) {
    return { atualizados: 0, encontrados: 0 };
  }

  const itensMap = new Map();
  produtos.forEach((item) => {
    const skuChave = normalizarSkuChave(item.sku);
    if (!skuChave) return;
    const precoRaw =
      typeof item.sobra === 'number' ? item.sobra : converterNumero(item.sobra);
    if (precoRaw == null) return;
    const precoNormalizado = Math.round(precoRaw * 100) / 100;
    itensMap.set(skuChave, {
      ...item,
      preco: precoNormalizado,
      skuNormalizado: skuChave,
      skuOriginal: String(item.sku || '').trim(),
    });
  });

  if (!itensMap.size) {
    return { atualizados: 0, encontrados: 0 };
  }

  const uids = Array.from(
    new Set(
      (state.destinatarios || [])
        .map((dest) => dest?.uid)
        .filter((uid) => typeof uid === 'string' && uid),
    ),
  );

  if (!uids.length) {
    return { atualizados: 0, encontrados: 0 };
  }

  let totalAtualizados = 0;
  let totalEncontrados = 0;

  for (const uid of uids) {
    try {
      const resultado = await atualizarPrecosParaUid(
        uid,
        itensMap,
        dataReferencia,
        arquivoNome,
      );
      totalAtualizados += resultado.atualizados;
      totalEncontrados += resultado.encontrados;
    } catch (err) {
      console.warn(`Falha ao atualizar preços para ${uid}:`, err);
    }
  }

  return { atualizados: totalAtualizados, encontrados: totalEncontrados };
}

async function atualizarPrecosParaUid(
  uid,
  itensMap,
  dataReferencia,
  arquivoNome,
) {
  if (!uid) return { atualizados: 0, encontrados: 0 };

  const existentes = await buscarProdutosExistentes(uid, itensMap);
  if (!existentes.size) {
    return { atualizados: 0, encontrados: 0 };
  }

  const batch = criarBatchManager();
  let encontrados = 0;

  for (const [skuChave, item] of itensMap.entries()) {
    const existente = existentes.get(skuChave);
    if (!existente) continue;

    encontrados++;
    const novoPreco = item.preco;
    if (novoPreco == null) continue;

    const { campo, valor: precoAtual } = extrairCampoPreco(existente.data);
    if (precoAtual != null && numerosSaoQuaseIguais(precoAtual, novoPreco)) {
      continue;
    }

    const updateData = {
      precoTabela: novoPreco,
      precoTabelaAtualizadoEm: serverTimestamp(),
      precoTabelaFonte: 'importacao-produtos-precos',
    };

    if (campo && campo !== 'precoTabela') {
      updateData[campo] = novoPreco;
    }
    if (dataReferencia) {
      updateData.precoTabelaReferencia = dataReferencia;
    }
    if (arquivoNome) {
      updateData.precoTabelaArquivo = arquivoNome;
    }
    if (state.currentUser?.uid) {
      updateData.precoTabelaAtualizadoPor = state.currentUser.uid;
    }
    if (state.currentUser?.email) {
      updateData.precoTabelaAtualizadoPorEmail = state.currentUser.email;
    }
    if (state.currentUser?.displayName) {
      updateData.precoTabelaAtualizadoPorNome = state.currentUser.displayName;
    }
    if (item.produto && !existente.data.produto) {
      updateData.produto = item.produto;
    }

    await batch.update(existente.ref, updateData);
  }

  await batch.finalize();

  return { atualizados: batch.getTotal(), encontrados };
}

async function buscarProdutosExistentes(uid, itensMap) {
  const encontrados = new Map();
  const produtosCol = collection(db, 'uid', uid, 'produtos');
  const skusOriginais = Array.from(
    new Set(
      Array.from(itensMap.values())
        .map((item) => String(item.skuOriginal || item.sku || '').trim())
        .filter(Boolean),
    ),
  );

  const chunkSize = 10;
  for (let i = 0; i < skusOriginais.length; i += chunkSize) {
    const chunk = skusOriginais.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    try {
      const q = query(produtosCol, where('sku', 'in', chunk));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const skuDoc = normalizarSkuChave(data.sku || docSnap.id);
        if (!skuDoc || encontrados.has(skuDoc)) return;
        encontrados.set(skuDoc, {
          ref: doc(db, 'uid', uid, 'produtos', docSnap.id),
          data,
        });
      });
    } catch (err) {
      console.warn(`Falha na consulta de produtos por SKU (${uid}):`, err);
      break;
    }
  }

  if (encontrados.size < itensMap.size) {
    try {
      const snapTodos = await getDocs(produtosCol);
      snapTodos.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const skuDoc = normalizarSkuChave(data.sku || docSnap.id);
        if (!skuDoc || encontrados.has(skuDoc)) return;
        encontrados.set(skuDoc, {
          ref: doc(db, 'uid', uid, 'produtos', docSnap.id),
          data,
        });
      });
    } catch (err) {
      console.warn(`Falha ao carregar produtos cadastrados (${uid}):`, err);
    }
  }

  return encontrados;
}

function criarBatchManager() {
  let batch = writeBatch(db);
  let operacoes = 0;
  let total = 0;

  async function commitInterno() {
    if (operacoes === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    operacoes = 0;
  }

  return {
    async update(ref, data) {
      batch.update(ref, data);
      operacoes += 1;
      total += 1;
      if (operacoes >= 450) {
        await commitInterno();
      }
    },
    async finalize() {
      await commitInterno();
    },
    getTotal() {
      return total;
    },
  };
}

async function salvarImportacao(produtos, dataReferencia, arquivoNome) {
  if (!state.currentUser) return;
  const importId = `${dataReferencia}-${Date.now()}`;

  const destinatariosIds = state.destinatarios.map((item) => item.uid);

  const baseMetadata = {
    importId,
    dataReferencia,
    arquivoNome,
    totalProdutos: produtos.length,
    autorUid: state.currentUser.uid,
    autorEmail: state.currentUser.email || '',
    autorNome: state.currentUser.displayName || '',
    destinatarios: destinatariosIds,
    gestorUid: state.currentUser.uid,
  };

  const centralRef = doc(collection(db, 'produtosPrecos'), importId);
  await setDoc(centralRef, {
    ...baseMetadata,
    criadoEm: serverTimestamp(),
  });
  await salvarItensImportados(centralRef, produtos, dataReferencia, importId);

  for (const destinatario of state.destinatarios) {
    const destinoRef = doc(
      db,
      `uid/${destinatario.uid}/produtosPrecos/${importId}`,
    );
    await setDoc(destinoRef, {
      ...baseMetadata,
      visivelParaUid: destinatario.uid,
      criadoEm: serverTimestamp(),
    });
    await salvarItensImportados(destinoRef, produtos, dataReferencia, importId);
  }

  return importId;
}

async function salvarItensImportados(
  docRef,
  produtos,
  dataReferencia,
  importId,
) {
  if (!produtos.length) return;
  const itensCol = collection(docRef, 'itens');
  const loteTamanho = 400;

  for (let i = 0; i < produtos.length; i += loteTamanho) {
    const lote = produtos.slice(i, i + loteTamanho);
    const batch = writeBatch(db);
    lote.forEach((item, index) => {
      const ordem = i + index + 1;
      const docId = gerarIdItem(item, ordem);
      const itemRef = doc(itensCol, docId);
      batch.set(itemRef, {
        importId,
        dataReferencia,
        ordem,
        sku: item.sku || '',
        produto: item.produto || '',
        sobra: item.sobra ?? null,
        atualizadoEm: serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

function gerarIdItem(item, ordemFallback) {
  const base = (item?.sku || '')
    .toString()
    .trim()
    .replace(/[\/#?\[\]]/g, '-')
    .replace(/\s+/g, '-');
  if (!base) return `item-${ordemFallback}`;
  return base.slice(0, 120);
}

async function carregarHistorico() {
  const corpo = document.getElementById('historicoImportacoes');
  const vazio = document.getElementById('historicoVazio');
  if (!corpo) return;

  if (!state.temPermissao) {
    corpo.innerHTML = '';
    if (vazio) vazio.classList.remove('hidden');
    return;
  }

  corpo.innerHTML =
    '<tr><td colspan="6" class="px-4 py-4 text-sm text-gray-500">Carregando importações...</td></tr>';
  if (vazio) vazio.classList.add('hidden');

  try {
    const baseCol = collection(db, 'produtosPrecos');
    let docs = [];
    try {
      const q = query(
        baseCol,
        where('autorUid', '==', state.currentUser.uid),
        orderBy('criadoEm', 'desc'),
      );
      const snap = await getDocs(q);
      docs = snap.docs;
    } catch (err) {
      if (err.code === 'failed-precondition') {
        const fallbackSnap = await getDocs(
          query(baseCol, orderBy('criadoEm', 'desc')),
        );
        docs = fallbackSnap.docs.filter(
          (docSnap) => docSnap.data()?.autorUid === state.currentUser.uid,
        );
      } else {
        throw err;
      }
    }

    renderizarHistorico(
      docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })),
    );
  } catch (err) {
    console.error('Erro ao carregar histórico de importações:', err);
    corpo.innerHTML =
      '<tr><td colspan="6" class="px-4 py-4 text-sm text-red-500">Erro ao carregar histórico.</td></tr>';
  }
}

function renderizarHistorico(importacoes) {
  const corpo = document.getElementById('historicoImportacoes');
  const vazio = document.getElementById('historicoVazio');
  if (!corpo) return;

  corpo.innerHTML = '';

  if (!Array.isArray(importacoes) || importacoes.length === 0) {
    if (vazio) vazio.classList.remove('hidden');
    return;
  }
  if (vazio) vazio.classList.add('hidden');

  importacoes
    .sort((a, b) => {
      const aTime = obterTime(a.criadoEm);
      const bTime = obterTime(b.criadoEm);
      return bTime - aTime;
    })
    .forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-3">${escapeHtml(formatarData(item.dataReferencia))}</td>
        <td class="px-4 py-3">${escapeHtml(formatarDataHora(item.criadoEm))}</td>
        <td class="px-4 py-3">${escapeHtml(item.arquivoNome || '-')}</td>
        <td class="px-4 py-3 text-center">${item.totalProdutos ?? '-'}</td>
        <td class="px-4 py-3">${escapeHtml(
          descreverDestinatarios(item.destinatarios),
        )}</td>
        <td class="px-4 py-3 text-right">
          <button
            data-import-id="${escapeHtml(item.id)}"
            class="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Ver itens
          </button>
        </td>
      `;
      corpo.appendChild(tr);
    });
}

function obterTime(valor) {
  if (!valor) return 0;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 0 : data.getTime();
}

function descreverDestinatarios(lista) {
  if (!Array.isArray(lista) || !lista.length) return '-';
  const nomes = lista
    .map((uid) => state.destinatariosMap.get(uid)?.nome || uid)
    .slice(0, 3);
  const extras = lista.length - nomes.length;
  return `${nomes.join(', ')}${extras > 0 ? ` +${extras}` : ''}`;
}

async function mostrarDetalhes(importId) {
  if (!importId) return;
  const card = document.getElementById('detalhesImportacaoCard');
  const tabela = document.getElementById('detalhesImportacaoTabela');
  const info = document.getElementById('detalhesImportacaoInfo');
  if (!card || !tabela || !info) return;

  card.classList.remove('hidden');
  tabela.innerHTML =
    '<tr><td colspan="4" class="px-4 py-3 text-sm text-gray-500">Carregando itens...</td></tr>';
  info.textContent = '';

  try {
    const docRef = doc(db, 'produtosPrecos', importId);
    const [metaSnap, itensSnap] = await Promise.all([
      getDoc(docRef),
      getDocs(collection(docRef, 'itens')),
    ]);

    const meta = metaSnap.exists() ? metaSnap.data() : null;
    const itens = itensSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    if (meta) {
      const total = meta.totalProdutos ?? itens.length;
      info.textContent = `Importação ${formatarData(
        meta.dataReferencia,
      )} • ${total} produto${total === 1 ? '' : 's'} • ${formatarDataHora(
        meta.criadoEm,
      )}`;
    } else {
      info.textContent = `Importação ${importId}`;
    }

    renderizarItensDetalhes(itens, tabela);
  } catch (err) {
    console.error('Erro ao carregar itens importados:', err);
    tabela.innerHTML =
      '<tr><td colspan="4" class="px-4 py-3 text-sm text-red-500">Erro ao carregar itens.</td></tr>';
  }
}

function renderizarItensDetalhes(itens, tabela) {
  tabela.innerHTML = '';
  if (!Array.isArray(itens) || !itens.length) {
    tabela.innerHTML =
      '<tr><td colspan="4" class="px-4 py-3 text-sm text-gray-500">Nenhum item encontrado.</td></tr>';
    return;
  }

  itens.forEach((item, index) => {
    const tr = document.createElement('tr');

    const ordem = document.createElement('td');
    ordem.className = 'px-4 py-2 text-xs text-gray-500';
    ordem.textContent = String(item.ordem || index + 1);

    const sku = document.createElement('td');
    sku.className = 'px-4 py-2 font-mono';
    sku.textContent = item.sku || '';

    const produto = document.createElement('td');
    produto.className = 'px-4 py-2';
    produto.textContent = item.produto || '';

    const sobra = document.createElement('td');
    sobra.className = 'px-4 py-2 text-right';
    sobra.textContent = formatarMoeda(item.sobra);

    tr.append(ordem, sku, produto, sobra);
    tabela.appendChild(tr);
  });
}

function fecharDetalhes() {
  const card = document.getElementById('detalhesImportacaoCard');
  if (card) card.classList.add('hidden');
}

function formatarData(valor) {
  if (!valor) return '-';
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  return data.toLocaleDateString('pt-BR');
}

function formatarDataHora(valor) {
  if (!valor) return '-';
  if (typeof valor.toDate === 'function') {
    return valor.toDate().toLocaleString('pt-BR');
  }
  if (valor instanceof Date) {
    return valor.toLocaleString('pt-BR');
  }
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleString('pt-BR');
}

function formatarMoeda(valor) {
  if (valor === null || valor === undefined) return '-';
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '-';
  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function escapeHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
