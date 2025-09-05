import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, addDoc, updateDoc, doc, getDocs, getDoc, query, where, onSnapshot, orderBy, serverTimestamp, limit } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { decryptString } from './crypto.js';
import { fetchResponsavelFinanceiroUsuarios } from './responsavel-financeiro.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

let currentUser = null;
let initialLoad = true;
let usuariosResponsaveis = [];

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `fixed bottom-4 right-4 px-4 py-4 rounded-lg shadow-lg text-white ${
    type === 'success' ? 'bg-green-500' :
    type === 'error' ? 'bg-red-500' :
    type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
  }`;
  notification.innerHTML = `
    <div class="flex items-center">
      <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-2"></i>
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  currentUser = user;
  await carregarUsuarios();
  carregarExpedicao();
  carregarAtualizacoes();
});

async function carregarUsuarios() {
  const select = document.getElementById('destinatarios');
  const card = document.getElementById('usuariosResponsaveisCard');
  const lista = document.getElementById('usuariosResponsaveisLista');
  if (select) select.innerHTML = '';
  if (lista) lista.innerHTML = '';
  usuariosResponsaveis = [];
    try {
      const listaUsuarios = await fetchResponsavelFinanceiroUsuarios(db, currentUser.email);
      if (!listaUsuarios.length) {
        card?.classList.add('hidden');
        return;
      }
      card?.classList.remove('hidden');
      listaUsuarios.forEach(u => {
        usuariosResponsaveis.push({ uid: u.uid, nome: u.nome });
        if (select) {
          const opt = document.createElement('option');
          opt.value = u.uid;
          opt.textContent = u.nome;
          select.appendChild(opt);
        }
        if (lista) {
          const li = document.createElement('li');
          li.className = 'flex items-center gap-2';
          const avatar = `<div class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-medium">${(u.nome || '?').charAt(0).toUpperCase()}</div>`;
          li.innerHTML = `${avatar}<span>${u.nome}</span>`;
          lista.appendChild(li);
        }
      });
      carregarHistoricoFaturamento();
      carregarTotais();
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
}

async function calcularFaturamentoDiaDetalhado(responsavelUid, uid, dia) {
  const lojasSnap = await getDocs(collection(db, 'uid', responsavelUid, 'uid', uid, 'faturamento', dia, 'lojas'));
  let liquido = 0;
  let bruto = 0;
  for (const lojaDoc of lojasSnap.docs) {
    let dados = lojaDoc.data();
    if (dados.encrypted) {
      let txt;
      const candidates = [getPassphrase(), currentUser?.email, `chave-${uid}`, uid];
      for (const p of candidates) {
        if (!p) continue;
        try {
          txt = await decryptString(dados.encrypted, p);
          if (txt) break;
        } catch (_) {}
      }
      if (txt) dados = JSON.parse(txt);
    }
    liquido += Number(dados.valorLiquido) || 0;
    bruto += Number(dados.valorBruto) || 0;
  }
  return { liquido, bruto };
}

async function calcularVendasDia(responsavelUid, uid, dia) {
  try {
    const lojasSnap = await getDocs(collection(db, 'uid', responsavelUid, 'uid', uid, 'faturamento', dia, 'lojas'));
    let total = 0;
    for (const lojaDoc of lojasSnap.docs) {
      let dados = lojaDoc.data();
      if (dados.encrypted) {
        let txt;
        const candidates = [getPassphrase(), currentUser?.email, `chave-${uid}`, uid];
        for (const p of candidates) {
          if (!p) continue;
          try {
            txt = await decryptString(dados.encrypted, p);
            if (txt) break;
          } catch (_) {}
        }
        if (txt) dados = JSON.parse(txt);
      }
      total += Number(dados.qtdVendas || dados.quantidade) || 0;
    }
    return total;
  } catch (e) {
    console.error('Erro ao calcular vendas do dia:', e);
    return 0;
  }
}

