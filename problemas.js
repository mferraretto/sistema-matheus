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
  document.getElementById('pecasForm')?.addEventListener('submit', salvarPeca);
  carregarPecas();
});

async function salvarPeca(ev) {
  ev.preventDefault();
  const form = ev.target;
  const registro = {
    data: form.data.value,
    nomeCliente: form.nomeCliente.value.trim(),
    numero: form.numero.value.trim(),
    apelido: form.apelido.value.trim(),
    nf: form.nf.value.trim(),
    loja: form.loja.value.trim(),
    peca: form.peca.value.trim(),
    valorGasto: 0,
    status: 'NÃO FEITO'
  };
  if (!registro.data || !registro.nomeCliente || !registro.numero || !registro.peca) {
    alert('Preencha os campos obrigatórios.');
    return;
  }
  const colRef = collection(db, `uid/${uidAtual}/problemas/pecasfaltando/itens`);
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
  const colRef = collection(db, `uid/${uidAtual}/problemas/pecasfaltando/itens`);
  const snap = await getDocs(colRef);
  const dados = snap.docs.map(d => d.data()).sort((a,b) => (a.data||'').localeCompare(b.data||''));
  dados.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${formatarData(d.data)}</td>
      <td class="p-2">${d.nomeCliente || ''}</td>
      <td class="p-2">${d.apelido || ''}</td>
      <td class="p-2">${d.numero || ''}</td>
      <td class="p-2">${d.loja || ''}</td>
      <td class="p-2">${d.peca || ''}</td>
      <td class="p-2 text-right">R$ ${(Number(d.valorGasto)||0).toFixed(2)}</td>
      <td class="p-2">${d.status || ''}</td>`;
    tbody.appendChild(tr);
  });
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
