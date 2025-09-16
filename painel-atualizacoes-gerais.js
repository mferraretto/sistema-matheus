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
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  documentId,
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
const participantesListaEl = document.getElementById('participantesLista');
const participantesResumoEl = document.getElementById('participantesResumo');
const participantesVazioEl = document.getElementById('participantesVazio');
const limparParticipantesBtn = document.getElementById(
  'limparParticipantesBtn',
);

let currentUser = null;
let participantesCompartilhamento = [];
let mensagensUnsub = null;
let problemasUnsub = null;
let produtosUnsub = null;
let nomeResponsavel = '';
let participantesDetalhes = [];
let participantesPorUid = new Map();
let participantesSelecionados = new Set();

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
  setStatus(element, message, isError);
  if (message) {
    setTimeout(() => {
      if (element.textContent === message) {
        setStatus(element, '');
      }
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

function montarDetalhesParticipante(uid, data = {}) {
  const nomeFonte =
    data.nomeCompleto ||
    data.nome ||
    data.displayName ||
    data.nomeFantasia ||
    data.razaoSocial ||
    data.fantasia ||
    data.usuario ||
    data.email ||
    '';
  const papelFonte =
    data.perfil ||
    data.funcao ||
    data.cargo ||
    data.papel ||
    data.tipo ||
    data.role ||
    data.departamento ||
    '';
  const emailFonte =
    data.email ||
    data.usuarioEmail ||
    data.loginEmail ||
    data.contatoEmail ||
    '';

  const nome = String(nomeFonte || '').trim() || `Usuário ${uid.slice(0, 6)}`;
  const papel = String(papelFonte || '').trim();
  const email = String(emailFonte || '').trim();

  return {
    uid,
    nome,
    papel,
    email,
    isAtual: currentUser?.uid === uid,
  };
}

async function carregarDetalhesParticipantes(uids = []) {
  const validos = Array.from(
    new Set((uids || []).filter((uid) => typeof uid === 'string' && uid)),
  );

  const detalhesMap = new Map();
  const buscarEmColecao = async (colecao, ids) => {
    for (let i = 0; i < ids.length; i += 10) {
      const lote = ids.slice(i, i + 10);
      if (!lote.length) continue;
      try {
        const snap = await getDocs(
          query(collection(db, colecao), where(documentId(), 'in', lote)),
        );
        snap.forEach((docSnap) => {
          const uid = docSnap.id;
          const data = docSnap.data() || {};
          detalhesMap.set(uid, montarDetalhesParticipante(uid, data));
        });
      } catch (err) {
        console.error(
          `Erro ao carregar participantes (${colecao}) para seleção:`,
          err,
        );
      }
    }
  };

  if (validos.length) {
    await buscarEmColecao('usuarios', validos);
    const faltantes = validos.filter((uid) => !detalhesMap.has(uid));
    if (faltantes.length) {
      await buscarEmColecao('uid', faltantes);
    }
    const aindaFaltando = validos.filter((uid) => !detalhesMap.has(uid));
    aindaFaltando.forEach((uid) => {
      detalhesMap.set(uid, {
        uid,
        nome: `Usuário ${uid.slice(0, 6)}`,
        papel: 'Perfil não identificado',
        email: '',
        isAtual: currentUser?.uid === uid,
      });
    });
  }

  participantesPorUid = detalhesMap;
  participantesDetalhes = Array.from(detalhesMap.values()).sort((a, b) => {
    if (a.isAtual && !b.isAtual) return -1;
    if (!a.isAtual && b.isAtual) return 1;
    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  });

  participantesSelecionados = new Set(
    Array.from(participantesSelecionados).filter((uid) =>
      participantesPorUid.has(uid),
    ),
  );

  renderizarParticipantesDisponiveis();
}

function renderizarParticipantesDisponiveis() {
  if (!participantesListaEl) {
    atualizarResumoDestinatarios();
    return;
  }

  participantesListaEl.innerHTML = '';

  if (!participantesDetalhes.length) {
    participantesVazioEl?.classList.remove('hidden');
    atualizarResumoDestinatarios();
    return;
  }

  participantesVazioEl?.classList.add('hidden');
  const frag = document.createDocumentFragment();

  participantesDetalhes.forEach((info) => {
    const item = document.createElement('label');
    item.className =
      'flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-blue-300';
    item.dataset.uid = info.uid;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className =
      'mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500';
    checkbox.checked = participantesSelecionados.has(info.uid);
    checkbox.addEventListener('change', (event) => {
      if (event.target.checked) {
        participantesSelecionados.add(info.uid);
      } else {
        participantesSelecionados.delete(info.uid);
      }
      atualizarResumoDestinatarios();
    });

    const content = document.createElement('div');
    content.className = 'flex-1 min-w-0';

    const nomeEl = document.createElement('p');
    nomeEl.className = 'text-sm font-medium text-gray-800';
    if (info.isAtual) {
      nomeEl.textContent = `${info.nome || 'Você'} (você)`;
    } else {
      nomeEl.textContent = info.nome || 'Usuário';
    }

    const detalheEl = document.createElement('p');
    detalheEl.className = 'text-xs text-gray-500';
    if (info.papel && info.email) {
      detalheEl.textContent = `${info.papel} • ${info.email}`;
    } else if (info.papel) {
      detalheEl.textContent = info.papel;
    } else if (info.email) {
      detalheEl.textContent = info.email;
    } else {
      detalheEl.textContent = 'Sem detalhes adicionais';
    }

    content.appendChild(nomeEl);
    content.appendChild(detalheEl);

    item.appendChild(checkbox);
    item.appendChild(content);
    frag.appendChild(item);
  });

  participantesListaEl.appendChild(frag);
  atualizarResumoDestinatarios();
}

function atualizarResumoDestinatarios() {
  const selecionados = Array.from(participantesSelecionados);
  const totalDisponiveis = participantesDetalhes.length;

  if (participantesResumoEl) {
    if (!totalDisponiveis) {
      participantesResumoEl.textContent =
        'Nenhum participante disponível para seleção.';
    } else if (!selecionados.length) {
      participantesResumoEl.textContent = `Nenhum destinatário selecionado. As atualizações alcançarão todos os ${totalDisponiveis} integrantes conectados.`;
    } else if (selecionados.length === 1) {
      const info = participantesPorUid.get(selecionados[0]);
      const nome = info?.nome || '1 usuário';
      participantesResumoEl.textContent = `Enviando somente para ${nome}.`;
    } else {
      participantesResumoEl.textContent = `Enviando para ${selecionados.length} destinatários selecionados.`;
    }
  }

  if (mensagemEscopoEl) {
    if (!selecionados.length) {
      mensagemEscopoEl.textContent =
        'Compartilhado com todos os perfis conectados.';
    } else if (selecionados.length === 1) {
      const info = participantesPorUid.get(selecionados[0]);
      const nome = info?.nome || '1 usuário';
      mensagemEscopoEl.textContent = `Compartilhado somente com ${nome}.`;
    } else {
      mensagemEscopoEl.textContent = `Compartilhado com ${selecionados.length} destinatários selecionados.`;
    }
  }
}

function obterParticipantesParaEnvio() {
  if (!participantesSelecionados.size) {
    return participantesCompartilhamento;
  }
  const destino = new Set(participantesSelecionados);
  if (currentUser?.uid) destino.add(currentUser.uid);
  return Array.from(destino);
}

function limparSelecaoDestinatarios() {
  if (!participantesSelecionados.size) {
    atualizarResumoDestinatarios();
    return;
  }
  participantesSelecionados.clear();
  participantesListaEl
    ?.querySelectorAll('input[type="checkbox"]')
    .forEach((input) => {
      input.checked = false;
    });
  atualizarResumoDestinatarios();
}

async function montarEscopoCompartilhamento(user) {
  const participantes = new Set();
  const emails = new Set();
  const equipesParaInspecionar = new Set();

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

  return { participantes: Array.from(participantes), perfil };
}

function atualizarEscopoMensagem() {
  atualizarResumoDestinatarios();
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
  return item;
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

function renderProduto(docSnap) {
  const data = docSnap.data() || {};
  const card = document.createElement('article');
  card.className =
    'bg-white border border-emerald-100 rounded-lg p-3 shadow-sm';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between text-sm text-gray-700';
  const nomeEl = document.createElement('span');
  nomeEl.className = 'font-semibold';
  nomeEl.textContent = data.nome || 'Produto sem nome';
  const autorEl = document.createElement('span');
  autorEl.className = 'text-xs text-gray-500';
  autorEl.textContent = data.autorNome ? `Por ${data.autorNome}` : '';
  header.appendChild(nomeEl);
  header.appendChild(autorEl);
  card.appendChild(header);

  if (data.observacoes) {
    const obs = document.createElement('p');
    obs.className = 'mt-2 text-sm text-gray-600 whitespace-pre-line';
    obs.textContent = data.observacoes;
    card.appendChild(obs);
  }

  const dataCriacao = document.createElement('p');
  dataCriacao.className = 'mt-2 text-[11px] text-gray-400';
  dataCriacao.textContent = data.createdAt
    ? `Atualizado em ${formatDate(data.createdAt, true)}`
    : '';
  card.appendChild(dataCriacao);

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

function carregarProdutos() {
  if (!currentUser) return;
  produtosUnsub?.();
  const produtosRef = query(
    collection(db, 'painelAtualizacoesGerais'),
    where('categoria', '==', 'produto'),
    where('participantes', 'array-contains', currentUser.uid),
    orderBy('createdAt', 'desc'),
  );
  produtosUnsub = onSnapshot(
    produtosRef,
    (snap) => {
      listaProdutosEl.innerHTML = '';
      if (snap.empty) {
        produtosVazioEl?.classList.remove('hidden');
        return;
      }
      produtosVazioEl?.classList.add('hidden');
      const itens = [];
      snap.forEach((docSnap) => itens.push(docSnap));
      itens
        .sort((a, b) => {
          const nomeA = (a.data()?.nome || '').toLowerCase();
          const nomeB = (b.data()?.nome || '').toLowerCase();
          if (nomeA < nomeB) return -1;
          if (nomeA > nomeB) return 1;
          return 0;
        })
        .forEach((docSnap) =>
          listaProdutosEl.appendChild(renderProduto(docSnap)),
        );
    },
    (err) => {
      console.error('Erro ao carregar produtos:', err);
      produtosVazioEl?.classList.remove('hidden');
    },
  );
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
    const participantesDestino = obterParticipantesParaEnvio();
    await addDoc(collection(db, 'painelAtualizacoesGerais'), {
      categoria: 'mensagem',
      texto,
      autorUid: currentUser.uid,
      autorNome: nomeResponsavel,
      responsavelUid: currentUser.uid,
      responsavelNome: nomeResponsavel,
      participantes: participantesDestino,
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
    const participantesDestino = obterParticipantesParaEnvio();
    await addDoc(collection(db, 'painelAtualizacoesGerais'), {
      categoria: 'problema',
      problema,
      solucao: solucao || '',
      setor,
      responsavel,
      dataOcorrencia,
      autorUid: currentUser.uid,
      autorNome: nomeResponsavel,
      participantes: participantesDestino,
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
    const participantesDestino = obterParticipantesParaEnvio();
    await addDoc(collection(db, 'painelAtualizacoesGerais'), {
      categoria: 'produto',
      nome,
      observacoes: observacoes || '',
      autorUid: currentUser.uid,
      autorNome: nomeResponsavel,
      participantes: participantesDestino,
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
limparParticipantesBtn?.addEventListener('click', limparSelecaoDestinatarios);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  currentUser = user;
  nomeResponsavel = user.displayName || user.email || 'Usuário';
  setStatus(painelStatusEl, 'Carregando configurações da equipe...');
  try {
    const { participantes } = await montarEscopoCompartilhamento(user);
    const baseParticipantes = participantes.length ? participantes : [user.uid];
    participantesCompartilhamento = Array.from(new Set(baseParticipantes));
    await carregarDetalhesParticipantes(participantesCompartilhamento);
    atualizarEscopoMensagem();
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
    participantesCompartilhamento = currentUser?.uid ? [currentUser.uid] : [];
    await carregarDetalhesParticipantes(participantesCompartilhamento);
    atualizarEscopoMensagem();
  }
});
