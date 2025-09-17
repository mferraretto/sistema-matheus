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
  setDoc,
  deleteDoc,
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
const calendarioReunioesAtualEl = document.getElementById(
  'calendarioReunioesAtual',
);
const calendarioReunioesAnteriorEl = document.getElementById(
  'calendarioReunioesAnterior',
);
const calendarioReunioesProximoEl = document.getElementById(
  'calendarioReunioesProximo',
);
const calendarioReunioesAtualTituloEl = document.getElementById(
  'calendarioReunioesAtualTitulo',
);
const calendarioReunioesAnteriorTituloEl = document.getElementById(
  'calendarioReunioesAnteriorTitulo',
);
const calendarioReunioesProximoTituloEl = document.getElementById(
  'calendarioReunioesProximoTitulo',
);
const listaReunioesEl = document.getElementById('listaReunioes');
const reunioesVazioEl = document.getElementById('reunioesVazio');
const reunioesStatusEl = document.getElementById('reunioesStatus');
const modalReuniaoEl = document.getElementById('modalReuniao');
const modalReuniaoDataEl = document.getElementById('modalReuniaoData');
const modalReuniaoFecharBtn = document.getElementById('modalReuniaoFechar');
const reuniaoCancelarBtn = document.getElementById('reuniaoCancelar');
const reuniaoSalvarBtn = document.getElementById('reuniaoSalvar');
const reuniaoHorarioInput = document.getElementById('reuniaoHorario');
const reuniaoDescricaoInput = document.getElementById('reuniaoDescricao');
const reuniaoParticipantesListaEl = document.getElementById(
  'reuniaoParticipantesLista',
);
const reuniaoParticipantesVazioEl = document.getElementById(
  'reuniaoParticipantesVazio',
);
const reuniaoModalStatusEl = document.getElementById('reuniaoModalStatus');
const formReuniao = document.getElementById('formReuniao');
const tabButtons = document.querySelectorAll('[data-tab-target]');
const tabPanels = document.querySelectorAll('[data-tab-panel]');
const muralResumoDestinatariosEl = document.getElementById(
  'muralResumoDestinatarios',
);
const muralResumoProximaReuniaoEl = document.getElementById(
  'muralResumoProximaReuniao',
);
const muralMensagemDestaqueTextoEl = document.getElementById(
  'muralMensagemDestaqueTexto',
);
const muralMensagemDestaqueAutorEl = document.getElementById(
  'muralMensagemDestaqueAutor',
);
const muralMensagensListaEl = document.getElementById('muralMensagensLista');
const muralMensagensVazioEl = document.getElementById('muralMensagensVazio');
const muralProblemasListaEl = document.getElementById('muralProblemasLista');
const muralProblemasVazioEl = document.getElementById('muralProblemasVazio');
const muralReunioesListaEl = document.getElementById('muralReunioesLista');
const muralReunioesVazioEl = document.getElementById('muralReunioesVazio');
const muralProdutosListaEl = document.getElementById('muralProdutosLista');
const muralProdutosVazioEl = document.getElementById('muralProdutosVazio');
const produtosLinhaStatusEl = document.getElementById('produtosLinhaStatus');
const produtosLinhaTabelaCabecalhoEl = document.getElementById(
  'produtosLinhaTabelaCabecalho',
);
const produtosLinhaTabelaCorpoEl = document.getElementById(
  'produtosLinhaTabelaCorpo',
);
const produtosLinhaTabelaContainerEl = document.getElementById(
  'produtosLinhaTabelaContainer',
);
const produtosLinhaMetaEl = document.getElementById('produtosLinhaMeta');
const produtosLinhaVazioEl = document.getElementById('produtosLinhaVazio');
const produtosLinhaAcessoNegadoEl = document.getElementById(
  'produtosLinhaAcessoNegado',
);
const produtosLinhaSemInformacaoEl = document.getElementById(
  'produtosLinhaSemInformacao',
);
const produtosLinhaConfigSecaoEl = document.getElementById(
  'produtosLinhaConfigSecao',
);
const produtosLinhaUsuariosListaEl = document.getElementById(
  'produtosLinhaUsuariosLista',
);
const produtosLinhaConfigVazioEl = document.getElementById(
  'produtosLinhaConfigVazio',
);
const produtosLinhaConfigStatusEl = document.getElementById(
  'produtosLinhaConfigStatus',
);
const produtosLinhaConfigFormEl = document.getElementById(
  'formProdutosLinhaConfig',
);
const modalDestinatariosEl = document.getElementById(
  'modalDestinatariosMensagem',
);
const modalDestinatariosListaEl = document.getElementById(
  'destinatariosMensagemLista',
);
const modalDestinatariosVazioEl = document.getElementById(
  'destinatariosMensagemVazio',
);
const modalDestinatariosStatusEl = document.getElementById(
  'destinatariosMensagemStatus',
);
const modalDestinatariosMensagemResumoEl = document.getElementById(
  'modalDestinatariosMensagemResumo',
);
const modalDestinatariosFecharBtn = document.getElementById(
  'modalDestinatariosFechar',
);
const modalDestinatariosCancelarBtn = document.getElementById(
  'modalDestinatariosCancelar',
);
const destinatariosSelecionarTodosBtn = document.getElementById(
  'destinatariosSelecionarTodos',
);
const destinatariosLimparSelecaoBtn = document.getElementById(
  'destinatariosLimparSelecao',
);
const modalDestinatariosConfirmarBtn = document.getElementById(
  'modalDestinatariosConfirmar',
);
const formDestinatariosMensagem = document.getElementById(
  'formDestinatariosMensagem',
);

let currentUser = null;
let participantesCompartilhamento = [];
let mensagensUnsub = null;
let problemasUnsub = null;
let produtosUnsub = null;
let nomeResponsavel = '';
let isGestorAtual = false;
let isResponsavelFinanceiroAtual = false;
let produtosLinhaPodeGerir = false;
let usuariosFinanceirosLista = [];
let produtosLinhaResponsavelUid = null;
let produtosLinhaImportacoesUnsub = null;
let produtosLinhaItensUnsub = null;
let produtosLinhaConfigUnsub = null;
let produtosLinhaConfigUidAtual = null;
let produtosLinhaImportacaoMeta = null;
let produtosLinhaItens = [];
let produtosLinhaUsuariosMap = new Map();
let produtosLinhaConfigDados = null;
let produtosLinhaPronto = false;
let produtosLinhaItensImportacaoPath = null;
let participantesDetalhes = [];
let participantesPorUid = new Map();
let participantesSelecionados = new Set();
let reunioesUnsub = null;
let reunioesDados = [];
let reunioesPorDia = new Map();
let dataReuniaoSelecionada = '';
let reuniaoParticipantesSelecionados = new Set();
let mensagensDados = [];
let problemasDados = [];
let produtosDados = [];
let destinatariosMensagemSelecionados = new Set();
let mensagemEmPreparacao = '';

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

