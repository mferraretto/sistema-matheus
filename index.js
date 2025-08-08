import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, doc, getDoc, collectionGroup } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { decryptString } from './crypto.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
function toggleBlur(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const body = card.querySelector('.card-body');
  if (!body) return;
  const icon = card.querySelector('.toggle-blur i');
  const blurred = body.classList.toggle('blurred');
  if (icon) {
    icon.classList.toggle('fa-eye-slash', !blurred);
    icon.classList.toggle('fa-eye', blurred);
  }
  localStorage.setItem('blur_' + cardId, blurred);
}

function applyBlurStates() {
  document.querySelectorAll('[data-blur-id]').forEach(card => {
    const cardId = card.getAttribute('data-blur-id');
    const body = card.querySelector('.card-body');
    const icon = card.querySelector('.toggle-blur i');
    const blurred = localStorage.getItem('blur_' + cardId) === 'true';
    if (body) body.classList.toggle('blurred', blurred);
    if (icon) {
      icon.classList.toggle('fa-eye-slash', !blurred);
      icon.classList.toggle('fa-eye', blurred);
    }
    const btn = card.querySelector('.toggle-blur');
    if (btn) btn.addEventListener('click', () => toggleBlur(cardId));
  });
}

// apply saved blur settings for static cards immediately
applyBlurStates();


async function carregarResumoFaturamento(uid, isAdmin) {
  const el = document.getElementById('resumoFaturamento');
  if (!el) return;
  el.innerHTML = 'Carregando...';
  const hoje = new Date();
  const mesAtual = hoje.toISOString().slice(0,7); // YYYY-MM
let totalLiquido = 0;
  let totalBruto = 0;
  let pedidos = 0;
 const snap = isAdmin
    ? await getDocs(collectionGroup(db, 'faturamento'))
    : await getDocs(collection(db, `uid/${uid}/faturamento`));
  for (const docSnap of snap.docs) {
    const [ano, mes] = docSnap.id.split('-');
    if (`${ano}-${mes}` !== mesAtual) continue;
  const ownerUid = isAdmin ? docSnap.ref.parent.parent.id : uid;
    const subRef = collection(db, `uid/${ownerUid}/faturamento/${docSnap.id}/lojas`);
    const subSnap = await getDocs(subRef);
    for (const s of subSnap.docs) {
      let d = s.data();
      if (d.encrypted) {
        try {
 const passFn =
            typeof window !== 'undefined' ? window.getPassphrase : null;
          const pass = passFn ? await passFn() : null;
          const txt = await decryptString(d.encrypted, pass || ownerUid);
          d = JSON.parse(txt);
        } catch (e) {
          console.error('Erro ao descriptografar faturamento', e);
        }
      }
 totalLiquido += d.valorLiquido || 0;
      totalBruto += d.valorBruto || 0;
      pedidos += d.qtdVendas || 0;
    }
  }
  el.innerHTML = `
    <div class="card" id="resumoFaturamentoCard" data-blur-id="resumoFaturamentoCard">
      <div class="card-header">
        <div class="card-header-icon"><i class="fas fa-chart-line text-xl"></i></div>
        <div>
          <h2 class="text-xl font-bold text-gray-800">Faturamento do Mês</h2>
          <p class="text-gray-600 text-sm">${pedidos} pedidos</p>
        </div>
         <button type="button" class="ml-auto toggle-blur" data-card="resumoFaturamentoCard">
          <i class="fas fa-eye-slash"></i>
        </button>
      </div>
      <div class="card-body">
<div class="text-3xl font-bold text-green-600">Líquido: R$ ${totalLiquido.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
        <div class="text-xl font-semibold text-blue-600 mt-1">Bruto: R$ ${totalBruto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
        </div>
    </div>`;
}

async function carregarTopSkus(uid, isAdmin) {
  const el = document.getElementById('topSkus');
  if (!el) return;
  el.innerHTML = 'Carregando...';
  const hoje = new Date();
  const mesAtual = hoje.toISOString().slice(0,7);
  const mapa = {};
const snap = isAdmin
    ? await getDocs(collectionGroup(db, 'skusVendidos'))
    : await getDocs(collection(db, `uid/${uid}/skusVendidos`));
  for (const docSnap of snap.docs) {
    const [ano, mes] = docSnap.id.split('-');
    if (`${ano}-${mes}` !== mesAtual) continue;
     const ownerUid = isAdmin ? docSnap.ref.parent.parent.id : uid;
    const listaRef = collection(db, `uid/${ownerUid}/skusVendidos/${docSnap.id}/lista`);
    const listaSnap = await getDocs(listaRef);
    listaSnap.forEach(s => {
      const d = s.data();
      const chave = `${d.sku}||${d.loja || ''}`;
      mapa[chave] = (mapa[chave] || 0) + (d.total || 0);
    });
  }
  const ordenado = Object.entries(mapa).sort((a,b) => b[1]-a[1]).slice(0,5);
  if (ordenado.length === 0) {
    el.innerHTML = '<p class="text-gray-500">Sem dados</p>';
    return;
  }
  const linhas = ordenado.map(([ch,q]) => {
    const [sku, loja] = ch.split('||');
    return `<tr><td>${sku}</td><td>${q}</td><td>${loja || '-'}</td></tr>`;
  }).join('');
  el.innerHTML = `<table class="data-table"><thead><tr><th>SKU</th><th>Qtd.</th><th>Loja</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

async function iniciarPainel(user) {
  const uid = user?.uid;
  let isAdmin = false;
  if (uid) {
    try {
      const snap = await getDoc(doc(db, 'uid', uid));
      isAdmin = snap.exists() && String(snap.data().perfil || '').toLowerCase() === 'adm';
    } catch (e) { console.error(e); }
  }
  await Promise.all([
    carregarResumoFaturamento(uid, isAdmin),
    carregarTopSkus(uid, isAdmin)
  ]);
  applyBlurStates();
}

onAuthStateChanged(auth, user => {
  if (user) iniciarPainel(user);
});
