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
  Timestamp,
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
const reuniaoStatusEl = document.getElementById('reuniaoStatus');
const calendarioPrincipalEl = document.getElementById('calendarioPrincipal');
const calendarioAnteriorEl = document.getElementById('calendarioAnterior');
const calendarioProximoEl = document.getElementById('calendarioProximo');
const listaReunioesEl = document.getElementById('listaReunioes');
const reunioesVazioEl = document.getElementById('reunioesVazio');
const modalReuniaoEl = document.getElementById('modalAgendarReuniao');
const modalReuniaoDataEl = document.getElementById('modalReuniaoData');
const reuniaoParticipantesListaEl = document.getElementById(
  'reuniaoParticipantesLista',
);
const reuniaoParticipantesVazioEl = document.getElementById(
  'reuniaoParticipantesVazio',
);
const reuniaoHorarioInput = document.getElementById('reuniaoHorario');
const reuniaoCancelarBtn = document.getElementById('reuniaoCancelarBtn');
const reuniaoModalCloseBtn = document.getElementById('reuniaoModalClose');
const formReuniao = document.getElementById('formReuniao');

let currentUser = null;
let participantesCompartilhamento = [];
let mensagensUnsub = null;
let problemasUnsub = null;
let produtosUnsub = null;
let reunioesUnsub = null;
let nomeResponsavel = '';
const participantesInfo = new Map();
let participantesInfoCarregado = false;
let calendarioReferencia = new Date();
let dataSelecionadaParaReuniao = null;
const reunioesPorData = new Map();
let reunioesCache = [];
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MAX_REUNIOES_EXIBIDAS = 5;

dataSelecionadaParaReuniao = formatDateKey(new Date());

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

function formatDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function obterDataAPartirString(value) {
  if (!value || typeof value !== 'string') return null;
  const partes = value.split('-');
  if (partes.length !== 3) return null;
  const [anoStr, mesStr, diaStr] = partes;
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);
  if (!ano || !mes || !dia) return null;
  const date = new Date(ano, mes - 1, dia);
  if (Number.isNaN(date.valueOf())) return null;
  return date;
}