function capitalizeFirstLetter(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function truncarTexto(texto, limite = 120) {
  if (!texto && texto !== 0) return '';
  const valor = String(texto).trim();
  if (!valor) return '';
  if (valor.length <= limite) return valor;
  return `${valor.slice(0, Math.max(0, limite - 1)).trimEnd()}…`;
}

function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISODate(value) {
  if (!value) return null;
  const [yearStr, monthStr, dayStr] = String(value).split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function formatMonthTitle(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return '';
  const texto = date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return capitalizeFirstLetter(texto);
}

function formatLongDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return '';
  const texto = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return capitalizeFirstLetter(texto);
}

function formatShortDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return '';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '';
  const numero = Number(value);
  if (!Number.isFinite(numero)) return '';
  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resumirNomesParticipantes(nomes) {
  if (!Array.isArray(nomes) || !nomes.length) return '';
  const filtrados = nomes.filter(
    (nome) => typeof nome === 'string' && nome.trim(),
  );
  if (!filtrados.length) return '';
  if (filtrados.length === 1) return filtrados[0];
  if (filtrados.length === 2) return `${filtrados[0]} e ${filtrados[1]}`;
  if (filtrados.length === 3) {
    return `${filtrados[0]}, ${filtrados[1]} e ${filtrados[2]}`;
  }
  return `${filtrados[0]}, ${filtrados[1]} e mais ${filtrados.length - 2}`;
}

function normalizeTimeValue(value) {
  if (!value) return '';
  const [hoursStr, minutesStr] = String(value).split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (
    !Number.isInteger(hours) ||
    hours < 0 ||
    hours > 23 ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 59
  ) {
    return '';
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatHourFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return '';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
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
  renderizarParticipantesModalReuniao();
  renderizarDestinatariosMensagemModal();
  atualizarCalendarioReunioes();
  renderizarListaReunioes();
  atualizarMuralHero();
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

  atualizarResumoModalDestinatarios();
  atualizarMuralHero();
}

function atualizarResumoModalDestinatarios() {
  if (!modalDestinatariosStatusEl) return;
  const modalAtivo =
    modalDestinatariosEl && !modalDestinatariosEl.classList.contains('hidden');
  if (!modalAtivo) {
    if (modalDestinatariosStatusEl.textContent) {
      setStatus(modalDestinatariosStatusEl, '');
    }
    return;
  }

  if (!participantesDetalhes.length) {
    setStatus(
      modalDestinatariosStatusEl,
      'Nenhum destinatário disponível para envio.',
      true,
    );
    return;
  }

  const totalSelecionados = destinatariosMensagemSelecionados.size;
  if (!totalSelecionados) {
    setStatus(
      modalDestinatariosStatusEl,
      'Selecione ao menos um destinatário ou utilize Enviar para todos.',
      false,
    );
    return;
  }

  const totalDisponiveis = participantesDetalhes.length;
  if (totalSelecionados >= totalDisponiveis) {
    setStatus(
      modalDestinatariosStatusEl,
      'Enviar para todos os contatos conectados.',
      false,
    );
    return;
  }

  setStatus(
    modalDestinatariosStatusEl,
    `Enviar para ${totalSelecionados} ${
      totalSelecionados === 1
        ? 'destinatário selecionado'
        : 'destinatários selecionados'
    }.`,
    false,
  );
}

function renderizarDestinatariosMensagemModal() {
  if (!modalDestinatariosListaEl) return;

  modalDestinatariosListaEl.innerHTML = '';

  if (!participantesDetalhes.length) {
    modalDestinatariosVazioEl?.classList.remove('hidden');
    atualizarResumoModalDestinatarios();
    return;
  }

  modalDestinatariosVazioEl?.classList.add('hidden');
  const frag = document.createDocumentFragment();

  participantesDetalhes.forEach((info) => {
    const item = document.createElement('label');
    item.className =
      'flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-blue-300';
    item.dataset.uid = info.uid;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className =
      'mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500';
    checkbox.checked = destinatariosMensagemSelecionados.has(info.uid);
    checkbox.addEventListener('change', (event) => {
      if (event.target.checked) {
        destinatariosMensagemSelecionados.add(info.uid);
      } else {
        destinatariosMensagemSelecionados.delete(info.uid);
      }
      atualizarResumoModalDestinatarios();
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
    if (info.email && info.papel) {
      detalheEl.textContent = `${info.email} • ${info.papel}`;
    } else if (info.email) {
      detalheEl.textContent = info.email;
    } else if (info.papel) {
      detalheEl.textContent = info.papel;
    } else {
      detalheEl.textContent = 'Detalhes não informados';
    }

    content.appendChild(nomeEl);
    content.appendChild(detalheEl);

    item.appendChild(checkbox);
    item.appendChild(content);
    frag.appendChild(item);
  });

  modalDestinatariosListaEl.appendChild(frag);
  atualizarResumoModalDestinatarios();
}

function abrirModalDestinatariosMensagem(texto) {
  if (!modalDestinatariosEl) return;

  mensagemEmPreparacao = texto;
  setStatus(modalDestinatariosStatusEl, '');

  const baseSelecao = Array.isArray(participantesCompartilhamento)
    ? participantesCompartilhamento
    : [];
  destinatariosMensagemSelecionados = new Set(
    baseSelecao.filter((uid) => typeof uid === 'string' && uid),
  );

  if (!destinatariosMensagemSelecionados.size) {
    participantesDetalhes
      .map((info) => info.uid)
      .filter((uid) => typeof uid === 'string' && uid)
      .forEach((uid) => destinatariosMensagemSelecionados.add(uid));
  }

  if (modalDestinatariosMensagemResumoEl) {
    modalDestinatariosMensagemResumoEl.textContent = truncarTexto(texto, 110);
  }

  modalDestinatariosEl.classList.remove('hidden');
  modalDestinatariosEl.classList.add('flex');
  modalDestinatariosEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overflow-hidden');

  renderizarDestinatariosMensagemModal();
}

function fecharModalDestinatariosMensagem() {
  if (!modalDestinatariosEl) return;
  modalDestinatariosEl.classList.add('hidden');
  modalDestinatariosEl.classList.remove('flex');
  modalDestinatariosEl.setAttribute('aria-hidden', 'true');
  if (!modalReuniaoEl || modalReuniaoEl.classList.contains('hidden')) {
    document.body.classList.remove('overflow-hidden');
  }
  mensagemEmPreparacao = '';
  setStatus(modalDestinatariosStatusEl, '');
}

function selecionarTodosDestinatariosModal() {
  destinatariosMensagemSelecionados = new Set(
    participantesDetalhes
      .map((info) => info.uid)
      .filter((uid) => typeof uid === 'string' && uid),
  );
  renderizarDestinatariosMensagemModal();
}

function limparSelecaoDestinatariosModal() {
  destinatariosMensagemSelecionados.clear();
  renderizarDestinatariosMensagemModal();
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

function ativarAba(targetId) {
  if (!targetId) return;
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === targetId;
    button.classList.toggle('opacity-60', !isActive);
    button.classList.toggle('opacity-100', isActive);
    button.classList.toggle('ring-2', isActive);
    button.classList.toggle('ring-offset-2', isActive);
    button.classList.toggle('ring-blue-200', isActive);
    button.classList.toggle('shadow-lg', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    button.setAttribute('tabindex', isActive ? '0' : '-1');
  });
  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === targetId;
    panel.classList.toggle('hidden', !isActive);
    panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });
}

function obterDataHoraReuniao(reuniao) {
  if (!reuniao) return null;
  const candidato = reuniao.inicio;
  if (candidato instanceof Date && !Number.isNaN(candidato.valueOf())) {
    return candidato;
  }
  if (candidato && typeof candidato.toDate === 'function') {
    try {
      const convertido = candidato.toDate();
      if (!Number.isNaN(convertido.valueOf())) return convertido;
    } catch (_) {}
  }
  const dataBase = parseISODate(reuniao.dataIso || reuniao.data);
  if (!dataBase) return null;
  const horaNormalizada = normalizeTimeValue(reuniao.hora);
  if (horaNormalizada) {
    const [hora, minuto] = horaNormalizada.split(':').map(Number);
    dataBase.setHours(hora, minuto, 0, 0);
  }
  return dataBase;
}

function obterNomesParticipantesReuniao(reuniao) {
  if (!reuniao) return [];
  const nomes = new Set();
  if (Array.isArray(reuniao.participantesNomes)) {
    reuniao.participantesNomes.forEach((nome) => {
      if (typeof nome === 'string' && nome.trim()) {
        nomes.add(nome.trim());
      }
    });
  }
  if (Array.isArray(reuniao.participantes)) {
    reuniao.participantes.forEach((uid) => {
      const info = participantesPorUid.get(uid);
      const nome = info?.nome;
      if (nome) {
        nomes.add(nome);
      }
    });
  }
  return Array.from(nomes);
}

function atualizarMapaReunioes() {
  const mapa = new Map();
  reunioesDados.forEach((reuniao) => {
    const iso = reuniao.dataIso || reuniao.data;
    if (!iso) return;
    if (!mapa.has(iso)) {
      mapa.set(iso, []);
    }
    mapa.get(iso).push(reuniao);
  });
  reunioesPorDia = mapa;
}

function renderizarListaReunioes() {
  if (!listaReunioesEl) return;
  listaReunioesEl.innerHTML = '';

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const itensOrdenados = reunioesDados
    .map((reuniao) => {
      const inicio = obterDataHoraReuniao(reuniao);
      return { ...reuniao, inicio };
    })
    .filter(
      (reuniao) =>
        reuniao.inicio instanceof Date && !Number.isNaN(reuniao.inicio),
    )
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  const proximas = itensOrdenados.filter(
    (reuniao) => reuniao.inicio.getTime() >= inicioHoje.getTime(),
  );
  let exibir = proximas.slice(0, 5);
  if (!exibir.length) {
    exibir = itensOrdenados.slice(-5).reverse();
  }

  if (!exibir.length) {
    reunioesVazioEl?.classList.remove('hidden');
    return;
  }

  reunioesVazioEl?.classList.add('hidden');
  const frag = document.createDocumentFragment();

  exibir.forEach((reuniao) => {
    const card = document.createElement('article');
    card.className =
      'rounded-lg border border-indigo-100 bg-indigo-50 p-3 shadow-sm transition hover:border-indigo-200';

    const cabecalho = document.createElement('div');
    cabecalho.className =
      'flex items-center justify-between text-xs font-semibold text-indigo-700';
    cabecalho.innerHTML = `
      <span>${formatShortDate(reuniao.inicio)}</span>
      <span>${
        normalizeTimeValue(reuniao.hora) ||
        formatHourFromDate(reuniao.inicio) ||
        ''
      }</span>
    `;
    card.appendChild(cabecalho);

    const nomes = obterNomesParticipantesReuniao(reuniao);
    const participantesResumo = resumirNomesParticipantes(nomes);
    const participantes = document.createElement('p');
    participantes.className = 'mt-2 text-sm text-gray-700';
    participantes.textContent = participantesResumo
      ? `Participantes: ${participantesResumo}`
      : 'Participantes a definir.';
    card.appendChild(participantes);

    const descricao = (reuniao.descricao || '').toString().trim();
    if (descricao) {
      const descricaoEl = document.createElement('p');
      descricaoEl.className = 'mt-2 text-sm text-gray-600';
      descricaoEl.textContent = descricao;
      card.appendChild(descricaoEl);
    }

    const autorNome = reuniao.autorNome || reuniao.responsavelNome || '';
    if (autorNome) {
      const autorEl = document.createElement('p');
      autorEl.className = 'mt-2 text-xs text-gray-500';
      autorEl.textContent = `Agendado por ${autorNome}`;
      card.appendChild(autorEl);
    }

    frag.appendChild(card);
  });

  listaReunioesEl.appendChild(frag);
}

function obterProximaReuniao() {
  const agora = new Date();
  const candidatos = reunioesDados
    .map((reuniao) => ({
      ...reuniao,
      inicio: obterDataHoraReuniao(reuniao),
    }))
    .filter(
      (reuniao) =>
        reuniao.inicio instanceof Date && !Number.isNaN(reuniao.inicio),
    )
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  return (
    candidatos.find((item) => item.inicio.getTime() >= agora.getTime()) || null
  );
}

function atualizarMuralHero() {
  if (muralMensagemDestaqueTextoEl) {
    if (mensagensDados.length) {
      const mensagem = mensagensDados[0];
      muralMensagemDestaqueTextoEl.textContent =
        truncarTexto(mensagem.texto, 160) ||
        'Compartilhe uma atualização para iniciar o dia.';
      const detalhes = [];
      if (mensagem.autor) detalhes.push(`por ${mensagem.autor}`);
      if (mensagem.createdAt)
        detalhes.push(formatDate(mensagem.createdAt, true));
      muralMensagemDestaqueAutorEl.textContent = detalhes.join(' • ');
    } else {
      muralMensagemDestaqueTextoEl.textContent =
        'Compartilhe uma atualização para iniciar o dia.';
      muralMensagemDestaqueAutorEl.textContent =
        'As mensagens aparecerão aqui assim que forem enviadas.';
    }
  }

  if (muralResumoDestinatariosEl) {
    const total =
      participantesDetalhes.length || participantesCompartilhamento.length;
    if (total) {
      muralResumoDestinatariosEl.textContent = `${total} ${
        total === 1 ? 'destinatário' : 'destinatários'
      }`;
    } else {
      muralResumoDestinatariosEl.textContent =
        'Nenhum destinatário configurado';
    }
  }

  if (muralResumoProximaReuniaoEl) {
    const proxima = obterProximaReuniao();
    if (proxima) {
      const inicio = obterDataHoraReuniao(proxima);
      const dataTexto = inicio ? formatLongDate(inicio) : '';
      const horaTexto =
        normalizeTimeValue(proxima.hora) ||
        (inicio ? formatHourFromDate(inicio) : '');
      const participantesResumo = resumirNomesParticipantes(
        obterNomesParticipantesReuniao(proxima),
      );
      const partes = [];
      if (dataTexto) partes.push(dataTexto);
      if (horaTexto) partes.push(`às ${horaTexto}`);
      if (participantesResumo) partes.push(participantesResumo);
      muralResumoProximaReuniaoEl.textContent = partes.join(' • ');
    } else {
      muralResumoProximaReuniaoEl.textContent =
        'Nenhuma reunião futura agendada.';
    }
  }
}

function atualizarMuralMensagens() {
  if (!muralMensagensListaEl) return;
  muralMensagensListaEl.innerHTML = '';

  if (!mensagensDados.length) {
    muralMensagensVazioEl?.classList.remove('hidden');
    return;
  }

  muralMensagensVazioEl?.classList.add('hidden');
  const frag = document.createDocumentFragment();
  mensagensDados.slice(0, 4).forEach((mensagem) => {
    const card = document.createElement('article');
    card.className =
      'rounded-xl border border-blue-100 bg-blue-50/40 p-4 shadow-sm';

    const textoEl = document.createElement('p');
    textoEl.className = 'text-sm text-gray-700';
    textoEl.textContent = truncarTexto(mensagem.texto, 160);
    card.appendChild(textoEl);

    const metaEl = document.createElement('p');
    metaEl.className =
      'mt-2 text-[11px] uppercase tracking-wide text-blue-700/70';
    const detalhes = [];
    if (mensagem.autor) detalhes.push(mensagem.autor);
    if (mensagem.createdAt) detalhes.push(formatDate(mensagem.createdAt, true));
    metaEl.textContent = detalhes.join(' • ');
    if (metaEl.textContent) card.appendChild(metaEl);

    frag.appendChild(card);
  });
  muralMensagensListaEl.appendChild(frag);
}

function atualizarMuralProblemas() {
  if (!muralProblemasListaEl) return;
  muralProblemasListaEl.innerHTML = '';

  if (!problemasDados.length) {
    muralProblemasVazioEl?.classList.remove('hidden');
    return;
  }

  muralProblemasVazioEl?.classList.add('hidden');
  const frag = document.createDocumentFragment();
  problemasDados.slice(0, 4).forEach((problema) => {
    const card = document.createElement('article');
    card.className =
      'rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm';

    const descricaoEl = document.createElement('p');
    descricaoEl.className = 'text-sm font-semibold text-amber-700';
    descricaoEl.textContent =
      truncarTexto(problema.problema, 150) || 'Problema sem descrição';
    card.appendChild(descricaoEl);

    const detalhes = [];
    if (problema.setor) detalhes.push(`Setor ${problema.setor}`);
    if (problema.responsavel)
      detalhes.push(`Responsável ${problema.responsavel}`);
    if (detalhes.length) {
      const detalhesEl = document.createElement('p');
      detalhesEl.className = 'mt-2 text-xs text-amber-700/80';
      detalhesEl.textContent = detalhes.join(' • ');
      card.appendChild(detalhesEl);
    }

    if (problema.solucao) {
      const solucaoEl = document.createElement('p');
      solucaoEl.className =
        'mt-2 rounded-lg bg-white/70 p-2 text-xs text-amber-700';
      solucaoEl.textContent = truncarTexto(`Solução: ${problema.solucao}`, 160);
      card.appendChild(solucaoEl);
    }

    const datas = [];
    if (problema.dataOcorrencia)
      datas.push(`Registro ${formatDate(problema.dataOcorrencia, false)}`);
    if (problema.createdAt)
      datas.push(`Atualizado ${formatDate(problema.createdAt, true)}`);
    if (datas.length) {
      const dataEl = document.createElement('p');
      dataEl.className = 'mt-2 text-[11px] text-amber-600/80';
      dataEl.textContent = datas.join(' • ');
      card.appendChild(dataEl);
    }

    frag.appendChild(card);
  });
  muralProblemasListaEl.appendChild(frag);
}

function atualizarMuralProdutos() {
  if (!muralProdutosListaEl) return;
  muralProdutosListaEl.innerHTML = '';

  if (!produtosDados.length) {
    muralProdutosVazioEl?.classList.remove('hidden');
    return;
  }

  muralProdutosVazioEl?.classList.add('hidden');
  const frag = document.createDocumentFragment();
  produtosDados.slice(0, 4).forEach((produto) => {
    const card = document.createElement('article');
    card.className =
      'rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm';

    const nomeEl = document.createElement('p');
    nomeEl.className = 'text-sm font-semibold text-emerald-700';
    nomeEl.textContent = produto.nome || 'Produto sem nome';
    card.appendChild(nomeEl);

    if (produto.observacoes) {
      const obsEl = document.createElement('p');
      obsEl.className = 'mt-2 text-xs text-emerald-700/80';
      obsEl.textContent = truncarTexto(produto.observacoes, 150);
      card.appendChild(obsEl);
    }

    const detalhes = [];
    if (produto.autor) detalhes.push(`Por ${produto.autor}`);
    if (produto.createdAt) detalhes.push(formatDate(produto.createdAt, true));
    if (detalhes.length) {
      const detalheEl = document.createElement('p');
      detalheEl.className = 'mt-2 text-[11px] text-emerald-600/80';
      detalheEl.textContent = detalhes.join(' • ');
      card.appendChild(detalheEl);
    }

    frag.appendChild(card);
  });
  muralProdutosListaEl.appendChild(frag);
}

function atualizarMuralReunioes() {
  if (!muralReunioesListaEl) return;
  muralReunioesListaEl.innerHTML = '';

  const proximas = reunioesDados
    .map((reuniao) => ({
      ...reuniao,
      inicio: obterDataHoraReuniao(reuniao),
    }))
    .filter(
      (reuniao) =>
        reuniao.inicio instanceof Date && !Number.isNaN(reuniao.inicio),
    )
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  if (!proximas.length) {
    muralReunioesVazioEl?.classList.remove('hidden');
    return;
  }

  muralReunioesVazioEl?.classList.add('hidden');
  const frag = document.createDocumentFragment();
  proximas.slice(0, 4).forEach((reuniao) => {
    const card = document.createElement('article');
    card.className =
      'rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm';

    const dataEl = document.createElement('p');
    dataEl.className = 'text-sm font-semibold text-indigo-700';
    const inicio = reuniao.inicio;
    const dataTexto = inicio ? formatShortDate(inicio) : '';
    const horaTexto =
      normalizeTimeValue(reuniao.hora) ||
      (inicio ? formatHourFromDate(inicio) : '');
    dataEl.textContent = horaTexto ? `${dataTexto} • ${horaTexto}` : dataTexto;
    card.appendChild(dataEl);

    const descricao = (reuniao.descricao || '').toString().trim();
    if (descricao) {
      const descricaoEl = document.createElement('p');
      descricaoEl.className = 'mt-2 text-sm text-gray-700';
      descricaoEl.textContent = truncarTexto(descricao, 140);
      card.appendChild(descricaoEl);
    }

    const participantesResumo = resumirNomesParticipantes(
      obterNomesParticipantesReuniao(reuniao),
    );
    if (participantesResumo) {
      const participantesEl = document.createElement('p');
      participantesEl.className = 'mt-2 text-xs text-indigo-700/80';
      participantesEl.textContent = participantesResumo;
      card.appendChild(participantesEl);
    }

    frag.appendChild(card);
  });
  muralReunioesListaEl.appendChild(frag);
}

function obterDiasCalendario(baseDate) {
  const base = baseDate instanceof Date ? new Date(baseDate) : new Date();
  base.setDate(1);
  const ano = base.getFullYear();
  const mes = base.getMonth();
  const primeiroDiaSemana = base.getDay();
  const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
  const totalDiasMesAnterior = new Date(ano, mes, 0).getDate();

  const dias = [];
  for (let indice = 0; indice < 42; indice += 1) {
    const deslocamento = indice - primeiroDiaSemana + 1;
    let dia = deslocamento;
    let mesAtual = mes;
    let anoAtual = ano;
    let pertenceAoMes = true;

    if (deslocamento <= 0) {
      mesAtual -= 1;
      if (mesAtual < 0) {
        mesAtual = 11;
        anoAtual -= 1;
      }
      dia = totalDiasMesAnterior + deslocamento;
      pertenceAoMes = false;
    } else if (deslocamento > totalDiasMes) {
      mesAtual += 1;
      if (mesAtual > 11) {
        mesAtual = 0;
        anoAtual += 1;
      }
      dia = deslocamento - totalDiasMes;
      pertenceAoMes = false;
    }

    const dataDia = new Date(anoAtual, mesAtual, dia);
    dias.push({
      date: dataDia,
      iso: toDateKey(dataDia),
      inMonth: pertenceAoMes,
    });
  }
  return dias;
}

function renderizarCalendarioMes(container, tituloEl, baseDate, { mini } = {}) {
  if (!container) return;

  container.innerHTML = '';
  if (tituloEl) {
    tituloEl.textContent = formatMonthTitle(baseDate);
  }

  const diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const cabecalho = document.createElement('div');
  cabecalho.className = mini
    ? 'mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400'
    : 'mb-2 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wide text-gray-400';
  diasSemana.forEach((dia) => {
    const span = document.createElement('span');
    span.textContent = dia;
    cabecalho.appendChild(span);
  });
  container.appendChild(cabecalho);

  const grade = document.createElement('div');
  grade.className = mini ? 'grid grid-cols-7 gap-1' : 'grid grid-cols-7 gap-2';
  container.appendChild(grade);

  const hojeKey = toDateKey(new Date());
  const dias = obterDiasCalendario(baseDate);

  dias.forEach((dia) => {
    const reunioesDoDia = reunioesPorDia.get(dia.iso) || [];
    const temReunioes = reunioesDoDia.length > 0;
    const ehHoje = dia.iso === hojeKey;

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.dataset.date = dia.iso;
    botao.className = mini
      ? 'relative flex h-9 items-center justify-center rounded-md border text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-300'
      : 'relative flex h-16 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-300';

    let classes =
      'border-gray-200 bg-white text-gray-600 hover:border-indigo-400 hover:text-indigo-600';
    if (!dia.inMonth) {
      classes += ' bg-gray-50 text-gray-400';
    }
    if (temReunioes) {
      classes += ' border-indigo-300 bg-indigo-50 text-indigo-700';
    }
    if (ehHoje) {
      classes += ' ring-2 ring-indigo-400';
    }
    botao.className += ` ${classes}`;

    const numero = document.createElement('span');
    numero.textContent = String(dia.date.getDate());
    if (!mini) {
      numero.className = 'text-base font-semibold';
    }
    botao.appendChild(numero);

    if (temReunioes) {
      if (mini) {
        const indicador = document.createElement('span');
        indicador.className =
          'absolute bottom-1 h-1.5 w-1.5 rounded-full bg-indigo-500';
        botao.appendChild(indicador);
      } else {
        const badge = document.createElement('span');
        badge.className =
          'absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-semibold text-white';
        badge.textContent = String(reunioesDoDia.length);
        botao.appendChild(badge);
      }
    }

    if (temReunioes) {
      const resumoTitulo = reunioesDoDia
        .map((reuniao) => {
          const inicio = obterDataHoraReuniao(reuniao);
          const hora =
            normalizeTimeValue(reuniao.hora) || formatHourFromDate(inicio);
          const nomes = resumirNomesParticipantes(
            obterNomesParticipantesReuniao(reuniao),
          );
          const horaTexto = hora ? ` às ${hora}` : '';
          return `${formatLongDate(inicio || dia.date)}${horaTexto}${
            nomes ? ` - ${nomes}` : ''
          }`;
        })
        .join('\n');
      botao.title = resumoTitulo;
    } else {
      botao.title = `Agendar reunião em ${formatLongDate(dia.date)}`;
    }

    botao.addEventListener('click', () => abrirModalReuniao(dia.iso));
    grade.appendChild(botao);
  });
}

function atualizarCalendarioReunioes() {
  if (!calendarioReunioesAtualEl) return;
  const hoje = new Date();
  const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesProximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

  renderizarCalendarioMes(
    calendarioReunioesAtualEl,
    calendarioReunioesAtualTituloEl,
    mesAtual,
    {
      mini: false,
    },
  );
  renderizarCalendarioMes(
    calendarioReunioesAnteriorEl,
    calendarioReunioesAnteriorTituloEl,
    mesAnterior,
    { mini: true },
  );
  renderizarCalendarioMes(
    calendarioReunioesProximoEl,
    calendarioReunioesProximoTituloEl,
    mesProximo,
    { mini: true },
  );
}

function renderizarParticipantesModalReuniao() {
  if (!reuniaoParticipantesListaEl) return;
  reuniaoParticipantesListaEl.innerHTML = '';

  if (!participantesDetalhes.length) {
    reuniaoParticipantesVazioEl?.classList.remove('hidden');
    return;
  }

  reuniaoParticipantesVazioEl?.classList.add('hidden');
  const frag = document.createDocumentFragment();

  participantesDetalhes.forEach((info) => {
    const wrapper = document.createElement('label');
    wrapper.className =
      'flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm';
    wrapper.dataset.uid = info.uid;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className =
      'mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500';

    const isAtual = currentUser?.uid === info.uid;
    if (isAtual) {
      checkbox.checked = true;
      checkbox.disabled = true;
      reuniaoParticipantesSelecionados.add(info.uid);
    } else {
      checkbox.checked = reuniaoParticipantesSelecionados.has(info.uid);
      checkbox.addEventListener('change', (event) => {
        if (event.target.checked) {
          reuniaoParticipantesSelecionados.add(info.uid);
        } else {
          reuniaoParticipantesSelecionados.delete(info.uid);
        }
      });
    }

    const conteudo = document.createElement('div');
    conteudo.className = 'flex-1 min-w-0';

    const nomeEl = document.createElement('p');
    nomeEl.className = 'text-sm font-medium text-gray-800';
    if (isAtual) {
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

    conteudo.appendChild(nomeEl);
    conteudo.appendChild(detalheEl);

    wrapper.appendChild(checkbox);
    wrapper.appendChild(conteudo);
    frag.appendChild(wrapper);
  });

  reuniaoParticipantesListaEl.appendChild(frag);
}

function abrirModalReuniao(dateIso) {
  if (!modalReuniaoEl || !currentUser) return;
  const dataSelecionada = parseISODate(dateIso);
  if (!dataSelecionada) {
    showTemporaryStatus(
      reunioesStatusEl,
      'Não foi possível identificar a data selecionada.',
      true,
    );
    return;
  }

  dataReuniaoSelecionada = dateIso;
  if (modalReuniaoDataEl) {
    modalReuniaoDataEl.textContent = formatLongDate(dataSelecionada);
  }
  if (reuniaoHorarioInput) {
    reuniaoHorarioInput.value = '09:00';
  }
  if (reuniaoDescricaoInput) {
    reuniaoDescricaoInput.value = '';
  }

  const baseSelecao = participantesSelecionados.size
    ? Array.from(participantesSelecionados)
    : participantesCompartilhamento;
  reuniaoParticipantesSelecionados = new Set(
    (baseSelecao || []).filter((uid) => typeof uid === 'string' && uid),
  );
  if (currentUser?.uid) {
    reuniaoParticipantesSelecionados.add(currentUser.uid);
  }
  renderizarParticipantesModalReuniao();

  setStatus(reuniaoModalStatusEl, '');
  modalReuniaoEl.classList.remove('hidden');
  modalReuniaoEl.classList.add('flex');
  modalReuniaoEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overflow-hidden');
  setTimeout(() => reuniaoHorarioInput?.focus(), 100);
}

function fecharModalReuniao() {
  if (!modalReuniaoEl) return;
  modalReuniaoEl.classList.add('hidden');
  modalReuniaoEl.classList.remove('flex');
  modalReuniaoEl.setAttribute('aria-hidden', 'true');
  if (
    !modalDestinatariosEl ||
    modalDestinatariosEl.classList.contains('hidden')
  ) {
    document.body.classList.remove('overflow-hidden');
  }
  dataReuniaoSelecionada = '';
  reuniaoParticipantesSelecionados.clear();
  setStatus(reuniaoModalStatusEl, '');
}

async function salvarReuniao(event) {
  event.preventDefault();
  if (!currentUser) return;

  const dataIso = dataReuniaoSelecionada;
  const dataSelecionada = parseISODate(dataIso);
  if (!dataSelecionada) {
    setStatus(
      reuniaoModalStatusEl,
      'Selecione uma data válida para a reunião.',
      true,
    );
    return;
  }

  const horario = normalizeTimeValue(reuniaoHorarioInput?.value);
  if (!horario) {
    setStatus(
      reuniaoModalStatusEl,
      'Informe um horário válido para a reunião.',
      true,
    );
    return;
  }

  const participantesDestino = new Set(
    Array.from(reuniaoParticipantesSelecionados).filter(
      (uid) => typeof uid === 'string' && uid,
    ),
  );
  if (currentUser?.uid) {
    participantesDestino.add(currentUser.uid);
  }

  if (participantesDestino.size <= 1 && participantesDetalhes.length > 1) {
    setStatus(
      reuniaoModalStatusEl,
      'Selecione ao menos um participante além de você.',
      true,
    );
    return;
  }

  const [hora, minuto] = horario.split(':').map(Number);
  dataSelecionada.setHours(hora, minuto, 0, 0);
  if (Number.isNaN(dataSelecionada.valueOf())) {
    setStatus(
      reuniaoModalStatusEl,
      'Não foi possível interpretar a data informada.',
      true,
    );
    return;
  }

  const descricao = reuniaoDescricaoInput?.value.trim() || '';
  const participantesArray = Array.from(participantesDestino);
  const nomesParticipantes = participantesArray
    .map((uid) => participantesPorUid.get(uid)?.nome)
    .filter((nome) => typeof nome === 'string' && nome.trim());
  const nomesOrdenados = nomesParticipantes
    .map((nome) => nome.trim())
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  const participantesResumo = resumirNomesParticipantes(nomesOrdenados);

  try {
    if (reuniaoSalvarBtn) {
      reuniaoSalvarBtn.disabled = true;
      reuniaoSalvarBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    await addDoc(collection(db, 'painelAtualizacoesGerais'), {
      categoria: 'reuniao',
      data: dataIso,
      hora: horario,
      inicio: dataSelecionada,
      descricao,
      participantes: participantesArray,
      participantesNomes: nomesOrdenados,
      participantesResumo,
      autorUid: currentUser.uid,
      autorNome: nomeResponsavel,
      createdAt: serverTimestamp(),
    });
    fecharModalReuniao();
    showTemporaryStatus(
      reunioesStatusEl,
      'Reunião agendada e participantes notificados.',
    );
  } catch (err) {
    console.error('Erro ao agendar reunião:', err);
    setStatus(
      reuniaoModalStatusEl,
      'Não foi possível agendar a reunião. Tente novamente.',
      true,
    );
  } finally {
    if (reuniaoSalvarBtn) {
      reuniaoSalvarBtn.disabled = false;
      reuniaoSalvarBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
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
      mensagensDados = [];
      if (snap.empty) {
        mensagensVazioEl?.classList.remove('hidden');
        atualizarMuralMensagens();
        atualizarMuralHero();
        return;
      }
      mensagensVazioEl?.classList.add('hidden');
      const frag = document.createDocumentFragment();
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        mensagensDados.push({
          id: docSnap.id,
          texto: (data.texto || '').toString(),
          autor: data.autorNome || data.responsavelNome || '',
          createdAt:
            data.createdAt?.toDate?.() ||
            (data.createdAt instanceof Date ? data.createdAt : null),
        });
        frag.appendChild(renderMensagem(docSnap));
      });
      listaMensagensEl.appendChild(frag);
      atualizarMuralMensagens();
      atualizarMuralHero();
    },
    (err) => {
      console.error('Erro ao carregar mensagens:', err);
      mensagensVazioEl?.classList.remove('hidden');
      mensagensDados = [];
      atualizarMuralMensagens();
      atualizarMuralHero();
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
      problemasDados = [];
      if (snap.empty) {
        problemasVazioEl?.classList.remove('hidden');
        atualizarMuralProblemas();
        return;
      }
      problemasVazioEl?.classList.add('hidden');
      const frag = document.createDocumentFragment();
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        problemasDados.push({
          id: docSnap.id,
          problema: (data.problema || '').toString(),
          setor: (data.setor || '').toString(),
          responsavel: (data.responsavel || '').toString(),
          solucao: (data.solucao || '').toString(),
          dataOcorrencia: data.dataOcorrencia || '',
          createdAt:
            data.createdAt?.toDate?.() ||
            (data.createdAt instanceof Date ? data.createdAt : null),
        });
        frag.appendChild(renderProblema(docSnap));
      });
      listaProblemasEl.appendChild(frag);
      atualizarMuralProblemas();
    },
    (err) => {
      console.error('Erro ao carregar problemas:', err);
      problemasVazioEl?.classList.remove('hidden');
      problemasDados = [];
      atualizarMuralProblemas();
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
      produtosDados = [];
      if (snap.empty) {
        produtosVazioEl?.classList.remove('hidden');
        atualizarMuralProdutos();
        return;
      }
      produtosVazioEl?.classList.add('hidden');
      const itens = [];
      snap.forEach((docSnap) => {
        itens.push(docSnap);
        const data = docSnap.data() || {};
        produtosDados.push({
          id: docSnap.id,
          nome: (data.nome || '').toString(),
          observacoes: (data.observacoes || '').toString(),
          autor: data.autorNome || '',
          createdAt:
            data.createdAt?.toDate?.() ||
            (data.createdAt instanceof Date ? data.createdAt : null),
        });
      });
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
      atualizarMuralProdutos();
    },
    (err) => {
      console.error('Erro ao carregar produtos:', err);
      produtosVazioEl?.classList.remove('hidden');
      produtosDados = [];
      atualizarMuralProdutos();
    },
  );
}

