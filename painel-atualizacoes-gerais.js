import {
  initializeApp,
  getApps,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { loadUserProfile } from './login.js';
import { fetchResponsavelFinanceiroUsuarios } from './responsavel-financeiro.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const mensagemForm = document.getElementById('mensagemForm');
const mensagemTexto = document.getElementById('mensagemTexto');
const mensagemStatus = document.getElementById('mensagemStatus');
const mensagensLista = document.getElementById('mensagensLista');
const mensagensTotal = document.getElementById('mensagensTotal');

const problemaForm = document.getElementById('problemaForm');
const problemaDescricao = document.getElementById('problemaDescricao');
const problemaSetor = document.getElementById('problemaSetor');
const problemaResponsavel = document.getElementById('problemaResponsavel');
const problemaData = document.getElementById('problemaData');
const problemaSolucao = document.getElementById('problemaSolucao');
const problemaStatus = document.getElementById('problemaStatus');
const problemasLista = document.getElementById('problemasLista');

const produtoForm = document.getElementById('produtoForm');
const produtoNome = document.getElementById('produtoNome');
const produtoObservacoes = document.getElementById('produtoObservacoes');
const produtoStatus = document.getElementById('produtoStatus');
const produtoAviso = document.getElementById('produtoAviso');
const produtosLista = document.getElementById('produtosLista');
const produtosTotal = document.getElementById('produtosTotal');

let currentUser = null;
let teamContext = null;
let mensagensUnsub = null;
let problemasUnsub = null;
let produtosUnsub = null;

const emailUidCache = new Map();

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function normalizePerfil(perfil) {
  const p = (perfil || '').toLowerCase().trim();
  if (['adm', 'admin', 'administrador'].includes(p)) return 'adm';
  if (['usuario completo', 'usuario'].includes(p)) return 'usuario';
  if (['usuario basico', 'cliente', 'user'].includes(p)) return 'cliente';
  if (
    [
      'gestor',
      'mentor',
      'responsavel',
      'gestor financeiro',
      'responsavel financeiro',
    ].includes(p)
  )
    return 'gestor';
  if (['gestor expedicao', 'gestor expedição', 'expedicao'].includes(p))
    return 'gestor expedicao';
  return p;
}

function formatDate(value) {
  if (!value) return '—';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '—';
    return value.toLocaleDateString('pt-BR');
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('pt-BR');
    }
  }
  if (value?.seconds) {
    return new Date(value.seconds * 1000).toLocaleDateString('pt-BR');
  }
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleDateString('pt-BR');
  }
  return '—';
}

function formatDateTime(value) {
  if (!value) return '—';
  let date = null;
  if (value instanceof Date) {
    date = value;
  } else if (value?.seconds) {
    date = new Date(value.seconds * 1000);
  } else if (typeof value.toDate === 'function') {
    date = value.toDate();
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  }
  if (!date || Number.isNaN(date.getTime())) return '—';
  const data = date.toLocaleDateString('pt-BR');
  const hora = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${data} ${hora}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showStatus(el, message, type = 'success') {
  if (!el) return;
  el.textContent = message;
  el.classList.remove(
    'hidden',
    'text-green-600',
    'text-red-600',
    'text-yellow-600',
  );
  const cls =
    type === 'error'
      ? 'text-red-600'
      : type === 'warning'
        ? 'text-yellow-600'
        : 'text-green-600';
  el.classList.add(cls);
}

function clearStatus(el) {
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
  el.classList.remove('text-green-600', 'text-red-600', 'text-yellow-600');
}

function todayInputValue() {
  const today = new Date();
  const iso = today.toISOString();
  return iso.slice(0, 10);
}

async function findUidByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  if (emailUidCache.has(normalized)) return emailUidCache.get(normalized);

  const candidates = [];
  if (email && email.trim()) candidates.push(email.trim());
  if (!candidates.includes(normalized)) candidates.push(normalized);

  let uid = null;
  for (const value of candidates) {
    try {
      const snap = await getDocs(
        query(collection(db, 'usuarios'), where('email', '==', value)),
      );
      if (!snap.empty) {
        uid = snap.docs[0].id;
        break;
      }
    } catch (err) {
      console.error('Erro ao buscar UID pelo e-mail em usuarios:', err);
      break;
    }
  }

  if (!uid) {
    for (const value of candidates) {
      try {
        const snap = await getDocs(
          query(collection(db, 'uid'), where('email', '==', value)),
        );
        if (!snap.empty) {
          uid = snap.docs[0].id;
          break;
        }
      } catch (err) {
        console.error('Erro ao buscar UID pelo e-mail em uid:', err);
        break;
      }
    }
  }

  emailUidCache.set(normalized, uid);
  return uid;
}

