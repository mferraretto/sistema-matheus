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
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  deleteField,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  getAuth,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import { loadUserProfile } from './login.js';
import { fetchResponsavelFinanceiroUsuarios } from './responsavel-financeiro.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const urlParams = new URLSearchParams(window.location.search);
const singleUid = urlParams.get('uid');

let usuarioAtual = null;
let carregandoLista = false;

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

function hasValue(value) {
  return !(value === undefined || value === null || value === '');
}

function formatCurrencyValue(value) {
  if (!hasValue(value)) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return currencyFormatter.format(value);
  }
  const stringValue = String(value).trim();
  if (!stringValue) return '';
  const sanitized = stringValue
    .replace(/[R$\s]/g, '')
    .replace(/\.(?=.*[.,])/g, '')
    .replace(',', '.');
  const parsed = Number(sanitized);
  if (!Number.isNaN(parsed)) return currencyFormatter.format(parsed);
  return stringValue;
}

function normalizeMetaInput(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return { shouldDelete: true, value: null };
  }
  const sanitized = trimmed
    .replace(/[R$\s]/g, '')
    .replace(/\.(?=.*[.,])/g, '')
    .replace(',', '.');
  const parsed = Number(sanitized);
  if (Number.isNaN(parsed)) {
    return { shouldDelete: false, value: trimmed };
  }
  return { shouldDelete: false, value: Number(parsed.toFixed(2)) };
}

function formatDate(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime()))
      return parsed.toISOString().slice(0, 10);
    return '';
  }
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString().slice(0, 10);
    } catch (_) {
      return '';
    }
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const date = new Date(value.seconds * 1000);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime()))
    return fallback.toISOString().slice(0, 10);
  return '';
}

function normalizeEntry(id, data = {}) {
  return {
    id,
    uid: data.uid || null,
    nome: data.nome || '',
    email: data.email || '',
    contato: data.contato || data.telefone || '',
    dataInicio: data.dataInicio || '',
    loja: data.loja || '',
    segmento: data.segmento || '',
    tempoOperacao: data.tempoOperacao || '',
    cargo: data.cargo || '',
    metaFaturamentoLiquido:
      data.metaFaturamentoLiquido !== undefined &&
      data.metaFaturamentoLiquido !== null
        ? data.metaFaturamentoLiquido
        : '',
    links: {
      shopee: data.links?.shopee || '',
      mercadoLivre: data.links?.mercadoLivre || '',
      site: data.links?.site || '',
      instagram: data.links?.instagram || '',
    },
    objetivos: data.objetivos || '',
    gestorUid: data.gestorUid || null,
    gestorEmail: data.gestorEmail || null,
    responsavelFinanceiroEmail: data.responsavelFinanceiroEmail || null,
    criadoPeloGestor: !!data.criadoPeloGestor,
    origens: new Set(),
  };
}

function toggleNovoMentoradoSection(show) {
  const section = document.getElementById('novoMentoradoSection');
  if (!section) return;
  section.classList.toggle('hidden', !show);
}

function setLoading(button, loading, text) {
  if (!button) return;
  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }
    if (text) button.textContent = text;
    button.disabled = true;
    button.classList.add('opacity-70', 'cursor-not-allowed');
  } else {
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
    button.disabled = false;
    button.classList.remove('opacity-70', 'cursor-not-allowed');
  }
}

function getInputValue(container, field) {
  const element = container.querySelector(`[data-field="${field}"]`);
  if (!element) return '';
  return (element.value || '').trim();
}