function carregarReunioes() {
  if (!currentUser) return;
  reunioesUnsub?.();
  const reunioesRef = query(
    collection(db, 'painelAtualizacoesGerais'),
    where('categoria', '==', 'reuniao'),
    where('participantes', 'array-contains', currentUser.uid),
    orderBy('createdAt', 'desc'),
    limit(120),
  );
  reunioesUnsub = onSnapshot(
    reunioesRef,
    (snap) => {
      const dados = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const inicio =
          data.inicio instanceof Date
            ? data.inicio
            : typeof data.inicio?.toDate === 'function'
              ? data.inicio.toDate()
              : null;
        const dataIso = data.data || (inicio ? toDateKey(inicio) : '');
        const hora =
          normalizeTimeValue(data.hora) ||
          (inicio ? formatHourFromDate(inicio) : '');
        const participantes = Array.isArray(data.participantes)
          ? data.participantes.filter((uid) => typeof uid === 'string' && uid)
          : [];
        const nomes = Array.isArray(data.participantesNomes)
          ? data.participantesNomes.filter(
              (nome) => typeof nome === 'string' && nome.trim(),
            )
          : [];
        dados.push({
          id: docSnap.id,
          dataIso,
          hora,
          inicio:
            inicio instanceof Date && !Number.isNaN(inicio.valueOf())
              ? inicio
              : null,
          descricao: (data.descricao || '').toString(),
          participantes,
          participantesNomes: nomes,
          participantesResumo: data.participantesResumo || '',
          autorNome: data.autorNome || data.responsavelNome || '',
          autorUid: data.autorUid || '',
          createdAt: data.createdAt?.toDate?.() || null,
        });
      });
      reunioesDados = dados;
      atualizarMapaReunioes();
      atualizarCalendarioReunioes();
      renderizarListaReunioes();
      atualizarMuralReunioes();
      atualizarMuralHero();
    },
    (err) => {
      console.error('Erro ao carregar reuniões:', err);
      reunioesDados = [];
      atualizarMapaReunioes();
      atualizarCalendarioReunioes();
      renderizarListaReunioes();
      atualizarMuralReunioes();
      atualizarMuralHero();
      showTemporaryStatus(
        reunioesStatusEl,
        'Não foi possível carregar o calendário de reuniões.',
        true,
      );
    },
  );
}