async function buildTeamContext(user) {
  const profile = await loadUserProfile(user.uid);
  const emailMap = new Map(); // normalized -> original
  const uidSet = new Set();
  const emailsToResolve = new Set();

  const addEmail = (email) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    if (!emailMap.has(normalized)) {
      emailMap.set(normalized, (email || '').trim());
    }
    return normalized;
  };

  const addEmailAndResolveUid = async (email) => {
    const normalized = addEmail(email);
    if (!normalized) return;
    emailsToResolve.add(normalized);
  };

  addEmail(user.email);
  uidSet.add(user.uid);
  if (profile?.email) addEmail(profile.email);

  const financeEmails = new Set();
  if (profile?.responsavelFinanceiroEmail) {
    financeEmails.add(profile.responsavelFinanceiroEmail);
  }
  if (Array.isArray(profile?.gestoresFinanceirosEmails)) {
    profile.gestoresFinanceirosEmails.forEach((email) =>
      financeEmails.add(email),
    );
  }

  const expedicaoEmails = new Set();
  if (profile?.responsavelExpedicaoEmail) {
    expedicaoEmails.add(profile.responsavelExpedicaoEmail);
  }
  if (Array.isArray(profile?.gestoresExpedicaoEmails)) {
    profile.gestoresExpedicaoEmails.forEach((email) =>
      expedicaoEmails.add(email),
    );
  }

  for (const email of financeEmails) {
    await addEmailAndResolveUid(email);
  }
  for (const email of expedicaoEmails) {
    await addEmailAndResolveUid(email);
  }

  try {
    const teamSnap = await getDocs(
      collection(db, 'uid', user.uid, 'expedicaoTeam'),
    );
    teamSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data) return;
      if (data.allowEquipes === false) return;
      if (data.email) addEmail(data.email);
    });
  } catch (err) {
    console.error('Erro ao carregar membros configurados na equipe:', err);
  }

  let isFinanceiroResponsavel = false;
  try {
    const relacionados = await fetchResponsavelFinanceiroUsuarios(
      db,
      user.email,
    );
    if (relacionados.length > 0) {
      isFinanceiroResponsavel = true;
    }
    relacionados.forEach((info) => {
      if (info.email) addEmail(info.email);
      if (info.uid) uidSet.add(info.uid);
    });
  } catch (err) {
    console.error('Erro ao carregar usuários vinculados financeiramente:', err);
  }

  let possuiEquipeExpedicao = false;
  try {
    const responsaveisSnap = await getDocs(
      query(
        collection(db, 'usuarios'),
        where('responsavelExpedicaoEmail', '==', user.email),
      ),
    );
    responsaveisSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data?.email) addEmail(data.email);
      uidSet.add(docSnap.id);
    });
    if (!responsaveisSnap.empty) possuiEquipeExpedicao = true;

    const gestoresSnap = await getDocs(
      query(
        collection(db, 'usuarios'),
        where('gestoresExpedicaoEmails', 'array-contains', user.email),
      ),
    );
    gestoresSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data?.email) addEmail(data.email);
      uidSet.add(docSnap.id);
    });
    if (!gestoresSnap.empty) possuiEquipeExpedicao = true;
  } catch (err) {
    console.error('Erro ao carregar equipe de expedição relacionada:', err);
  }

  for (const normalized of emailsToResolve) {
    const original = emailMap.get(normalized);
    const uid = await findUidByEmail(original || normalized);
    if (uid) uidSet.add(uid);
  }

  const emails = Array.from(emailMap.keys()).filter(Boolean);
  if (!emails.includes(normalizeEmail(user.email))) {
    emails.push(normalizeEmail(user.email));
  }
  const uids = Array.from(uidSet).filter(Boolean);
  const perfilNormalizado = normalizePerfil(profile?.perfil);
  const displayName =
    profile?.nome ||
    user.displayName ||
    profile?.email ||
    user.email ||
    'Usuário';

  const canManageProdutos =
    ['gestor', 'adm'].includes(perfilNormalizado) || isFinanceiroResponsavel;

  return {
    emails,
    uids,
    perfil: perfilNormalizado,
    displayName,
    isFinanceiroResponsavel,
    possuiEquipeExpedicao,
    canManageProdutos,
  };
}