async function salvarPerfil(entry, card, button) {
  if (!usuarioAtual) {
    alert('É necessário estar autenticado para salvar alterações.');
    return;
  }
  setLoading(button, true, 'Salvando...');
  const nome = getInputValue(card, 'nome');
  const email = getInputValue(card, 'email');
  const contato = getInputValue(card, 'contato');
  const dataInicio = getInputValue(card, 'dataInicio');
  const loja = getInputValue(card, 'loja');
  const segmento = getInputValue(card, 'segmento');
  const tempoOperacao = getInputValue(card, 'tempoOperacao');
  const cargo = getInputValue(card, 'cargo');
  const metaInput = getInputValue(card, 'metaFaturamentoLiquido');
  const linkShopee = getInputValue(card, 'linkShopee');
  const linkMercadoLivre = getInputValue(card, 'linkMercadoLivre');
  const linkSite = getInputValue(card, 'linkSite');
  const linkInstagram = getInputValue(card, 'linkInstagram');
  const objetivos = getInputValue(card, 'objetivos');
  const metaNormalizada = normalizeMetaInput(metaInput);

  const payload = {
    gestorUid: usuarioAtual.uid,
    gestorEmail: usuarioAtual.email,
    updatedAt: serverTimestamp(),
  };

  if (entry.criadoPeloGestor) payload.criadoPeloGestor = true;
  if (entry.uid) payload.uid = entry.uid;
  if (entry.origens instanceof Set && entry.origens.has('financeiro')) {
    payload.responsavelFinanceiroEmail = usuarioAtual.email;
  }

  const applyField = (key, value, allowDelete = true) => {
    if (value) payload[key] = value;
    else if (allowDelete) payload[key] = deleteField();
  };

  applyField('nome', nome);
  applyField('email', email);
  applyField('contato', contato);
  applyField('loja', loja);
  applyField('segmento', segmento);
  applyField('tempoOperacao', tempoOperacao);
  applyField('cargo', cargo);
  applyField('objetivos', objetivos);

  if (dataInicio) payload.dataInicio = dataInicio;
  else payload.dataInicio = deleteField();

  if (metaNormalizada.shouldDelete) {
    payload.metaFaturamentoLiquido = deleteField();
  } else {
    payload.metaFaturamentoLiquido = metaNormalizada.value;
  }

  const links = {
    shopee: linkShopee,
    mercadoLivre: linkMercadoLivre,
    site: linkSite,
    instagram: linkInstagram,
  };
  if (Object.values(links).some((val) => val)) payload.links = links;
  else payload.links = deleteField();

  try {
    await setDoc(doc(db, 'perfilMentorado', entry.id), payload, {
      merge: true,
    });

    if (entry.uid) {
      const usuarioUpdates = {};
      if (nome) usuarioUpdates.nome = nome;
      if (email) usuarioUpdates.email = email;
      if (dataInicio) usuarioUpdates.dataInicio = dataInicio;
      else usuarioUpdates.dataInicio = deleteField();
      if (contato) usuarioUpdates.contato = contato;
      else usuarioUpdates.contato = deleteField();
      if (cargo) usuarioUpdates.cargo = cargo;
      else usuarioUpdates.cargo = deleteField();
      if (metaNormalizada.shouldDelete)
        usuarioUpdates.metaFaturamentoLiquido = deleteField();
      else usuarioUpdates.metaFaturamentoLiquido = metaNormalizada.value;
      if (entry.origens instanceof Set && entry.origens.has('financeiro')) {
        usuarioUpdates.responsavelFinanceiroEmail = usuarioAtual.email;
      }

      if (Object.keys(usuarioUpdates).length) {
        try {
          await updateDoc(doc(db, 'usuarios', entry.uid), usuarioUpdates);
        } catch (err) {
          console.warn('Não foi possível atualizar dados em "usuarios":', err);
        }
      }

      if (entry.origens instanceof Set && entry.origens.has('financeiro')) {
        try {
          await updateDoc(doc(db, 'uid', entry.uid), {
            responsavelFinanceiroEmail: usuarioAtual.email,
          });
        } catch (err) {
          console.warn('Não foi possível atualizar dados em "uid":', err);
        }
      }
    }

    alert('Perfil salvo com sucesso!');
    await carregarPerfis();
  } catch (err) {
    console.error('Erro ao salvar perfil:', err);
    alert('Não foi possível salvar o perfil. Tente novamente.');
  } finally {
    setLoading(button, false);
  }
}