const PRODUTOS_LINHA_CAMPOS = [
  'sku',
  'produto',
  'preco',
  'prazo',
  'ultimaAtualizacao',
];

const PRODUTOS_LINHA_LABELS = {
  sku: 'SKU',
  produto: 'Produto',
  preco: 'Preço',
  prazo: 'Prazo',
  ultimaAtualizacao: 'Última atualização',
};

const PRODUTOS_LINHA_PRAZO_OPCOES = {
  sem_prazo: 'Sem prazo',
  com_prazo: 'Com prazo',
};

function atualizarProdutosLinhaStatus(message = '', isError = false) {
  setStatus(produtosLinhaStatusEl, message, isError);
}

function limparMonitoramentoProdutosLinhaImportacoes() {
  produtosLinhaImportacoesUnsub?.();
  produtosLinhaImportacoesUnsub = null;
}

function limparMonitoramentoProdutosLinhaItens() {
  produtosLinhaItensUnsub?.();
  produtosLinhaItensUnsub = null;
  produtosLinhaItensImportacaoPath = null;
}

function limparMonitoramentoProdutosLinhaConfig() {
  produtosLinhaConfigUnsub?.();
  produtosLinhaConfigUnsub = null;
  produtosLinhaConfigUidAtual = null;
}

function limparProdutosLinhaDados() {
  produtosLinhaResponsavelUid = null;
  produtosLinhaImportacaoMeta = null;
  produtosLinhaItens = [];
  produtosLinhaPronto = false;
  produtosLinhaItensImportacaoPath = null;
  atualizarProdutosLinhaMeta();
  renderProdutosLinhaTabela();
}

