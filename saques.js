import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { decryptString } from './crypto.js';
import { saveSecureDoc, loadSecureDoc } from './secure-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  await carregarSaques();
});

export async function registrarSaque() {
  const data = document.getElementById('dataSaque').value;
  const loja = document.getElementById('lojaSaque').value.trim();
  const valor = parseFloat(document.getElementById('valorSaque').value);
  const comissao = parseFloat(document.getElementById('comissaoSaque').value) || 0;

  if (!data || !loja || isNaN(valor) || valor <= 0) {
    alert('Preencha data, loja e valor corretamente.');
    return;
  }

  const uid = auth.currentUser.uid;
  const pass = getPassphrase() || `chave-${uid}`;
  const lojaId = loja.replace(/[.#$/\[\]]/g, '_');

  await saveSecureDoc(
    db,
    `uid/${uid}/saques/${data}/lojas`,
    lojaId,
    { loja, valor, comissao, uid },
    pass
  );

  const snap = await getDocs(collection(db, `uid/${uid}/saques/${data}/lojas`));
  let total = 0;
  for (const d of snap.docs) {
    const enc = d.data().encrypted;
    if (!enc) continue;
    const txt = await decryptString(enc, pass);
    const obj = JSON.parse(txt);
    total += obj.valor || 0;
  }

  const existente = await loadSecureDoc(db, `uid/${uid}/saques`, data, pass);
  const pago = existente?.pago || false;

  await saveSecureDoc(
    db,
    `uid/${uid}/saques`,
    data,
    { data, valorTotal: total, pago, uid },
    pass
  );

  document.getElementById('valorSaque').value = '';
  document.getElementById('lojaSaque').value = '';
  document.getElementById('comissaoSaque').value = '';
  await carregarSaques();
}

export async function carregarSaques() {
  const container = document.getElementById('listaSaques');
  if (!container) return;
  container.innerHTML = '<p>Carregando...</p>';

  const filtroMes = document.getElementById('filtroMesSaques')?.value;
  const modo = document.getElementById('modoVisualizacaoSaques')?.value || 'cards';
  const uid = auth.currentUser.uid;
  const pass = getPassphrase() || `chave-${uid}`;
  const snap = await getDocs(collection(db, `uid/${uid}/saques`));
  container.innerHTML = '';
  container.className = modo === 'cards'
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4'
    : 'p-4 space-y-2';

  for (const docSnap of snap.docs) {
    const dados = await loadSecureDoc(db, `uid/${uid}/saques`, docSnap.id, pass);
    if (!dados) continue;
    if (filtroMes) {
      const [anoF, mesF] = filtroMes.split('-');
      const [ano, mes] = docSnap.id.split('-');
      if (ano !== anoF || mes !== mesF) continue;
    }
    const total = dados.valorTotal || 0;
    const pago = !!dados.pago;
    const statusClass = pago ? 'border bg-green-100 border-green-300' : 'border bg-yellow-100 border-yellow-300';
    const statusText = pago ? 'Pago' : 'Em aberto';

    let elem;
    if (modo === 'cards') {
      elem = document.createElement('div');
      elem.className = `${statusClass} rounded-2xl shadow-lg p-4 hover:shadow-xl transition`;
      elem.innerHTML = `
        <div class="flex justify-between items-center mb-2">
          <div class="text-sm text-gray-500 flex items-center gap-2">
            <i class="fas fa-calendar-alt text-blue-600"></i>
            <span class="font-semibold">${docSnap.id}</span>
          </div>
          <label class="inline-flex items-center text-sm">
            <input type="checkbox" onchange="alternarPago('${docSnap.id}')" ${pago ? 'checked' : ''}>
            <span class="ml-1">${statusText}</span>
          </label>
        </div>
        <div class="text-xl font-bold text-green-600 mb-2">R$ ${total.toLocaleString('pt-BR')}</div>
        <div class="flex justify-between items-center">
          <button onclick="mostrarDetalhesSaque('${docSnap.id}')" class="btn btn-outline">
            <i class="fas fa-eye"></i> Ver Detalhes
          </button>
        </div>
        <div id="detalhes-${docSnap.id}" class="mt-3 text-sm text-gray-700" style="display:none;"></div>
      `;
   } else {
      elem = document.createElement('div');
      elem.className = `${statusClass} rounded-lg p-3`;
      elem.innerHTML = `
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-2">
        <input type="checkbox" class="selecionar-saque" data-saquedata="${docSnap.id}">
        <div class="text-sm text-gray-500 flex items-center gap-2 font-semibold">
          <i class="fas fa-calendar-alt text-blue-600"></i>${docSnap.id}
        </div>
      </div>
      <label class="inline-flex items-center text-sm">
        <input type="checkbox" onchange="alternarPago('${docSnap.id}')" ${pago ? 'checked' : ''}>
        <span class="ml-1">${statusText}</span>
      </label>
    </div>
    <div class="flex justify-between items-center mt-1">
      <div class="text-lg font-bold text-green-600">R$ ${total.toLocaleString('pt-BR')}</div>
      <button onclick="mostrarDetalhesSaque('${docSnap.id}')" class="btn btn-outline text-sm"><i class="fas fa-eye"></i></button>
    </div>
    <div id="detalhes-${docSnap.id}" class="mt-2 text-sm text-gray-700" style="display:none;"></div>
  `;
    }
    container.appendChild(elem);
  }
  if (!container.children.length) {
    container.innerHTML = '<p class="text-gray-500">Nenhum saque encontrado</p>';
  }
const oldControls = document.getElementById('acoesSelecionados');
 if (oldControls) oldControls.remove();
 const controls = document.createElement('div');
 controls.id = 'acoesSelecionados';
 controls.className = 'flex flex-wrap gap-2 mt-4';

 const resumoBtn = document.createElement('button');
 resumoBtn.textContent = 'Ver Resumo Selecionados';
 resumoBtn.className = 'btn btn-primary';
 resumoBtn.onclick = mostrarResumoSelecionados;

 const excluirBtn = document.createElement('button');
 excluirBtn.textContent = 'Excluir Selecionados';
 excluirBtn.className = 'btn btn-danger';
 excluirBtn.onclick = excluirSaquesSelecionados;

 const excelBtn = document.createElement('button');
 excelBtn.textContent = 'Exportar Excel';
 excelBtn.className = 'btn btn-outline';
 excelBtn.onclick = () => exportarSelecionados('excel');

 const pdfBtn = document.createElement('button');
 pdfBtn.textContent = 'Exportar PDF';
 pdfBtn.className = 'btn btn-outline';
 pdfBtn.onclick = () => exportarSelecionados('pdf');

 controls.append(resumoBtn, excluirBtn, excelBtn, pdfBtn);
 container.parentElement.appendChild(controls);
}

export async function mostrarDetalhesSaque(dataRef) {
  const detalhesEl = document.getElementById('detalhes-' + dataRef);
  if (detalhesEl.style.display === 'block') {
    detalhesEl.style.display = 'none';
    return;
  }
  detalhesEl.innerHTML = '<div class="text-sm text-gray-500">Carregando...</div>';
  detalhesEl.style.display = 'block';

  const uid = auth.currentUser.uid;
  const pass = getPassphrase() || `chave-${uid}`;
  const snap = await getDocs(collection(db, `uid/${uid}/saques/${dataRef}/lojas`));
  let html = '';
  for (const docSnap of snap.docs) {
    const enc = docSnap.data().encrypted;
    if (!enc) continue;
    const txt = await decryptString(enc, pass);
    const d = JSON.parse(txt);
    const loja = d.loja || 'Loja';
    const valor = d.valor || 0;
const comissao = d.comissao || 0;
const valorComissao = comissao ? ((valor * comissao) / 100) : 0;
html += `<div class="mt-1 text-sm text-gray-800 border-t pt-1">
  <strong>${loja}</strong>: R$ ${valor.toLocaleString('pt-BR')}
  ${comissao ? `<span class="ml-2 text-blue-700">(Comissão: ${comissao}% → R$ ${valorComissao.toLocaleString('pt-BR')})</span>` : ''}
</div>`;
  }
  detalhesEl.innerHTML = html || '<p class="text-gray-500">Sem detalhes</p>';
}
async function mostrarResumoSelecionados() {
  const checks = document.querySelectorAll('.selecionar-saque:checked');
  const uids = Array.from(checks).map(c => c.dataset.saquedata);
  if (!uids.length) return alert('Selecione ao menos um saque');

  const uid = auth.currentUser.uid;
  const pass = getPassphrase() || `chave-${uid}`;
  let total = 0;
  let totalComissao = 0;
  for (const dataRef of uids) {
    const snap = await getDocs(collection(db, `uid/${uid}/saques/${dataRef}/lojas`));
    for (const docSnap of snap.docs) {
      const enc = docSnap.data().encrypted;
      if (!enc) continue;
      const txt = await decryptString(enc, pass);
      const d = JSON.parse(txt);
      total += d.valor || 0;
      if (d.comissao) totalComissao += (d.valor * d.comissao / 100);
    }
  }
  alert(`Total Selecionado: R$ ${total.toLocaleString('pt-BR')}\nComissão Total: R$ ${totalComissao.toLocaleString('pt-BR')}`);
}

async function exportarSelecionados(formato) {
  const checks = document.querySelectorAll('.selecionar-saque:checked');
  const datas = Array.from(checks).map(c => c.dataset.saquedata);
  if (!datas.length) return alert('Selecione ao menos um saque');

  const uid = auth.currentUser.uid;
  const pass = getPassphrase() || `chave-${uid}`;
  const rows = [];
  let total = 0;
  let totalComissao = 0;

  for (const dataRef of datas) {
    const snap = await getDocs(collection(db, `uid/${uid}/saques/${dataRef}/lojas`));
    for (const docSnap of snap.docs) {
      const enc = docSnap.data().encrypted;
      if (!enc) continue;
      const txt = await decryptString(enc, pass);
      const d = JSON.parse(txt);
      const valorComissao = d.comissao ? (d.valor * d.comissao / 100) : 0;
      rows.push({
        Data: dataRef,
        Loja: d.loja || '',
        Valor: d.valor || 0,
        Comissao: d.comissao || 0,
        ValorComissao: valorComissao
      });
      total += d.valor || 0;
      totalComissao += valorComissao;
    }
  }

  if (formato === 'excel') {
    const wb = XLSX.utils.book_new();
    const sheetData = [
      ['Data', 'Loja', 'Valor', 'Comissão (%)', 'Valor Comissão'],
      ...rows.map(r => [r.Data, r.Loja, r.Valor, r.Comissao, r.ValorComissao]),
      ['Total', '', total, '', totalComissao]
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Saques');
    XLSX.writeFile(wb, 'saques_selecionados.xlsx');
  } else if (formato === 'pdf') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const tableBody = rows.map(r => [
      r.Data,
      r.Loja,
      r.Valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      r.Comissao,
      r.ValorComissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);
    doc.autoTable({
      head: [['Data', 'Loja', 'Valor', 'Comissão (%)', 'Valor Comissão']],
      body: tableBody
    });
    const y = doc.lastAutoTable.finalY + 10;
    doc.text(`Total: R$ ${total.toLocaleString('pt-BR')}`, 14, y);
    doc.text(`Comissão Total: R$ ${totalComissao.toLocaleString('pt-BR')}`, 14, y + 8);
    doc.save('saques_selecionados.pdf');
  }
}
async function excluirSaquesSelecionados() {
  const checks = document.querySelectorAll('.selecionar-saque:checked');
  const datas = Array.from(checks).map(c => c.dataset.saquedata);
  if (!datas.length) return alert('Selecione ao menos um saque');
  if (!confirm('Excluir saques selecionados?')) return;

  const uid = auth.currentUser.uid;
  for (const dataRef of datas) {
    const snap = await getDocs(collection(db, `uid/${uid}/saques/${dataRef}/lojas`));
    for (const docSnap of snap.docs) {
      await deleteDoc(doc(db, `uid/${uid}/saques/${dataRef}/lojas`, docSnap.id));
    }
    await deleteDoc(doc(db, `uid/${uid}/saques`, dataRef));
  }
  await carregarSaques();
}
export async function alternarPago(dataRef) {
  const uid = auth.currentUser.uid;
  const pass = getPassphrase() || `chave-${uid}`;
  const dados = await loadSecureDoc(db, `uid/${uid}/saques`, dataRef, pass);
  if (!dados) return;
  dados.pago = !dados.pago;
  await saveSecureDoc(db, `uid/${uid}/saques`, dataRef, { ...dados, uid }, pass);
  await carregarSaques();
}

if (typeof window !== 'undefined') {
  window.registrarSaque = registrarSaque;
  window.carregarSaques = carregarSaques;
  window.mostrarDetalhesSaque = mostrarDetalhesSaque;
  window.alternarPago = alternarPago;
   window.mostrarResumoSelecionados = mostrarResumoSelecionados;
  window.exportarSelecionados = exportarSelecionados;
  window.excluirSaquesSelecionados = excluirSaquesSelecionados;
}