async function excluirPerfil(entry, button) {
  if (!usuarioAtual) {
    alert('Faça login para excluir um mentorado.');
    return;
  }
  const isFinanceiro =
    entry.origens instanceof Set && entry.origens.has('financeiro');
  const isCadastroGestor = entry.criadoPeloGestor && !isFinanceiro;
  const mensagem = isFinanceiro
    ? 'Deseja remover este mentorado da sua lista e desvincular o responsável financeiro?'
    : 'Deseja realmente excluir este mentorado cadastrado?';
  if (!window.confirm(mensagem)) return;

  setLoading(button, true, 'Excluindo...');
  try {
    const ref = doc(db, 'perfilMentorado', entry.id);
    if (isCadastroGestor) {
      await deleteDoc(ref);
    } else {
      const updates = {
        gestorUid: deleteField(),
        gestorEmail: deleteField(),
      };
      if (isFinanceiro) updates.responsavelFinanceiroEmail = deleteField();
      await setDoc(ref, updates, { merge: true });
      if (entry.criadoPeloGestor && !isFinanceiro) {
        await deleteDoc(ref);
      }
    }

    if (isFinanceiro && entry.uid) {
      const updates = { responsavelFinanceiroEmail: deleteField() };
      await Promise.all([
        updateDoc(doc(db, 'usuarios', entry.uid), updates).catch((err) =>
          console.warn(
            'Não foi possível atualizar "usuarios" ao remover responsável financeiro:',
            err,
          ),
        ),
        updateDoc(doc(db, 'uid', entry.uid), updates).catch((err) =>
          console.warn(
            'Não foi possível atualizar "uid" ao remover responsável financeiro:',
            err,
          ),
        ),
      ]);
    }

    alert('Mentorado removido com sucesso.');
    await carregarPerfis();
  } catch (err) {
    console.error('Erro ao excluir mentorado:', err);
    alert('Não foi possível excluir o mentorado. Tente novamente.');
  } finally {
    setLoading(button, false);
  }
}

