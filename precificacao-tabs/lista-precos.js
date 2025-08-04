import { encryptString, decryptString } from '../crypto.js';

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
// Avoid clashing with a global `db` from other scripts
const dbListaPrecos = firebase.firestore();
const authListaPrecos = firebase.auth();
let produtos = [];
let viewMode = 'cards';
let selecionados = new Set();

async function carregarProdutos() {
  const user = firebase.auth().currentUser;
  const uid = user?.uid;
  const isAdmin = window.sistema?.isAdmin;

 produtos = [];
  selecionados.clear();
  const selectAll = document.getElementById('selectAll');
  if (selectAll) selectAll.checked = false;

  if (isAdmin) {
    const snap = await dbListaPrecos.collectionGroup('produtos').orderBy('createdAt', 'desc').get();
    for (const doc of snap.docs) {
      const owner = doc.ref.parent.parent.id;
      const pass = getPassphrase() || `chave-${owner}`;
      const enc = doc.data().encrypted;
      if (!enc) continue;
      const data = JSON.parse(await decryptString(enc, pass));
      produtos.push({ id: doc.id, uid: owner, ...data });
    }
  } else if (uid) {
    const pass = getPassphrase() || `chave-${uid}`;
    const snap = await dbListaPrecos
      .collection('uid')
      .doc(uid)
      .collection('produtos')
      .orderBy('createdAt', 'desc')
      .get();
    for (const doc of snap.docs) {
      const enc = doc.data().encrypted;
      if (!enc) continue;
      const data = JSON.parse(await decryptString(enc, pass));
      produtos.push({ id: doc.id, uid, ...data });
    }
  }

   aplicarFiltros();

}

function aplicarFiltros() {
    const termo = document.getElementById('filtroBusca')?.value.toLowerCase() || '';

  const filtrados = produtos.filter(p => {
    const texto = `${p.produto || ''} ${(p.sku || '')}`.toLowerCase();
        return !termo || texto.includes(termo);

  });
  renderLista(filtrados);
}