function formatarData(str) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(str);
  if (!m) return str;
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${m[3]}/${meses[Number(m[2]) - 1]}`;
}

async function carregarHistoricoFaturamento() {
  const card = document.getElementById('historicoFaturamentoCard');
  const container = document.getElementById('historicoFaturamento');
  if (!card || !container) return;
  container.innerHTML = '';
  if (!usuariosResponsaveis.length) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  const mesAtual = new Date().toISOString().slice(0,7);
  const ano = new Date().getFullYear();
  const mesNum = new Date().getMonth() + 1;
  const totalDiasMes = new Date(ano, mesNum, 0).getDate();
  for (const u of usuariosResponsaveis) {
    let metaMensal = 0;
    try {
      const metaDoc = await getDoc(doc(db, 'uid', currentUser.uid, 'uid', u.uid, 'metasFaturamento', mesAtual));
      if (metaDoc.exists()) metaMensal = Number(metaDoc.data().valor) || 0;
    } catch (_) {}
    const metaDiaria = totalDiasMes ? metaMensal / totalDiasMes : 0;

    const fatSnap = await getDocs(collection(db, 'uid', currentUser.uid, 'uid', u.uid, 'faturamento'));
    const dias = fatSnap.docs.map(d => d.id).sort().slice(-3);

    const col = document.createElement('div');
    col.className = 'faturamento-col';

    const header = document.createElement('div');
    header.className = 'faturamento-header';
    header.innerHTML = `<div>${u.nome}</div><div>META R$ ${metaMensal.toLocaleString('pt-BR')}</div>`;
    col.appendChild(header);

    for (const dia of dias) {
      const { liquido, bruto } = await calcularFaturamentoDiaDetalhado(currentUser.uid, u.uid, dia);
      const vendas = await calcularVendasDia(currentUser.uid, u.uid, dia);
      const diff = metaDiaria - liquido;
      const atingido = diff <= 0;
      const day = document.createElement('div');
      day.className = 'faturamento-dia';
      day.innerHTML = `
        <div class="dia-data">${formatarData(dia)}</div>
        <div>Bruto: <span class="valor">R$ ${bruto.toLocaleString('pt-BR')}</span></div>
        <div>Líquido: <span class="valor">R$ ${liquido.toLocaleString('pt-BR')}</span></div>
        <div>Qtd: <span class="valor">${vendas}</span></div>
        <div class="resultado ${atingido ? 'positivo' : 'negativo'}">${atingido ? 'POSITIVO' : 'NEGATIVO'}${diff ? ` R$ ${Math.abs(diff).toLocaleString('pt-BR')}` : ''}</div>
      `;
      col.appendChild(day);
    }

    container.appendChild(col);
  }
}

async function carregarTotais() {
  const container = document.getElementById('resumoTotais');
  if (!container) return;
  container.innerHTML = '';
  if (!usuariosResponsaveis.length) return;
  let totalBruto = 0, totalLiquido = 0, totalPedidos = 0, totalMeta = 0;
  const hoje = new Date();
  const diaStr = hoje.toISOString().split('T')[0];
  const mesAtual = hoje.toISOString().slice(0,7);
  const totalDiasMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  for (const u of usuariosResponsaveis) {
    const { bruto, liquido } = await calcularFaturamentoDiaDetalhado(currentUser.uid, u.uid, diaStr);
    const pedidos = await calcularVendasDia(currentUser.uid, u.uid, diaStr);
    totalBruto += bruto;
    totalLiquido += liquido;
    totalPedidos += pedidos;
    try {
      const metaDoc = await getDoc(doc(db, 'uid', currentUser.uid, 'uid', u.uid, 'metasFaturamento', mesAtual));
      if (metaDoc.exists()) {
        const metaMensal = Number(metaDoc.data().valor) || 0;
        totalMeta += totalDiasMes ? metaMensal / totalDiasMes : 0;
      }
    } catch (_) {}
  }
  const cards = [
    { label: 'Bruto', valor: `R$ ${totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
    { label: 'Líquido', valor: `R$ ${totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
    { label: 'Pedidos', valor: totalPedidos.toLocaleString('pt-BR') },
    { label: 'Meta', valor: `R$ ${totalMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }
  ];
  cards.forEach(c => {
    const div = document.createElement('div');
    div.className = 'card text-center';
    div.innerHTML = `<div class="text-sm text-gray-500">${c.label}</div><div class="text-lg font-semibold">${c.valor}</div>`;
    container.appendChild(div);
  });
}

