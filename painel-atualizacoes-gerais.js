import {
  initializeApp,
  getApps,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  getAuth,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import { carregarUsuariosFinanceiros } from './responsavel-financeiro.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const formMensagem = document.getElementById('formMensagem');
const formProblema = document.getElementById('formProblema');
const formProduto = document.getElementById('formProduto');
const mensagemInput = document.getElementById('mensagemTexto');
const problemaTituloInput = document.getElementById('problemaTitulo');
const problemaSolucaoInput = document.getElementById('problemaSolucao');
const problemaSetorInput = document.getElementById('problemaSetor');
const problemaResponsavelInput = document.getElementById('problemaResponsavel');
const problemaDataInput = document.getElementById('problemaData');
const produtoNomeInput = document.getElementById('produtoNome');
const produtoObsInput = document.getElementById('produtoObs');

const listaMensagensEl = document.getElementById('listaMensagens');
const listaProblemasEl = document.getElementById('listaProblemas');
const listaProdutosEl = document.getElementById('listaProdutos');
const mensagensVazioEl = document.getElementById('mensagensVazio');
const problemasVazioEl = document.getElementById('problemasVazio');
const produtosVazioEl = document.getElementById('produtosVazio');
const mensagemStatusEl = document.getElementById('mensagemStatus');
const problemaStatusEl = document.getElementById('problemaStatus');
const produtoStatusEl = document.getElementById('produtoStatus');
const painelStatusEl = document.getElementById('painelStatus');
const produtosAvisoEl = document.getElementById('produtosAviso');
const mensagemEscopoEl = document.getElementById('mensagemEscopo');

let currentUser = null;
let participantesCompartilhamento = [];
let mensagensUnsub = null;
let problemasUnsub = null;
let produtosManualUnsub = null;
const produtosImportacoesUnsub = { user: null, responsavel: null };
const produtosImportadosUnsub = { user: null, responsavel: null };
let nomeResponsavel = '';
let manualProdutosCache = [];
let importadosProdutosCache = [];
let manualProdutosPronto = false;
let importadosProdutosPronto = false;
let ultimaImportacaoMeta = null;
let importadosOrigemAtual = null;
let responsavelFinanceiroUid = '';
let responsavelFinanceiroEmail = '';
let responsavelFinanceiroNome = '';
const importacaoEstado = {
  user: { meta: null, itens: [], pronto: false },
  responsavel: { meta: null, itens: [], pronto: false },
};

function setStatus(element, message = '', isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('text-red-600', Boolean(message) && isError);
  element.classList.toggle('text-gray-500', !isError);
}

function showTemporaryStatus(
  element,
  message,
  isError = false,
  timeout = 5000,
) {
  if (!element) return;
  if (message) {
    element.dataset.temporaryStatus = '1';
  } else {
    delete element.dataset.temporaryStatus;
  }
  setStatus(element, message, isError);
  if (message) {
    setTimeout(() => {
      if (!element) return;
      if (element.dataset.temporaryStatus !== '1') return;
      if (element.textContent === message) {
        setStatus(element, '');
      }
      delete element.dataset.temporaryStatus;
    }, timeout);
  }
}

function formatDate(value, includeTime = true) {
  if (!value) return '';
  let date = null;
  if (value.toDate) {
    try {
      date = value.toDate();
    } catch (_) {
      date = null;
    }
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      date = parsed;
    }
  }
  if (!date) return '';
  return includeTime
    ? date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : date.toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

function obterNomeProduto(item) {
  if (!item || typeof item !== 'object') return '';
  return item.nome || item.produto || '';
}

function compararProdutosPorNome(a, b) {
  const nomeA = obterNomeProduto(a).toLowerCase();
  const nomeB = obterNomeProduto(b).toLowerCase();
  if (nomeA && nomeB && nomeA !== nomeB) {
    return nomeA.localeCompare(nomeB, 'pt-BR');
  }
  if (nomeA && !nomeB) return -1;
  if (!nomeA && nomeB) return 1;

  const skuA = (a?.sku || '').toLowerCase();
  const skuB = (b?.sku || '').toLowerCase();
  if (skuA && skuB && skuA !== skuB) {
    return skuA.localeCompare(skuB, 'pt-BR');
  }
  if (skuA && !skuB) return -1;
  if (!skuA && skuB) return 1;

  if (typeof a?.ordem === 'number' && typeof b?.ordem === 'number') {
    return a.ordem - b.ordem;
  }

  return 0;
}

function renderProdutoManual(item = {}) {
  const card = document.createElement('article');
  card.className =
    'bg-white border border-emerald-100 rounded-lg p-3 shadow-sm';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between text-sm text-gray-700';

  const nomeEl = document.createElement('span');
  nomeEl.className = 'font-semibold';
  nomeEl.textContent = item.nome || 'Produto sem nome';
  header.appendChild(nomeEl);

  if (item.autorNome) {
    const autorEl = document.createElement('span');
    autorEl.className = 'text-xs text-gray-500';
    autorEl.textContent = `Por ${item.autorNome}`;
    header.appendChild(autorEl);
  }

  card.appendChild(header);

  if (item.observacoes) {
    const obs = document.createElement('p');
    obs.className = 'mt-2 text-sm text-gray-600 whitespace-pre-line';
    obs.textContent = item.observacoes;
    card.appendChild(obs);
  }

  if (item.createdAt) {
    const dataCriacao = document.createElement('p');
    dataCriacao.className = 'mt-2 text-[11px] text-gray-400';
    dataCriacao.textContent = `Atualizado em ${formatDate(item.createdAt, true)}`;
    card.appendChild(dataCriacao);
  }

  return card;
}

function renderProdutoImportado(item = {}) {
  const card = document.createElement('article');
  card.className =
    'bg-white border border-emerald-100 rounded-lg p-3 shadow-sm space-y-2';

  const header = document.createElement('div');
  header.className = 'flex items-start justify-between gap-2';

  const nomeEl = document.createElement('span');
  nomeEl.className = 'font-semibold text-sm text-gray-800';
  nomeEl.textContent = obterNomeProduto(item) || 'Produto sem nome';
  header.appendChild(nomeEl);

  const precoTexto = formatCurrency(item.sobra);
  if (precoTexto) {
    const precoEl = document.createElement('span');
    precoEl.className =
      'text-sm font-semibold text-emerald-600 whitespace-nowrap';
    precoEl.textContent = precoTexto;
    header.appendChild(precoEl);
  }

  card.appendChild(header);

  if (item.sku) {
    const skuRow = document.createElement('p');
    skuRow.className = 'text-xs text-gray-600';
    const label = document.createElement('span');
    label.className = 'font-medium text-gray-700';
    label.textContent = 'SKU: ';
    const skuValue = document.createElement('span');
    skuValue.className = 'font-mono text-gray-700';
    skuValue.textContent = item.sku;
    skuRow.appendChild(label);
    skuRow.appendChild(skuValue);
    card.appendChild(skuRow);
  }

  const footer = document.createElement('div');
  footer.className = 'text-[11px] text-gray-400 flex flex-wrap gap-x-2 gap-y-1';

  const dataReferencia =
    item.dataReferencia || ultimaImportacaoMeta?.dataReferencia || '';
  const referenciaFormatada = formatDate(dataReferencia, false);
  if (referenciaFormatada) {
    const refSpan = document.createElement('span');
    refSpan.textContent = `Referência ${referenciaFormatada}`;
    footer.appendChild(refSpan);
  }

  const atualizadoFonte =
    item.atualizadoEm || ultimaImportacaoMeta?.criadoEm || null;
  const atualizadoFormatado = formatDate(atualizadoFonte, true);
  if (atualizadoFormatado) {
    const attSpan = document.createElement('span');
    attSpan.textContent = `Importado em ${atualizadoFormatado}`;
    footer.appendChild(attSpan);
  }

  const responsavelDescricao =
    ultimaImportacaoMeta?.autorNome ||
    ultimaImportacaoMeta?.autorEmail ||
    responsavelFinanceiroNome ||
    responsavelFinanceiroEmail ||
    '';
  if (responsavelDescricao) {
    const respSpan = document.createElement('span');
    respSpan.textContent = `Responsável: ${responsavelDescricao}`;
    footer.appendChild(respSpan);
  }

  if (importadosOrigemAtual === 'responsavel') {
    const origemSpan = document.createElement('span');
    origemSpan.textContent = 'Compartilhado pelo responsável financeiro';
    footer.appendChild(origemSpan);
  }

  if (footer.childElementCount) {
    card.appendChild(footer);
  }

  return card;
}

function renderProdutoCard(item) {
  if (item?.tipo === 'importado') {
    return renderProdutoImportado(item);
  }
  return renderProdutoManual(item);
}

async function montarEscopoCompartilhamento(user) {
  const participantes = new Set();
  const emails = new Set();
  const equipesParaInspecionar = new Set();
  let responsavelUid = responsavelFinanceiroUid || '';
  let responsavelEmail = responsavelFinanceiroEmail || '';
  let responsavelEmailNormalizado = responsavelEmail
    ? responsavelEmail.trim().toLowerCase()
    : '';

  const addUid = (uid) => {
    if (uid && typeof uid === 'string') {
      participantes.add(uid);
    }
  };

  const addEmail = (email) => {
    if (!email) return;
    const normalized = String(email).trim().toLowerCase();
    if (normalized) emails.add(normalized);
  };

  addUid(user.uid);
  if (user.email) addEmail(user.email);

  const usuarioDoc = await getDoc(doc(db, 'usuarios', user.uid));
  const usuarioData = usuarioDoc.exists() ? usuarioDoc.data() : {};
  const uidDoc = await getDoc(doc(db, 'uid', user.uid));
  const uidData = uidDoc.exists() ? uidDoc.data() : {};
  const perfil = usuarioData.perfil || uidData.perfil || '';

  const coletarDadosCompartilhamento = (data) => {
    if (!data || typeof data !== 'object') return;
    if (!responsavelUid && data.responsavelFinanceiroUid) {
      responsavelUid = data.responsavelFinanceiroUid;
    }
    if (!responsavelEmail && data.responsavelFinanceiroEmail) {
      responsavelEmail = String(data.responsavelFinanceiroEmail).trim();
      responsavelEmailNormalizado = responsavelEmail.toLowerCase();
    }
    const uidFields = [
      'responsavelFinanceiroUid',
      'responsavelExpedicaoUid',
      'gestorUid',
      'gestoresFinanceirosUids',
      'gestoresExpedicaoUids',
      'equipeUids',
      'equipesUids',
      'timeUids',
    ];
    uidFields.forEach((field) => {
      const value = data[field];
      if (!value) return;
      if (Array.isArray(value)) value.forEach(addUid);
      else addUid(value);
    });

    const emailFields = [
      'responsavelFinanceiroEmail',
      'responsavelExpedicaoEmail',
      'gestorEmail',
      'gestoresFinanceirosEmails',
      'gestoresExpedicaoEmails',
      'equipeEmails',
      'equipesEmails',
      'timeEmails',
      'teamEmails',
      'responsaveisEquipeEmails',
      'usuariosEquipeEmails',
    ];
    emailFields.forEach((field) => {
      const value = data[field];
      if (!value) return;
      if (Array.isArray(value)) value.forEach(addEmail);
      else addEmail(value);
    });

    if (Array.isArray(data.equipe)) {
      data.equipe.forEach((item) => {
        if (item?.email) addEmail(item.email);
        if (item?.uid) addUid(item.uid);
      });
    }
    if (Array.isArray(data.team)) {
      data.team.forEach((item) => {
        if (item?.email) addEmail(item.email);
        if (item?.uid) addUid(item.uid);
      });
    }
  };

  const adicionarMembrosEquipe = async (ownerUid) => {
    if (!ownerUid) return;
    try {
      const membrosRef = collection(
        db,
        'artifacts',
        'equipes',
        'users',
        ownerUid,
        'members',
      );
      const membrosSnap = await getDocs(membrosRef);
      membrosSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (data.email) addEmail(data.email);
        if (data.uid) addUid(data.uid);
      });
    } catch (err) {
      console.error('Erro ao carregar membros da equipe:', err);
    }

    try {
      const expRef = collection(db, 'uid', ownerUid, 'expedicaoTeam');
      const expSnap = await getDocs(expRef);
      expSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (data.email) addEmail(data.email);
        if (data.uid) addUid(data.uid);
      });
    } catch (err) {
      console.error('Erro ao carregar equipe de expedição:', err);
    }
  };

  coletarDadosCompartilhamento(usuarioData);
  coletarDadosCompartilhamento(uidData);
  await adicionarMembrosEquipe(user.uid);

  const meuEmail = user.email ? user.email.toLowerCase() : '';
  if (meuEmail) {
    try {
      const consultas = [
        getDocs(
          query(
            collection(db, 'usuarios'),
            where('responsavelFinanceiroEmail', '==', meuEmail),
          ),
        ),
        getDocs(
          query(
            collection(db, 'usuarios'),
            where('responsavelExpedicaoEmail', '==', meuEmail),
          ),
        ),
        getDocs(
          query(
            collection(db, 'usuarios'),
            where('gestoresFinanceirosEmails', 'array-contains', meuEmail),
          ),
        ),
        getDocs(
          query(
            collection(db, 'usuarios'),
            where('gestoresExpedicaoEmails', 'array-contains', meuEmail),
          ),
        ),
      ];
      const resultados = await Promise.all(consultas);
      resultados.forEach((snap) => {
        snap.forEach((docSnap) => {
          addUid(docSnap.id);
          coletarDadosCompartilhamento(docSnap.data());
        });
      });
    } catch (err) {
      console.error(
        'Erro ao localizar usuários vinculados ao seu e-mail:',
        err,
      );
    }

    try {
      const membrosSnap = await getDocs(
        query(collectionGroup(db, 'members'), where('email', '==', meuEmail)),
      );
      membrosSnap.forEach((docSnap) => {
        const pathSegments = docSnap.ref.path.split('/');
        const usersIndex = pathSegments.indexOf('users');
        if (usersIndex >= 0 && usersIndex + 1 < pathSegments.length) {
          const ownerUid = pathSegments[usersIndex + 1];
          addUid(ownerUid);
          equipesParaInspecionar.add(ownerUid);
        }
      });
    } catch (err) {
      console.error('Erro ao localizar equipes que incluem o usuário:', err);
    }
  }

  for (const ownerUid of equipesParaInspecionar) {
    await adicionarMembrosEquipe(ownerUid);
  }

  const adicionarUidsPorEmails = async () => {
    const processados = new Set();
    let pendentes = Array.from(emails).filter(
      (email) => email && !processados.has(email),
    );
    while (pendentes.length) {
      const lote = pendentes.slice(0, 10);
      try {
        const snap = await getDocs(
          query(collection(db, 'usuarios'), where('email', 'in', lote)),
        );
        const encontrados = new Set();
        snap.forEach((docSnap) => {
          addUid(docSnap.id);
          const data = docSnap.data() || {};
          const email = (data.email || '').toLowerCase();
          if (email) encontrados.add(email);
          if (!responsavelUid && responsavelEmailNormalizado === email) {
            responsavelUid = docSnap.id;
            if (!responsavelFinanceiroNome && data.nome) {
              responsavelFinanceiroNome = data.nome;
            }
          }
          coletarDadosCompartilhamento(data);
        });
        for (const email of lote) {
          processados.add(email);
        }
        const faltantes = lote.filter((email) => !encontrados.has(email));
        for (const email of faltantes) {
          try {
            const altSnap = await getDocs(
              query(collection(db, 'uid'), where('email', '==', email)),
            );
            altSnap.forEach((docSnap) => {
              addUid(docSnap.id);
              coletarDadosCompartilhamento(docSnap.data());
              const altData = docSnap.data() || {};
              const altEmail = (altData.email || '').toLowerCase();
              if (!responsavelUid && responsavelEmailNormalizado) {
                if (altEmail && altEmail === responsavelEmailNormalizado) {
                  responsavelUid = docSnap.id;
                  if (!responsavelFinanceiroNome && altData.nome) {
                    responsavelFinanceiroNome = altData.nome;
                  }
                }
              }
            });
          } catch (err) {
            console.error('Erro ao buscar UID pelo e-mail:', err);
          }
        }
      } catch (err) {
        console.error('Erro ao mapear e-mails para usuários:', err);
        for (const email of lote) {
          processados.add(email);
        }
      }
      pendentes = Array.from(emails).filter(
        (email) => email && !processados.has(email),
      );
    }
  };

  await adicionarUidsPorEmails();

  if (!responsavelUid && typeof window !== 'undefined') {
    if (window.responsavelFinanceiro?.uid) {
      responsavelUid = window.responsavelFinanceiro.uid;
    }
    if (window.responsavelFinanceiro?.email) {
      responsavelEmail = window.responsavelFinanceiro.email;
      responsavelEmailNormalizado = String(responsavelEmail)
        .trim()
        .toLowerCase();
    }
    if (window.responsavelFinanceiro?.nome) {
      responsavelFinanceiroNome = window.responsavelFinanceiro.nome;
    }
  }

  return {
    participantes: Array.from(participantes),
    perfil,
    responsavelFinanceiroUid: responsavelUid || '',
    responsavelFinanceiroEmail: responsavelEmail || '',
  };
}

