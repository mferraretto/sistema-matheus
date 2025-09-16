import {
  initializeApp,
  getApps,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  Timestamp,
  deleteField,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  getAuth,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import { fetchResponsavelFinanceiroUsuarios } from './responsavel-financeiro.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const urlParams = new URLSearchParams(window.location.search);
const singleUid = urlParams.get('uid');

let currentUser = null;
let novoFormInicializado = false;

function formatDateInput(value) {
  if (!value) return '';
  let dateValue = value;
  if (typeof value?.toDate === 'function') {
    dateValue = value.toDate();
  }
  const dateObj = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(dateObj.getTime())) return '';
  return dateObj.toISOString().slice(0, 10);
}

function parseDateInput(value) {
  if (!value) return null;
  const dateObj = new Date(value);
  return Number.isNaN(dateObj.getTime()) ? null : dateObj;
}

function setOrDelete(obj, key, value) {
  if (value === undefined || value === null || value === '') {
    obj[key] = deleteField();
  } else {
    obj[key] = value;
  }
}

function updateMentoradosCount(count) {
  const counter = document.getElementById('mentoradosCount');
  if (!counter) return;
  if (!count) {
    counter.textContent = '';
    return;
  }
  counter.textContent = count === 1 ? '1 mentorado' : `${count} mentorados`;
}

function toggleEmptyState(hasItems) {
  const emptyEl = document.getElementById('perfilMentoradoEmpty');
  if (!emptyEl) return;
  if (hasItems) emptyEl.classList.add('hidden');
  else emptyEl.classList.remove('hidden');
}

function setNovoMentoradoFeedback(message, type = 'info') {
  const feedback = document.getElementById('novoMentoradoFeedback');
  if (!feedback) return;
  if (!message) {
    feedback.textContent = '';
    feedback.className = 'text-sm';
    return;
  }
  const classes = {
    success: 'text-emerald-600',
    error: 'text-red-500',
    info: 'text-gray-500',
  };
  feedback.textContent = message;
  feedback.className = `text-sm ${classes[type] || classes.info}`;
}

function createInput({
  field,
  label,
  type = 'text',
  value = '',
  placeholder = '',
  rows,
  colSpan = '',
}) {
  const wrapper = document.createElement('label');
  wrapper.className = `flex flex-col gap-1 ${colSpan}`.trim();
  const span = document.createElement('span');
  span.className = 'text-sm font-medium text-gray-700';
  span.textContent = label;
  wrapper.appendChild(span);
  const input = document.createElement(
    type === 'textarea' ? 'textarea' : 'input',
  );
  input.className = 'form-control';
  input.dataset.field = field;
  if (type === 'textarea') {
    input.rows = rows || 3;
    input.value = value || '';
  } else {
    input.type = type;
    input.value = value || '';
    if (placeholder) input.placeholder = placeholder;
  }
  wrapper.appendChild(input);
  return wrapper;
}

function getFieldValue(card, field) {
  const el = card.querySelector(`[data-field="${field}"]`);
  if (!el) return '';
  return el.value?.trim?.() ?? '';
}