function normalizarImportacaoMeta(docSnap) {
  if (!docSnap) return null;
  const data = docSnap.data() || {};
  const criadoEm =
    data.criadoEm?.toDate?.() ||
    (data.criadoEm instanceof Date ? data.criadoEm : null);
  const autorUid =
    data.autorUid || data.responsavelUid || produtosLinhaResponsavelUid || '';
  return {
    id: docSnap.id,
    autorUid,
    autorNome: data.autorNome || data.responsavelNome || '',
    dataReferencia: data.dataReferencia || '',
    arquivoNome: data.arquivoNome || '',
    criadoEm,
    totalProdutos: Number(data.totalProdutos) || 0,
    destinatarios: Array.isArray(data.destinatarios)
      ? data.destinatarios.filter((uid) => typeof uid === 'string' && uid)
      : [],
    visivelParaUid: data.visivelParaUid || '',
  };
}

function atualizarProdutosLinhaMeta() {
  if (!produtosLinhaMetaEl) return;
  if (!produtosLinhaImportacaoMeta) {
    produtosLinhaMetaEl.textContent = '';
    return;
  }
  const partes = [];
  const meta = produtosLinhaImportacaoMeta;
  if (meta.dataReferencia) {
    partes.push(`Referência ${meta.dataReferencia}`);
  }
  if (meta.criadoEm) {
    partes.push(`Importado em ${formatDate(meta.criadoEm, true)}`);
  }
  if (produtosLinhaItens.length) {
    const total = produtosLinhaItens.length;
    partes.push(`${total} produto${total === 1 ? '' : 's'}`);
  }
  if (meta.arquivoNome) {
    partes.push(meta.arquivoNome);
  }
  produtosLinhaMetaEl.textContent = partes.join(' • ');
}

function obterTimestampCriadoEm(docSnap) {
  if (!docSnap) return 0;
  try {
    const data = docSnap.data ? docSnap.data() || {} : {};
    const criadoEm =
      data.criadoEm?.toDate?.() ||
      (data.criadoEm instanceof Date ? data.criadoEm : null);
    if (criadoEm instanceof Date) {
      return criadoEm.getTime();
    }
    if (typeof data.criadoEm === 'number') {
      return data.criadoEm;
    }
    if (
      data.criadoEm &&
      typeof data.criadoEm.seconds === 'number' &&
      typeof data.criadoEm.nanoseconds === 'number'
    ) {
      return data.criadoEm.seconds * 1000 + data.criadoEm.nanoseconds / 1e6;
    }
  } catch (err) {
    console.error(
      'Não foi possível determinar a data de criação do produto:',
      err,
    );
  }
  return 0;
}

function selecionarDocMaisRecente(docs = []) {
  return (docs || []).reduce((melhor, atual) => {
    if (!atual) return melhor;
    if (!melhor) return atual;
    const tempoAtual = obterTimestampCriadoEm(atual);
    const tempoMelhor = obterTimestampCriadoEm(melhor);
    if (tempoAtual > tempoMelhor) {
      return atual;
    }
    if (tempoAtual === tempoMelhor) {
      return atual.ref.path < melhor.ref.path ? atual : melhor;
    }
    return melhor;
  }, null);
}

function extrairCamposAtivos(fields) {
  if (!fields || typeof fields !== 'object') {
    return [...PRODUTOS_LINHA_CAMPOS];
  }
  const ativos = PRODUTOS_LINHA_CAMPOS.filter((campo) => {
    if (!Object.prototype.hasOwnProperty.call(fields, campo)) {
      return false;
    }
    return Boolean(fields[campo]);
  });
  return ativos;
}

function obterPermissoesProdutosLinha() {
  const todos = [...PRODUTOS_LINHA_CAMPOS];
  if (
    produtosLinhaPodeGerir &&
    produtosLinhaResponsavelUid === currentUser?.uid
  ) {
    return { allowed: true, campos: todos };
  }
  const uidAtual = currentUser?.uid;
  if (!uidAtual) {
    return { allowed: false, campos: [] };
  }
  if (!produtosLinhaConfigDados) {
    return { allowed: true, campos: todos };
  }
  const allowedUsers =
    produtosLinhaConfigDados.allowedUsers &&
    typeof produtosLinhaConfigDados.allowedUsers === 'object'
      ? produtosLinhaConfigDados.allowedUsers
      : {};
  if (Object.prototype.hasOwnProperty.call(allowedUsers, uidAtual)) {
    const entry = allowedUsers[uidAtual] || {};
    const allowed = entry.allowed !== false;
    const campos = extrairCamposAtivos(entry.fields);
    return { allowed, campos };
  }
  const camposPadrao = extrairCamposAtivos(
    produtosLinhaConfigDados.defaultFields,
  );
  if (!camposPadrao.length) {
    return { allowed: true, campos: todos };
  }
  return { allowed: true, campos: camposPadrao };
}

function obterChaveProdutoLinha(item = {}) {
  if (item.id) return String(item.id);
  if (item.sku) {
    return `sku:${String(item.sku).trim().toUpperCase()}`;
  }
  if (item.produto) {
    return `produto:${String(item.produto).trim().toUpperCase()}`;
  }
  if (typeof item.ordem === 'number') {
    return `ordem:${item.ordem}`;
  }
  return '';
}

function obterPrazoStatus(itemId) {
  if (!itemId) return 'sem_prazo';
  if (!produtosLinhaConfigDados) return 'sem_prazo';
  const mapa =
    produtosLinhaConfigDados.prazoStatus &&
    typeof produtosLinhaConfigDados.prazoStatus === 'object'
      ? produtosLinhaConfigDados.prazoStatus
      : {};
  const valor = mapa[itemId];
  if (
    valor &&
    Object.prototype.hasOwnProperty.call(PRODUTOS_LINHA_PRAZO_OPCOES, valor)
  ) {
    return valor;
  }
  return 'sem_prazo';
}