function atualizarEscopoMensagem(participantes) {
  if (!mensagemEscopoEl) return;
  if (!participantes || participantes.length === 0) {
    mensagemEscopoEl.textContent = '';
    return;
  }
  const quantidade = participantes.length;
  mensagemEscopoEl.textContent = `Compartilhado com ${quantidade} integrante${
    quantidade > 1 ? 's' : ''
  } da equipe.`;
}

function renderMensagem(docSnap) {
  const data = docSnap.data() || {};
  const item = document.createElement('article');
  item.className = 'bg-white border border-blue-100 rounded-lg p-3 shadow-sm';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between text-xs text-gray-500';

  const dataEl = document.createElement('span');
  dataEl.textContent = formatDate(data.createdAt, true) || '—';
  const respEl = document.createElement('span');
  respEl.className = 'font-medium text-gray-600';
  respEl.textContent =
    data.responsavelNome || data.autorNome || 'Responsável não informado';

  header.appendChild(dataEl);
  header.appendChild(respEl);

  const corpo = document.createElement('p');
  corpo.className = 'mt-2 text-sm text-gray-700 whitespace-pre-line';
  corpo.textContent = data.texto || '';

  item.appendChild(header);
  item.appendChild(corpo);

  if (currentUser?.uid && data.autorUid === currentUser.uid) {
    const actions = document.createElement('div');
    actions.className = 'mt-3 flex justify-end';
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className =
      'text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold';
    deleteBtn.innerHTML =
      '<i class="fa-solid fa-trash-can"></i><span>Excluir mensagem</span>';
    deleteBtn.addEventListener('click', async () => {
      if (!window.confirm('Deseja realmente excluir esta mensagem?')) {
        return;
      }
      deleteBtn.disabled = true;
      deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
      try {
        await excluirMensagem(docSnap.id);
      } catch (err) {
        deleteBtn.disabled = false;
        deleteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });
    actions.appendChild(deleteBtn);
    item.appendChild(actions);
  }
  return item;
}

async function excluirMensagem(id) {
  if (!currentUser) return;
  try {
    await deleteDoc(doc(db, 'painelAtualizacoesGerais', id));
    showTemporaryStatus(
      mensagemStatusEl,
      'Mensagem excluída com sucesso.',
      false,
      4000,
    );
  } catch (err) {
    console.error('Erro ao excluir mensagem:', err);
    showTemporaryStatus(
      mensagemStatusEl,
      'Não foi possível excluir a mensagem. Tente novamente.',
      true,
    );
    throw err;
  }
}

function renderProblema(docSnap) {
  const data = docSnap.data() || {};
  const card = document.createElement('article');
  card.className = 'bg-white border border-amber-100 rounded-lg p-3 shadow-sm';

  const header = document.createElement('div');
  header.className =
    'flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500';

  const setorEl = document.createElement('span');
  setorEl.className = 'font-semibold text-gray-700';
  setorEl.textContent = data.setor
    ? `Setor: ${data.setor}`
    : 'Setor não informado';

  const responsavelEl = document.createElement('span');
  responsavelEl.textContent = data.responsavel
    ? `Responsável: ${data.responsavel}`
    : 'Responsável não informado';

  const dataOcorrenciaEl = document.createElement('span');
  dataOcorrenciaEl.textContent = data.dataOcorrencia
    ? `Data: ${formatDate(data.dataOcorrencia, false)}`
    : '';

  header.appendChild(setorEl);
  header.appendChild(responsavelEl);
  if (dataOcorrenciaEl.textContent) header.appendChild(dataOcorrenciaEl);

  const descricao = document.createElement('p');
  descricao.className = 'mt-2 text-sm text-gray-700 whitespace-pre-line';
  descricao.textContent = data.problema || '';

  card.appendChild(header);
  card.appendChild(descricao);

  if (data.solucao) {
    const solucao = document.createElement('p');
    solucao.className =
      'mt-2 text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded p-2';
    solucao.textContent = `Solução: ${data.solucao}`;
    card.appendChild(solucao);
  }

  const rodape = document.createElement('div');
  rodape.className = 'mt-2 text-[11px] text-gray-400 flex justify-between';
  const autor = document.createElement('span');
  autor.textContent = data.autorNome ? `Registrado por ${data.autorNome}` : '';
  const createdAt = document.createElement('span');
  createdAt.textContent = data.createdAt
    ? `Registro: ${formatDate(data.createdAt, true)}`
    : '';
  if (autor.textContent) rodape.appendChild(autor);
  if (createdAt.textContent) rodape.appendChild(createdAt);
  if (rodape.childElementCount) card.appendChild(rodape);

  return card;
}

function carregarMensagens() {
  if (!currentUser) return;
  mensagensUnsub?.();
  const mensagensRef = query(
    collection(db, 'painelAtualizacoesGerais'),
    where('categoria', '==', 'mensagem'),
    where('participantes', 'array-contains', currentUser.uid),
    orderBy('createdAt', 'desc'),
    limit(10),
  );
  mensagensUnsub = onSnapshot(
    mensagensRef,
    (snap) => {
      listaMensagensEl.innerHTML = '';
      if (snap.empty) {
        mensagensVazioEl?.classList.remove('hidden');
        return;
      }
      mensagensVazioEl?.classList.add('hidden');
      const frag = document.createDocumentFragment();
      snap.forEach((docSnap) => {
        frag.appendChild(renderMensagem(docSnap));
      });
      listaMensagensEl.appendChild(frag);
    },
    (err) => {
      console.error('Erro ao carregar mensagens:', err);
      mensagensVazioEl?.classList.remove('hidden');
    },
  );
}

function carregarProblemas() {
  if (!currentUser) return;
  problemasUnsub?.();
  const problemasRef = query(
    collection(db, 'painelAtualizacoesGerais'),
    where('categoria', '==', 'problema'),
    where('participantes', 'array-contains', currentUser.uid),
    orderBy('createdAt', 'desc'),
    limit(25),
  );
  problemasUnsub = onSnapshot(
    problemasRef,
    (snap) => {
      listaProblemasEl.innerHTML = '';
      if (snap.empty) {
        problemasVazioEl?.classList.remove('hidden');
        return;
      }
      problemasVazioEl?.classList.add('hidden');
      const frag = document.createDocumentFragment();
      snap.forEach((docSnap) => frag.appendChild(renderProblema(docSnap)));
      listaProblemasEl.appendChild(frag);
    },
    (err) => {
      console.error('Erro ao carregar problemas:', err);
      problemasVazioEl?.classList.remove('hidden');
    },
  );
}

function resetImportacaoEstado() {
  importacaoEstado.user = { meta: null, itens: [], pronto: false };
  importacaoEstado.responsavel = { meta: null, itens: [], pronto: false };
}

function limparMonitoramentoImportacao(origem) {
  if (!origem) return;
  produtosImportacoesUnsub[origem]?.();
  produtosImportacoesUnsub[origem] = null;
  produtosImportadosUnsub[origem]?.();
  produtosImportadosUnsub[origem] = null;
  importacaoEstado[origem] = { meta: null, itens: [], pronto: false };
}

function iniciarMonitoramentoImportacao(origem, uid) {
  limparMonitoramentoImportacao(origem);
  if (!uid) {
    importacaoEstado[origem].pronto = true;
    atualizarImportadosOrigem();
    return;
  }

  const importacoesRef = query(
    collection(db, 'uid', uid, 'produtosPrecos'),
    orderBy('criadoEm', 'desc'),
    limit(1),
  );

  produtosImportacoesUnsub[origem] = onSnapshot(
    importacoesRef,
    (snap) => {
      if (snap.empty) {
        importacaoEstado[origem].meta = null;
        importacaoEstado[origem].itens = [];
        importacaoEstado[origem].pronto = true;
        produtosImportadosUnsub[origem]?.();
        produtosImportadosUnsub[origem] = null;
        atualizarImportadosOrigem();
        return;
      }

      const docSnap = snap.docs[0];
      importacaoEstado[origem].meta = {
        id: docSnap.id,
        origemUid: uid,
        ...(docSnap.data() || {}),
      };
      monitorarItensImportados(origem, docSnap.ref);
    },
    (err) => {
      console.error(
        `Erro ao carregar importações de produtos/preços (${origem}):`,
        err,
      );
      setStatus(
        produtoStatusEl,
        'Não foi possível carregar as peças importadas.',
        true,
      );
      importacaoEstado[origem].meta = null;
      importacaoEstado[origem].itens = [];
      importacaoEstado[origem].pronto = true;
      produtosImportadosUnsub[origem]?.();
      produtosImportadosUnsub[origem] = null;
      atualizarImportadosOrigem();
    },
  );
}

function monitorarItensImportados(origem, importacaoRef) {
  produtosImportadosUnsub[origem]?.();
  importacaoEstado[origem].itens = [];
  importacaoEstado[origem].pronto = false;

  if (!importacaoRef) {
    importacaoEstado[origem].pronto = true;
    atualizarImportadosOrigem();
    return;
  }

  const itensRef = query(
    collection(importacaoRef, 'itens'),
    orderBy('ordem', 'asc'),
  );

  produtosImportadosUnsub[origem] = onSnapshot(
    itensRef,
    (snap) => {
      const meta = importacaoEstado[origem].meta || {};
      importacaoEstado[origem].itens = snap.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        return {
          tipo: 'importado',
          origem,
          id: docSnap.id,
          produto: data.produto || data.nome || '',
          nome: data.produto || data.nome || '',
          sku: data.sku || '',
          sobra: data.sobra ?? null,
          ordem: data.ordem ?? null,
          dataReferencia: data.dataReferencia || meta.dataReferencia || '',
          atualizadoEm: data.atualizadoEm || meta.criadoEm || null,
        };
      });
      importacaoEstado[origem].pronto = true;
      atualizarImportadosOrigem();
    },
    (err) => {
      console.error(`Erro ao carregar itens importados (${origem}):`, err);
      setStatus(
        produtoStatusEl,
        'Não foi possível carregar as peças importadas.',
        true,
      );
      importacaoEstado[origem].itens = [];
      importacaoEstado[origem].pronto = true;
      atualizarImportadosOrigem();
    },
  );
}