function createPerfilCard({
  uid,
  nome,
  email,
  usuarioData = {},
  perfilData = {},
  relacionado = false,
}) {
  const card = document.createElement('div');
  card.className =
    'bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-4';
  card.dataset.uid = uid;
  card.dataset.relacionado = relacionado ? '1' : '0';

  const header = document.createElement('div');
  header.className =
    'flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between';
  const titleWrapper = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'text-lg font-semibold';
  title.dataset.role = 'titulo';
  title.textContent = nome || email || 'Mentorado sem nome';
  titleWrapper.appendChild(title);
  const uidText = document.createElement('p');
  uidText.className = 'text-xs text-gray-500 break-all';
  uidText.textContent = `UID: ${uid}`;
  titleWrapper.appendChild(uidText);
  header.appendChild(titleWrapper);
  if (!relacionado) {
    const badge = document.createElement('span');
    badge.className =
      'mt-2 inline-flex items-center justify-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 sm:mt-0';
    badge.textContent = 'Visualização';
    header.appendChild(badge);
  }
  card.appendChild(header);

  const dadosBasicos = document.createElement('div');
  dadosBasicos.className = 'grid gap-3 md:grid-cols-2';
  dadosBasicos.appendChild(
    createInput({
      field: 'nome',
      label: 'Nome',
      value: nome || perfilData.nome || '',
    }),
  );
  dadosBasicos.appendChild(
    createInput({
      field: 'email',
      label: 'E-mail',
      type: 'email',
      value: email || usuarioData.email || perfilData.email || '',
    }),
  );
  dadosBasicos.appendChild(
    createInput({
      field: 'dataInicio',
      label: 'Data de início',
      type: 'date',
      value:
        formatDateInput(usuarioData.dataInicio || perfilData.dataInicio) || '',
    }),
  );
  dadosBasicos.appendChild(
    createInput({
      field: 'contato',
      label: 'Contato',
      value: usuarioData.contato || perfilData.contato || '',
      placeholder: 'Telefone, WhatsApp ou outro canal',
    }),
  );
  card.appendChild(dadosBasicos);

  const dadosExtras = document.createElement('div');
  dadosExtras.className = 'grid gap-3 md:grid-cols-2';
  dadosExtras.appendChild(
    createInput({ field: 'loja', label: 'Loja', value: perfilData.loja || '' }),
  );
  dadosExtras.appendChild(
    createInput({
      field: 'segmento',
      label: 'Segmento',
      value: perfilData.segmento || '',
    }),
  );
  dadosExtras.appendChild(
    createInput({
      field: 'tempoOperacao',
      label: 'Tempo de operação',
      value: perfilData.tempoOperacao || '',
    }),
  );
  dadosExtras.appendChild(
    createInput({
      field: 'link-shopee',
      label: 'Link Shopee',
      type: 'url',
      value: perfilData.links?.shopee || '',
      placeholder: 'https://shopee...',
    }),
  );
  dadosExtras.appendChild(
    createInput({
      field: 'link-mercadoLivre',
      label: 'Link Mercado Livre',
      type: 'url',
      value: perfilData.links?.mercadoLivre || '',
      placeholder: 'https://mercadolivre...',
    }),
  );
  dadosExtras.appendChild(
    createInput({
      field: 'link-site',
      label: 'Site próprio',
      type: 'url',
      value: perfilData.links?.site || '',
      placeholder: 'https://...',
    }),
  );
  dadosExtras.appendChild(
    createInput({
      field: 'link-instagram',
      label: 'Instagram',
      value: perfilData.links?.instagram || '',
      placeholder: '@perfil',
    }),
  );
  card.appendChild(dadosExtras);

  const objetivosWrapper = createInput({
    field: 'objetivos',
    label: 'Objetivos',
    type: 'textarea',
    value: perfilData.objetivos || '',
    rows: 4,
    colSpan: 'md:col-span-2',
  });
  objetivosWrapper.querySelector('textarea').classList.add('resize-y');
  card.appendChild(objetivosWrapper);

  const actions = document.createElement('div');
  actions.className = 'flex flex-wrap justify-end gap-2';
  const salvarBtn = document.createElement('button');
  salvarBtn.type = 'button';
  salvarBtn.className = 'btn-primary px-4 py-2 rounded';
  salvarBtn.dataset.role = 'salvar';
  salvarBtn.textContent = 'Salvar alterações';
  salvarBtn.addEventListener('click', () => salvarPerfil(uid, card));
  actions.appendChild(salvarBtn);

  const removerBtn = document.createElement('button');
  removerBtn.type = 'button';
  removerBtn.dataset.role = 'remover';
  removerBtn.className =
    'px-4 py-2 rounded border border-red-500 text-red-600 hover:bg-red-50 transition';
  removerBtn.textContent = 'Remover mentorado';
  removerBtn.addEventListener('click', () => excluirMentorado(uid, card));
  actions.appendChild(removerBtn);

  card.appendChild(actions);

  return card;
}