function bindFormHandlers() {
  if (mensagemForm && !mensagemForm.dataset.bound) {
    mensagemForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!teamContext?.emails?.length) {
        showStatus(
          mensagemStatus,
          'Não foi possível localizar a equipe vinculada ao usuário.',
          'error',
        );
        return;
      }
      const texto = (mensagemTexto?.value || '').trim();
      if (!texto) {
        showStatus(
          mensagemStatus,
          'Escreva uma mensagem antes de enviar.',
          'warning',
        );
        return;
      }
      try {
        clearStatus(mensagemStatus);
        await addDoc(collection(db, 'painelAtualizacoesMensagens'), {
          texto,
          autorUid: currentUser.uid,
          autorNome: teamContext.displayName,
          autorEmail: currentUser.email || '',
          participantesEmails: [...teamContext.emails],
          participantesUids: [...teamContext.uids],
          createdAt: serverTimestamp(),
          origemUid: currentUser.uid,
        });
        mensagemTexto.value = '';
        showStatus(
          mensagemStatus,
          'Mensagem enviada para a equipe com sucesso!',
        );
      } catch (err) {
        console.error('Erro ao enviar mensagem geral:', err);
        showStatus(
          mensagemStatus,
          'Não foi possível enviar a mensagem. Tente novamente.',
          'error',
        );
      }
    });
    mensagemForm.dataset.bound = 'true';
  }

  if (problemaForm && !problemaForm.dataset.bound) {
    problemaForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!teamContext?.emails?.length) {
        showStatus(
          problemaStatus,
          'Não foi possível localizar a equipe vinculada ao usuário.',
          'error',
        );
        return;
      }
      const descricao = (problemaDescricao?.value || '').trim();
      const setor = (problemaSetor?.value || '').trim();
      const responsavel = (
        problemaResponsavel?.value ||
        teamContext.displayName ||
        ''
      ).trim();
      const dataReferencia = (problemaData?.value || '').trim();
      const solucao = (problemaSolucao?.value || '').trim();
      if (!descricao || !setor) {
        showStatus(
          problemaStatus,
          'Informe a descrição do problema e o setor correspondente.',
          'warning',
        );
        return;
      }
      try {
        clearStatus(problemaStatus);
        await addDoc(collection(db, 'painelAtualizacoesProblemas'), {
          descricao,
          setor,
          responsavel: responsavel || null,
          dataReferencia: dataReferencia || null,
          solucao: solucao || null,
          registradoPorUid: currentUser.uid,
          registradoPorNome: teamContext.displayName,
          registradoPorEmail: currentUser.email || '',
          participantesEmails: [...teamContext.emails],
          participantesUids: [...teamContext.uids],
          createdAt: serverTimestamp(),
          origemUid: currentUser.uid,
        });
        problemaDescricao.value = '';
        problemaSetor.value = '';
        problemaSolucao.value = '';
        problemaResponsavel.value = teamContext.displayName || '';
        problemaData.value = todayInputValue();
        showStatus(problemaStatus, 'Problema registrado com sucesso!');
      } catch (err) {
        console.error('Erro ao registrar problema:', err);
        showStatus(
          problemaStatus,
          'Não foi possível registrar o problema. Tente novamente.',
          'error',
        );
      }
    });
    problemaForm.dataset.bound = 'true';
  }

  if (produtoForm && !produtoForm.dataset.bound) {
    produtoForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!teamContext?.emails?.length) {
        showStatus(
          produtoStatus,
          'Não foi possível localizar a equipe vinculada ao usuário.',
          'error',
        );
        return;
      }
      if (!teamContext?.canManageProdutos) {
        showStatus(
          produtoStatus,
          'Somente gestores ou responsáveis financeiros podem cadastrar produtos.',
          'error',
        );
        return;
      }
      const nome = (produtoNome?.value || '').trim();
      const observacoes = (produtoObservacoes?.value || '').trim();
      if (!nome) {
        showStatus(
          produtoStatus,
          'Informe o nome do produto ou peça em linha.',
          'warning',
        );
        return;
      }
      try {
        clearStatus(produtoStatus);
        await addDoc(collection(db, 'painelAtualizacoesProdutos'), {
          nome,
          observacoes: observacoes || null,
          criadoPorUid: currentUser.uid,
          criadoPorNome: teamContext.displayName,
          criadoPorEmail: currentUser.email || '',
          participantesEmails: [...teamContext.emails],
          participantesUids: [...teamContext.uids],
          createdAt: serverTimestamp(),
          origemUid: currentUser.uid,
        });
        produtoNome.value = '';
        produtoObservacoes.value = '';
        showStatus(produtoStatus, 'Produto registrado com sucesso!');
      } catch (err) {
        console.error('Erro ao registrar produto em linha:', err);
        showStatus(
          produtoStatus,
          'Não foi possível registrar o produto. Tente novamente.',
          'error',
        );
      }
    });
    produtoForm.dataset.bound = 'true';
  }
}

