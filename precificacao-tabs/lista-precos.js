if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
// Avoid clashing with a global `db` from other scripts
const dbListaPrecos = firebase.firestore();
let produtos = [];
let viewMode = 'cards';

function lpCarregarProdutos() {
  dbListaPrecos
    .collection('products')
    .orderBy('createdAt', 'desc')
    .get()
    .then(snap => {
      produtos = [];
      snap.forEach(doc => {
        produtos.push({ id: doc.id, ...doc.data() });
      });
      lpAplicarFiltros();
    });
}

function lpAplicarFiltros() {
    const termo = document.getElementById('filtroBusca')?.value.toLowerCase() || '';

  const filtrados = produtos.filter(p => {
    const texto = `${p.produto || ''} ${(p.sku || '')}`.toLowerCase();
        return !termo || texto.includes(termo);

  });
  lpRenderLista(filtrados);
}

function lpRenderLista(lista) {
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
          <div>
            <h3 class="font-bold text-lg">${data.produto}</h3>
            ${data.sku ? `<div class="text-sm text-gray-500">SKU: ${data.sku}</div>` : ''}
          </div>
          <div class="text-right">
            <div class="text-gray-500 text-sm">Preço mínimo</div>
            <div class="text-lg font-semibold text-green-600">R$ ${parseFloat(data.precoMinimo).toFixed(2)}</div>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between">
          <div class="text-sm text-gray-500"><i class="far fa-calendar-alt"></i> ${new Date(data.createdAt).toLocaleDateString('pt-BR')}</div>
         <div class="flex space-x-2">
  <button onclick="lpVerDetalhes('${data.id}')" class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
    <i class='fas fa-eye mr-1'></i> Ver
  </button>
  <button onclick="lpEditarProduto('${data.id}')" class="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600">
    <i class='fas fa-edit mr-1'></i> Editar
  </button>
  <button onclick="lpExcluirProduto('${data.id}')" class="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">
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
        <td class="p-3">${data.produto}</td>
        <td class="p-3">${data.sku || ''}</td>
        <td class="p-3">${data.plataforma}</td>
        <td class="p-3">R$ ${parseFloat(data.precoMinimo).toFixed(2)}</td>
        <td class="p-3">
          <div class="flex space-x-2">
            <button class="text-blue-600" onclick="lpVerDetalhes('${data.id}')"><i class='fas fa-eye'></i></button>
            <button class="text-yellow-600" onclick="lpEditarProduto('${data.id}')"><i class='fas fa-edit'></i></button>
            <button class="text-red-600" onclick="lpExcluirProduto('${data.id}')"><i class='fas fa-trash'></i></button>
          </div>
        </td>`;
      tbody.appendChild(row);
    });
  }
}

function lpVerDetalhes(id) {
  const prod = produtos.find(p => p.id === id);
  if (!prod) return;
  document.getElementById('lpSaveBtn').classList.add('hidden');
  document.getElementById('lpModalTitle').textContent = prod.produto;
  const body = document.getElementById('lpModalBody');
  body.innerHTML = `
    ${prod.sku ? `<div><strong>SKU:</strong> ${prod.sku}</div>` : ''}
    <div><strong>Plataforma:</strong> ${prod.plataforma}</div>
    <div><strong>Custo:</strong> R$ ${prod.custo}</div>
    <div><strong>Preço mínimo:</strong> R$ ${prod.precoMinimo}</div>
    <div><strong>Preço ideal:</strong> R$ ${prod.precoIdeal}</div>
    <div><strong>Preço médio:</strong> R$ ${prod.precoMedio}</div>
    <div><strong>Preço promo:</strong> R$ ${prod.precoPromo}</div>
  `;
  document.getElementById('lpDetalhesModal').classList.remove('hidden');
}

let editId = null;
function lpEditarProduto(id) {
  const prod = produtos.find(p => p.id === id);
  if (!prod) return;
  editId = id;
 document.getElementById('lpModalTitle').textContent = 'Editar ' + prod.produto;
  const body = document.getElementById('lpModalBody');
  body.innerHTML = `
    <label class='block'>Nome<input id='editNome' class='w-full border p-2 rounded mt-1' value="${prod.produto}"></label>
    <label class='block mt-2'>SKU<input id='editSku' class='w-full border p-2 rounded mt-1' value="${prod.sku || ''}"></label>
    <label class='block mt-2'>Custo<input id='editCusto' type='number' step='0.01' class='w-full border p-2 rounded mt-1' value="${prod.custo}"></label>
    <label class='block mt-2'>Preço mínimo<input id='editMin' type='number' step='0.01' class='w-full border p-2 rounded mt-1' value="${prod.precoMinimo}"></label>
    <label class='block mt-2'>Preço ideal<input id='editIdeal' type='number' step='0.01' class='w-full border p-2 rounded mt-1' value="${prod.precoIdeal}"></label>
    <label class='block mt-2'>Preço médio<input id='editMedio' type='number' step='0.01' class='w-full border p-2 rounded mt-1' value="${prod.precoMedio}"></label>
    <label class='block mt-2'>Preço promo<input id='editPromo' type='number' step='0.01' class='w-full border p-2 rounded mt-1' value="${prod.precoPromo}"></label>
  `;
 document.getElementById('lpSaveBtn').classList.remove('hidden');
  document.getElementById('lpDetalhesModal').classList.remove('hidden');
}

document.getElementById('lpSaveBtn').addEventListener('click', async () => {
  if (!editId) return;
  const data = {
    produto: document.getElementById('editNome').value,
    sku: document.getElementById('editSku').value,
    custo: parseFloat(document.getElementById('editCusto').value) || 0,
    precoMinimo: parseFloat(document.getElementById('editMin').value) || 0,
    precoIdeal: parseFloat(document.getElementById('editIdeal').value) || 0,
    precoMedio: parseFloat(document.getElementById('editMedio').value) || 0,
    precoPromo: parseFloat(document.getElementById('editPromo').value) || 0
  };
  await dbListaPrecos.collection('products').doc(editId).update(data);
  lpFecharModal();
  lpCarregarProdutos();
});

function lpExcluirProduto(id) {
  if (!confirm('Excluir este produto?')) return;
  dbListaPrecos.collection('products').doc(id).delete().then(lpCarregarProdutos);
}

function lpFecharModal() {
  document.getElementById('lpDetalhesModal').classList.add('hidden');
  editId = null;
}
function setupListeners() {
document.getElementById('filtroBusca')?.addEventListener('input', lpAplicarFiltros);
  document.getElementById('btnCardView')?.addEventListener('click', () => { viewMode = 'cards'; lpAplicarFiltros(); });
  document.getElementById('btnListView')?.addEventListener('click', () => { viewMode = 'list'; lpAplicarFiltros(); });
}


if (document.readyState !== 'loading') {
    setupListeners();
  lpCarregarProdutos();
} else {
  document.addEventListener('DOMContentLoaded', lpCarregarProdutos);
}