function createPerfilCard(entry) {
  const card = document.createElement('div');
  card.className =
    'bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-4';
  card.dataset.editing = 'false';

  const header = document.createElement('div');
  header.className = 'space-y-3';

  const topRow = document.createElement('div');
  topRow.className =
    'flex flex-col gap-2 md:flex-row md:items-start md:justify-between';

  const tituloWrapper = document.createElement('div');
  tituloWrapper.className = 'space-y-1';
  const titulo = document.createElement('h3');
  titulo.className = 'text-lg font-semibold';
  titulo.textContent = entry.nome || entry.email || 'Mentorado sem nome';
  tituloWrapper.appendChild(titulo);
  topRow.appendChild(tituloWrapper);

  const headerActions = document.createElement('div');
  headerActions.className = 'flex items-center gap-2';
  const verMaisBtn = document.createElement('button');
  verMaisBtn.type = 'button';
  verMaisBtn.className = 'btn btn-secondary px-3 py-2 text-sm ver-mais';
  verMaisBtn.textContent = 'Ver mais';
  verMaisBtn.setAttribute('aria-expanded', 'false');
  const editarBtn = document.createElement('button');
  editarBtn.type = 'button';
  editarBtn.className = 'btn btn-primary px-3 py-2 text-sm editar';
  editarBtn.textContent = 'Editar';
  headerActions.appendChild(verMaisBtn);
  headerActions.appendChild(editarBtn);
  topRow.appendChild(headerActions);

  header.appendChild(topRow);

  const badges = document.createElement('div');
  badges.className = 'flex flex-wrap gap-2';
  if (entry.origens instanceof Set && entry.origens.has('cadastrado')) {
    const badge = document.createElement('span');
    badge.className =
      'px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700';
    badge.textContent = 'Cadastrado por você';
    badges.appendChild(badge);
  }
  if (entry.origens instanceof Set && entry.origens.has('financeiro')) {
    const badge = document.createElement('span');
    badge.className =
      'px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700';
    badge.textContent = 'Responsável financeiro';
    badges.appendChild(badge);
  }
  if (badges.children.length) header.appendChild(badges);

  const resumo = document.createElement('div');
  resumo.className =
    'flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4 text-sm text-gray-600';
  const cargoResumo = document.createElement('span');
  const metaResumo = document.createElement('span');
  resumo.appendChild(cargoResumo);
  resumo.appendChild(metaResumo);
  header.appendChild(resumo);

  card.appendChild(header);

  const details = document.createElement('div');
  details.className = 'space-y-4 hidden';

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 gap-4 md:grid-cols-2';

  const campos = [
    { label: 'Nome', field: 'nome', type: 'text', value: entry.nome || '' },
    {
      label: 'E-mail',
      field: 'email',
      type: 'email',
      value: entry.email || '',
    },
    {
      label: 'Cargo',
      field: 'cargo',
      type: 'text',
      value: entry.cargo || '',
    },
    {
      label: 'Meta de faturamento líquido',
      field: 'metaFaturamentoLiquido',
      type: 'text',
      value:
        entry.metaFaturamentoLiquido !== undefined &&
        entry.metaFaturamentoLiquido !== null
          ? entry.metaFaturamentoLiquido
          : '',
      attributes: {
        inputmode: 'decimal',
        placeholder: 'Ex: 15000 ou 15.000,00',
      },
    },
    {
      label: 'Data de início',
      field: 'dataInicio',
      type: 'date',
      value: formatDate(entry.dataInicio),
    },
    {
      label: 'Contato',
      field: 'contato',
      type: 'text',
      value: entry.contato || '',
    },
    { label: 'Loja', field: 'loja', type: 'text', value: entry.loja || '' },
    {
      label: 'Segmento',
      field: 'segmento',
      type: 'text',
      value: entry.segmento || '',
    },
    {
      label: 'Tempo de operação',
      field: 'tempoOperacao',
      type: 'text',
      value: entry.tempoOperacao || '',
    },
    {
      label: 'Link Shopee',
      field: 'linkShopee',
      type: 'text',
      value: entry.links.shopee || '',
    },
    {
      label: 'Link Mercado Livre',
      field: 'linkMercadoLivre',
      type: 'text',
      value: entry.links.mercadoLivre || '',
    },
    {
      label: 'Site próprio',
      field: 'linkSite',
      type: 'text',
      value: entry.links.site || '',
    },
    {
      label: 'Instagram',
      field: 'linkInstagram',
      type: 'text',
      value: entry.links.instagram || '',
    },
  ];

  const inputsMap = {};

  campos.forEach((c) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-1';
    const label = document.createElement('label');
    label.className = 'text-sm font-medium text-gray-700';
    label.textContent = c.label;
    const input = document.createElement('input');
    input.className = 'form-control';
    input.type = c.type;
    const value = c.value === undefined || c.value === null ? '' : c.value;
    input.value = value;
    input.dataset.field = c.field;
    if (c.attributes) {
      Object.entries(c.attributes).forEach(([attr, attrValue]) => {
        if (attrValue !== undefined && attrValue !== null) {
          input.setAttribute(attr, attrValue);
        }
      });
    }
    input.disabled = true;
    inputsMap[c.field] = input;
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    grid.appendChild(wrapper);
  });

  details.appendChild(grid);

  const objetivosWrapper = document.createElement('div');
  objetivosWrapper.className = 'space-y-1';
  const objetivosLabel = document.createElement('label');
  objetivosLabel.className = 'text-sm font-medium text-gray-700';
  objetivosLabel.textContent = 'Objetivos';
  const objetivosTextarea = document.createElement('textarea');
  objetivosTextarea.className = 'form-control';
  objetivosTextarea.style.minHeight = '96px';
  objetivosTextarea.dataset.field = 'objetivos';
  objetivosTextarea.value = entry.objetivos || '';
  objetivosTextarea.disabled = true;
  objetivosWrapper.appendChild(objetivosLabel);
  objetivosWrapper.appendChild(objetivosTextarea);
  details.appendChild(objetivosWrapper);

  const actions = document.createElement('div');
  actions.className = 'flex flex-col gap-2 sm:flex-row sm:justify-end';
  const deleteBtn = document.createElement('button');
  deleteBtn.className =
    'btn btn-secondary px-4 py-2 text-red-600 border border-red-200 hover:bg-red-50 remover';
  deleteBtn.type = 'button';
  deleteBtn.textContent = 'Excluir';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary px-4 py-2 salvar';
  saveBtn.type = 'button';
  saveBtn.textContent = 'Salvar alterações';
  saveBtn.disabled = true;
  saveBtn.classList.add('opacity-70', 'cursor-not-allowed');
  actions.appendChild(deleteBtn);
  actions.appendChild(saveBtn);
  details.appendChild(actions);

  card.appendChild(details);

  const editableFields = [
    ...Object.values(inputsMap),
    objetivosTextarea,
  ].filter(Boolean);

  const updateTitulo = () => {
    const nomeValor = inputsMap.nome ? inputsMap.nome.value.trim() : '';
    const emailValor = inputsMap.email ? inputsMap.email.value.trim() : '';
    titulo.textContent = nomeValor || emailValor || 'Mentorado sem nome';
  };

  const updateResumo = () => {
    const cargoValor = inputsMap.cargo ? inputsMap.cargo.value.trim() : '';
    cargoResumo.textContent = cargoValor
      ? `Cargo: ${cargoValor}`
      : 'Cargo: não informado';
    const metaValor = inputsMap.metaFaturamentoLiquido
      ? inputsMap.metaFaturamentoLiquido.value.trim()
      : '';
    metaResumo.textContent = metaValor
      ? `Meta de faturamento líquido: ${formatCurrencyValue(metaValor)}`
      : 'Meta de faturamento líquido: não informada';
  };

  updateTitulo();
  updateResumo();

  if (inputsMap.nome) inputsMap.nome.addEventListener('input', updateTitulo);
  if (inputsMap.email) inputsMap.email.addEventListener('input', updateTitulo);
  if (inputsMap.cargo) inputsMap.cargo.addEventListener('input', updateResumo);
  if (inputsMap.metaFaturamentoLiquido)
    inputsMap.metaFaturamentoLiquido.addEventListener('input', updateResumo);

  const toggleDetails = (forceValue) => {
    const shouldShow =
      typeof forceValue === 'boolean'
        ? forceValue
        : details.classList.contains('hidden');
    details.classList.toggle('hidden', !shouldShow);
    verMaisBtn.textContent = shouldShow ? 'Ver menos' : 'Ver mais';
    verMaisBtn.setAttribute('aria-expanded', shouldShow ? 'true' : 'false');
  };

  verMaisBtn.addEventListener('click', () => {
    if (card.dataset.editing === 'true') return;
    toggleDetails();
  });

  const toggleEditMode = (enable) => {
    const shouldEnable =
      typeof enable === 'boolean' ? enable : card.dataset.editing !== 'true';
    if (shouldEnable) {
      editableFields.forEach((field) => {
        field.dataset.originalValue = field.value;
        field.disabled = false;
      });
      saveBtn.disabled = false;
      saveBtn.classList.remove('opacity-70', 'cursor-not-allowed');
      editarBtn.textContent = 'Cancelar edição';
      verMaisBtn.disabled = true;
      verMaisBtn.classList.add('opacity-70', 'cursor-not-allowed');
      card.dataset.editing = 'true';
      toggleDetails(true);
      const firstEditable = editableFields.find(
        (field) =>
          !field.readOnly &&
          (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA'),
      );
      if (firstEditable) firstEditable.focus();
    } else {
      editableFields.forEach((field) => {
        if (field.dataset.originalValue !== undefined) {
          field.value = field.dataset.originalValue;
        }
        field.disabled = true;
      });
      saveBtn.disabled = true;
      saveBtn.classList.add('opacity-70', 'cursor-not-allowed');
      editarBtn.textContent = 'Editar';
      verMaisBtn.disabled = false;
      verMaisBtn.classList.remove('opacity-70', 'cursor-not-allowed');
      card.dataset.editing = 'false';
      updateTitulo();
      updateResumo();
    }
  };

  editarBtn.addEventListener('click', () => {
    const isEditing = card.dataset.editing === 'true';
    toggleEditMode(!isEditing);
  });

  saveBtn.addEventListener('click', (event) => {
    event.preventDefault();
    salvarPerfil(entry, card, saveBtn);
  });
  deleteBtn.addEventListener('click', (event) => {
    event.preventDefault();
    excluirPerfil(entry, deleteBtn);
  });

  if (singleUid) toggleDetails(true);

  return card;
}