function capitalizeLabel(text = '') {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatLongDateLabel(dateStr) {
  const date = obterDataAPartirString(dateStr);
  if (!date) return '';
  const formatted = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return capitalizeLabel(formatted);
}

function extrairNomeUsuario(data = {}, fallback = '') {
  if (!data || typeof data !== 'object') return fallback;
  const candidatos = [
    data.nomeCompleto,
    data.nome,
    data.displayName,
    data.nomeResponsavel,
    data.responsavelNome,
    data.autorNome,
    data.nomeGestor,
    data.nomeUsuario,
    data.apelido,
    data.firstName && data.lastName
      ? `${data.firstName} ${data.lastName}`
      : undefined,
    data.usuarioNome,
    data.fullName,
  ];
  for (const candidato of candidatos) {
    if (typeof candidato === 'string') {
      const texto = candidato.trim();
      if (texto) return texto;
    }
  }
  return fallback;
}

function extrairEmailUsuario(data = {}, fallback = '') {
  if (!data || typeof data !== 'object') return fallback;
  const candidatos = [
    data.email,
    data.usuarioEmail,
    data.autorEmail,
    data.responsavelEmail,
    data.gestorEmail,
    data.financeiroEmail,
  ];
  for (const candidato of candidatos) {
    if (typeof candidato === 'string') {
      const texto = candidato.trim();
      if (texto) return texto;
    }
  }
  return fallback;
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

async function carregarParticipantesInfo(uids = []) {
  participantesInfo.clear();
  participantesInfoCarregado = false;
  const set = new Set(
    Array.isArray(uids)
      ? uids.filter((uid) => typeof uid === 'string' && uid)
      : [],
  );
  if (currentUser?.uid) {
    set.add(currentUser.uid);
  }
  if (!set.size) {
    participantesInfoCarregado = true;
    renderParticipantesModal();
    return;
  }
  const lista = Array.from(set);
  try {
    await Promise.all(
      lista.map(async (uid) => {
        let dados = null;
        try {
          const usuarioSnap = await getDoc(doc(db, 'usuarios', uid));
          if (usuarioSnap.exists()) {
            dados = usuarioSnap.data();
          } else {
            const uidSnap = await getDoc(doc(db, 'uid', uid));
            if (uidSnap.exists()) dados = uidSnap.data();
          }
        } catch (err) {
          console.error('Erro ao carregar participante vinculado:', err);
        }

        const emailBase =
          uid === currentUser?.uid
            ? currentUser?.email || ''
            : extrairEmailUsuario(dados, '');
        const fallbackNome =
          uid === currentUser?.uid
            ? nomeResponsavel || emailBase || 'Você'
            : emailBase
              ? emailBase.split('@')[0]
              : `Usuário ${uid.slice(-4)}`;
        const nome = extrairNomeUsuario(dados, fallbackNome);
        const email =
          uid === currentUser?.uid
            ? currentUser?.email || emailBase
            : emailBase;

        participantesInfo.set(uid, {
          uid,
          nome: nome || fallbackNome,
          email: email || '',
        });
      }),
    );
  } catch (err) {
    console.error('Erro ao preparar participantes conectados:', err);
  }
  participantesInfoCarregado = true;
  renderParticipantesModal();
}

function obterParticipantesOrdenados({ incluirAtual = false } = {}) {
  const valores = Array.from(participantesInfo.values());
  const filtrados = incluirAtual
    ? valores
    : valores.filter((info) => info.uid !== currentUser?.uid);
  return filtrados.sort((a, b) => {
    const nomeA = (a.nome || '').toLowerCase();
    const nomeB = (b.nome || '').toLowerCase();
    return nomeA.localeCompare(nomeB, 'pt-BR');
  });
}

function renderParticipantesModal() {
  if (!reuniaoParticipantesListaEl) return;
  reuniaoParticipantesListaEl.innerHTML = '';
  if (!participantesInfoCarregado) {
    const loading = document.createElement('div');
    loading.className = 'px-4 py-3 text-sm text-gray-500';
    loading.textContent = 'Carregando participantes conectados...';
    reuniaoParticipantesListaEl.appendChild(loading);
    reuniaoParticipantesVazioEl?.classList.add('hidden');
    return;
  }

  const participantes = obterParticipantesOrdenados();
  if (!participantes.length) {
    reuniaoParticipantesVazioEl?.classList.remove('hidden');
    return;
  }
  reuniaoParticipantesVazioEl?.classList.add('hidden');

  participantes.forEach((info) => {
    const linha = document.createElement('label');
    linha.className =
      'flex items-start gap-3 px-4 py-3 hover:bg-white transition-colors cursor-pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = info.uid;
    checkbox.dataset.uid = info.uid;
    checkbox.className =
      'mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500';

    const wrapper = document.createElement('div');
    wrapper.className = 'flex-1';
    const nomeEl = document.createElement('p');
    nomeEl.className = 'text-sm font-medium text-gray-700';
    nomeEl.textContent = info.nome || 'Usuário';
    wrapper.appendChild(nomeEl);

    const emailEl = document.createElement('p');
    emailEl.className = 'text-xs text-gray-500';
    if (info.email) {
      emailEl.textContent = info.email;
      wrapper.appendChild(emailEl);
    }

    linha.appendChild(checkbox);
    linha.appendChild(wrapper);
    reuniaoParticipantesListaEl.appendChild(linha);
  });
}

function renderCalendarioEm(container, referencia, options = {}) {
  if (!container || !(referencia instanceof Date)) return;
  const { compacto = false, tituloAux = '' } = options;
  const dataBase = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  container.innerHTML = '';

  const titulo = document.createElement('div');
  titulo.className = 'flex items-center justify-between';

  const tituloPrincipal = document.createElement('p');
  tituloPrincipal.className = compacto
    ? 'text-sm font-semibold text-gray-700'
    : 'text-lg font-semibold text-gray-800';
  tituloPrincipal.textContent = capitalizeLabel(
    dataBase.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    }),
  );
  titulo.appendChild(tituloPrincipal);

  if (tituloAux) {
    const aux = document.createElement('span');
    aux.className = 'text-xs uppercase tracking-wide text-gray-400';
    aux.textContent = tituloAux;
    titulo.appendChild(aux);
  }

  container.appendChild(titulo);

  const diasCabecalho = document.createElement('div');
  diasCabecalho.className = compacto
    ? 'grid grid-cols-7 gap-1 text-[10px] font-semibold uppercase text-gray-400'
    : 'grid grid-cols-7 gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500';
  DIAS_SEMANA.forEach((dia) => {
    const span = document.createElement('span');
    span.className = 'text-center';
    span.textContent = dia;
    diasCabecalho.appendChild(span);
  });
  container.appendChild(diasCabecalho);

  const grid = document.createElement('div');
  grid.className = compacto
    ? 'grid grid-cols-7 gap-1 text-xs'
    : 'grid grid-cols-7 gap-1 sm:gap-2 text-sm';

  const primeiroDiaSemana = (dataBase.getDay() + 6) % 7; // Segunda-feira como início
  const totalDiasMes = new Date(
    dataBase.getFullYear(),
    dataBase.getMonth() + 1,
    0,
  ).getDate();
  const totalCelulas = 42;
  const hojeKey = formatDateKey(new Date());

  for (let indice = 0; indice < totalCelulas; indice += 1) {
    const diaAtual = indice - primeiroDiaSemana + 1;
    if (diaAtual < 1 || diaAtual > totalDiasMes) {
      const vazio = document.createElement('div');
      vazio.className = 'aspect-square rounded-lg';
      grid.appendChild(vazio);
      continue;
    }

    const dataCelula = new Date(
      dataBase.getFullYear(),
      dataBase.getMonth(),
      diaAtual,
    );
    const dataKey = formatDateKey(dataCelula);
    const possuiReuniao = reunioesPorData.has(dataKey);
    const isHoje = dataKey === hojeKey;
    const isSelecionado = dataSelecionadaParaReuniao === dataKey;

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.dataset.date = dataKey;
    botao.className = compacto
      ? 'flex flex-col items-center justify-center rounded-md border border-transparent text-xs font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors'
      : 'flex flex-col items-center justify-center rounded-lg border border-gray-200 py-1.5 font-medium text-gray-700 hover:border-indigo-500 hover:text-indigo-600 transition-colors';

    if (!compacto) {
      botao.classList.add('aspect-square', 'sm:py-2');
    } else {
      botao.classList.add('aspect-square');
    }

    if (isHoje) {
      botao.classList.add(
        'border-indigo-500',
        'text-indigo-600',
        'font-semibold',
      );
      if (!compacto) botao.classList.add('bg-indigo-50');
    }
    if (isSelecionado) {
      botao.classList.add('ring-2', 'ring-indigo-400', 'ring-offset-1');
    }

    const numero = document.createElement('span');
    numero.textContent = String(diaAtual);
    botao.appendChild(numero);

    if (possuiReuniao) {
      const indicador = document.createElement('span');
      indicador.className = compacto
        ? 'mt-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500'
        : 'mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500';
      botao.appendChild(indicador);
    }

    botao.addEventListener('click', () => {
      abrirModalReuniao(dataKey);
    });

    grid.appendChild(botao);
  }

  container.appendChild(grid);
}

