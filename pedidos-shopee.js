import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { loadUserDoc } from './secure-firestore.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
await carregarPedidosShopee();
});

export async function carregarPedidosShopee() {
const tbody = document.querySelector('#tabelaPedidosShopee tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Carregando...</td></tr>';
  try {
    const uid = auth.currentUser.uid;
const pass = (await getPassphrase()) || `chave-${uid}`;
    const snap = await getDocs(collection(db, `uid/${uid}/pedidosshopee`));
    const pedidos = [];
    for (const d of snap.docs) {
 let pedido = await loadUserDoc(db, uid, 'pedidosshopee', d.id, pass);
      if (!pedido) {
        const raw = d.data();
        if (raw && !raw.encrypted) {
          // Documento sem criptografia, usa dados brutos
          pedido = raw;
        }
      }
      console.log('Pedido carregado:', d.id, pedido);
      if (pedido) pedidos.push({ id: d.id, ...pedido });
    }
 tbody.innerHTML = '';
pedidos.forEach(p => {
  const tr = document.createElement('tr');
  const data = p.data || p.status || '–'; // usa status se não houver data
  const total = p.preco || p.total || '–'; // usa preço se não houver total
  tr.innerHTML = `
    <td>${p.id || ''}</td>
    <td>${data}</td>
    <td>${total}</td>
    <td><button class="btn btn-secondary text-sm">Ver Detalhes</button></td>
  `;
  tr.querySelector('button').addEventListener('click', () => mostrarDetalhesPedido(p));
  tbody.appendChild(tr);
});

    if (!tbody.children.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Nenhum pedido encontrado</td></tr>';
    }
  } catch (err) {
    console.error('Erro ao carregar pedidos', err);
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Erro ao carregar pedidos</td></tr>';
  }
}
async function getPassphrase() {
  // 1. Tenta recuperar da extensão
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise(resolve => {
      chrome.storage.local.get(['user'], res => {
        if (res?.user?.passphrase) resolve(res.user.passphrase);
        else resolve(localStorage.getItem('sistemaPassphrase') || prompt("Digite sua senha de visualização:"));
      });
    });
  }

  // 2. Se não estiver na extensão, tenta localStorage ou prompt
  return localStorage.getItem('sistemaPassphrase') || prompt("Digite sua senha de visualização:");
}

function mostrarDetalhesPedido(pedido) {
  const modal = document.getElementById('modalPedido');
  const detalhes = document.getElementById('detalhesPedido');
  if (!modal || !detalhes) return;
  detalhes.innerHTML = '';
  Object.entries(pedido).forEach(([k, v]) => {
    const div = document.createElement('div');
    const valor = typeof v === 'object' ? JSON.stringify(v, null, 2) : v;
    div.innerHTML = `<strong>${k}:</strong> ${valor}`;
    detalhes.appendChild(div);
  });
  modal.style.display = 'flex';
}

const modal = document.getElementById('modalPedido');
if (modal) {
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
  const fechar = document.getElementById('fecharModal');
  if (fechar) {
    fechar.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
}

if (typeof window !== 'undefined') {
window.carregarPedidosShopee = carregarPedidosShopee;
}