async function carregarMentoradoUnico(uid) {
  try {
    const [perfilDoc, usuarioDoc] = await Promise.all([
      getDoc(doc(db, 'perfilMentorado', uid)).catch(() => null),
      getDoc(doc(db, 'usuarios', uid)).catch(() => null),
    ]);
    const perfilData =
      perfilDoc && perfilDoc.exists() ? perfilDoc.data() || {} : {};
    const entry = normalizeEntry(uid, perfilData);
    entry.id = uid;
    entry.uid = uid;
    if (usuarioDoc && usuarioDoc.exists()) {
      const dadosUsuario = usuarioDoc.data() || {};
      if (!entry.nome && dadosUsuario.nome) entry.nome = dadosUsuario.nome;
      if (!entry.email && dadosUsuario.email) entry.email = dadosUsuario.email;
      if (!entry.contato && dadosUsuario.contato)
        entry.contato = dadosUsuario.contato;
      if (!entry.contato && dadosUsuario.telefone)
        entry.contato = dadosUsuario.telefone;
      if (!entry.dataInicio && dadosUsuario.dataInicio)
        entry.dataInicio = dadosUsuario.dataInicio;
      if (!hasValue(entry.cargo) && hasValue(dadosUsuario.cargo))
        entry.cargo = dadosUsuario.cargo;
      if (
        !hasValue(entry.metaFaturamentoLiquido) &&
        hasValue(dadosUsuario.metaFaturamentoLiquido)
      )
        entry.metaFaturamentoLiquido = dadosUsuario.metaFaturamentoLiquido;
      if (
        usuarioAtual &&
        dadosUsuario.responsavelFinanceiroEmail &&
        dadosUsuario.responsavelFinanceiroEmail === usuarioAtual.email
      ) {
        entry.responsavelFinanceiroEmail = usuarioAtual.email;
      }
    } else {
      const profile = await loadUserProfile(uid);
      if (profile) {
        if (!entry.nome && profile.nome) entry.nome = profile.nome;
        if (!entry.email && profile.email) entry.email = profile.email;
        const perfilMentorado = profile.perfilMentorado || {};
        if (!entry.objetivos && perfilMentorado.objetivos)
          entry.objetivos = perfilMentorado.objetivos;
        const linksPerfil = perfilMentorado.links || {};
        entry.links.shopee = entry.links.shopee || linksPerfil.shopee || '';
        entry.links.mercadoLivre =
          entry.links.mercadoLivre || linksPerfil.mercadoLivre || '';
        entry.links.site = entry.links.site || linksPerfil.site || '';
        entry.links.instagram =
          entry.links.instagram || linksPerfil.instagram || '';
        if (!hasValue(entry.cargo) && hasValue(perfilMentorado.cargo))
          entry.cargo = perfilMentorado.cargo;
        if (
          !hasValue(entry.metaFaturamentoLiquido) &&
          hasValue(perfilMentorado.metaFaturamentoLiquido)
        )
          entry.metaFaturamentoLiquido = perfilMentorado.metaFaturamentoLiquido;
      }
    }

    if (usuarioAtual) {
      if (entry.gestorUid === usuarioAtual.uid) entry.origens.add('cadastrado');
      if (entry.responsavelFinanceiroEmail === usuarioAtual.email)
        entry.origens.add('financeiro');
    }

    if (entry.origens.size === 0) entry.origens.add('cadastrado');

    return entry;
  } catch (err) {
    console.error('Erro ao carregar mentorado:', err);
    return null;
  }
}