function atualizarImportadosOrigem() {
  const prioridade = [];
  if (currentUser?.uid) prioridade.push('user');
  if (
    responsavelFinanceiroUid &&
    responsavelFinanceiroUid !== currentUser?.uid
  ) {
    prioridade.push('responsavel');
  }

  let selecionada = null;
  for (const origem of prioridade) {
    const estado = importacaoEstado[origem];
    if (estado && estado.itens.length > 0) {
      selecionada = origem;
      break;
    }
  }

  if (!selecionada) {
    for (const origem of prioridade) {
      const estado = importacaoEstado[origem];
      if (estado && estado.pronto) {
        selecionada = origem;
        break;
      }
    }
  }

  importadosOrigemAtual = selecionada;

  if (!selecionada) {
    const todosProntos = prioridade.every(
      (origem) => importacaoEstado[origem]?.pronto,
    );
    importadosProdutosCache = [];
    importadosProdutosPronto = todosProntos;
    ultimaImportacaoMeta = null;
  } else {
    const estado = importacaoEstado[selecionada];
    importadosProdutosCache = estado.itens.slice();
    importadosProdutosPronto = Boolean(estado.pronto);
    ultimaImportacaoMeta = estado.meta || null;
    if (!responsavelFinanceiroNome && ultimaImportacaoMeta?.autorNome) {
      responsavelFinanceiroNome = ultimaImportacaoMeta.autorNome;
    }
    if (!responsavelFinanceiroEmail && ultimaImportacaoMeta?.autorEmail) {
      responsavelFinanceiroEmail = ultimaImportacaoMeta.autorEmail;
    }
  }

  atualizarListaProdutos();
}

