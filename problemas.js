import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, doc, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import { setDocWithCopy } from './secure-firestore.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let uidAtual = null;

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  uidAtual = user.uid;
  const dataInput = document.getElementById('data');
  if (dataInput) dataInput.value = new Date().toISOString().split('T')[0];
  const dataRInput = document.getElementById('dataR');
  if (dataRInput) dataRInput.value = new Date().toISOString().split('T')[0];
    document.getElementById('pecasForm')?.addEventListener('submit', salvarPeca);
    document.getElementById('limparForm')?.addEventListener('click', () => {
      const form = document.getElementById('pecasForm');
      if (form) {
        form.reset();
        const dataInput = document.getElementById('data');
        if (dataInput) dataInput.value = new Date().toISOString().split('T')[0];
      }
    });
    document.getElementById('reembolsosForm')?.addEventListener('submit', salvarReembolso);
  document.getElementById('filtroData')?.addEventListener('change', carregarPecas);
  document.getElementById('filtroStatus')?.addEventListener('change', carregarPecas);
  document.getElementById('limparFiltros')?.addEventListener('click', ev => {
    ev.preventDefault();
    const fd = document.getElementById('filtroData');
    const fs = document.getElementById('filtroStatus');
    if (fd) fd.value = '';
    if (fs) fs.value = '';
    carregarPecas();
  });
  carregarPecas();
  carregarReembolsos();
});

async function salvarPeca(ev) {
  ev.preventDefault();
  const form = ev.target;
  const registro = {
    data: form.data.value,
    nomeCliente: '',
    numero: form.numero.value.trim(),
    apelido: form.apelido.value.trim(),
    nf: form.nf.value.trim(),
    loja: form.loja.value.trim(),
    peca: form.peca.value.trim(),
    valorGasto: 0,
    status: 'NÃO FEITO'
  };
  if (!registro.data || !registro.numero || !registro.peca) {
    alert('Preencha os campos obrigatórios.');
    return;
  }
  // Estrutura correta de coleção -> documento -> subcoleção
  const baseDoc = doc(db, 'uid', uidAtual, 'problemas', 'pecasfaltando');
  const colRef = collection(baseDoc, 'itens');
  const ref = doc(colRef);
  await setDocWithCopy(ref, registro, uidAtual);
  form.reset();
  const dataInput = document.getElementById('data');
  if (dataInput) dataInput.value = new Date().toISOString().split('T')[0];
  carregarPecas();
}