function renderCalendarios() {
  if (!calendarioPrincipalEl) return;
  calendarioReferencia = new Date(
    calendarioReferencia.getFullYear(),
    calendarioReferencia.getMonth(),
    1,
  );
  const anterior = new Date(
    calendarioReferencia.getFullYear(),
    calendarioReferencia.getMonth() - 1,
    1,
  );
  const proximo = new Date(
    calendarioReferencia.getFullYear(),
    calendarioReferencia.getMonth() + 1,
    1,
  );

  renderCalendarioEm(calendarioPrincipalEl, calendarioReferencia, {
    tituloAux: 'Mês atual',
  });
  renderCalendarioEm(calendarioAnteriorEl, anterior, {
    compacto: true,
    tituloAux: 'Mês anterior',
  });
  renderCalendarioEm(calendarioProximoEl, proximo, {
    compacto: true,
    tituloAux: 'Próximo mês',
  });
}

function sugerirHorarioPadrao(dateKey) {
  const data = obterDataAPartirString(dateKey);
  if (!data) return '';
  const hoje = new Date();
  if (formatDateKey(hoje) === dateKey) {
    const proximaHora = new Date();
    proximaHora.setMinutes(0, 0, 0);
    proximaHora.setHours(proximaHora.getHours() + 1);
    const horas = String(proximaHora.getHours()).padStart(2, '0');
    return `${horas}:00`;
  }
  return '09:00';
}