function renderProdutosLinhaTabela() {
  if (!produtosLinhaTabelaCabecalhoEl || !produtosLinhaTabelaCorpoEl) {
    return;
  }

  const permissoes = obterPermissoesProdutosLinha();
  const camposAtivos =
    Array.isArray(permissoes.campos) && permissoes.campos.length
      ? permissoes.campos
      : [];
  const podeExibirTabela = permissoes.allowed && camposAtivos.length > 0;

  if (produtosLinhaTabelaContainerEl) {
    produtosLinhaTabelaContainerEl.classList.toggle(
      'hidden',
      !podeExibirTabela,
    );
  }

  if (!permissoes.allowed) {
    produtosLinhaAcessoNegadoEl?.classList.remove('hidden');
  } else {
    produtosLinhaAcessoNegadoEl?.classList.add('hidden');
  }

  if (permissoes.allowed && !camposAtivos.length) {
    produtosLinhaSemInformacaoEl?.classList.remove('hidden');
  } else {
    produtosLinhaSemInformacaoEl?.classList.add('hidden');
  }

  if (!podeExibirTabela) {
    produtosLinhaTabelaCabecalhoEl.innerHTML = '';
    produtosLinhaTabelaCorpoEl.innerHTML = '';
    if (permissoes.allowed) {
      produtosLinhaVazioEl?.classList.add('hidden');
    }
    return;
  }

  const thead = produtosLinhaTabelaCabecalhoEl;
  thead.innerHTML = '';
  const headerRow = document.createElement('tr');
  camposAtivos.forEach((campo) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.className =
      'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500';
    th.textContent = PRODUTOS_LINHA_LABELS[campo] || campo;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = produtosLinhaTabelaCorpoEl;
  tbody.innerHTML = '';
  const itensOrdenados = [...produtosLinhaItens].sort((a, b) => {
    const nomeA = (a.produto || '').toLowerCase();
    const nomeB = (b.produto || '').toLowerCase();
    if (nomeA && nomeB && nomeA !== nomeB) {
      return nomeA.localeCompare(nomeB, 'pt-BR');
    }
    const skuA = (a.sku || '').toLowerCase();
    const skuB = (b.sku || '').toLowerCase();
    if (skuA && skuB && skuA !== skuB) {
      return skuA.localeCompare(skuB, 'pt-BR');
    }
    if (typeof a.ordem === 'number' && typeof b.ordem === 'number') {
      return a.ordem - b.ordem;
    }
    return 0;
  });

  if (!itensOrdenados.length) {
    if (produtosLinhaPronto) {
      produtosLinhaVazioEl?.classList.remove('hidden');
    } else {
      produtosLinhaVazioEl?.classList.add('hidden');
    }
    return;
  }

  produtosLinhaVazioEl?.classList.add('hidden');
  const podeEditarPrazo =
    produtosLinhaPodeGerir && produtosLinhaResponsavelUid === currentUser?.uid;
  const frag = document.createDocumentFragment();
  itensOrdenados.forEach((item) => {
    const tr = document.createElement('tr');
    tr.className = 'transition hover:bg-emerald-50/60';
    camposAtivos.forEach((campo) => {
      const td = document.createElement('td');
      td.className = 'px-4 py-3 text-sm text-gray-700 align-top';
      preencherCelulaProdutoLinha(td, item, campo, podeEditarPrazo);
      tr.appendChild(td);
    });
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
}

function preencherCelulaProdutoLinha(td, item, campo, podeEditarPrazo) {
  switch (campo) {
    case 'sku': {
      const texto = item.sku ? String(item.sku) : '-';
      td.textContent = texto;
      if (!item.sku) td.classList.add('text-gray-400');
      break;
    }
    case 'produto': {
      const texto = item.produto ? String(item.produto) : '-';
      td.textContent = texto;
      if (!item.produto) td.classList.add('text-gray-400');
      break;
    }
    case 'preco': {
      const valor = item.preco ?? item.sobra ?? null;
      const texto = formatCurrency(valor);
      td.textContent = texto || '-';
      if (!texto) td.classList.add('text-gray-400');
      break;
    }
    case 'prazo': {
      const itemId = obterChaveProdutoLinha(item);
      const status = obterPrazoStatus(itemId);
      if (podeEditarPrazo && itemId) {
        const select = document.createElement('select');
        select.className =
          'produtos-linha-prazo-select w-full rounded-lg border border-emerald-200 bg-white px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-300';
        select.dataset.itemId = itemId;
        Object.entries(PRODUTOS_LINHA_PRAZO_OPCOES).forEach(
          ([valor, label]) => {
            const option = document.createElement('option');
            option.value = valor;
            option.textContent = label;
            select.appendChild(option);
          },
        );
        select.value = status;
        td.appendChild(select);
      } else {
        td.textContent =
          PRODUTOS_LINHA_PRAZO_OPCOES[status] ||
          PRODUTOS_LINHA_PRAZO_OPCOES.sem_prazo;
      }
      break;
    }
    case 'ultimaAtualizacao': {
      const atualizadoEm =
        item.atualizadoEm instanceof Date ? item.atualizadoEm : null;
      let texto = atualizadoEm ? formatDate(atualizadoEm, true) : '';
      if (!texto && item.dataReferencia) {
        texto = `Referência ${item.dataReferencia}`;
      }
      td.textContent = texto || '-';
      if (!texto) td.classList.add('text-gray-400');
      break;
    }
    default: {
      const valor = item && campo in item ? item[campo] : '';
      const texto = valor === null || valor === undefined ? '' : String(valor);
      td.textContent = texto || '-';
      if (!texto) td.classList.add('text-gray-400');
    }
  }
}

function renderProdutosLinhaConfig() {
  if (!produtosLinhaConfigSecaoEl) return;
  const podeGerenciar =
    produtosLinhaPodeGerir && produtosLinhaResponsavelUid === currentUser?.uid;
  if (!podeGerenciar) {
    produtosLinhaConfigSecaoEl.classList.add('hidden');
    setStatus(produtosLinhaConfigStatusEl, '');
    return;
  }

  produtosLinhaConfigSecaoEl.classList.remove('hidden');
  if (!produtosLinhaUsuariosListaEl) return;

  const usuarios = Array.from(produtosLinhaUsuariosMap.values()).sort((a, b) =>
    (a.nome || '').localeCompare(b.nome || '', 'pt-BR'),
  );

  produtosLinhaUsuariosListaEl.innerHTML = '';

  if (!usuarios.length) {
    produtosLinhaConfigVazioEl?.classList.remove('hidden');
    return;
  }

  produtosLinhaConfigVazioEl?.classList.add('hidden');
  const allowedUsers =
    produtosLinhaConfigDados?.allowedUsers &&
    typeof produtosLinhaConfigDados.allowedUsers === 'object'
      ? produtosLinhaConfigDados.allowedUsers
      : {};

  const frag = document.createDocumentFragment();
  usuarios.forEach((info) => {
    const entry = allowedUsers[info.uid] || null;
    frag.appendChild(criarItemConfigUsuario(info, entry));
  });
  produtosLinhaUsuariosListaEl.appendChild(frag);
}

function criarItemConfigUsuario(info = {}, entry = null) {
  const wrapper = document.createElement('div');
  wrapper.className =
    'space-y-3 rounded-2xl border border-white bg-white p-4 shadow-sm';
  wrapper.dataset.uid = info.uid || '';

  const header = document.createElement('div');
  header.className =
    'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between';

  const label = document.createElement('label');
  label.className = 'flex items-center gap-3 text-sm font-medium text-gray-800';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className =
    'produtos-linha-user-enable h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500';
  const habilitado = entry ? entry.allowed !== false : true;
  checkbox.checked = habilitado;
  label.appendChild(checkbox);

  const nomeEl = document.createElement('span');
  const nomePadrao = info.nome || info.email || '';
  nomeEl.textContent =
    nomePadrao || `Usuário ${String(info.uid || '').slice(0, 6)}`;
  label.appendChild(nomeEl);

  header.appendChild(label);

  if (info.email) {
    const emailEl = document.createElement('span');
    emailEl.className = 'text-xs text-gray-500 break-all';
    emailEl.textContent = info.email;
    header.appendChild(emailEl);
  }

  wrapper.appendChild(header);

  const camposContainer = document.createElement('div');
  camposContainer.className = 'mt-2 flex flex-wrap gap-3';

  const camposConfig =
    entry && entry.fields && typeof entry.fields === 'object'
      ? entry.fields
      : null;

  PRODUTOS_LINHA_CAMPOS.forEach((campo) => {
    const option = document.createElement('label');
    option.className =
      'flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className =
      'produtos-linha-user-field h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500';
    input.dataset.field = campo;
    let marcado = true;
    if (camposConfig && Object.keys(camposConfig).length) {
      if (Object.prototype.hasOwnProperty.call(camposConfig, campo)) {
        marcado = Boolean(camposConfig[campo]);
      }
    }
    input.checked = marcado;
    input.disabled = !habilitado;
    option.appendChild(input);
    const span = document.createElement('span');
    span.textContent = PRODUTOS_LINHA_LABELS[campo] || campo;
    option.appendChild(span);
    camposContainer.appendChild(option);
  });

  wrapper.appendChild(camposContainer);

  checkbox.addEventListener('change', (event) => {
    atualizarDisponibilidadeCampos(wrapper, event.target.checked);
  });

  return wrapper;
}

function atualizarDisponibilidadeCampos(container, habilitado) {
  if (!container) return;
  const campos = container.querySelectorAll('.produtos-linha-user-field');
  campos.forEach((checkbox) => {
    checkbox.disabled = !habilitado;
  });
}

function extrairCamposSelecionados(container) {
  const campos = {};
  if (!container) return campos;
  container.querySelectorAll('.produtos-linha-user-field').forEach((input) => {
    const campo = input.dataset.field;
    if (!campo) return;
    campos[campo] = input.checked;
  });
  return campos;
}

async function salvarConfiguracoesProdutosLinha(event) {
  event.preventDefault();
  if (
    !produtosLinhaPodeGerir ||
    produtosLinhaResponsavelUid !== currentUser?.uid ||
    !produtosLinhaUsuariosListaEl
  ) {
    return;
  }

  const botao = produtosLinhaConfigFormEl?.querySelector(
    'button[type="submit"]',
  );
  if (botao) {
    botao.disabled = true;
    botao.classList.add('opacity-60', 'cursor-not-allowed');
  }
  setStatus(produtosLinhaConfigStatusEl, 'Salvando configurações...');

  try {
    const containers =
      produtosLinhaUsuariosListaEl.querySelectorAll('[data-uid]');
    const allowedUsers = {};
    containers.forEach((container) => {
      const uid = container.dataset.uid;
      if (!uid) return;
      const habilitado = !!container.querySelector(
        '.produtos-linha-user-enable',
      )?.checked;
      const campos = extrairCamposSelecionados(container);
      allowedUsers[uid] = { allowed: habilitado, fields: campos };
    });

    const defaultFields =
      produtosLinhaConfigDados?.defaultFields &&
      typeof produtosLinhaConfigDados.defaultFields === 'object'
        ? produtosLinhaConfigDados.defaultFields
        : PRODUTOS_LINHA_CAMPOS.reduce((acc, campo) => {
            acc[campo] = true;
            return acc;
          }, {});

    await setDoc(
      doc(db, 'produtosEmLinhaConfigs', produtosLinhaResponsavelUid),
      {
        responsavelUid: produtosLinhaResponsavelUid,
        responsavelEmail: currentUser?.email || '',
        responsavelNome: currentUser?.displayName || '',
        allowedUsers,
        defaultFields,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || '',
      },
      { merge: true },
    );

    showTemporaryStatus(
      produtosLinhaConfigStatusEl,
      'Configurações atualizadas com sucesso.',
    );
  } catch (err) {
    console.error('Erro ao salvar configurações de produtos em linha:', err);
    showTemporaryStatus(
      produtosLinhaConfigStatusEl,
      'Não foi possível salvar as configurações.',
      true,
    );
  } finally {
    if (botao) {
      botao.disabled = false;
      botao.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  }
}

async function atualizarPrazoProdutoLinha(itemId, valor) {
  if (
    !produtosLinhaPodeGerir ||
    produtosLinhaResponsavelUid !== currentUser?.uid ||
    !itemId
  ) {
    return;
  }

  const status = Object.prototype.hasOwnProperty.call(
    PRODUTOS_LINHA_PRAZO_OPCOES,
    valor,
  )
    ? valor
    : 'sem_prazo';

  try {
    const docRef = doc(
      db,
      'produtosEmLinhaConfigs',
      produtosLinhaResponsavelUid,
    );
    const payload = {
      responsavelUid: produtosLinhaResponsavelUid,
      responsavelEmail: currentUser?.email || '',
      responsavelNome: currentUser?.displayName || '',
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.uid || '',
    };
    payload[`prazoStatus.${itemId}`] = status;
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.error('Erro ao atualizar prazo do produto em linha:', err);
    showTemporaryStatus(
      produtosLinhaStatusEl,
      'Não foi possível atualizar o status de prazo.',
      true,
    );
  }
}

async function garantirUsuariosProdutosLinha(uids = []) {
  const validos = Array.from(
    new Set((uids || []).filter((uid) => typeof uid === 'string' && uid)),
  );
  if (!validos.length) return;

  const faltantes = validos.filter((uid) => !produtosLinhaUsuariosMap.has(uid));
  if (!faltantes.length) return;

  faltantes.forEach((uid) => {
    produtosLinhaUsuariosMap.set(uid, {
      uid,
      nome: `Usuário ${uid.slice(0, 6)}`,
      email: '',
    });
  });
  renderProdutosLinhaConfig();

  try {
    const detalhes = await buscarDetalhesUsuariosBasico(faltantes);
    detalhes.forEach((info) => {
      produtosLinhaUsuariosMap.set(info.uid, {
        uid: info.uid,
        nome: info.nome || info.email || `Usuário ${info.uid.slice(0, 6)}`,
        email: info.email || '',
      });
    });
    renderProdutosLinhaConfig();
  } catch (err) {
    console.error(
      'Erro ao carregar usuários relacionados aos produtos em linha:',
      err,
    );
  }
}

async function buscarDetalhesUsuariosBasico(uids = []) {
  const validos = Array.from(
    new Set((uids || []).filter((uid) => typeof uid === 'string' && uid)),
  );
  if (!validos.length) return [];

  const resultados = new Map();

  const buscar = async (colecao, ids) => {
    for (let i = 0; i < ids.length; i += 10) {
      const lote = ids.slice(i, i + 10);
      if (!lote.length) continue;
      try {
        const snap = await getDocs(
          query(collection(db, colecao), where(documentId(), 'in', lote)),
        );
        snap.forEach((docSnap) => {
          resultados.set(
            docSnap.id,
            montarDetalhesParticipante(docSnap.id, docSnap.data() || {}),
          );
        });
      } catch (err) {
        console.error(`Erro ao buscar usuários (${colecao}):`, err);
      }
    }
  };

  await buscar('usuarios', validos);
  const faltantes = validos.filter((uid) => !resultados.has(uid));
  if (faltantes.length) {
    await buscar('uid', faltantes);
  }

  return validos.map((uid) => {
    if (resultados.has(uid)) {
      const info = resultados.get(uid);
      return {
        uid: info.uid,
        nome: info.nome,
        email: info.email,
      };
    }
    const detalhes = montarDetalhesParticipante(uid, {});
    return {
      uid: detalhes.uid,
      nome: detalhes.nome,
      email: detalhes.email,
    };
  });
}

async function inicializarProdutosLinha(usuarios = []) {
  produtosLinhaUsuariosMap = new Map();
  usuariosFinanceirosLista = Array.isArray(usuarios) ? usuarios : [];
  usuariosFinanceirosLista.forEach((info) => {
    if (!info?.uid) return;
    const nome = info.nome || info.email || '';
    produtosLinhaUsuariosMap.set(info.uid, {
      uid: info.uid,
      nome: nome || `Usuário ${info.uid.slice(0, 6)}`,
      email: info.email || '',
    });
  });

  if (currentUser?.uid && !produtosLinhaUsuariosMap.has(currentUser.uid)) {
    produtosLinhaUsuariosMap.set(currentUser.uid, {
      uid: currentUser.uid,
      nome: currentUser.displayName || currentUser.email || 'Você',
      email: currentUser.email || '',
    });
  }

  renderProdutosLinhaConfig();
  produtosLinhaItens = [];
  produtosLinhaImportacaoMeta = null;
  produtosLinhaPronto = false;
  atualizarProdutosLinhaMeta();
  renderProdutosLinhaTabela();

  if (produtosLinhaPodeGerir) {
    produtosLinhaResponsavelUid = currentUser?.uid || null;
    await garantirUsuariosProdutosLinha([produtosLinhaResponsavelUid]);
    monitorarConfigProdutosLinha(produtosLinhaResponsavelUid);
    monitorarProdutosLinhaResponsavel();
  } else {
    monitorarConfigProdutosLinha(null);
    monitorarProdutosLinhaUsuario();
  }
}

async function monitorarConfigProdutosLinha(responsavelUid) {
  if (!responsavelUid) {
    produtosLinhaConfigDados = null;
    limparMonitoramentoProdutosLinhaConfig();
    renderProdutosLinhaConfig();
    renderProdutosLinhaTabela();
    return;
  }

  if (
    produtosLinhaConfigUidAtual === responsavelUid &&
    produtosLinhaConfigUnsub
  ) {
    return;
  }

  limparMonitoramentoProdutosLinhaConfig();
  produtosLinhaConfigUidAtual = responsavelUid;
  const configRef = doc(db, 'produtosEmLinhaConfigs', responsavelUid);
  produtosLinhaConfigUnsub = onSnapshot(
    configRef,
    async (docSnap) => {
      produtosLinhaConfigDados = docSnap.exists() ? docSnap.data() || {} : null;
      const chaves =
        produtosLinhaConfigDados?.allowedUsers &&
        typeof produtosLinhaConfigDados.allowedUsers === 'object'
          ? Object.keys(produtosLinhaConfigDados.allowedUsers)
          : [];
      await garantirUsuariosProdutosLinha([
        responsavelUid,
        ...(produtosLinhaImportacaoMeta?.destinatarios || []),
        ...chaves,
      ]);
      renderProdutosLinhaConfig();
      renderProdutosLinhaTabela();
    },
    (err) => {
      console.error(
        'Erro ao monitorar configurações de produtos em linha:',
        err,
      );
      produtosLinhaConfigDados = null;
      renderProdutosLinhaConfig();
      renderProdutosLinhaTabela();
    },
  );
}

function monitorarProdutosLinhaResponsavel() {
  if (!currentUser) return;
  limparMonitoramentoProdutosLinhaImportacoes();
  atualizarProdutosLinhaStatus('Carregando produtos importados...');
  produtosLinhaPronto = false;

  const importacoesRef = query(
    collection(db, 'produtosPrecos'),
    where('autorUid', '==', currentUser.uid),
    orderBy('criadoEm', 'desc'),
    limit(1),
  );

  produtosLinhaImportacoesUnsub = onSnapshot(
    importacoesRef,
    (snap) => {
      if (snap.empty) {
        produtosLinhaPronto = true;
        produtosLinhaImportacaoMeta = null;
        produtosLinhaItens = [];
        atualizarProdutosLinhaStatus(
          'Nenhuma importação encontrada para exibir.',
        );
        atualizarProdutosLinhaMeta();
        renderProdutosLinhaTabela();
        limparMonitoramentoProdutosLinhaItens();
        return;
      }

      produtosLinhaPronto = true;
      atualizarProdutosLinhaStatus('', false);
      const docSnap = snap.docs[0];
      processarImportacaoProdutosLinha(docSnap);
    },
    async (err) => {
      console.error(
        'Erro ao monitorar importações do responsável financeiro:',
        err,
      );
      if (err.code === 'failed-precondition') {
        await carregarImportacaoResponsavelFallback(currentUser.uid);
      } else {
        atualizarProdutosLinhaStatus(
          'Não foi possível carregar as importações de produtos.',
          true,
        );
        limparProdutosLinhaDados();
      }
    },
  );
}

function monitorarProdutosLinhaUsuario() {
  if (!currentUser) return;
  limparMonitoramentoProdutosLinhaImportacoes();
  atualizarProdutosLinhaStatus('Carregando produtos importados...');
  produtosLinhaPronto = false;

  const unsubscribers = [];
  const fontesEstado = new Map();

  const prepararFonte = (chave) => {
    if (!fontesEstado.has(chave)) {
      fontesEstado.set(chave, { pronto: false, doc: null, erro: false });
    }
  };

  const atualizarFonte = (chave, docSnap, erro = false) => {
    prepararFonte(chave);
    fontesEstado.set(chave, {
      pronto: true,
      doc: docSnap || null,
      erro: Boolean(erro),
    });
    atualizarSelecao();
  };

  const atualizarSelecao = () => {
    const estados = Array.from(fontesEstado.values());
    const todasFontesProcessadas =
      estados.length > 0 && estados.every((info) => info.pronto);
    const existeErro = estados.some((info) => info.erro);
    const docsDisponiveis = estados
      .map((info) => info.doc)
      .filter((doc) => doc);

    if (!docsDisponiveis.length) {
      if (todasFontesProcessadas) {
        produtosLinhaPronto = true;
        if (!existeErro) {
          atualizarProdutosLinhaStatus(
            'Nenhum produto importado foi encontrado.',
          );
        }
        monitorarConfigProdutosLinha(null);
        limparProdutosLinhaDados();
        limparMonitoramentoProdutosLinhaItens();
      } else {
        atualizarProdutosLinhaStatus('Carregando produtos importados...');
      }
      return;
    }

    const docSelecionado = selecionarDocMaisRecente(docsDisponiveis);
    if (!docSelecionado) return;

    produtosLinhaPronto = true;
    atualizarProdutosLinhaStatus('', false);
    processarImportacaoProdutosLinha(docSelecionado);
  };

  const registrarErroFonte = (chave, mensagem, err) => {
    if (err) {
      console.error(mensagem, err);
    }
    atualizarFonte(chave, null, true);
  };

  const criarMonitor = (chave, ref, selecionarDocFn, aoErro) => {
    prepararFonte(chave);
    try {
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (snap.empty) {
            atualizarFonte(chave, null);
            return;
          }
          const docSelecionado = selecionarDocFn
            ? selecionarDocFn(snap)
            : snap.docs[0];
          atualizarFonte(chave, docSelecionado || null);
        },
        async (err) => {
          if (aoErro) {
            await aoErro(err, (docSnap, erro) =>
              atualizarFonte(chave, docSnap, erro),
            );
          } else {
            registrarErroFonte(
              chave,
              'Erro ao monitorar importações de produtos em linha:',
              err,
            );
          }
        },
      );
      unsubscribers.push(unsub);
    } catch (err) {
      registrarErroFonte(
        chave,
        'Erro ao iniciar monitoramento de produtos em linha:',
        err,
      );
    }
  };

  criarMonitor(
    'usuario',
    query(
      collection(db, 'uid', currentUser.uid, 'produtosPrecos'),
      orderBy('criadoEm', 'desc'),
      limit(1),
    ),
    (snap) => snap.docs[0],
    async (err, atualizarFonteInterna) => {
      console.error('Erro ao monitorar importações do usuário:', err);
      if (err.code === 'failed-precondition') {
        const docSnap = await carregarImportacaoUsuarioFallback(
          currentUser.uid,
        );
        if (docSnap) {
          atualizarFonteInterna(docSnap);
          return;
        }
        atualizarFonteInterna(null);
        return;
      }
      atualizarProdutosLinhaStatus(
        'Não foi possível carregar os produtos importados.',
        true,
      );
      limparProdutosLinhaDados();
      monitorarConfigProdutosLinha(null);
      atualizarFonteInterna(null, true);
    },
  );

  criarMonitor(
    'destinatarios',
    query(
      collection(db, 'produtosPrecos'),
      where('destinatarios', 'array-contains', currentUser.uid),
      limit(20),
    ),
    (snap) => selecionarDocMaisRecente(snap.docs),
    async (err) => {
      registrarErroFonte(
        'destinatarios',
        'Erro ao monitorar importações compartilhadas por destinatários:',
        err,
      );
    },
  );

  criarMonitor(
    'visivel',
    query(
      collection(db, 'produtosPrecos'),
      where('visivelParaUid', '==', currentUser.uid),
      limit(20),
    ),
    (snap) => selecionarDocMaisRecente(snap.docs),
    async (err) => {
      registrarErroFonte(
        'visivel',
        'Erro ao monitorar importações compartilhadas diretamente:',
        err,
      );
    },
  );

  produtosLinhaImportacoesUnsub = () => {
    unsubscribers.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error(
          'Erro ao encerrar monitoramento de importações de produtos:',
          err,
        );
      }
    });
  };
}