function renderMensagens(docs) {
  if (mensagensLista) mensagensLista.innerHTML = '';
  if (!docs.length) {
    mensagensTotal && (mensagensTotal.textContent = '');
    if (mensagensLista) {
      const vazio = document.createElement('p');
      vazio.className = 'text-sm text-gray-500';
      vazio.textContent = 'Nenhuma mensagem registrada até o momento.';
      mensagensLista.appendChild(vazio);
    }
    return;
  }
  mensagensTotal &&
    (mensagensTotal.textContent =
      docs.length === 1 ? '1 mensagem' : `${docs.length} mensagens`);
  docs.forEach((docSnap) => {
    const data = docSnap.data();
    const container = document.createElement('div');
    container.className =
      'border border-indigo-100 bg-indigo-50/60 rounded-lg p-3 shadow-sm';
    const header = document.createElement('div');
    header.className =
      'flex items-center justify-between text-xs text-gray-500';
    const autor =
      data.autorNome || data.autorEmail || 'Responsável não informado';
    header.innerHTML = `<span>${escapeHtml(autor)}</span><span>${formatDateTime(
      data.createdAt,
    )}</span>`;
    const texto = document.createElement('p');
    texto.className =
      'mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-snug';
    texto.textContent = data.texto || '';
    container.appendChild(header);
    container.appendChild(texto);
    mensagensLista?.appendChild(container);
  });
}

function renderProblemas(docs) {
  if (problemasLista) problemasLista.innerHTML = '';
  if (!docs.length) {
    const vazio = document.createElement('p');
    vazio.className = 'text-sm text-gray-500';
    vazio.textContent = 'Nenhum problema registrado até o momento.';
    problemasLista?.appendChild(vazio);
    return;
  }
  docs.forEach((docSnap) => {
    const data = docSnap.data();
    const card = document.createElement('div');
    card.className =
      'border border-amber-100 bg-amber-50 rounded-lg p-3 shadow-sm';
    const header = document.createElement('div');
    header.className =
      'flex flex-wrap items-center justify-between text-xs text-amber-700';
    header.innerHTML = `<span class="font-semibold">${escapeHtml(
      data.setor || 'Setor não informado',
    )}</span><span>${
      data.dataReferencia
        ? formatDate(data.dataReferencia)
        : formatDate(data.createdAt)
    }</span>`;
    const descricao = document.createElement('p');
    descricao.className = 'mt-2 text-sm text-gray-800 whitespace-pre-wrap';
    descricao.textContent = data.descricao || '';
    const detalhes = document.createElement('div');
    detalhes.className = 'mt-3 text-xs text-gray-600 space-y-1';
    const responsavel = escapeHtml(
      data.responsavel ||
        data.registradoPorNome ||
        data.registradoPorEmail ||
        '—',
    );
    detalhes.innerHTML = `
      <div><strong>Responsável:</strong> ${responsavel}</div>
      ${data.solucao ? `<div><strong>Solução:</strong> ${escapeHtml(data.solucao)}</div>` : ''}
      <div><strong>Registrado por:</strong> ${escapeHtml(
        data.registradoPorNome || data.registradoPorEmail || '—',
      )}</div>
    `;
    card.appendChild(header);
    card.appendChild(descricao);
    card.appendChild(detalhes);
    problemasLista?.appendChild(card);
  });
}