async function salvarPerfil(uid, card) {
  const salvarBtn = card.querySelector('[data-role="salvar"]');
  if (salvarBtn) salvarBtn.disabled = true;

  const nome = getFieldValue(card, 'nome');
  const email = getFieldValue(card, 'email').toLowerCase();
  const contato = getFieldValue(card, 'contato');
  const loja = getFieldValue(card, 'loja');
  const segmento = getFieldValue(card, 'segmento');
  const tempoOperacao = getFieldValue(card, 'tempoOperacao');
  const objetivos = getFieldValue(card, 'objetivos');
  const dataInicioValue = parseDateInput(getFieldValue(card, 'dataInicio'));
  const relacionado = card.dataset.relacionado === '1' && !!currentUser;

  const usuarioPayload = { atualizadoEm: serverTimestamp() };
  setOrDelete(usuarioPayload, 'nome', nome);
  setOrDelete(usuarioPayload, 'email', email);
  setOrDelete(usuarioPayload, 'contato', contato);
  if (dataInicioValue)
    usuarioPayload.dataInicio = Timestamp.fromDate(dataInicioValue);
  else usuarioPayload.dataInicio = deleteField();
  if (relacionado) {
    setOrDelete(
      usuarioPayload,
      'responsavelFinanceiroEmail',
      currentUser.email || '',
    );
    setOrDelete(
      usuarioPayload,
      'responsavelFinanceiroUid',
      currentUser.uid || '',
    );
    setOrDelete(usuarioPayload, 'gestorUid', currentUser.uid || '');
  }

  const perfilPayload = { atualizadoEm: serverTimestamp() };
  setOrDelete(perfilPayload, 'nome', nome);
  setOrDelete(perfilPayload, 'loja', loja);
  setOrDelete(perfilPayload, 'segmento', segmento);
  setOrDelete(perfilPayload, 'tempoOperacao', tempoOperacao);
  setOrDelete(perfilPayload, 'objetivos', objetivos);
  setOrDelete(perfilPayload, 'contato', contato);
  if (relacionado) {
    setOrDelete(perfilPayload, 'gestorUid', currentUser.uid || '');
    setOrDelete(
      perfilPayload,
      'responsavelFinanceiroUid',
      currentUser.uid || '',
    );
    setOrDelete(
      perfilPayload,
      'responsavelFinanceiroEmail',
      currentUser.email || '',
    );
  }
  const links = {
    shopee: getFieldValue(card, 'link-shopee'),
    mercadoLivre: getFieldValue(card, 'link-mercadoLivre'),
    site: getFieldValue(card, 'link-site'),
    instagram: getFieldValue(card, 'link-instagram'),
  };
  Object.entries(links).forEach(([key, value]) => {
    setOrDelete(perfilPayload, `links.${key}`, value);
  });

  const uidPayload = {};
  setOrDelete(uidPayload, 'nome', nome);
  setOrDelete(uidPayload, 'email', email);
  setOrDelete(uidPayload, 'contato', contato);
  if (relacionado) {
    setOrDelete(
      uidPayload,
      'responsavelFinanceiroEmail',
      currentUser.email || '',
    );
    setOrDelete(uidPayload, 'responsavelFinanceiroUid', currentUser.uid || '');
    setOrDelete(uidPayload, 'gestorUid', currentUser.uid || '');
    setOrDelete(uidPayload, 'gestorEmail', currentUser.email || '');
  }

  try {
    await Promise.all([
      setDoc(doc(db, 'usuarios', uid), usuarioPayload, { merge: true }),
      setDoc(doc(db, 'perfilMentorado', uid), perfilPayload, { merge: true }),
      setDoc(doc(db, 'uid', uid), uidPayload, { merge: true }),
    ]);
    const title = card.querySelector('[data-role="titulo"]');
    if (title) title.textContent = nome || email || 'Mentorado sem nome';
    alert('Perfil salvo com sucesso!');
  } catch (err) {
    console.error('Erro ao salvar perfil:', err);
    alert('Não foi possível salvar o perfil. Tente novamente.');
  } finally {
    if (salvarBtn) salvarBtn.disabled = false;
  }
}

async function excluirMentorado(uid, card) {
  if (!window.confirm('Deseja remover este mentorado da sua lista?')) return;
  const removerBtn = card.querySelector('[data-role="remover"]');
  if (removerBtn) removerBtn.disabled = true;
  try {
    await deleteDoc(doc(db, 'perfilMentorado', uid));
  } catch (err) {
    console.warn('Perfil já removido ou sem permissões para exclusão.', err);
  }

  const usuarioUpdates = {
    responsavelFinanceiroEmail: deleteField(),
    responsavelFinanceiroUid: deleteField(),
    gestorUid: deleteField(),
  };
  const uidUpdates = {
    responsavelFinanceiroEmail: deleteField(),
    responsavelFinanceiroUid: deleteField(),
    gestorUid: deleteField(),
    gestorEmail: deleteField(),
  };

  try {
    await Promise.all([
      setDoc(doc(db, 'usuarios', uid), usuarioUpdates, { merge: true }),
      setDoc(doc(db, 'uid', uid), uidUpdates, { merge: true }),
    ]);
  } catch (err) {
    console.error('Erro ao remover vínculos do mentorado:', err);
  }

  card.remove();
  const list = document.getElementById('perfilMentoradoList');
  const count = list ? list.childElementCount : 0;
  updateMentoradosCount(count);
  toggleEmptyState(count > 0);
  alert('Mentorado removido da sua lista.');
  if (removerBtn) removerBtn.disabled = false;
}

