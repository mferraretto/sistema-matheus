import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { loadUserDoc, loadSecureDoc } from './secure-firestore.js';

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
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Carregando...</td></tr>';
  try {
    const uid = auth.currentUser.uid;
const pass = (await getPassphrase()) || `chave-${uid}`;

    const [snap, mapaAnuncios] = await Promise.all([
      getDocs(collection(db, `uid/${uid}/pedidosshopee`)),
      carregarMapaAnuncios(uid, pass)
    ]);
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
      if (pedido) pedidos.push({ id: d.id, ...pedido });
    }
correlacionarPedidosComAnuncios(pedidos, mapaAnuncios);

    tbody.innerHTML = '';
    pedidos.forEach(p => {
      const tr = document.createElement('tr');
      const data = p.data || p.status || '–'; // usa status se não houver data
      const total = p.preco || p.total || '–'; // usa preço se não houver total
      const skuList = (p.itens || []).map(i => i.sku).filter(Boolean).join(', ') || '–';
      tr.innerHTML = `
        <td>${p.id || ''}</td>
        <td>${data}</td>
        <td>${total}</td>
        <td>${skuList}</td>
        <td><button class="btn btn-secondary text-sm">Ver Detalhes</button></td>
      `;
      tr.querySelector('button').addEventListener('click', () => mostrarDetalhesPedido(p));
      tbody.appendChild(tr);
    });

    if (!tbody.children.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Nenhum pedido encontrado</td></tr>';
    }
  } catch (err) {
    console.error('Erro ao carregar pedidos', err);
 tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Erro ao carregar pedidos</td></tr>';
  }
}

async function carregarMapaAnuncios(uid, pass) {
  const mapa = {};
  try {
    const anunciosSnap = await getDocs(collection(db, `uid/${uid}/anuncios`));
    for (const anuncioDoc of anunciosSnap.docs) {
      const anuncio = await loadUserDoc(db, uid, 'anuncios', anuncioDoc.id, pass);

      if (!anuncio) continue;
      const nomeAnuncio = anuncio.nome || anuncioDoc.id;
      const variantesSnap = await getDocs(collection(db, `uid/${uid}/anuncios/${anuncioDoc.id}/variantes`));
      for (const varDoc of variantesSnap.docs) {
         const variante = await loadSecureDoc(db, `uid/${uid}/anuncios/${anuncioDoc.id}/variantes`, varDoc.id, pass);

        if (!variante) continue;
        const chave = `${nomeAnuncio}|${variante.nomeVariante}`;
        if (variante.skuVariante) {
          mapa[chave] = variante.skuVariante;
        }
      }
    }
  } catch (err) {
    console.error('Erro ao carregar anúncios para correlação', err);
  }
  return mapa;
}

function correlacionarPedidosComAnuncios(pedidos, mapa) {
  for (const pedido of pedidos) {
    const itens = pedido.itens || pedido.items || [];
    pedido.itens = itens.map(item => {
      const chave = `${item.produto}|${item.variacao}`;
      const sku = mapa[chave] || null;
      return { ...item, sku };
    });
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
if (k === 'itens' && Array.isArray(v)) {
      div.innerHTML = '<strong>Itens:</strong>';
      const ul = document.createElement('ul');
      v.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.produto || ''} / ${item.variacao || ''} - SKU: ${item.sku || '–'}`;
        ul.appendChild(li);
      });
      div.appendChild(ul);
    } else {
      const valor = typeof v === 'object' ? JSON.stringify(v, null, 2) : v;
      div.innerHTML = `<strong>${k}:</strong> ${valor}`;
    }
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