async function carregarImportacaoResponsavelFallback(uid) {
  if (!uid) return;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'produtosPrecos'),
        orderBy('criadoEm', 'desc'),
        limit(20),
      ),
    );
    const docSnap = snap.docs.find((doc) => {
      const data = doc.data() || {};
      return (data.autorUid || data.responsavelUid) === uid;
    });

    if (!docSnap) {
      produtosLinhaPronto = true;
      produtosLinhaImportacaoMeta = null;
      produtosLinhaItens = [];
      atualizarProdutosLinhaStatus(
        'Nenhuma importação encontrada para exibir.',
      );
      atualizarProdutosLinhaMeta();
      renderProdutosLinhaTabela();
      limparMonitoramentoProdutosLinhaItens();
      return;
    }

    produtosLinhaPronto = true;
    atualizarProdutosLinhaStatus('', false);
    processarImportacaoProdutosLinha(docSnap);
  } catch (err) {
    console.error(
      'Erro ao carregar importações do responsável (fallback):',
      err,
    );
    atualizarProdutosLinhaStatus(
      'Não foi possível carregar as importações de produtos.',
      true,
    );
    limparProdutosLinhaDados();
  }
}

async function carregarImportacaoUsuarioFallback(uid) {
  if (!uid) return null;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'uid', uid, 'produtosPrecos'),
        orderBy('criadoEm', 'desc'),
        limit(1),
      ),
    );
    if (snap.empty) {
      return null;
    }
    return snap.docs[0];
  } catch (err) {
    console.error('Erro ao carregar importações do usuário (fallback):', err);
    return null;
  }
}

