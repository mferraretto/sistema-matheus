import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  await carregarPedidos();
});

export async function carregarPedidos() {
  const tbody = document.querySelector('#tabelaPedidosBling tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Carregando...</td></tr>';
  try {
const uid = auth.currentUser.uid;
    const snap = await getDocs(collection(db, `uid/${uid}/pedidosBling`));
    const pedidos = snap.docs.map(d => d.data());
    tbody.innerHTML = '';
    if (window.atualizarTabelaPedidos) {
      window.atualizarTabelaPedidos(pedidos);
    }
    if (!tbody.children.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Nenhum pedido encontrado</td></tr>';
    }
  } catch (err) {
    console.error('Erro ao carregar pedidos', err);
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Erro ao carregar pedidos</td></tr>';
  }
}

if (typeof window !== 'undefined') {
  window.carregarPedidosBling = carregarPedidos;
}
