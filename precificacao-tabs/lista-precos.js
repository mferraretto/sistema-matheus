if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
if (!window.db) {
  window.db = firebase.firestore();
}
const db = window.db;

let produtos = [];

function carregarProdutos() {
  db.collection('products').orderBy('createdAt', 'desc').get().then(snap => {
    produtos = [];
    const container = document.getElementById('listaProdutos');
    if (!container) return;
    container.innerHTML = '';
    snap.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      produtos.push(data);
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-bold text-lg">${data.produto}</h3>
            ${data.sku ? `<div class="text-sm text-gray-500">SKU: ${data.sku}</div>` : ''}
          </div>
          <div class="text-right">
            <div class="text-gray-500 text-sm">Preço mínimo</div>
            <div class="product-price">R$ ${parseFloat(data.precoMinimo).toFixed(2)}</div>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between">
          <div class="text-sm text-gray-500"><i class="far fa-calendar-alt"></i> ${new Date(data.createdAt).toLocaleDateString('pt-BR')}</div>
          <div class="flex space-x-2">
            <button class="text-blue-600" onclick="verDetalhes('${data.id}')"><i class='fas fa-eye'></i> Ver</button>
            <button class="text-yellow-600" onclick="editarProduto('${data.id}')"><i class='fas fa-edit'></i> Editar</button>
            <button class="text-red-600" onclick="excluirProduto('${data.id}')"><i class='fas fa-trash'></i></button>
          </div>
        </div>`;
      container.appendChild(card);
    });
  });
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
  document.getElementById('detalhesModal').classList.remove('hidden');
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
}

document.getElementById('saveBtn').addEventListener('click', async () => {
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
  await db.collection('products').doc(editId).update(data);
  fecharModal();
  carregarProdutos();
});

function excluirProduto(id) {
  if (!confirm('Excluir este produto?')) return;
  db.collection('products').doc(id).delete().then(carregarProdutos);
}

function fecharModal() {
  document.getElementById('detalhesModal').classList.add('hidden');
  editId = null;
}

if (document.readyState !== 'loading') {
  carregarProdutos();
} else {
  document.addEventListener('DOMContentLoaded', carregarProdutos);
}