function atualizarStatusProdutos() {
  if (!produtoStatusEl) return;
  if (!manualProdutosPronto || !importadosProdutosPronto) return;

  delete produtoStatusEl.dataset.temporaryStatus;

  const mensagens = [];

  if (importadosProdutosCache.length) {
    const total = importadosProdutosCache.length;
    const partes = [
      `${total} peça${total === 1 ? '' : 's'} importada${
        total === 1 ? '' : 's'
      } via Produtos/Preços`,
    ];
    const meta = ultimaImportacaoMeta || {};
    const referencia = formatDate(
      meta.dataReferencia || importadosProdutosCache[0]?.dataReferencia,
      false,
    );
    if (referencia) partes.push(`referência ${referencia}`);
    const atualizado = formatDate(
      meta.criadoEm || importadosProdutosCache[0]?.atualizadoEm,
      true,
    );
    if (atualizado) partes.push(`disponível desde ${atualizado}`);
    const responsavelDescricao =
      meta.autorNome ||
      meta.autorEmail ||
      responsavelFinanceiroNome ||
      responsavelFinanceiroEmail ||
      '';
    if (responsavelDescricao) {
      partes.push(`responsável ${responsavelDescricao}`);
    }
    if (importadosOrigemAtual === 'responsavel') {
      partes.push('compartilhadas pelo responsável financeiro');
    }
    mensagens.push(partes.join(' • '));
  }

  if (manualProdutosCache.length) {
    const total = manualProdutosCache.length;
    mensagens.push(
      `${total} peça${total === 1 ? '' : 's'} cadastrada manualmente`,
    );
  }

  setStatus(produtoStatusEl, mensagens.join(' | '));
}