async function carregarExpedicao() {
  const card = document.getElementById('expedicaoCard');
  const container = document.getElementById('expedicaoAtualizacoes');
  if (!card || !container) return;
  container.innerHTML = '';
  const limiteData = new Date();
  limiteData.setDate(limiteData.getDate() - 3);
  try {
    const q = query(collection(db, 'expedicaoMensagens'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    let count = 0;
    snap.forEach(docSnap => {
      const dados = docSnap.data();
      const dests = dados.destinatarios || [];
      if (currentUser && !dests.includes(currentUser.uid) && dados.gestorUid !== currentUser.uid) return;
      const dataHora = dados.createdAt?.toDate ? dados.createdAt.toDate() : null;
      if (!dataHora || dataHora < limiteData) return;
      const item = document.createElement('div');
      item.className = 'p-2 border rounded';
      item.innerHTML = `<div>Qtd não expedida: ${dados.quantidade}</div>` +
        `${dados.motivo ? `<div>Motivo: ${dados.motivo}</div>` : ''}` +
        `<div class="text-xs text-gray-500">${dataHora.toLocaleString('pt-BR')}</div>`;
      container.appendChild(item);
      count++;
    });
    if (count) card.classList.remove('hidden'); else card.classList.add('hidden');
  } catch (e) {
    console.error('Erro ao carregar expedição:', e);
  }
}

document.getElementById('formAtualizacao')?.addEventListener('submit', enviarAtualizacao);

async function enviarAtualizacao(e) {
  e.preventDefault();
  if (!currentUser) return;
  const descricao = document.getElementById('descricao').value.trim();
  const destinatarios = Array.from(document.getElementById('destinatarios').selectedOptions).map(o => o.value);
  if (!destinatarios.includes(currentUser.uid)) destinatarios.push(currentUser.uid);
  const arquivos = document.getElementById('arquivos').files;
  const docRef = await addDoc(collection(db, 'financeiroAtualizacoes'), {
    descricao,
    autorUid: currentUser.uid,
    autorNome: currentUser.displayName || currentUser.email,
    destinatarios,
    tipo: 'atualizacao',
    createdAt: serverTimestamp(),
    anexos: []
  });
  const anexos = [];
  for (const file of arquivos) {
    const path = `financeiroAtualizacoes/${currentUser.uid}/${docRef.id}/${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    anexos.push({ nome: file.name, url });
  }
  if (anexos.length) {
    await updateDoc(docRef, { anexos });
  }
  document.getElementById('descricao').value = '';
  Array.from(document.getElementById('destinatarios').options).forEach(o => o.selected = false);
  document.getElementById('arquivos').value = '';
}

function carregarAtualizacoes() {
  const lista = document.getElementById('listaAtualizacoes');
  if (!lista) return;
  const colRef = collection(db, 'financeiroAtualizacoes');
  const q = query(colRef, orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    if (!initialLoad) {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const dests = data.destinatarios || [];
          if (data.autorUid !== currentUser.uid && dests.includes(currentUser.uid) && data.tipo === 'faturamento') {
            showNotification(data.descricao || 'Novo faturamento registrado');
          }
        }
      });
    }
    lista.innerHTML = '';
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const dests = data.destinatarios || [];
      if (data.autorUid !== currentUser.uid && !dests.includes(currentUser.uid)) return;
      lista.appendChild(renderCard(docSnap.id, data));
    });
    initialLoad = false;
  });
}

function renderCard(id, data) {
  const card = document.createElement('div');
  card.className = 'card p-4';
  const dataStr = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString('pt-BR') : '';
  const anexosHtml = (data.anexos || []).map(a => `<a href="${a.url}" target="_blank" class="text-blue-500 underline block">${a.nome}</a>`).join('');
  card.innerHTML = `
    <p class="text-sm text-gray-500">${dataStr}</p>
    <p class="font-medium">${data.autorNome || ''}</p>
    <p class="mb-2">${data.descricao || ''}</p>
    ${anexosHtml}
  `;
  return card;
}