function processarImportacaoProdutosLinha(docSnap) {
  if (!docSnap) return;
  produtosLinhaImportacaoMeta = normalizarImportacaoMeta(docSnap);
  if (produtosLinhaImportacaoMeta?.autorUid) {
    produtosLinhaResponsavelUid = produtosLinhaImportacaoMeta.autorUid;
    monitorarConfigProdutosLinha(produtosLinhaResponsavelUid);
  }

  const destinatarios = Array.isArray(
    produtosLinhaImportacaoMeta?.destinatarios,
  )
    ? produtosLinhaImportacaoMeta.destinatarios
    : [];

  garantirUsuariosProdutosLinha([
    produtosLinhaResponsavelUid,
    ...(destinatarios || []),
    produtosLinhaImportacaoMeta?.visivelParaUid,
  ]);

  atualizarProdutosLinhaMeta();
  monitorarProdutosLinhaItens(docSnap.ref);
}

function monitorarProdutosLinhaItens(importacaoRef) {
  const novoPath = importacaoRef?.path || null;
  if (
    produtosLinhaItensImportacaoPath &&
    produtosLinhaItensImportacaoPath === novoPath &&
    produtosLinhaItensUnsub
  ) {
    return;
  }

  limparMonitoramentoProdutosLinhaItens();
  if (!importacaoRef) {
    produtosLinhaItens = [];
    renderProdutosLinhaTabela();
    return;
  }

  produtosLinhaItensImportacaoPath = novoPath;
  const itensRef = query(
    collection(importacaoRef, 'itens'),
    orderBy('ordem', 'asc'),
  );

  produtosLinhaItensUnsub = onSnapshot(
    itensRef,
    (snap) => {
      produtosLinhaItens = snap.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        const atualizadoEm =
          data.atualizadoEm?.toDate?.() ||
          (data.atualizadoEm instanceof Date ? data.atualizadoEm : null);
        return {
          id: docSnap.id,
          sku: data.sku || '',
          produto: data.produto || data.nome || '',
          preco:
            data.preco ?? data.precoTabela ?? data.sobra ?? data.valor ?? null,
          sobra: data.sobra ?? null,
          atualizadoEm,
          ordem: data.ordem ?? null,
          dataReferencia:
            data.dataReferencia ||
            produtosLinhaImportacaoMeta?.dataReferencia ||
            '',
        };
      });

      if (
        !produtosLinhaItens.length &&
        produtosLinhaImportacaoMeta?.totalProdutos
      ) {
        atualizarProdutosLinhaStatus(
          'Aguardando processamento dos itens importados...',
          false,
        );
      } else {
        atualizarProdutosLinhaStatus('', false);
      }

      atualizarProdutosLinhaMeta();
      renderProdutosLinhaTabela();
    },
    (err) => {
      console.error('Erro ao carregar itens importados:', err);
      produtosLinhaItens = [];
      atualizarProdutosLinhaStatus(
        'Não foi possível carregar os itens importados.',
        true,
      );
      atualizarProdutosLinhaMeta();
      renderProdutosLinhaTabela();
    },
  );
}

function enviarMensagem(event) {
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
  abrirModalDestinatariosMensagem(texto);
}

async function confirmarEnvioMensagem(event) {
  event.preventDefault();
  if (!currentUser) return;

  const textoAtual = mensagemEmPreparacao || mensagemInput?.value.trim();
  if (!textoAtual) {
    fecharModalDestinatariosMensagem();
    showTemporaryStatus(
      mensagemStatusEl,
      'Digite uma mensagem antes de enviar.',
      true,
    );
    return;
  }

  const baseDestinatarios = destinatariosMensagemSelecionados.size
    ? Array.from(destinatariosMensagemSelecionados)
    : participantesCompartilhamento;
  const destino = new Set(
    (baseDestinatarios || []).filter((uid) => typeof uid === 'string' && uid),
  );
  if (currentUser?.uid) {
    destino.add(currentUser.uid);
  }

  if (!destino.size) {
    setStatus(
      modalDestinatariosStatusEl,
      'Nenhum destinatário disponível para envio.',
      true,
    );
    return;
  }

  try {
    if (modalDestinatariosConfirmarBtn) {
      modalDestinatariosConfirmarBtn.disabled = true;
      modalDestinatariosConfirmarBtn.classList.add(
        'opacity-60',
        'cursor-not-allowed',
      );
    }
    await addDoc(collection(db, 'painelAtualizacoesGerais'), {
      categoria: 'mensagem',
      texto: textoAtual,
      autorUid: currentUser.uid,
      autorNome: nomeResponsavel,
      responsavelUid: currentUser.uid,
      responsavelNome: nomeResponsavel,
      participantes: Array.from(destino),
      createdAt: serverTimestamp(),
    });
    mensagemInput.value = '';
    destinatariosMensagemSelecionados.clear();
    mensagemEmPreparacao = '';
    fecharModalDestinatariosMensagem();
    showTemporaryStatus(
      mensagemStatusEl,
      'Mensagem compartilhada com a equipe.',
    );
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    setStatus(
      modalDestinatariosStatusEl,
      'Não foi possível enviar a mensagem. Tente novamente.',
      true,
    );
  } finally {
    if (modalDestinatariosConfirmarBtn) {
      modalDestinatariosConfirmarBtn.disabled = false;
      modalDestinatariosConfirmarBtn.classList.remove(
        'opacity-60',
        'cursor-not-allowed',
      );
    }
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
formDestinatariosMensagem?.addEventListener('submit', confirmarEnvioMensagem);
formProblema?.addEventListener('submit', registrarProblema);
formProduto?.addEventListener('submit', registrarProduto);
limparParticipantesBtn?.addEventListener('click', limparSelecaoDestinatarios);
formReuniao?.addEventListener('submit', salvarReuniao);
modalReuniaoFecharBtn?.addEventListener('click', fecharModalReuniao);
reuniaoCancelarBtn?.addEventListener('click', fecharModalReuniao);
modalReuniaoEl?.addEventListener('click', (event) => {
  if (event.target === modalReuniaoEl) {
    fecharModalReuniao();
  }
});
modalDestinatariosFecharBtn?.addEventListener(
  'click',
  fecharModalDestinatariosMensagem,
);
modalDestinatariosCancelarBtn?.addEventListener(
  'click',
  fecharModalDestinatariosMensagem,
);
modalDestinatariosEl?.addEventListener('click', (event) => {
  if (event.target === modalDestinatariosEl) {
    fecharModalDestinatariosMensagem();
  }
});
produtosLinhaConfigFormEl?.addEventListener(
  'submit',
  salvarConfiguracoesProdutosLinha,
);
produtosLinhaTabelaContainerEl?.addEventListener('change', (event) => {
  const select = event.target.closest('.produtos-linha-prazo-select');
  if (!select) return;
  atualizarPrazoProdutoLinha(select.dataset.itemId, select.value);
});
destinatariosSelecionarTodosBtn?.addEventListener(
  'click',
  selecionarTodosDestinatariosModal,
);
destinatariosLimparSelecaoBtn?.addEventListener(
  'click',
  limparSelecaoDestinatariosModal,
);
tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    ativarAba(button.dataset.tabTarget);
  });
});
if (tabButtons.length) {
  const inicial =
    Array.from(tabButtons).find(
      (btn) => btn.getAttribute('aria-selected') === 'true',
    )?.dataset.tabTarget || tabButtons[0].dataset.tabTarget;
  ativarAba(inicial);
}
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  let fechado = false;
  if (
    modalDestinatariosEl &&
    !modalDestinatariosEl.classList.contains('hidden')
  ) {
    fecharModalDestinatariosMensagem();
    fechado = true;
  }
  if (
    !fechado &&
    modalReuniaoEl &&
    !modalReuniaoEl.classList.contains('hidden')
  ) {
    fecharModalReuniao();
  }
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
    const baseParticipantes = participantes.length ? participantes : [user.uid];
    participantesCompartilhamento = Array.from(new Set(baseParticipantes));
    await carregarDetalhesParticipantes(participantesCompartilhamento);
    atualizarEscopoMensagem();
    setStatus(painelStatusEl, '');

    let usuariosFinanceiros = [];
    try {
      const {
        usuarios = [],
        isGestor,
        isResponsavelFinanceiro,
      } = await carregarUsuariosFinanceiros(db, user);
      usuariosFinanceiros = Array.isArray(usuarios) ? usuarios : [];
      isGestorAtual = Boolean(isGestor);
      isResponsavelFinanceiroAtual = Boolean(isResponsavelFinanceiro);
      produtosLinhaPodeGerir = isGestorAtual || isResponsavelFinanceiroAtual;
      if (produtosLinhaPodeGerir) {
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
      isGestorAtual = false;
      isResponsavelFinanceiroAtual = false;
      produtosLinhaPodeGerir = false;
      usuariosFinanceiros = [];
    }

    await inicializarProdutosLinha(usuariosFinanceiros);
    carregarMensagens();
    carregarProblemas();
    carregarReunioes();
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
    produtosLinhaPodeGerir = false;
    isGestorAtual = false;
    isResponsavelFinanceiroAtual = false;
    await inicializarProdutosLinha([]);
    carregarReunioes();
  }
});
