import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, query, orderBy, limit, startAfter, startAt, endAt, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Garante que os modais de autenticação estejam disponíveis
if (typeof window !== 'undefined' && window.loadAuthModals) {
  window.loadAuthModals();
}

function showLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.style.display = 'block';
  } else {
    // Re-tenta após um pequeno atraso caso os modais ainda não tenham sido carregados
    setTimeout(showLoginModal, 500);
  }
}

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Não logado");
  return await user.getIdToken();
}

// URLs públicas das Cloud Functions
const URL_CONNECT = "https://connecttiny-g6u4niudyq-uc.a.run.app";
const URL_DISCONNECT = "https://disconnecttiny-g6u4niudyq-uc.a.run.app";
const URL_SYNC_PRODUCTS = "https://synctinyproducts-g6u4niudyq-uc.a.run.app";
const URL_SYNC_ORDERS   = "https://synctinyorders-g6u4niudyq-uc.a.run.app";

const stateTiny = {
  produtos: { pageSize: 30, lastDoc: null, stack: [], search: '', page: 1 },
  pedidos:  { pageSize: 20, lastDoc: null, stack: [], page: 1 }
};

onAuthStateChanged(auth, user => {
  if (!user) {
    showLoginModal();
    return;
  }
  carregarProdutos();
  carregarPedidos();
});

document.querySelectorAll('.tabTiny').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.tab;
    document.getElementById('tab-produtos').classList.toggle('hidden', t !== 'produtos');
    document.getElementById('tab-pedidos').classList.toggle('hidden', t !== 'pedidos');
    document.getElementById('tab-config').classList.toggle('hidden', t !== 'config');
  });
});

document.getElementById('btnSyncProdutos').onclick = async () => {
  await syncProdutos();
  stateTiny.produtos.lastDoc = null;
  stateTiny.produtos.stack = [];
  stateTiny.produtos.page = 1;
  carregarProdutos();
};

document.getElementById('btnSyncPedidos').onclick = async () => {
  await syncPedidosUltimos7d();
  stateTiny.pedidos.lastDoc = null;
  stateTiny.pedidos.stack = [];
  stateTiny.pedidos.page = 1;
  carregarPedidos();
};

document.getElementById('btnSyncPedidosPeriodo').onclick = async () => {
  try {
    const di = document.getElementById('dataInicial').value;
    const df = document.getElementById('dataFinal').value;
    if (!di || !df) return alert('Preencha data inicial e final');
    const [yi,mi,di2] = di.split('-');
    const [yf,mf,df2] = df.split('-');
    const dataInicial = `${di2}/${mi}/${yi}`;
    const dataFinal   = `${df2}/${mf}/${yf}`;
    const idToken = await getIdToken();
    const resp = await fetch(URL_SYNC_ORDERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ dataInicial, dataFinal })
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) throw new Error(data.error || 'Falha no sync de pedidos');
    stateTiny.pedidos.lastDoc = null;
    stateTiny.pedidos.stack = [];
    stateTiny.pedidos.page = 1;
    carregarPedidos();
  } catch (e) {
    alert(e.message);
  }
};

