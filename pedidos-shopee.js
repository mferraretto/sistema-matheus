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
function normalizarTexto(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize("NFD") // remove acentos
    .replace(/[\u0300-\u036f]/g, '') // remove acentos restantes
    .replace(/[^a-z0-9]+/g, ' ') // remove símbolos especiais
    .trim();
}

function setTbodyMessage(tbody, message, classes = '', colspan = 5) {
  tbody.textContent = '';
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = colspan;
  td.className = `text-center py-4 ${classes}`.trim();
  td.textContent = message;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

export async function carregarPedidosShopee() {
  const tbody = document.querySelector('#tabelaPedidosShopee tbody');
  if (!tbody) return;
  setTbodyMessage(tbody, 'Carregando...');
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
if (pedido) {
  console.log('📦 Pedido carregado:', d.id, pedido); // 🔍 mostra no console
  pedidos.push({ id: d.id, ...pedido });
}
    }
correlacionarPedidosComAnuncios(pedidos, mapaAnuncios);

    tbody.textContent = '';
    pedidos.forEach(p => {
      const tr = document.createElement('tr');
      const data = p.data || p.status || '–';
      const total = p.preco || p.total || '–';
      const skuList = (p.itens || []).map(i => i.sku).filter(Boolean).join(', ') || '–';
      [p.id || '', data, total, skuList].forEach(text => {
        const td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      const tdBtn = document.createElement('td');
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary text-sm';
      btn.textContent = 'Ver Detalhes';
      btn.addEventListener('click', () => mostrarDetalhesPedido(p));
      tdBtn.appendChild(btn);
      tr.appendChild(tdBtn);
      tbody.appendChild(tr);
    });

    if (!tbody.children.length) {
      setTbodyMessage(tbody, 'Nenhum pedido encontrado', 'text-gray-500');
    }
  } catch (err) {
    console.error('Erro ao carregar pedidos', err);
    setTbodyMessage(tbody, 'Erro ao carregar pedidos', 'text-red-500');
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
const variante = await loadUserDoc(db, uid, `anuncios/${anuncioDoc.id}/variantes`, varDoc.id, pass);
        if (!variante) continue;
        const chave = `${normalizarTexto(nomeAnuncio)}|${normalizarTexto(variante.nomeVariante)}`;
        if (variante.skuVariante) {
 mapa[chave] = variante.skuVariante;
          console.log(`🔑 Chave gerada no anúncio: "${chave}" → SKU: ${variante.skuVariante}`);
        }
      }
    }
  } catch (err) {
    console.error('Erro ao carregar anúncios para correlação', err);
  }
    console.log("📦 Mapa de Anúncios completo:");
  console.log(mapa);
  return mapa;
}

function correlacionarPedidosComAnuncios(pedidos, mapa) {
  for (const pedido of pedidos) {
    const itens = pedido.itens || pedido.items || [];
    pedido.itens = itens.map(item => {
const chave = `${normalizarTexto(item.produto)}|${normalizarTexto(item.variacao)}`;
      const sku = mapa[chave] || null;
if (sku) {
  console.log(`✅ Correlacionado: "${chave}" → SKU: ${sku}`);
} else {
  console.warn(`❌ SKU não encontrado para chave: "${chave}"`);
}

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
  detalhes.textContent = '';
  Object.entries(pedido).forEach(([k, v]) => {
    const div = document.createElement('div');
    if (k === 'itens' && Array.isArray(v)) {
      const strong = document.createElement('strong');
      strong.textContent = 'Itens:';
      div.appendChild(strong);
      const ul = document.createElement('ul');
      v.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.produto || ''} / ${item.variacao || ''} - SKU: ${item.sku || '–'}`;
        ul.appendChild(li);
      });
      div.appendChild(ul);
    } else {
      const valor = typeof v === 'object' ? JSON.stringify(v, null, 2) : v;
      const strong = document.createElement('strong');
      strong.textContent = `${k}:`;
      div.appendChild(strong);
      div.appendChild(document.createTextNode(` ${valor}`));
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