function atualizarListaProdutos() {
  if (!listaProdutosEl) return;

  listaProdutosEl.innerHTML = '';

  const itensImportados = [...importadosProdutosCache];
  const itensManuais = [...manualProdutosCache];
  const todos = [...itensImportados, ...itensManuais];

  if (!todos.length) {
    if (manualProdutosPronto && importadosProdutosPronto) {
      produtosVazioEl?.classList.remove('hidden');
      atualizarStatusProdutos();
    } else {
      produtosVazioEl?.classList.add('hidden');
    }
    return;
  }

  produtosVazioEl?.classList.add('hidden');
  const frag = document.createDocumentFragment();
  todos.sort(compararProdutosPorNome).forEach((item) => {
    frag.appendChild(renderProdutoCard(item));
  });
  listaProdutosEl.appendChild(frag);
  atualizarStatusProdutos();
}

function monitorarUltimaImportacao() {
  resetImportacaoEstado();
  limparMonitoramentoImportacao('user');
  limparMonitoramentoImportacao('responsavel');
  importadosOrigemAtual = null;
  importadosProdutosCache = [];
  importadosProdutosPronto = false;
  ultimaImportacaoMeta = null;

  const userUid = currentUser?.uid || '';
  iniciarMonitoramentoImportacao('user', userUid);

  let responsavelUid = responsavelFinanceiroUid;
  if (!responsavelUid && typeof window !== 'undefined') {
    if (window.responsavelFinanceiro?.uid) {
      responsavelUid = window.responsavelFinanceiro.uid;
      responsavelFinanceiroUid = responsavelUid;
    }
    if (window.responsavelFinanceiro?.email) {
      responsavelFinanceiroEmail = window.responsavelFinanceiro.email;
    }
    if (window.responsavelFinanceiro?.nome) {
      responsavelFinanceiroNome = window.responsavelFinanceiro.nome;
    }
  }

  if (responsavelUid && responsavelUid !== userUid) {
    iniciarMonitoramentoImportacao('responsavel', responsavelUid);
  } else {
    importacaoEstado.responsavel.pronto = true;
  }

  atualizarImportadosOrigem();
}