async function coletarMentorados(usuario) {
  const mapa = new Map();

  try {
    const cadastradosSnap = await getDocs(
      query(
        collection(db, 'perfilMentorado'),
        where('gestorUid', '==', usuario.uid),
      ),
    );
    cadastradosSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const entry = normalizeEntry(docSnap.id, data);
      entry.id = docSnap.id;
      entry.uid = data.uid || docSnap.id;
      entry.gestorUid = usuario.uid;
      entry.gestorEmail = usuario.email;
      entry.origens.add('cadastrado');
      mapa.set(docSnap.id, entry);
    });
  } catch (err) {
    console.error('Erro ao carregar mentorados cadastrados:', err);
  }

  try {
    const indicados = await fetchResponsavelFinanceiroUsuarios(
      db,
      usuario.email,
    );
    const detalhes = await Promise.all(
      indicados.map(async (info) => {
        const [perfilDoc, usuarioDoc] = await Promise.all([
          getDoc(doc(db, 'perfilMentorado', info.uid)).catch(() => null),
          getDoc(doc(db, 'usuarios', info.uid)).catch(() => null),
        ]);
        return { info, perfilDoc, usuarioDoc };
      }),
    );

    for (const { info, perfilDoc, usuarioDoc } of detalhes) {
      const key = info.uid;
      const perfilData =
        perfilDoc && perfilDoc.exists() ? perfilDoc.data() || {} : {};
      let entry = mapa.get(key);
      if (!entry) {
        entry = normalizeEntry(key, perfilData);
        entry.id = key;
        entry.uid = key;
        mapa.set(key, entry);
      }

      entry.origens.add('financeiro');
      entry.gestorUid = usuario.uid;
      entry.gestorEmail = usuario.email;
      entry.responsavelFinanceiroEmail = usuario.email;

      if (!entry.nome && (info.nome || perfilData.nome))
        entry.nome = info.nome || perfilData.nome;
      if (!entry.email && (info.email || perfilData.email))
        entry.email = info.email || perfilData.email;
      if (!entry.contato && perfilData.contato)
        entry.contato = perfilData.contato;
      if (!entry.contato && perfilData.telefone)
        entry.contato = perfilData.telefone;
      if (!entry.dataInicio && perfilData.dataInicio)
        entry.dataInicio = perfilData.dataInicio;
      if (!entry.loja && perfilData.loja) entry.loja = perfilData.loja;
      if (!entry.segmento && perfilData.segmento)
        entry.segmento = perfilData.segmento;
      if (!entry.tempoOperacao && perfilData.tempoOperacao)
        entry.tempoOperacao = perfilData.tempoOperacao;
      if (!entry.objetivos && perfilData.objetivos)
        entry.objetivos = perfilData.objetivos;
      if (!hasValue(entry.cargo) && hasValue(perfilData.cargo))
        entry.cargo = perfilData.cargo;
      if (
        !hasValue(entry.metaFaturamentoLiquido) &&
        hasValue(perfilData.metaFaturamentoLiquido)
      )
        entry.metaFaturamentoLiquido = perfilData.metaFaturamentoLiquido;

      if (perfilData.links) {
        entry.links.shopee =
          entry.links.shopee || perfilData.links.shopee || '';
        entry.links.mercadoLivre =
          entry.links.mercadoLivre || perfilData.links.mercadoLivre || '';
        entry.links.site = entry.links.site || perfilData.links.site || '';
        entry.links.instagram =
          entry.links.instagram || perfilData.links.instagram || '';
      }

      if (usuarioDoc && usuarioDoc.exists()) {
        const dadosUsuario = usuarioDoc.data() || {};
        if (!entry.nome && dadosUsuario.nome) entry.nome = dadosUsuario.nome;
        if (!entry.email && dadosUsuario.email)
          entry.email = dadosUsuario.email;
        if (!entry.contato && dadosUsuario.contato)
          entry.contato = dadosUsuario.contato;
        if (!entry.contato && dadosUsuario.telefone)
          entry.contato = dadosUsuario.telefone;
        if (!entry.dataInicio && dadosUsuario.dataInicio)
          entry.dataInicio = dadosUsuario.dataInicio;
        if (!hasValue(entry.cargo) && hasValue(dadosUsuario.cargo))
          entry.cargo = dadosUsuario.cargo;
        if (
          !hasValue(entry.metaFaturamentoLiquido) &&
          hasValue(dadosUsuario.metaFaturamentoLiquido)
        )
          entry.metaFaturamentoLiquido = dadosUsuario.metaFaturamentoLiquido;
        if (dadosUsuario.responsavelFinanceiroEmail === usuario.email) {
          entry.responsavelFinanceiroEmail = usuario.email;
        }
      }

      mapa.set(key, entry);
    }
  } catch (err) {
    console.error('Erro ao carregar usuários vinculados financeiramente:', err);
  }

  return Array.from(mapa.values());
}