function abrirModalReuniao(dateKey) {
  if (!dateKey) return;
  dataSelecionadaParaReuniao = dateKey;
  renderCalendarios();
  if (!modalReuniaoEl) return;
  formReuniao?.reset();
  renderParticipantesModal();
  if (modalReuniaoDataEl) {
    const label = formatLongDateLabel(dateKey);
    modalReuniaoDataEl.textContent = label ? `Para ${label}` : '';
  }
  if (reuniaoHorarioInput) {
    reuniaoHorarioInput.value = sugerirHorarioPadrao(dateKey);
  }
  modalReuniaoEl.classList.remove('hidden');
  modalReuniaoEl.classList.add('flex');
  modalReuniaoEl.setAttribute('aria-hidden', 'false');
  reuniaoHorarioInput?.focus();
}

function fecharModalReuniao() {
  if (!modalReuniaoEl) return;
  modalReuniaoEl.classList.add('hidden');
  modalReuniaoEl.classList.remove('flex');
  modalReuniaoEl.setAttribute('aria-hidden', 'true');
  formReuniao?.reset();
  renderParticipantesModal();
}

function obterDadosHoraReuniao(data = {}) {
  const resultado = { dataHora: null, dataKey: '', horario: '' };
  if (!data || typeof data !== 'object') return resultado;
  let dataKey = '';
  if (typeof data.dataReuniao === 'string') {
    dataKey = data.dataReuniao;
  }
  let dataHora = null;
  if (data.reuniaoTimestamp?.toDate) {
    try {
      dataHora = data.reuniaoTimestamp.toDate();
    } catch (err) {
      console.warn('Não foi possível converter reuniaoTimestamp:', err);
    }
  }
  if (!dataHora && dataKey) {
    const base = obterDataAPartirString(dataKey);
    if (base) {
      if (
        typeof data.horario === 'string' &&
        /^\d{2}:\d{2}$/.test(data.horario)
      ) {
        const [horaStr, minutoStr] = data.horario.split(':');
        const hora = Number(horaStr);
        const minuto = Number(minutoStr);
        base.setHours(Number.isFinite(hora) ? hora : 0);
        base.setMinutes(Number.isFinite(minuto) ? minuto : 0);
      }
      dataHora = base;
    }
  }
  if (dataHora instanceof Date && !Number.isNaN(dataHora.valueOf())) {
    resultado.dataHora = dataHora;
    resultado.dataKey = dataKey || formatDateKey(dataHora);
    const horas = String(dataHora.getHours()).padStart(2, '0');
    const minutos = String(dataHora.getMinutes()).padStart(2, '0');
    resultado.horario =
      typeof data.horario === 'string' && /^\d{2}:\d{2}$/.test(data.horario)
        ? data.horario
        : `${horas}:${minutos}`;
  } else {
    resultado.dataKey = dataKey;
    resultado.horario =
      typeof data.horario === 'string' && /^\d{2}:\d{2}$/.test(data.horario)
        ? data.horario
        : '';
  }
  return resultado;
}

function formatParticipantesReuniao(data) {
  const uids = Array.isArray(data?.participantes) ? data.participantes : [];
  if (!uids.length) return '';
  const detalhesArr = Array.isArray(data.participantesDetalhes)
    ? data.participantesDetalhes
    : [];
  const detalhesMap = new Map();
  detalhesArr.forEach((item) => {
    if (item?.uid) detalhesMap.set(item.uid, item);
  });
  const nomes = uids.map((uid) => {
    if (uid === currentUser?.uid) return 'Você';
    const detalhe = detalhesMap.get(uid) || {};
    if (typeof detalhe.nome === 'string' && detalhe.nome.trim()) {
      return detalhe.nome.trim();
    }
    const info = participantesInfo.get(uid);
    if (info?.nome) return info.nome;
    const email = detalhe.email || info?.email || '';
    if (email) return email;
    return `Usuário ${uid.slice(-4)}`;
  });
  return nomes.join(', ');
}