function carregarProdutos() {
  if (!currentUser) return;

  produtosManualUnsub?.();
  produtosManualUnsub = null;
  limparMonitoramentoImportacao('user');
  limparMonitoramentoImportacao('responsavel');
  resetImportacaoEstado();
  manualProdutosCache = [];
  importadosProdutosCache = [];
  manualProdutosPronto = false;
  importadosProdutosPronto = false;
  ultimaImportacaoMeta = null;
  importadosOrigemAtual = null;

  if (listaProdutosEl) listaProdutosEl.innerHTML = '';
  produtosVazioEl?.classList.add('hidden');
  setStatus(produtoStatusEl, 'Carregando peças em linha...', false);

  const produtosRef = query(
    collection(db, 'painelAtualizacoesGerais'),
    where('categoria', '==', 'produto'),
    where('participantes', 'array-contains', currentUser.uid),
    orderBy('createdAt', 'desc'),
  );

  produtosManualUnsub = onSnapshot(
    produtosRef,
    (snap) => {
      manualProdutosCache = snap.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        return {
          tipo: 'manual',
          id: docSnap.id,
          nome: data.nome || '',
          observacoes: data.observacoes || '',
          autorNome: data.autorNome || '',
          createdAt: data.createdAt || null,
        };
      });
      manualProdutosPronto = true;
      atualizarListaProdutos();
    },
    (err) => {
      console.error('Erro ao carregar produtos cadastrados manualmente:', err);
      manualProdutosCache = [];
      manualProdutosPronto = true;
      setStatus(
        produtoStatusEl,
        'Não foi possível carregar os produtos cadastrados manualmente.',
        true,
      );
      atualizarListaProdutos();
    },
  );

  monitorarUltimaImportacao();
}

