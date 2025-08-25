import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, addDoc, updateDoc, doc, getDocs, getDoc, query, where, onSnapshot, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { decryptString } from './crypto.js';

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
    const snap = await getDocs(query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', currentUser.email)));
    if (snap.empty) {
      card?.classList.add('hidden');
      return;
    }
    card?.classList.remove('hidden');
    snap.forEach(d => {
      const dados = d.data();
      const nome = dados.nome || dados.email || d.id;
      usuariosResponsaveis.push({ uid: d.id, nome });
      if (select) {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = nome;
        select.appendChild(opt);
      }
      if (lista) {
        const li = document.createElement('li');
        li.textContent = `${nome} - ${dados.email || ''}`;
        lista.appendChild(li);
      }
    });
    carregarHistoricoFaturamento();
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
  }
}

async function calcularFaturamentoDiaDetalhado(uid, dia) {
  const lojasSnap = await getDocs(collection(db, `uid/${uid}/faturamento/${dia}/lojas`));
  let liquido = 0;
  let bruto = 0;
  for (const lojaDoc of lojasSnap.docs) {
    let dados = lojaDoc.data();
    if (dados.encrypted) {
      const pass = getPassphrase() || `chave-${uid}`;
      let txt;
      try {
        txt = await decryptString(dados.encrypted, pass);
      } catch (e) {
        try { txt = await decryptString(dados.encrypted, uid); } catch (_) {}
      }
      if (txt) dados = JSON.parse(txt);
    }
    liquido += Number(dados.valorLiquido) || 0;
    bruto += Number(dados.valorBruto) || 0;
  }
  return { liquido, bruto };
}

async function calcularVendasDia(uid, dia) {
  const skusSnap = await getDocs(collection(db, `uid/${uid}/skusVendidos/${dia}/lista`));
  let total = 0;
  skusSnap.forEach(doc => {
    const dados = doc.data();
    total += Number(dados.total || dados.quantidade) || 0;
  });
  return total;
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
    let metaDiaria = 0;
    try {
      const metaDoc = await getDoc(doc(db, `uid/${u.uid}/metasFaturamento`, mesAtual));
      if (metaDoc.exists()) {
        const metaMensal = Number(metaDoc.data().valor) || 0;
        metaDiaria = totalDiasMes ? metaMensal / totalDiasMes : 0;
      }
    } catch (_) {}
    const fatSnap = await getDocs(collection(db, `uid/${u.uid}/faturamento`));
    const dias = fatSnap.docs.map(d => d.id).sort().slice(-3);
    let ultimoLiquido = 0;
    const col = document.createElement('div');
    col.className = 'min-w-[200px]';
    col.innerHTML = `<h3 class="font-bold">${u.nome}</h3><div class="text-xs text-gray-500 mb-2">META LIQUIDA R$ ${metaDiaria.toLocaleString('pt-BR')}</div>`;
    for (const dia of dias) {
      const { liquido, bruto } = await calcularFaturamentoDiaDetalhado(u.uid, dia);
      ultimoLiquido = liquido;
      const vendas = await calcularVendasDia(u.uid, dia);
      col.innerHTML += `\n        <div class="mt-2">${formatarData(dia)}</div>\n        <div>Bruto R$ ${bruto.toLocaleString('pt-BR')}</div>\n        <div>Líquido R$ ${liquido.toLocaleString('pt-BR')}</div>\n        <div>Vendas ${vendas}</div>`;
    }
    const diff = metaDiaria - ultimoLiquido;
    const atingido = diff <= 0;
    const msg = atingido ? `ATINGIDO R$ ${Math.abs(diff).toLocaleString('pt-BR')} POSITIVO` : `NÃO ATINGIDO R$ ${diff.toLocaleString('pt-BR')} NEGATIVO`;
    col.innerHTML += `<div class="mt-2 font-bold ${atingido ? 'text-green-600' : 'text-red-600'}">${msg}</div>`;
    container.appendChild(col);
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