async function carregarPecas() {
  const tbody = document.getElementById('pecasTableBody');
  if (!tbody || !uidAtual) return;
  tbody.innerHTML = '';
  const baseDoc = doc(db, 'uid', uidAtual, 'problemas', 'pecasfaltando');
  const colRef = collection(baseDoc, 'itens');
  const snap = await getDocs(colRef);
  const dados = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  const filtroData = document.getElementById('filtroData')?.value;
  const filtroStatus = document.getElementById('filtroStatus')?.value;
  const filtrados = dados.filter(d => {
    const dataOk = filtroData ? d.data === filtroData : true;
    const statusOk = filtroStatus ? d.status === filtroStatus : true;
    return dataOk && statusOk;
  });
  filtrados.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${formatarData(d.data)}</td>
      <td class="p-2"><input type="text" class="nome-input border rounded p-1 w-full" data-id="${d.id}" value="${d.nomeCliente || ''}"></td>
      <td class="p-2">${d.apelido || ''}</td>
      <td class="p-2">${d.numero || ''}</td>
      <td class="p-2">${d.loja || ''}</td>
      <td class="p-2">${d.peca || ''}</td>
      <td class="p-2">${d.nf || ''}</td>
      <td class="p-2 text-right">
        <div class="flex items-center justify-end">
          <span class="mr-1">R$</span>
          <input type="number" step="0.01" class="valor-input border rounded p-1 w-24 text-right" data-id="${d.id}" value="${(Number(d.valorGasto) || 0).toFixed(2)}">
        </div>
      </td>
      <td class="p-2">
        <select class="status-select border rounded p-1" data-id="${d.id}">
          <option value="NÃO FEITO" ${d.status === 'NÃO FEITO' ? 'selected' : ''}>NÃO FEITO</option>
          <option value="ENVIADO" ${d.status === 'ENVIADO' ? 'selected' : ''}>ENVIADO</option>
      <option value="FEITO" ${d.status === 'FEITO' ? 'selected' : ''}>FEITO</option>
      </select>
    </td>`;
    aplicarCorLinha(tr, d.status);
    const select = tr.querySelector('.status-select');
    select.addEventListener('change', async (ev) => {
      const newStatus = ev.target.value;
      const { id, ...rest } = d;
      await setDocWithCopy(doc(colRef, id), { ...rest, status: newStatus }, uidAtual);
      d.status = newStatus;
      aplicarCorLinha(tr, newStatus);
    });

    const nomeInput = tr.querySelector('.nome-input');
    nomeInput.addEventListener('change', async (ev) => {
      const newNome = ev.target.value.trim();
      const { id, ...rest } = d;
      await setDocWithCopy(doc(colRef, id), { ...rest, nomeCliente: newNome }, uidAtual);
      d.nomeCliente = newNome;
    });

    const valorInput = tr.querySelector('.valor-input');
    valorInput.addEventListener('change', async (ev) => {
      const newValor = parseFloat(ev.target.value) || 0;
      const { id, ...rest } = d;
      await setDocWithCopy(doc(colRef, id), { ...rest, valorGasto: newValor }, uidAtual);
      d.valorGasto = newValor;
      ev.target.value = newValor.toFixed(2);
    });
    tbody.appendChild(tr);
  });
}

async function salvarReembolso(ev) {
  ev.preventDefault();
  const form = ev.target;
  const registro = {
    data: form.data.value,
    numero: form.numero.value.trim(),
    apelido: form.apelido.value.trim(),
    nf: form.nf.value.trim(),
    loja: form.loja.value.trim(),
    problema: form.problema.value.trim(),
    valor: parseFloat(form.valor.value) || 0
  };
  if (!registro.data || !registro.numero || !registro.problema) {
    alert('Preencha os campos obrigatórios.');
    return;
  }
  const baseDoc = doc(db, 'uid', uidAtual, 'problemas', 'reembolsos');
  const colRef = collection(baseDoc, 'itens');
  const ref = doc(colRef);
  await setDocWithCopy(ref, registro, uidAtual);
  form.reset();
  const dataRInput = document.getElementById('dataR');
  if (dataRInput) dataRInput.value = new Date().toISOString().split('T')[0];
  carregarReembolsos();
}

async function carregarReembolsos() {
  const tbody = document.getElementById('reembolsosTableBody');
  if (!tbody || !uidAtual) return;
  tbody.innerHTML = '';
  const baseDoc = doc(db, 'uid', uidAtual, 'problemas', 'reembolsos');
  const colRef = collection(baseDoc, 'itens');
  const snap = await getDocs(colRef);
  const dados = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  dados.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${formatarData(d.data)}</td>
      <td class="p-2">${d.numero || ''}</td>
      <td class="p-2">${d.apelido || ''}</td>
      <td class="p-2">${d.nf || ''}</td>
      <td class="p-2">${d.loja || ''}</td>
      <td class="p-2">${d.problema || ''}</td>
      <td class="p-2 text-right">R$ ${(Number(d.valor) || 0).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function aplicarCorLinha(tr, status) {
  tr.classList.remove('bg-white','bg-yellow-100','bg-green-100');
  if (status === 'FEITO') {
    tr.classList.add('bg-yellow-100');
  } else if (status === 'ENVIADO') {
    tr.classList.add('bg-green-100');
  } else {
    tr.classList.add('bg-white');
  }
}

function formatarData(str) {
  if (!str) return '';
  const [ano, mes, dia] = str.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Tabs
for (const btn of document.querySelectorAll('.tab-btn')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('bg-orange-500','text-white','active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.add('bg-gray-200'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('bg-orange-500','text-white','active');
    btn.classList.remove('bg-gray-200');
    document.getElementById(btn.dataset.tab).classList.remove('hidden');
  });
}