async function enviarMensagem(event) {
  event.preventDefault();
  if (!currentUser) return;
  const texto = mensagemInput?.value.trim();
  if (!texto) {
    showTemporaryStatus(
      mensagemStatusEl,
      'Digite uma mensagem antes de enviar.',
      true,
    );
    return;
  }
  try {
    await addDoc(collection(db, 'painelAtualizacoesGerais'), {
      categoria: 'mensagem',
      texto,
      autorUid: currentUser.uid,
      autorNome: nomeResponsavel,
      responsavelUid: currentUser.uid,
      responsavelNome: nomeResponsavel,
      participantes: participantesCompartilhamento,
      createdAt: serverTimestamp(),
    });
    mensagemInput.value = '';
    showTemporaryStatus(
      mensagemStatusEl,
      'Mensagem compartilhada com a equipe.',
    );
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    showTemporaryStatus(
      mensagemStatusEl,
      'Não foi possível registrar a mensagem. Tente novamente.',
      true,
    );
  }
}

async function registrarProblema(event) {
  event.preventDefault();
  if (!currentUser) return;
  const problema = problemaTituloInput?.value.trim();
  const solucao = problemaSolucaoInput?.value.trim();
  const setor = problemaSetorInput?.value.trim();
  const responsavel = problemaResponsavelInput?.value.trim();
  const dataOcorrencia = problemaDataInput?.value;
  if (!problema || !setor || !responsavel || !dataOcorrencia) {
    showTemporaryStatus(
      problemaStatusEl,
      'Preencha todos os campos obrigatórios para registrar o problema.',
      true,
    );
    return;
  }
  try {
    await addDoc(collection(db, 'painelAtualizacoesGerais'), {
      categoria: 'problema',
      problema,
      solucao: solucao || '',
      setor,
      responsavel,
      dataOcorrencia,
      autorUid: currentUser.uid,
      autorNome: nomeResponsavel,
      participantes: participantesCompartilhamento,
      createdAt: serverTimestamp(),
    });
    formProblema.reset();
    showTemporaryStatus(problemaStatusEl, 'Problema registrado com sucesso.');
  } catch (err) {
    console.error('Erro ao registrar problema:', err);
    showTemporaryStatus(
      problemaStatusEl,
      'Não foi possível salvar o problema. Tente novamente.',
      true,
    );
  }
}