function renderReunioesLista() {
  if (!listaReunioesEl) return;
  listaReunioesEl.innerHTML = '';
  const itens = reunioesCache.map(({ id, data }) => ({
    id,
    data,
    ...obterDadosHoraReuniao(data),
  }));

  const validos = itens.filter(
    (item) =>
      item.dataHora instanceof Date && !Number.isNaN(item.dataHora.valueOf()),
  );

  if (!validos.length) {
    reunioesVazioEl?.classList.remove('hidden');
    return;
  }

  const agora = new Date();
  const hojeKey = formatDateKey(agora);
  validos.sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime());
  const futuros = validos.filter(
    (item) => item.dataHora >= agora || item.dataKey === hojeKey,
  );
  let listaParaExibir = futuros.slice(0, MAX_REUNIOES_EXIBIDAS);
  if (!listaParaExibir.length) {
    const passados = validos.filter((item) => item.dataHora < agora);
    listaParaExibir = passados.slice(-MAX_REUNIOES_EXIBIDAS).reverse();
  }

  if (!listaParaExibir.length) {
    reunioesVazioEl?.classList.remove('hidden');
    return;
  }

  reunioesVazioEl?.classList.add('hidden');
  const fragment = document.createDocumentFragment();

  listaParaExibir.forEach((item) => {
    const card = document.createElement('article');
    card.className =
      'bg-white border border-indigo-100 rounded-lg p-3 shadow-sm';

    const header = document.createElement('div');
    header.className =
      'flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700';

    const dataEl = document.createElement('span');
    dataEl.className = 'font-semibold text-gray-800';
    if (item.dataHora instanceof Date) {
      const dataTexto = item.dataHora.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      dataEl.textContent = item.horario
        ? `${dataTexto} às ${item.horario}`
        : dataTexto;
    } else {
      dataEl.textContent = item.dataKey || 'Data a definir';
    }
    header.appendChild(dataEl);

    const autorEl = document.createElement('span');
    autorEl.className = 'text-xs text-gray-500';
    if (item.data.autorUid === currentUser?.uid) {
      autorEl.textContent = 'Agendado por você';
    } else if (item.data.autorNome) {
      autorEl.textContent = `Agendado por ${item.data.autorNome}`;
    } else {
      autorEl.textContent = 'Agendado pela equipe';
    }
    header.appendChild(autorEl);

    card.appendChild(header);

    const participantesTexto = formatParticipantesReuniao(item.data);
    if (participantesTexto) {
      const participantesEl = document.createElement('p');
      participantesEl.className = 'mt-2 text-xs text-gray-600';
      const label = document.createElement('span');
      label.className = 'font-medium text-gray-700';
      label.textContent = 'Participantes: ';
      participantesEl.appendChild(label);
      participantesEl.appendChild(document.createTextNode(participantesTexto));
      card.appendChild(participantesEl);
    }

    const registroEl = document.createElement('p');
    registroEl.className = 'mt-2 text-[11px] text-gray-400';
    const criado = formatDate(item.data.createdAt, true);
    registroEl.textContent = criado ? `Agendado em ${criado}` : '';
    if (registroEl.textContent) card.appendChild(registroEl);

    fragment.appendChild(card);
  });

  listaReunioesEl.appendChild(fragment);
}

function carregarReunioes() {
  if (!currentUser) return;
  reunioesUnsub?.();
  const reunioesRef = query(
    collection(db, 'painelAtualizacoesGerais'),
    where('categoria', '==', 'reuniao'),
    where('participantes', 'array-contains', currentUser.uid),
    orderBy('createdAt', 'desc'),
  );
  reunioesUnsub = onSnapshot(
    reunioesRef,
    (snap) => {
      reunioesCache = [];
      reunioesPorData.clear();
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const infoData = obterDadosHoraReuniao(data);
        if (infoData.dataKey) {
          if (!reunioesPorData.has(infoData.dataKey)) {
            reunioesPorData.set(infoData.dataKey, []);
          }
          reunioesPorData.get(infoData.dataKey).push({
            id: docSnap.id,
            data,
          });
        }
        reunioesCache.push({ id: docSnap.id, data });
      });
      renderCalendarios();
      renderReunioesLista();
    },
    (err) => {
      console.error('Erro ao carregar reuniões agendadas:', err);
      reunioesVazioEl?.classList.remove('hidden');
    },
  );
}