document.getElementById('btnConectarTiny').onclick = async () => {
  try {
    const token = document.getElementById('tinyToken').value.trim();
    if (!token) return alert("Cole o token do Tiny.");
    const idToken = await getIdToken();
    const resp = await fetch(URL_CONNECT, {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization": `Bearer ${idToken}` },
      body: JSON.stringify({ token: token, integradorId: 12228, validar: true })
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) throw new Error(data.error || "Falha ao conectar.");
    document.getElementById('tinyStatus').textContent = "Tiny conectado com sucesso.";
  } catch (e) {
    alert("Erro ao conectar: " + e.message);
  }
};

document.getElementById('btnDesconectarTiny').onclick = async () => {
  try {
    const idToken = await getIdToken();
    const resp = await fetch(URL_DISCONNECT, {
      method: "POST",
      headers: { "Authorization": `Bearer ${idToken}` }
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) throw new Error(data.error || "Falha ao desconectar.");
    document.getElementById('tinyStatus').textContent = "Tiny desconectado.";
  } catch (e) {
    alert("Erro ao desconectar: " + e.message);
  }
};

async function syncProdutos() {
  const idToken = await getIdToken();
  const resp = await fetch(URL_SYNC_PRODUCTS, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify({ modo: "scan" })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Falha no sync de produtos");
  return data;
}

async function syncPedidosUltimos7d() {
  const idToken = await getIdToken();
  const d = new Date(Date.now() - 7*24*60*60*1000);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  const dataAtualizacao = `${dd}/${mm}/${yyyy} 00:00:00`;
  const resp = await fetch(URL_SYNC_ORDERS, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify({ dataAtualizacao })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Falha no sync de pedidos");
  return data;
}

document.getElementById('btnFiltrarProdutos').onclick = () => {
  stateTiny.produtos.search = document.getElementById('buscaProduto').value.trim().toLowerCase();
  stateTiny.produtos.lastDoc = null;
  stateTiny.produtos.stack = [];
  stateTiny.produtos.page = 1;
  carregarProdutos();
};

document.getElementById('nextProdutos').onclick = () => carregarProdutos(1);

document.getElementById('prevProdutos').onclick = () => carregarProdutos(-1);

document.getElementById('nextPedidos').onclick = () => carregarPedidos(1);

document.getElementById('prevPedidos').onclick = () => carregarPedidos(-1);

async function carregarProdutos(direction = 0) {
  const uid = auth.currentUser.uid;
  const cont = document.getElementById('listaProdutos');
  cont.innerHTML = '';
  const ref = collection(db, `usuarios/${uid}/produtosTiny`);
  let q = query(ref, orderBy('nome'), limit(stateTiny.produtos.pageSize));
  if (stateTiny.produtos.search) {
    const s = stateTiny.produtos.search;
    q = query(ref, orderBy('nome'), startAt(s), endAt(s + '\uf8ff'), limit(stateTiny.produtos.pageSize));
  } else if (direction === 1 && stateTiny.produtos.lastDoc) {
    stateTiny.produtos.stack.push(stateTiny.produtos.lastDoc);
    stateTiny.produtos.page++;
    q = query(ref, orderBy('nome'), startAfter(stateTiny.produtos.lastDoc), limit(stateTiny.produtos.pageSize));
  } else if (direction === -1) {
    if (stateTiny.produtos.stack.length) {
      stateTiny.produtos.page = Math.max(1, stateTiny.produtos.page - 1);
      const prev = stateTiny.produtos.stack.pop();
      const startAfterDoc = stateTiny.produtos.stack[stateTiny.produtos.stack.length - 1];
      q = startAfterDoc
        ? query(ref, orderBy('nome'), startAfter(startAfterDoc), limit(stateTiny.produtos.pageSize))
        : query(ref, orderBy('nome'), limit(stateTiny.produtos.pageSize));
    }
  } else {
    stateTiny.produtos.page = 1;
  }
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const p = doc.data();
    cont.insertAdjacentHTML('beforeend', cardProduto(p));
  });
  stateTiny.produtos.lastDoc = snap.docs[snap.docs.length - 1] || null;
  document.getElementById('pagProdutos').textContent = `Página ${stateTiny.produtos.page}`;
}

function cardProduto(p) {
  return `<div class="rounded-2xl border p-4">
    <div class="text-sm text-gray-500">${p.sku || ''}</div>
    <div class="font-medium">${p.nome || ''}</div>
    <div class="text-sm">Preço: R$ ${(p.preco??0).toFixed(2)}</div>
    <div class="text-xs text-gray-400">Atualizado: ${new Date(p.updatedAt||Date.now()).toLocaleString('pt-BR')}</div>
  </div>`;
}

async function carregarPedidos(direction = 0) {
  const uid = auth.currentUser.uid;
  const cont = document.getElementById('listaPedidos');
  cont.innerHTML = '';
  const ref = collection(db, `usuarios/${uid}/pedidosShopeeTiny`);
  let q = query(ref, orderBy('data'), limit(stateTiny.pedidos.pageSize));
  if (direction === 1 && stateTiny.pedidos.lastDoc) {
    stateTiny.pedidos.stack.push(stateTiny.pedidos.lastDoc);
    stateTiny.pedidos.page++;
    q = query(ref, orderBy('data'), startAfter(stateTiny.pedidos.lastDoc), limit(stateTiny.pedidos.pageSize));
  } else if (direction === -1) {
    if (stateTiny.pedidos.stack.length) {
      stateTiny.pedidos.page = Math.max(1, stateTiny.pedidos.page - 1);
      const prev = stateTiny.pedidos.stack.pop();
      const startAfterDoc = stateTiny.pedidos.stack[stateTiny.pedidos.stack.length - 1];
      q = startAfterDoc
        ? query(ref, orderBy('data'), startAfter(startAfterDoc), limit(stateTiny.pedidos.pageSize))
        : query(ref, orderBy('data'), limit(stateTiny.pedidos.pageSize));
    }
  } else {
    stateTiny.pedidos.page = 1;
  }
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const p = doc.data();
    cont.insertAdjacentHTML('beforeend', cardPedido(p));
  });
  stateTiny.pedidos.lastDoc = snap.docs[snap.docs.length - 1] || null;
  document.getElementById('pagPedidos').textContent = `Página ${stateTiny.pedidos.page}`;
}

function cardPedido(p) {
  const itens = (p.itens||[]).map(i=>`<li>${i.quantidade}x ${i.sku} — R$ ${(i.preco||0).toFixed(2)}</li>`).join('');
  return `<div class="rounded-2xl border p-4 space-y-1">
    <div class="flex justify-between">
      <div class="font-medium">Pedido #${p.numero}</div>
      <div class="text-sm text-gray-500">${p.data||''}</div>
    </div>
    <div class="text-sm">Cliente: ${p.cliente||'-'}</div>
    <div class="text-sm">Total: R$ ${(p.total||0).toFixed(2)} — <span class="text-gray-600">${p.status||''}</span></div>
    <div class="text-xs text-gray-500">Canal: ${p.canal||''} • N° ecom: ${p.numeroEcommerce||'-'}</div>
    <ul class="mt-2 text-sm list-disc list-inside">${itens}</ul>
  </div>`;
}