async function carregarPerfilUnico(uid) {
  const list = document.getElementById('perfilMentoradoList');
  if (!list) return;
  list.innerHTML = '';
  try {
    const [usuarioSnap, perfilSnap] = await Promise.all([
      getDoc(doc(db, 'usuarios', uid)),
      getDoc(doc(db, 'perfilMentorado', uid)),
    ]);
    const usuarioData = usuarioSnap.exists() ? usuarioSnap.data() : {};
    const perfilData = perfilSnap.exists() ? perfilSnap.data() : {};
    const nome = usuarioData.nome || perfilData.nome || '';
    const email = usuarioData.email || perfilData.email || uid;
    const card = createPerfilCard({
      uid,
      nome,
      email,
      usuarioData,
      perfilData,
      relacionado: false,
    });
    list.appendChild(card);
    updateMentoradosCount(1);
    toggleEmptyState(true);
  } catch (err) {
    console.error('Erro ao carregar perfil do mentorado:', err);
    const msg = document.createElement('p');
    msg.className = 'text-sm text-red-500';
    msg.textContent = 'Não foi possível carregar o perfil do mentorado.';
    list.appendChild(msg);
    updateMentoradosCount(0);
    toggleEmptyState(false);
  }
}

async function carregarPerfis() {
  const list = document.getElementById('perfilMentoradoList');
  if (!list) return;
  list.innerHTML = '';
  updateMentoradosCount(0);
  toggleEmptyState(true);

  if (singleUid) {
    await carregarPerfilUnico(singleUid);
    return;
  }

  if (!currentUser) return;

  const carregando = document.createElement('p');
  carregando.className = 'text-sm text-gray-500 px-4';
  carregando.textContent = 'Carregando mentorados...';
  list.appendChild(carregando);

  const relacionados = new Map();

  try {
    const responsaveis = await fetchResponsavelFinanceiroUsuarios(
      db,
      currentUser.email,
    );
    responsaveis.forEach((item) => {
      relacionados.set(item.uid, {
        uid: item.uid,
        baseEmail: item.email || '',
        baseNome: item.nome || '',
        relacionado: true,
      });
    });
  } catch (err) {
    console.error('Erro ao buscar usuários vinculados financeiramente:', err);
  }

  try {
    const consultas = [
      getDocs(
        query(
          collection(db, 'perfilMentorado'),
          where('gestorUid', '==', currentUser.uid),
        ),
      ),
      getDocs(
        query(
          collection(db, 'perfilMentorado'),
          where('responsavelFinanceiroUid', '==', currentUser.uid),
        ),
      ),
    ];
    const resultados = await Promise.all(consultas);
    resultados.forEach((snap) => {
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const entry = relacionados.get(docSnap.id) || {
          uid: docSnap.id,
          relacionado: true,
        };
        entry.perfilData = data;
        entry.baseEmail = entry.baseEmail || data.email || '';
        entry.baseNome = entry.baseNome || data.nome || '';
        relacionados.set(docSnap.id, entry);
      });
    });
  } catch (err) {
    console.error('Erro ao buscar perfis mentorados:', err);
  }

  list.innerHTML = '';
  const entradas = Array.from(relacionados.values());

  if (!entradas.length) {
    toggleEmptyState(false);
    updateMentoradosCount(0);
    return;
  }

  entradas.sort((a, b) => {
    const nomeA = (a.baseNome || '').toLowerCase();
    const nomeB = (b.baseNome || '').toLowerCase();
    if (nomeA && nomeB) return nomeA.localeCompare(nomeB);
    if (nomeA) return -1;
    if (nomeB) return 1;
    const emailA = (a.baseEmail || '').toLowerCase();
    const emailB = (b.baseEmail || '').toLowerCase();
    return emailA.localeCompare(emailB);
  });

  const cards = await Promise.all(
    entradas.map(async (item) => {
      try {
        const [usuarioSnap, perfilSnap] = await Promise.all([
          getDoc(doc(db, 'usuarios', item.uid)),
          item.perfilData
            ? Promise.resolve({
                exists: () => true,
                data: () => item.perfilData,
              })
            : getDoc(doc(db, 'perfilMentorado', item.uid)),
        ]);
        const usuarioData = usuarioSnap.exists() ? usuarioSnap.data() : {};
        const perfilData = item.perfilData
          ? item.perfilData
          : perfilSnap.exists()
            ? perfilSnap.data()
            : {};
        const nome =
          usuarioData.nome ||
          perfilData.nome ||
          item.baseNome ||
          item.baseEmail ||
          '';
        const email =
          usuarioData.email || perfilData.email || item.baseEmail || '';
        return createPerfilCard({
          uid: item.uid,
          nome,
          email,
          usuarioData,
          perfilData,
          relacionado: true,
        });
      } catch (err) {
        console.error('Erro ao montar card do mentorado', item.uid, err);
        const aviso = document.createElement('div');
        aviso.className =
          'border border-red-200 bg-red-50 text-red-700 p-3 rounded';
        aviso.textContent = `Não foi possível carregar os dados do mentorado ${item.uid}.`;
        return aviso;
      }
    }),
  );

  cards.forEach((card) => list.appendChild(card));
  updateMentoradosCount(list.childElementCount);
  toggleEmptyState(list.childElementCount > 0);
}