function renderLista(lista) {
  const cards = document.getElementById('listaPrecos');
  const table = document.getElementById('listaPrecosList');
  const tbody = document.getElementById('listaPrecosListBody');
  if (!cards || !table || !tbody) return;
  cards.innerHTML = '';
  tbody.innerHTML = '';

  if (viewMode === 'cards') {
    cards.classList.remove('hidden');
    table.classList.add('hidden');
    lista.forEach(data => {
      const card = document.createElement('div');
      card.className = 'bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition duration-200';
      card.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex items-start">
            <input type="checkbox" class="mr-2 selecionar-produto" onchange="toggleSelecionado('${data.id}', this.checked)" ${selecionados.has(data.id) ? 'checked' : ''}>
            <div>
              <h3 class="font-bold text-lg">${data.produto}</h3>
              ${data.sku ? `<div class="text-sm text-gray-500">SKU: ${data.sku}</div>` : ''}
            </div>
          </div>
          <div class="text-right">
            <div class="text-gray-500 text-sm">Preço mínimo</div>
            <div class="text-lg font-semibold text-green-600">R$ ${parseFloat(data.precoMinimo).toFixed(2)}</div>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between">
          <div class="text-sm text-gray-500"><i class="far fa-calendar-alt"></i> ${new Date(data.createdAt).toLocaleDateString('pt-BR')}</div>
          <div class="flex space-x-2">
            <button onclick="verDetalhes('${data.id}')" class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
              <i class='fas fa-eye mr-1'></i> Ver
            </button>
            <button onclick="editarProduto('${data.id}')" class="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600">
              <i class='fas fa-edit mr-1'></i> Editar
            </button>
            <button onclick="excluirProduto('${data.id}')" class="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">
              <i class='fas fa-trash mr-1'></i> Excluir
            </button>
          </div>

        </div>`;
      cards.appendChild(card);
    });
  } else {
    cards.classList.add('hidden');
    table.classList.remove('hidden');
    lista.forEach(data => {
      const row = document.createElement('tr');
      row.innerHTML = `
       <td><input type="checkbox" class="selecionar-produto" onchange="toggleSelecionado('${data.id}', this.checked)" ${selecionados.has(data.id) ? 'checked' : ''}></td>
        <td>${data.produto}</td>
        <td>${data.sku || ''}</td>
        <td>${data.plataforma}</td>
        <td class="whitespace-nowrap">R$ ${parseFloat(data.precoMinimo).toFixed(2)}</td>
        <td class="whitespace-nowrap">
          <button class="text-blue-600 mr-2" onclick="verDetalhes('${data.id}')"><i class='fas fa-eye'></i></button>
          <button class="text-yellow-600 mr-2" onclick="editarProduto('${data.id}')"><i class='fas fa-edit'></i></button>
          <button class="text-red-600" onclick="excluirProduto('${data.id}')"><i class='fas fa-trash'></i></button>
        </td>`;
      tbody.appendChild(row);
    });
  }
  const selectAll = document.getElementById('selectAll');
  if (selectAll) {
    selectAll.checked = produtos.length > 0 && selecionados.size === produtos.length;
  }
}

function verDetalhes(id) {
  const prod = produtos.find(p => p.id === id);
  if (!prod) return;
  document.getElementById('saveBtn').classList.add('hidden');
  document.getElementById('modalTitle').textContent = prod.produto;
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    ${prod.sku ? `<div><strong>SKU:</strong> ${prod.sku}</div>` : ''}
    <div><strong>Plataforma:</strong> ${prod.plataforma}</div>
    <div><strong>Custo:</strong> R$ ${prod.custo}</div>
    <div><strong>Preço mínimo:</strong> R$ ${prod.precoMinimo}</div>
    <div><strong>Preço ideal:</strong> R$ ${prod.precoIdeal}</div>
    <div><strong>Preço médio:</strong> R$ ${prod.precoMedio}</div>
    <div><strong>Preço promo:</strong> R$ ${prod.precoPromo}</div>
  `;
    // Utilize global modal helpers to ensure proper display
  document.getElementById('detalhesModal').classList.remove('hidden');
  if (typeof openModal === 'function') {
    openModal('detalhesModal');
  } else {
    document.getElementById('detalhesModal').style.display = 'block';
  }
}

let editId = null;
function editarProduto(id) {
  const prod = produtos.find(p => p.id === id);
  if (!prod) return;
  editId = id;
  document.getElementById('modalTitle').textContent = 'Editar ' + prod.produto;
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <label class='block'>Nome<input id='editNome' class='w-full border p-2 rounded mt-1' value="${prod.produto}"></label>
    <label class='block mt-2'>SKU<input id='editSku' class='w-full border p-2 rounded mt-1' value="${prod.sku || ''}"></label>
    <label class='block mt-2'>Custo<input id='editCusto' type='number' step='0.01' class='w-full border p-2 rounded mt-1' value="${prod.custo}"></label>
    <label class='block mt-2'>Preço mínimo<input id='editMin' type='number' step='0.01' class='w-full border p-2 rounded mt-1' value="${prod.precoMinimo}"></label>
    <label class='block mt-2'>Preço ideal<input id='editIdeal' type='number' step='0.01' class='w-full border p-2 rounded mt-1' value="${prod.precoIdeal}"></label>
    <label class='block mt-2'>Preço médio<input id='editMedio' type='number' step='0.01' class='w-full border p-2 rounded mt-1' value="${prod.precoMedio}"></label>
    <label class='block mt-2'>Preço promo<input id='editPromo' type='number' step='0.01' class='w-full border p-2 rounded mt-1' value="${prod.precoPromo}"></label>
  `;
  document.getElementById('saveBtn').classList.remove('hidden');
  document.getElementById('detalhesModal').classList.remove('hidden');
  if (typeof openModal === 'function') {
    openModal('detalhesModal');
  } else {
    document.getElementById('detalhesModal').style.display = 'block';
  }
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  if (!editId) return;
  const user = firebase.auth().currentUser;
  if (!user) return;
  const data = {
    produto: document.getElementById('editNome').value,
    sku: document.getElementById('editSku').value,
    custo: parseFloat(document.getElementById('editCusto').value) || 0,
    precoMinimo: parseFloat(document.getElementById('editMin').value) || 0,
    precoIdeal: parseFloat(document.getElementById('editIdeal').value) || 0,
    precoMedio: parseFloat(document.getElementById('editMedio').value) || 0,
    precoPromo: parseFloat(document.getElementById('editPromo').value) || 0
  };
const pass = getPassphrase() || `chave-${user.uid}`;
  await dbListaPrecos
    .collection('uid')
    .doc(user.uid)
    .collection('produtos')
    .doc(editId)
    .set({ uid: user.uid, encrypted: await encryptString(JSON.stringify(data), pass) }, { merge: true });
  fecharModal();
  carregarProdutos();
});

function excluirProduto(id) {
  const user = firebase.auth().currentUser;
  if (!user) return;
 if (!confirm('Excluir este produto?')) return;
 dbListaPrecos
    .collection('uid')
    .doc(user.uid)
    .collection('produtos')
    .doc(id)
    .delete()
    .then(carregarProdutos);
}
function toggleSelecionado(id, checked) {
  if (checked) selecionados.add(id); else selecionados.delete(id);
}

function selecionarTodos(checked) {
  selecionados = new Set(checked ? produtos.map(p => p.id) : []);
  document.querySelectorAll('.selecionar-produto').forEach(el => { el.checked = checked; });
}

async function excluirSelecionados() {
const user = firebase.auth().currentUser;
  if (!user || !selecionados.size) return;
 if (!confirm('Excluir produtos selecionados?')) return;
 await Promise.all(
    Array.from(selecionados).map(id =>
      dbListaPrecos
        .collection('uid')
        .doc(user.uid)
        .collection('produtos')
        .doc(id)
        .delete()
    )
  );
  selecionados.clear();
  carregarProdutos();
}

async function excluirTodos() {
  if (!produtos.length) return;
  if (!confirm('Excluir todos os produtos?')) return;
 await Promise.all(
    produtos.map(p =>
      dbListaPrecos
        .collection('uid')
        .doc(p.uid)
        .collection('produtos')
        .doc(p.id)
        .delete()
    )
  );  selecionados.clear();
  carregarProdutos();
}
function fecharModal() {
  if (typeof closeModal === 'function') {
    closeModal('detalhesModal');
  } else {
    document.getElementById('detalhesModal').style.display = 'none';
  }
  document.getElementById('detalhesModal').classList.add('hidden');
  editId = null;
}
function exportarExcelLista() {
  if (!produtos.length) return;
  const data = produtos.map(p => ({
    SKU: p.sku || '',
    Produto: p.produto,
    Loja: p.plataforma,
    'Preço Mínimo': parseFloat(p.precoMinimo).toFixed(2),
    'Preço Ideal': parseFloat(p.precoIdeal).toFixed(2),
    'Preço Médio': parseFloat(p.precoMedio).toFixed(2),
    'Preço Promo': parseFloat(p.precoPromo).toFixed(2)
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Precos');
  XLSX.writeFile(wb, 'lista_precos.xlsx');
}

function exportarPDFLista() {
  if (!produtos.length) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const headers = ['Produto','SKU','Loja','Preço Mín.','Preço Ideal','Preço Médio','Preço Promo'];
  const body = produtos.map(p => [
    p.produto,
    p.sku || '',
    p.plataforma,
    parseFloat(p.precoMinimo).toFixed(2),
    parseFloat(p.precoIdeal).toFixed(2),
    parseFloat(p.precoMedio).toFixed(2),
    parseFloat(p.precoPromo).toFixed(2)
  ]);
  doc.autoTable({ head:[headers], body, startY:20, styles:{ fontSize:8 } });
  doc.save('lista_precos.pdf');
}

function importarExcelLista() {
  const input = document.getElementById('importFileInput');
  const file = input?.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!rows.length) return;
    const headers = rows[0].map(h => String(h).toLowerCase());
    const idxSku = headers.indexOf('sku');
    const idxMin = headers.findIndex(h => h.includes('mín'));
    const idxIdeal = headers.findIndex(h => h.includes('ideal'));
    const idxMedio = headers.findIndex(h => h.includes('médio'));
    const idxPromo = headers.findIndex(h => h.includes('promo'));
    let updated = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const sku = row[idxSku];
      if (!sku) continue;
      const prod = produtos.find(p => String(p.sku) === String(sku));
      if (!prod) continue;
      const updateData = {};
      if (idxMin !== -1 && row[idxMin] !== undefined) updateData.precoMinimo = parseFloat(row[idxMin]) || 0;
      if (idxIdeal !== -1 && row[idxIdeal] !== undefined) updateData.precoIdeal = parseFloat(row[idxIdeal]) || 0;
      if (idxMedio !== -1 && row[idxMedio] !== undefined) updateData.precoMedio = parseFloat(row[idxMedio]) || 0;
      if (idxPromo !== -1 && row[idxPromo] !== undefined) updateData.precoPromo = parseFloat(row[idxPromo]) || 0;
      if (Object.keys(updateData).length) {
   await dbListaPrecos
          .collection('uid')
          .doc(prod.uid)
          .collection('produtos')
          .doc(prod.id)
          .update(updateData);
        Object.assign(prod, updateData);
        updated++;
      }
    }
    input.value = '';
    aplicarFiltros();
    alert(`${updated} produtos atualizados`);
  };
  reader.readAsArrayBuffer(file);
}
function setupListeners() {
  document.getElementById('filtroBusca')?.addEventListener('input', aplicarFiltros);
  document.getElementById('btnCardView')?.addEventListener('click', () => { viewMode = 'cards'; aplicarFiltros(); });
  document.getElementById('btnListView')?.addEventListener('click', () => { viewMode = 'list'; aplicarFiltros(); });
    document.getElementById('selectAll')?.addEventListener('change', e => selecionarTodos(e.target.checked));
}

function initTooltips() {
  document.querySelectorAll('.tooltip').forEach(el => {
    const text = el.getAttribute('data-tooltip');
    if (text && !el.querySelector('.tooltip-text')) {
      const span = document.createElement('span');
      span.className = 'tooltip-text';
      span.textContent = text;
      el.appendChild(span);
    }
  });
}

function init() {
  setupListeners();
    initTooltips();
  // Aguardamos o evento de autenticação abaixo para carregar os produtos
}

if (document.readyState !== 'loading') {
  init();
} else {
     document.addEventListener('DOMContentLoaded', init);

}
authListaPrecos.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  carregarProdutos();
});
