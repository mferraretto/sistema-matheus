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
import { loadUserProfile } from './login.js';

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
const calendarioReunioesEl = document.getElementById('calendarioReunioes');
const calendarioMesAnteriorEl = document.getElementById(
  'calendarioMesAnterior',
);
const calendarioProximoMesEl = document.getElementById('calendarioProximoMes');
const reunioesStatusEl = document.getElementById('reunioesStatus');
const reunioesDiaListaEl = document.getElementById('listaReunioesDia');
const reunioesDiaVazioEl = document.getElementById('reunioesDiaVazio');
const modalReuniaoDataEl = document.getElementById('modalReuniaoData');
const reuniaoHorarioInput = document.getElementById('reuniaoHorario');
const reuniaoSalvarBtn = document.getElementById('reuniaoSalvarBtn');
const reuniaoParticipantesListaEl = document.getElementById(
  'reuniaoParticipantesLista',
);
const reuniaoParticipantesVazioEl = document.getElementById(
  'reuniaoParticipantesVazio',
);
const reuniaoModalStatusEl = document.getElementById('reuniaoModalStatus');
const reunioesHojeBtn = document.getElementById('reunioesHojeBtn');

let currentUser = null;
let participantesCompartilhamento = [];
let mensagensUnsub = null;
let problemasUnsub = null;
let produtosUnsub = null;
let nomeResponsavel = '';
let reunioesUnsub = null;
let reunioesEventos = [];
let dataReferenciaCalendario = new Date();
let dataSelecionada = '';
const usuariosCache = new Map();
let participantesDisponiveis = [];
const reunioesPorData = new Map();

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

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function formatDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  if (!key || typeof key !== 'string') return null;
  const [year, month, day] = key.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function formatDateKeyLong(key) {
  const date = parseDateKey(key);
  if (!date) return '';
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getTodayKey() {
  return formatDateKey(new Date());
}

function formatTimeDisplay(value) {
  if (!value || typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!/^\d{2}:\d{2}$/.test(normalized)) return normalized;
  return normalized;
}

function compareEventos(a, b) {
  const aTime =
    a.dataHora?.valueOf?.() ??
    new Date(`${a.dataKey}T${a.hora || '00:00'}:00`).valueOf();
  const bTime =
    b.dataHora?.valueOf?.() ??
    new Date(`${b.dataKey}T${b.hora || '00:00'}:00`).valueOf();
  return aTime - bTime;
}

dataSelecionada = getTodayKey();
dataReferenciaCalendario = parseDateKey(dataSelecionada) || new Date();

async function obterInfoUsuario(uid) {
  if (!uid || typeof uid !== 'string') return null;
  if (usuariosCache.has(uid)) return usuariosCache.get(uid);
  let info = null;
  try {
    const perfil = await loadUserProfile(uid);
    if (perfil) {
      info = {
        uid,
        nome: perfil.nome || perfil.displayName || perfil.email || 'Usuário',
        email: perfil.email || '',
      };
    }
  } catch (err) {
    console.warn('Erro ao carregar perfil do usuário:', err);
  }

  if (!info) {
    try {
      const snap = await getDoc(doc(db, 'usuarios', uid));
      if (snap.exists()) {
        const data = snap.data() || {};
        info = {
          uid,
          nome: data.nome || data.displayName || data.email || 'Usuário',
          email: data.email || '',
        };
      }
    } catch (err) {
      console.warn('Erro ao buscar usuário na coleção principal:', err);
    }
  }

  if (!info) {
    info = { uid, nome: 'Usuário', email: '' };
  }

  usuariosCache.set(uid, info);
  return info;
}

async function ensureUsuariosConhecidos(uids = []) {
  const unicos = Array.from(
    new Set(uids.filter((uid) => typeof uid === 'string' && uid.trim())),
  );
  const pendentes = unicos.filter((uid) => !usuariosCache.has(uid));
  if (!pendentes.length) return;
  await Promise.all(pendentes.map((uid) => obterInfoUsuario(uid)));
}

function nomeUsuario(uid) {
  if (!uid) return 'Usuário';
  const info = usuariosCache.get(uid);
  if (!info) return 'Usuário';
  if (currentUser?.uid && uid === currentUser.uid) return 'Você';
  return info.nome || 'Usuário';
}

async function prepararParticipantesParaModal(uids = []) {
  const candidatos = Array.from(
    new Set(
      (uids || [])
        .filter((uid) => typeof uid === 'string' && uid.trim())
        .map((uid) => uid.trim()),
    ),
  );
  if (currentUser?.uid && !candidatos.includes(currentUser.uid)) {
    candidatos.push(currentUser.uid);
  }
  if (!candidatos.length) {
    participantesDisponiveis = [];
    renderParticipantesModal();
    return;
  }
  await ensureUsuariosConhecidos(candidatos);
  participantesDisponiveis = candidatos
    .map((uid) => usuariosCache.get(uid))
    .filter(Boolean)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  renderParticipantesModal();
}

function renderParticipantesModal() {
  if (!reuniaoParticipantesListaEl) return;
  reuniaoParticipantesListaEl.innerHTML = '';
  if (reuniaoModalStatusEl) {
    reuniaoModalStatusEl.textContent = '';
  }
  if (!participantesDisponiveis.length) {
    reuniaoParticipantesVazioEl?.classList.remove('hidden');
    return;
  }
  reuniaoParticipantesVazioEl?.classList.add('hidden');
  const frag = document.createDocumentFragment();
  participantesDisponiveis.forEach((info) => {
    const item = document.createElement('label');
    item.className =
      'flex items-center gap-3 rounded-lg border border-gray-200 p-2 hover:border-purple-400 transition-colors';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'reuniaoParticipante';
    checkbox.value = info.uid;
    checkbox.className =
      'h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500';
    if (currentUser?.uid && info.uid === currentUser.uid) {
      checkbox.checked = true;
      checkbox.disabled = true;
      checkbox.dataset.locked = 'true';
      item.classList.add('opacity-80');
    }
    const textos = document.createElement('div');
    textos.className = 'flex flex-col';
    const nomeEl = document.createElement('span');
    nomeEl.className = 'text-sm font-medium text-gray-700';
    nomeEl.textContent = info.nome || 'Usuário';
    textos.appendChild(nomeEl);
    if (info.email) {
      const emailEl = document.createElement('span');
      emailEl.className = 'text-xs text-gray-500';
      emailEl.textContent = info.email;
      textos.appendChild(emailEl);
    }
    item.appendChild(checkbox);
    item.appendChild(textos);
    frag.appendChild(item);
  });
  reuniaoParticipantesListaEl.appendChild(frag);
}

function atualizarModalReuniao() {
  if (modalReuniaoDataEl) {
    modalReuniaoDataEl.textContent = formatDateKeyLong(dataSelecionada);
  }
  reuniaoModalStatusEl?.classList.remove('text-green-600');
  reuniaoModalStatusEl?.classList.remove('text-red-500');
  if (reuniaoModalStatusEl) reuniaoModalStatusEl.textContent = '';
  if (reuniaoHorarioInput) reuniaoHorarioInput.value = '';
  if (reuniaoParticipantesListaEl) {
    reuniaoParticipantesListaEl
      .querySelectorAll('input[name="reuniaoParticipante"]')
      .forEach((input) => {
        if (input.dataset.locked === 'true') {
          input.checked = true;
        } else {
          input.checked = false;
        }
      });
  }
}

function renderCalendarioMes(container, referencia, options = {}) {
  if (!container || !(referencia instanceof Date)) return;
  const { isMini = false } = options;
  const data = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  container.innerHTML = '';
  container.classList.add('overflow-hidden');
  const titulo = data.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  const header = document.createElement('div');
  header.className = isMini
    ? 'flex items-center justify-between bg-purple-50 px-3 py-2'
    : 'flex items-center justify-between px-2 sm:px-4';
  const tituloEl = document.createElement('h3');
  tituloEl.className = `capitalize ${
    isMini
      ? 'text-sm font-semibold text-purple-700'
      : 'text-lg font-semibold text-gray-800'
  }`;
  tituloEl.textContent = titulo;

  if (isMini) {
    const abrirBtn = document.createElement('button');
    abrirBtn.type = 'button';
    abrirBtn.className =
      'rounded-full border border-purple-200 px-3 py-1 text-xs font-medium text-purple-600 hover:bg-purple-100';
    abrirBtn.textContent = 'Ver mês';
    abrirBtn.addEventListener('click', () => {
      dataReferenciaCalendario = new Date(
        data.getFullYear(),
        data.getMonth(),
        1,
      );
      renderCalendarios();
    });
    header.appendChild(tituloEl);
    header.appendChild(abrirBtn);
  } else {
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className =
      'rounded-full border border-gray-200 p-1 text-gray-600 hover:border-purple-300 hover:text-purple-600';
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevBtn.addEventListener('click', () => {
      dataReferenciaCalendario = new Date(
        dataReferenciaCalendario.getFullYear(),
        dataReferenciaCalendario.getMonth() - 1,
        1,
      );
      renderCalendarios();
    });
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className =
      'rounded-full border border-gray-200 p-1 text-gray-600 hover:border-purple-300 hover:text-purple-600';
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextBtn.addEventListener('click', () => {
      dataReferenciaCalendario = new Date(
        dataReferenciaCalendario.getFullYear(),
        dataReferenciaCalendario.getMonth() + 1,
        1,
      );
      renderCalendarios();
    });
    header.appendChild(prevBtn);
    header.appendChild(tituloEl);
    header.appendChild(nextBtn);
  }

  container.appendChild(header);

  const grid = document.createElement('div');
  grid.className = isMini
    ? 'grid grid-cols-7 gap-1 px-2 pb-2 text-[11px] text-gray-600'
    : 'grid grid-cols-7 gap-1 px-1 pb-2 text-xs sm:text-sm text-gray-700';
  DIAS_SEMANA.forEach((dia) => {
    const label = document.createElement('div');
    label.className = 'text-center font-semibold uppercase tracking-tight';
    label.textContent = dia;
    grid.appendChild(label);
  });

  const primeiroDiaSemana = (data.getDay() + 6) % 7;
  for (let i = 0; i < primeiroDiaSemana; i += 1) {
    const vazio = document.createElement('div');
    vazio.className = isMini ? 'h-8' : 'h-16';
    grid.appendChild(vazio);
  }

  const totalDias = new Date(
    data.getFullYear(),
    data.getMonth() + 1,
    0,
  ).getDate();
  for (let dia = 1; dia <= totalDias; dia += 1) {
    const atual = new Date(data.getFullYear(), data.getMonth(), dia);
    const chave = formatDateKey(atual);
    const eventosDia = reunioesPorData.get(chave) || [];
    const isHoje = chave === getTodayKey();
    const isSelecionado = chave === dataSelecionada;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.dateKey = chave;
    btn.className = isMini
      ? 'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors'
      : 'flex h-16 w-full flex-col items-center justify-center rounded-lg border border-transparent text-sm font-medium transition-colors';
    btn.textContent = String(dia);

    if (eventosDia.length) {
      btn.classList.add('text-purple-600');
      const indicador = document.createElement('span');
      indicador.className = isMini
        ? 'absolute bottom-1 h-1.5 w-1.5 rounded-full bg-purple-500'
        : 'mt-1 h-1.5 w-1.5 rounded-full bg-purple-500';
      indicador.setAttribute('aria-hidden', 'true');
      if (isMini) {
        btn.classList.add('relative');
      }
      btn.appendChild(indicador);
    }
    if (isHoje) {
      btn.classList.add('ring-1', 'ring-blue-300');
      if (!isSelecionado) btn.classList.add('bg-blue-50');
    }
    if (isSelecionado) {
      btn.classList.add('bg-brand', 'text-white', 'shadow');
    } else {
      btn.classList.add('hover:bg-purple-50');
    }

    btn.addEventListener('click', () => {
      dataSelecionada = chave;
      dataReferenciaCalendario = new Date(
        data.getFullYear(),
        data.getMonth(),
        1,
      );
      renderCalendarios();
      renderReunioesDoDia();
      atualizarModalReuniao();
      openModal('modalReuniao');
    });

    grid.appendChild(btn);
  }

  container.appendChild(grid);
}

function renderCalendarios() {
  if (calendarioReunioesEl) {
    renderCalendarioMes(calendarioReunioesEl, dataReferenciaCalendario, {
      isMini: false,
    });
  }
  if (calendarioMesAnteriorEl) {
    const anterior = new Date(
      dataReferenciaCalendario.getFullYear(),
      dataReferenciaCalendario.getMonth() - 1,
      1,
    );
    renderCalendarioMes(calendarioMesAnteriorEl, anterior, { isMini: true });
  }
  if (calendarioProximoMesEl) {
    const proximo = new Date(
      dataReferenciaCalendario.getFullYear(),
      dataReferenciaCalendario.getMonth() + 1,
      1,
    );
    renderCalendarioMes(calendarioProximoMesEl, proximo, { isMini: true });
  }
}

function renderReunioesDoDia() {
  if (!reunioesDiaListaEl) return;
  reunioesDiaListaEl.innerHTML = '';
  const eventos = (reunioesPorData.get(dataSelecionada) || [])
    .slice()
    .sort(compareEventos);
  if (!eventos.length) {
    reunioesDiaVazioEl?.classList.remove('hidden');
    return;
  }
  reunioesDiaVazioEl?.classList.add('hidden');
  const frag = document.createDocumentFragment();
  eventos.forEach((evento) => {
    const card = document.createElement('article');
    card.className =
      'space-y-2 rounded-lg border border-purple-100 bg-white p-3 text-sm text-gray-700 shadow-sm';
    const header = document.createElement('div');
    header.className = 'flex flex-wrap items-center justify-between gap-2';
    const horaEl = document.createElement('span');
    horaEl.className = 'font-semibold text-gray-800';
    horaEl.textContent =
      formatTimeDisplay(evento.hora) || 'Horário não informado';
    header.appendChild(horaEl);
    const autorEl = document.createElement('span');
    autorEl.className = 'text-xs text-gray-500';
    const autorNome =
      evento.autorUid === currentUser?.uid
        ? 'Você'
        : evento.autorNome || nomeUsuario(evento.autorUid);
    autorEl.textContent = `Agendado por ${autorNome}`;
    header.appendChild(autorEl);
    card.appendChild(header);

    const participantes = Array.from(
      new Set(
        (evento.participantes || []).filter((uid) => typeof uid === 'string'),
      ),
    );
    if (participantes.length) {
      const participantesEl = document.createElement('p');
      participantesEl.className = 'text-xs text-gray-600';
      const nomes = participantes.map((uid) => nomeUsuario(uid));
      participantesEl.textContent = `Participantes: ${nomes.join(', ')}`;
      card.appendChild(participantesEl);
    }

    frag.appendChild(card);
  });
  reunioesDiaListaEl.appendChild(frag);
}

function atualizarEventosCalendario(eventos = []) {
  reunioesEventos = Array.isArray(eventos) ? eventos.slice() : [];
  reunioesPorData.clear();
  reunioesEventos.forEach((evento) => {
    if (!evento?.dataKey) return;
    if (!reunioesPorData.has(evento.dataKey)) {
      reunioesPorData.set(evento.dataKey, []);
    }
    reunioesPorData.get(evento.dataKey).push(evento);
  });
  Array.from(reunioesPorData.entries()).forEach(([key, lista]) => {
    lista.sort(compareEventos);
    reunioesPorData.set(key, lista);
  });
  renderCalendarios();
  renderReunioesDoDia();
}

function carregarReunioes() {
  if (!currentUser) return;
  reunioesUnsub?.();
  setStatus(reunioesStatusEl, 'Carregando agenda de reuniões...');
  const reunioesRef = query(
    collection(db, 'painelAtualizacoesGerais'),
    where('participantes', 'array-contains', currentUser.uid),
    orderBy('createdAt', 'desc'),
  );
  reunioesUnsub = onSnapshot(
    reunioesRef,
    async (snap) => {
      setStatus(reunioesStatusEl, '');
      const eventos = [];
      const usuariosParaCarregar = new Set();
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (data.categoria !== 'reuniao') return;
        let dataKey = '';
        if (typeof data.dataReuniao === 'string') {
          dataKey = data.dataReuniao;
        } else if (data.dataHora?.toDate) {
          try {
            dataKey = formatDateKey(data.dataHora.toDate());
          } catch (_) {
            dataKey = '';
          }
        } else if (data.createdAt?.toDate) {
          try {
            dataKey = formatDateKey(data.createdAt.toDate());
          } catch (_) {
            dataKey = '';
          }
        }
        if (!dataKey) return;
        const hora = data.horaReuniao || data.horario || '';
        let dataHora = null;
        if (data.dataHora?.toDate) {
          try {
            dataHora = data.dataHora.toDate();
          } catch (_) {
            dataHora = null;
          }
        }
        if (!dataHora && hora) {
          const parsed = new Date(`${dataKey}T${hora}:00`);
          if (!Number.isNaN(parsed.valueOf())) dataHora = parsed;
        }
        if (!dataHora && data.createdAt?.toDate) {
          try {
            dataHora = data.createdAt.toDate();
          } catch (_) {
            dataHora = null;
          }
        }
        const participantesEvento = Array.isArray(data.participantes)
          ? data.participantes.filter((uid) => typeof uid === 'string')
          : [];
        participantesEvento.forEach((uid) => usuariosParaCarregar.add(uid));
        const convidadosEvento = Array.isArray(data.convidados)
          ? data.convidados.filter((uid) => typeof uid === 'string')
          : [];
        eventos.push({
          id: docSnap.id,
          dataKey,
          hora,
          dataHora,
          participantes: participantesEvento,
          convidados: convidadosEvento,
          autorUid: data.autorUid || '',
          autorNome: data.autorNome || '',
        });
      });
      try {
        await ensureUsuariosConhecidos(Array.from(usuariosParaCarregar));
      } catch (err) {
        console.warn('Erro ao carregar participantes das reuniões:', err);
      }
      atualizarEventosCalendario(eventos);
    },
    (err) => {
      console.error('Erro ao carregar reuniões:', err);
      showTemporaryStatus(
        reunioesStatusEl,
        'Não foi possível carregar as reuniões. Tente novamente.',
        true,
      );
    },
  );
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