async function registrarProduto(event) {
  event.preventDefault();
  if (!currentUser) return;
  const nome = produtoNomeInput?.value.trim();
  const observacoes = produtoObsInput?.value.trim();
  if (!nome) {
    showTemporaryStatus(
      produtoStatusEl,
      'Informe o nome do produto para concluir o cadastro.',
      true,
    );
    return;
  }
  try {
    await addDoc(collection(db, 'painelAtualizacoesGerais'), {
      categoria: 'produto',
      nome,
      observacoes: observacoes || '',
      autorUid: currentUser.uid,
      autorNome: nomeResponsavel,
      participantes: participantesCompartilhamento,
      createdAt: serverTimestamp(),
    });
    formProduto?.reset();
    showTemporaryStatus(produtoStatusEl, 'Produto cadastrado com sucesso.');
  } catch (err) {
    console.error('Erro ao cadastrar produto:', err);
    showTemporaryStatus(
      produtoStatusEl,
      'Não foi possível cadastrar o produto. Tente novamente.',
      true,
    );
  }
}

formMensagem?.addEventListener('submit', enviarMensagem);
formProblema?.addEventListener('submit', registrarProblema);
formProduto?.addEventListener('submit', registrarProduto);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  currentUser = user;
  nomeResponsavel = user.displayName || user.email || 'Usuário';
  setStatus(painelStatusEl, 'Carregando configurações da equipe...');
  try {
    const {
      participantes,
      responsavelFinanceiroUid: respUid,
      responsavelFinanceiroEmail: respEmail,
    } = await montarEscopoCompartilhamento(user);
    if (respUid) responsavelFinanceiroUid = respUid;
    if (respEmail) responsavelFinanceiroEmail = respEmail;
    if (
      !responsavelFinanceiroNome &&
      typeof window !== 'undefined' &&
      window.responsavelFinanceiro?.nome
    ) {
      responsavelFinanceiroNome = window.responsavelFinanceiro.nome;
    }
    participantesCompartilhamento = participantes.length
      ? participantes
      : [user.uid];
    atualizarEscopoMensagem(participantesCompartilhamento);
    setStatus(painelStatusEl, '');

    try {
      const { isGestor, isResponsavelFinanceiro } =
        await carregarUsuariosFinanceiros(db, user);
      const podeGerirProdutos = isGestor || isResponsavelFinanceiro;
      if (podeGerirProdutos) {
        formProduto?.classList.remove('hidden');
        produtosAvisoEl?.classList.add('hidden');
      } else {
        formProduto?.classList.add('hidden');
        produtosAvisoEl?.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Erro ao verificar permissões financeiras:', err);
      formProduto?.classList.add('hidden');
      produtosAvisoEl?.classList.remove('hidden');
    }

    carregarMensagens();
    carregarProblemas();
    carregarProdutos();
  } catch (err) {
    console.error('Erro ao preparar painel de atualizações gerais:', err);
    setStatus(
      painelStatusEl,
      'Não foi possível carregar o compartilhamento da equipe.',
      true,
    );
  }
});