function renderProdutos(docs) {
  if (produtosLista) produtosLista.innerHTML = '';
  if (!docs.length) {
    const row = document.createElement('tr');
    row.innerHTML =
      '<td colspan="4" class="px-4 py-3 text-sm text-center text-gray-500">Nenhum produto cadastrado até o momento.</td>';
    produtosLista?.appendChild(row);
    produtosTotal && (produtosTotal.textContent = '');
    return;
  }
  produtosTotal &&
    (produtosTotal.textContent =
      docs.length === 1 ? '1 produto' : `${docs.length} produtos`);
  docs.forEach((docSnap) => {
    const data = docSnap.data();
    const row = document.createElement('tr');
    row.className = 'bg-white';
    row.innerHTML = `
      <td class="px-4 py-3 text-gray-800 font-medium">${escapeHtml(
        data.nome || '—',
      )}</td>
      <td class="px-4 py-3 text-gray-600">${escapeHtml(
        data.observacoes || '—',
      )}</td>
      <td class="px-4 py-3 text-gray-600">${escapeHtml(
        data.criadoPorNome || data.criadoPorEmail || '—',
      )}</td>
      <td class="px-4 py-3 text-gray-600">${formatDateTime(data.createdAt)}</td>
    `;
    produtosLista?.appendChild(row);
  });
}

function toggleProdutoFormVisibility() {
  if (!produtoForm) return;
  if (teamContext?.canManageProdutos) {
    produtoForm.classList.remove('hidden');
    produtoAviso?.classList.add('hidden');
  } else {
    produtoForm.classList.add('hidden');
    produtoAviso?.classList.remove('hidden');
  }
}

function prefillDefaults() {
  if (problemaResponsavel && !problemaResponsavel.value) {
    problemaResponsavel.value = teamContext?.displayName || '';
  }
  if (problemaData) {
    problemaData.value = todayInputValue();
  }
}

function startRealtimeListeners() {
  const userEmail = normalizeEmail(currentUser?.email);
  if (!userEmail) return;

  if (mensagensUnsub) mensagensUnsub();
  const mensagensQuery = query(
    collection(db, 'painelAtualizacoesMensagens'),
    where('participantesEmails', 'array-contains', userEmail),
    orderBy('createdAt', 'desc'),
    limit(10),
  );
  mensagensUnsub = onSnapshot(
    mensagensQuery,
    (snapshot) => {
      clearStatus(mensagemStatus);
      renderMensagens(snapshot.docs);
    },
    (err) => {
      console.error('Erro ao carregar mensagens gerais:', err);
      showStatus(
        mensagemStatus,
        'Não foi possível carregar as mensagens da equipe.',
        'error',
      );
    },
  );

  if (problemasUnsub) problemasUnsub();
  const problemasQuery = query(
    collection(db, 'painelAtualizacoesProblemas'),
    where('participantesEmails', 'array-contains', userEmail),
    orderBy('createdAt', 'desc'),
  );
  problemasUnsub = onSnapshot(
    problemasQuery,
    (snapshot) => {
      clearStatus(problemaStatus);
      renderProblemas(snapshot.docs);
    },
    (err) => {
      console.error('Erro ao carregar problemas gerais:', err);
      showStatus(
        problemaStatus,
        'Não foi possível carregar o quadro de problemas.',
        'error',
      );
    },
  );

  if (produtosUnsub) produtosUnsub();
  const produtosQuery = query(
    collection(db, 'painelAtualizacoesProdutos'),
    where('participantesEmails', 'array-contains', userEmail),
    orderBy('createdAt', 'desc'),
  );
  produtosUnsub = onSnapshot(
    produtosQuery,
    (snapshot) => {
      clearStatus(produtoStatus);
      renderProdutos(snapshot.docs);
    },
    (err) => {
      console.error('Erro ao carregar produtos em linha:', err);
      showStatus(
        produtoStatus,
        'Não foi possível carregar a lista de produtos.',
        'error',
      );
    },
  );
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  currentUser = user;
  try {
    teamContext = await buildTeamContext(user);
    bindFormHandlers();
    toggleProdutoFormVisibility();
    prefillDefaults();
    startRealtimeListeners();
  } catch (err) {
    console.error('Erro ao preparar o painel de atualizações gerais:', err);
    showStatus(
      mensagemStatus,
      'Não foi possível carregar as configurações de equipe.',
      'error',
    );
  }
});