async function salvarReuniao() {
  if (!currentUser) return;
  if (!dataSelecionada) {
    reuniaoModalStatusEl?.classList.add('text-red-500');
    if (reuniaoModalStatusEl)
      reuniaoModalStatusEl.textContent =
        'Selecione uma data válida para agendar a reunião.';
    return;
  }
  const horario = reuniaoHorarioInput?.value?.trim() || '';
  if (!/^\d{2}:\d{2}$/.test(horario)) {
    if (reuniaoModalStatusEl) {
      reuniaoModalStatusEl.classList.add('text-red-500');
      reuniaoModalStatusEl.textContent =
        'Informe um horário válido no formato HH:MM.';
    }
    return;
  }
  const inputs = reuniaoParticipantesListaEl
    ? Array.from(
        reuniaoParticipantesListaEl.querySelectorAll(
          'input[name="reuniaoParticipante"]',
        ),
      )
    : [];
  const selecionados = new Set();
  inputs.forEach((input) => {
    if (input.checked || input.dataset.locked === 'true') {
      selecionados.add(input.value);
    }
  });
  if (currentUser?.uid) selecionados.add(currentUser.uid);
  const participantes = Array.from(selecionados).filter(
    (uid) => typeof uid === 'string' && uid.trim(),
  );
  const convidados = participantes.filter((uid) => uid !== currentUser?.uid);
  if (!convidados.length) {
    if (reuniaoModalStatusEl) {
      reuniaoModalStatusEl.classList.add('text-red-500');
      reuniaoModalStatusEl.textContent =
        'Selecione pelo menos um participante além de você para agendar a reunião.';
    }
    return;
  }

  if (reuniaoModalStatusEl) {
    reuniaoModalStatusEl.classList.remove('text-red-500');
    reuniaoModalStatusEl.classList.remove('text-green-600');
    reuniaoModalStatusEl.textContent = '';
  }

  const dataCompleta = new Date(`${dataSelecionada}T${horario}:00`);
  const payload = {
    categoria: 'reuniao',
    dataReuniao: dataSelecionada,
    horaReuniao: horario,
    participantes,
    convidados,
    autorUid: currentUser.uid,
    autorNome: nomeResponsavel,
    createdAt: serverTimestamp(),
  };
  if (!Number.isNaN(dataCompleta.valueOf())) {
    payload.dataHora = Timestamp.fromDate(dataCompleta);
  }

  const originalText = reuniaoSalvarBtn?.textContent || 'Salvar reunião';
  try {
    if (reuniaoSalvarBtn) {
      reuniaoSalvarBtn.disabled = true;
      reuniaoSalvarBtn.classList.add('opacity-60', 'cursor-not-allowed');
      reuniaoSalvarBtn.textContent = 'Salvando...';
    }
    await addDoc(collection(db, 'painelAtualizacoesGerais'), payload);
    closeModal('modalReuniao');
    showTemporaryStatus(reunioesStatusEl, 'Reunião agendada com sucesso.');
  } catch (err) {
    console.error('Erro ao salvar reunião:', err);
    if (reuniaoModalStatusEl) {
      reuniaoModalStatusEl.classList.add('text-red-500');
      reuniaoModalStatusEl.textContent =
        'Não foi possível salvar a reunião. Tente novamente.';
    }
  } finally {
    if (reuniaoSalvarBtn) {
      reuniaoSalvarBtn.disabled = false;
      reuniaoSalvarBtn.classList.remove('opacity-60', 'cursor-not-allowed');
      reuniaoSalvarBtn.textContent = originalText;
    }
  }
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
renderReunioesDoDia();

reuniaoSalvarBtn?.addEventListener('click', salvarReuniao);
reunioesHojeBtn?.addEventListener('click', () => {
  const hojeKey = getTodayKey();
  dataSelecionada = hojeKey;
  dataReferenciaCalendario = parseDateKey(hojeKey) || new Date();
  renderCalendarios();
  renderReunioesDoDia();
});

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
    const { participantes } = await montarEscopoCompartilhamento(user);
    participantesCompartilhamento = participantes.length
      ? participantes
      : [user.uid];
    atualizarEscopoMensagem(participantesCompartilhamento);
    setStatus(painelStatusEl, '');

    try {
      await prepararParticipantesParaModal(participantesCompartilhamento);
    } catch (err) {
      console.error('Erro ao preparar participantes disponíveis:', err);
    }

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