async function handleNovoMentoradoSubmit(event) {
  event.preventDefault();
  if (!currentUser) {
    setNovoMentoradoFeedback(
      'Faça login novamente para cadastrar mentorados.',
      'error',
    );
    return;
  }

  const nomeEl = document.getElementById('novoMentoradoNome');
  const emailEl = document.getElementById('novoMentoradoEmail');
  const dataInicioEl = document.getElementById('novoMentoradoDataInicio');
  const contatoEl = document.getElementById('novoMentoradoContato');
  const submitBtn =
    event.submitter || event.target.querySelector('button[type="submit"]');

  const nome = nomeEl.value.trim();
  const email = emailEl.value.trim().toLowerCase();
  const dataInicio = parseDateInput(dataInicioEl.value);
  const contato = contatoEl.value.trim();

  if (!nome || !email) {
    setNovoMentoradoFeedback(
      'Informe pelo menos nome e e-mail para cadastrar.',
      'error',
    );
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  setNovoMentoradoFeedback('Salvando mentorado...', 'info');

  const usuariosRef = doc(collection(db, 'usuarios'));
  const uid = usuariosRef.id;

  const usuarioPayload = {
    perfil: 'Cliente',
    createdAt: serverTimestamp(),
    createdBy: currentUser.uid,
  };
  setOrDelete(usuarioPayload, 'nome', nome);
  setOrDelete(usuarioPayload, 'email', email);
  setOrDelete(usuarioPayload, 'contato', contato);
  if (dataInicio) usuarioPayload.dataInicio = Timestamp.fromDate(dataInicio);
  if (currentUser.email) {
    usuarioPayload.responsavelFinanceiroEmail = currentUser.email;
    usuarioPayload.gestorEmail = currentUser.email;
  }
  usuarioPayload.responsavelFinanceiroUid = currentUser.uid;
  usuarioPayload.gestorUid = currentUser.uid;

  const perfilPayload = {
    nome,
    contato: contato || deleteField(),
    gestorUid: currentUser.uid,
    responsavelFinanceiroUid: currentUser.uid,
    responsavelFinanceiroEmail: currentUser.email || '',
    criadoEm: serverTimestamp(),
  };

  const uidPayload = {
    uid,
    nome,
    email,
    createdAt: serverTimestamp(),
    createdBy: currentUser.uid,
    responsavelFinanceiroUid: currentUser.uid,
    gestorUid: currentUser.uid,
  };
  if (contato) uidPayload.contato = contato;
  if (currentUser.email) {
    uidPayload.responsavelFinanceiroEmail = currentUser.email;
    uidPayload.gestorEmail = currentUser.email;
  }

  try {
    await Promise.all([
      setDoc(usuariosRef, usuarioPayload, { merge: true }),
      setDoc(doc(db, 'perfilMentorado', uid), perfilPayload, { merge: true }),
      setDoc(doc(db, 'uid', uid), uidPayload, { merge: true }),
    ]);
    setNovoMentoradoFeedback('Mentorado cadastrado com sucesso!', 'success');
    event.target.reset();
    await carregarPerfis();
  } catch (err) {
    console.error('Erro ao cadastrar mentorado:', err);
    setNovoMentoradoFeedback(
      'Não foi possível cadastrar o mentorado. Tente novamente.',
      'error',
    );
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    setTimeout(() => setNovoMentoradoFeedback(''), 4000);
  }
}

function setupNovoMentoradoForm() {
  if (novoFormInicializado) return;
  const form = document.getElementById('novoMentoradoForm');
  if (!form) return;
  if (singleUid) {
    const card = form.closest('.card');
    if (card) card.classList.add('hidden');
    return;
  }
  form.addEventListener('submit', handleNovoMentoradoSubmit);
  novoFormInicializado = true;
}

function initPerfilMentorado() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    setupNovoMentoradoForm();
    if (user) {
      carregarPerfis();
    } else {
      const list = document.getElementById('perfilMentoradoList');
      if (list) list.innerHTML = '';
      updateMentoradosCount(0);
      toggleEmptyState(false);
    }
  });
}

window.initPerfilMentorado = initPerfilMentorado;