async function carregarPerfis() {
  if (!usuarioAtual) return;
  carregandoLista = true;

  const lista = document.getElementById('perfilMentoradoList');
  const statusEl = document.getElementById('perfilMentoradoStatus');
  if (!lista) {
    carregandoLista = false;
    return;
  }

  lista.innerHTML =
    '<p class="text-sm text-gray-500">Carregando mentorados...</p>';
  if (statusEl) statusEl.textContent = '';

  try {
    if (singleUid) {
      toggleNovoMentoradoSection(false);
      const entry = await carregarMentoradoUnico(singleUid);
      lista.innerHTML = '';
      if (entry) {
        lista.appendChild(createPerfilCard(entry));
      } else {
        lista.innerHTML =
          '<p class="text-sm text-red-500">Mentorado não encontrado ou sem permissões de visualização.</p>';
      }
      return;
    }

    toggleNovoMentoradoSection(true);
    const entries = await coletarMentorados(usuarioAtual);
    lista.innerHTML = '';

    if (!entries.length) {
      lista.innerHTML =
        '<p class="text-sm text-gray-500">Nenhum mentorado vinculado até o momento.</p>';
      if (statusEl) statusEl.textContent = '0 mentorados';
      return;
    }

    entries.sort((a, b) => {
      const nomeA = (a.nome || a.email || '').toLowerCase();
      const nomeB = (b.nome || b.email || '').toLowerCase();
      return nomeA.localeCompare(nomeB);
    });

    entries.forEach((entry) => {
      if (!(entry.origens instanceof Set))
        entry.origens = new Set(entry.origens || []);
      lista.appendChild(createPerfilCard(entry));
    });

    if (statusEl) {
      const total = entries.length;
      statusEl.textContent = `${total} mentorado${total === 1 ? '' : 's'} vinculado${
        total === 1 ? '' : 's'
      }`;
    }
  } catch (err) {
    console.error('Erro ao carregar lista de mentorados:', err);
    lista.innerHTML =
      '<p class="text-sm text-red-500">Não foi possível carregar os mentorados neste momento.</p>';
  } finally {
    carregandoLista = false;
  }
}