async function agendarReuniao(event) {
  event.preventDefault();
  if (!currentUser) return;

  const dataReuniao = dataSelecionadaParaReuniao;
  if (!dataReuniao) {
    showTemporaryStatus(
      reuniaoStatusEl,
      'Selecione um dia no calendário para agendar a reunião.',
      true,
    );
    return;
  }

  const horario = reuniaoHorarioInput?.value?.trim() || '';
  if (!horario || !/^\d{2}:\d{2}$/.test(horario)) {
    showTemporaryStatus(
      reuniaoStatusEl,
      'Informe um horário válido (HH:MM) para a reunião.',
      true,
    );
    reuniaoHorarioInput?.focus();
    return;
  }

  const checkboxes = reuniaoParticipantesListaEl
    ? Array.from(
        reuniaoParticipantesListaEl.querySelectorAll(
          'input[type="checkbox"][data-uid]',
        ),
      )
    : [];
  const selecionados = checkboxes
    .filter((input) => input.checked)
    .map((input) => input.dataset.uid)
    .filter((uid) => typeof uid === 'string' && uid);

  const participantesSet = new Set(selecionados);
  participantesSet.add(currentUser.uid);
  if (participantesSet.size <= 1) {
    showTemporaryStatus(
      reuniaoStatusEl,
      'Selecione pelo menos um participante além de você.',
      true,
    );
    return;
  }

  const dataBase = obterDataAPartirString(dataReuniao);
  if (!dataBase) {
    showTemporaryStatus(
      reuniaoStatusEl,
      'Não foi possível identificar a data selecionada. Tente novamente.',
      true,
    );
    return;
  }

  const [horaStr, minutoStr] = horario.split(':');
  const hora = Number(horaStr);
  const minuto = Number(minutoStr);
  if (!Number.isFinite(hora) || !Number.isFinite(minuto)) {
    showTemporaryStatus(
      reuniaoStatusEl,
      'Horário informado é inválido. Utilize o formato HH:MM.',
      true,
    );
    return;
  }
  dataBase.setHours(hora, minuto, 0, 0);

  const participantesArray = Array.from(participantesSet);
  const detalhesParticipantes = participantesArray.map((uid) => {
    const info = participantesInfo.get(uid) || {};
    if (uid === currentUser.uid) {
      return {
        uid,
        nome: nomeResponsavel || 'Você',
        email: currentUser.email || info.email || '',
      };
    }
    return {
      uid,
      nome: info.nome || '',
      email: info.email || '',
    };
  });

  try {
    await addDoc(collection(db, 'painelAtualizacoesGerais'), {
      categoria: 'reuniao',
      dataReuniao,
      horario,
      reuniaoTimestamp: Timestamp.fromDate(dataBase),
      participantes: participantesArray,
      participantesDetalhes: detalhesParticipantes,
      autorUid: currentUser.uid,
      autorNome: nomeResponsavel,
      createdAt: serverTimestamp(),
    });
    fecharModalReuniao();
    showTemporaryStatus(
      reuniaoStatusEl,
      'Reunião agendada com sucesso.',
      false,
      6000,
    );
  } catch (err) {
    console.error('Erro ao agendar reunião:', err);
    showTemporaryStatus(
      reuniaoStatusEl,
      'Não foi possível salvar a reunião. Tente novamente.',
      true,
    );
  }
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

renderCalendarios();

formMensagem?.addEventListener('submit', enviarMensagem);
formProblema?.addEventListener('submit', registrarProblema);
formProduto?.addEventListener('submit', registrarProduto);
formReuniao?.addEventListener('submit', agendarReuniao);
reuniaoModalCloseBtn?.addEventListener('click', fecharModalReuniao);
reuniaoCancelarBtn?.addEventListener('click', fecharModalReuniao);
modalReuniaoEl?.addEventListener('click', (event) => {
  if (event.target === modalReuniaoEl) fecharModalReuniao();
});

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
    participantesCompartilhamento = participantes.length
      ? participantes
      : [user.uid];
    atualizarEscopoMensagem(participantesCompartilhamento);
    setStatus(painelStatusEl, '');

    await carregarParticipantesInfo(participantesCompartilhamento);
    carregarReunioes();

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