function registrarFormNovoMentorado() {
  const form = document.getElementById('novoMentoradoForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!usuarioAtual) {
      alert('Faça login para cadastrar um mentorado.');
      return;
    }

    const formData = new FormData(form);
    const nome = (formData.get('novoNome') || '').trim();
    const email = (formData.get('novoEmail') || '').trim();
    const dataInicio = (formData.get('novoDataInicio') || '').trim();
    const contato = (formData.get('novoContato') || '').trim();
    const cargo = (formData.get('novoCargo') || '').trim();
    const metaInput = (formData.get('novoMeta') || '').trim();
    const metaNormalizada = normalizeMetaInput(metaInput);

    if (!nome || !email) {
      alert('Informe pelo menos o nome e o e-mail do mentorado.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    setLoading(submitBtn, true, 'Salvando...');

    const payload = {
      nome,
      email,
      gestorUid: usuarioAtual.uid,
      gestorEmail: usuarioAtual.email,
      criadoPeloGestor: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (dataInicio) payload.dataInicio = dataInicio;
    if (contato) payload.contato = contato;
    if (cargo) payload.cargo = cargo;
    if (!metaNormalizada.shouldDelete)
      payload.metaFaturamentoLiquido = metaNormalizada.value;

    try {
      await addDoc(collection(db, 'perfilMentorado'), payload);
      alert('Mentorado cadastrado com sucesso!');
      form.reset();
      await carregarPerfis();
    } catch (err) {
      console.error('Erro ao cadastrar mentorado:', err);
      alert('Não foi possível cadastrar o mentorado. Tente novamente.');
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

function initPerfilMentorado() {
  registrarFormNovoMentorado();
  if (singleUid) toggleNovoMentoradoSection(false);
  onAuthStateChanged(auth, (user) => {
    if (user) {
      usuarioAtual = user;
      carregarPerfis();
    }
  });
}

window.initPerfilMentorado = initPerfilMentorado;
