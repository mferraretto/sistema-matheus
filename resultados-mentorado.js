import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, query, orderBy, startAt, endAt, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { decryptString } from './crypto.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get('uid');

async function calcularResumo(uid) {
  const mesAtual = new Date().toISOString().slice(0, 7);
  let bruto = 0;
  let liquido = 0;
  let vendas = 0;
  try {
    const colFat = collection(db, `uid/${uid}/faturamento`);
    const q = query(colFat, orderBy('__name__'), startAt(`${mesAtual}-01`), endAt(`${mesAtual}-31`));
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const lojasSnap = await getDocs(collection(db, `uid/${uid}/faturamento/${docSnap.id}/lojas`));
      for (const lojaDoc of lojasSnap.docs) {
        let dados = lojaDoc.data();
        if (dados.encrypted) {
          const pass = getPassphrase() || `chave-${uid}`;
          let txt;
          try { txt = await decryptString(dados.encrypted, pass); }
          catch (e) { try { txt = await decryptString(dados.encrypted, uid); } catch (_) {} }
          if (txt) dados = JSON.parse(txt);
        }
        bruto += Number(dados.valorBruto) || 0;
        liquido += Number(dados.valorLiquido) || 0;
        vendas += Number(dados.vendas || dados.quantidade || 0);
      }
    }
  } catch (err) {
    console.error('Erro ao calcular faturamento', err);
  }

  let skusVendidos = 0;
  try {
    const skusRef = collection(db, `uid/${uid}/skusVendidos`);
    const skusSnap = await getDocs(skusRef);
    const setSkus = new Set();
    for (const docSnap of skusSnap.docs) {
      if (!docSnap.id.includes(mesAtual)) continue;
      const listaSnap = await getDocs(collection(db, `uid/${uid}/skusVendidos/${docSnap.id}/lista`));
      listaSnap.forEach(item => {
        const d = item.data();
        if (d.sku) setSkus.add(d.sku);
      });
    }
    skusVendidos = setSkus.size;
  } catch (err) {
    console.error('Erro ao calcular SKUs vendidos', err);
  }

  return { bruto, liquido, vendas, skusVendidos };
}

async function carregarResultados() {
  if (!uid) return;
  const container = document.getElementById('resultadoMentorado');
  container.innerHTML = '<p class="text-sm text-gray-500">Carregando...</p>';
  const { bruto, liquido, vendas, skusVendidos } = await calcularResumo(uid);
  const mesAtual = new Date().toISOString().slice(0, 7);
  let meta = 0;
  try {
    const metaDoc = await getDoc(doc(db, `uid/${uid}/metasFaturamento`, mesAtual));
    if (metaDoc.exists()) {
      meta = Number(metaDoc.data().valor) || 0;
    }
  } catch (_) {}
  const progresso = meta ? (liquido / meta) * 100 : 0;
  container.innerHTML = `
    <p><span class="font-medium">Faturamento bruto:</span> R$ ${bruto.toLocaleString('pt-BR')}</p>
    <p><span class="font-medium">Faturamento líquido:</span> R$ ${liquido.toLocaleString('pt-BR')}</p>
    <p><span class="font-medium">Quantidade de vendas:</span> ${vendas}</p>
    <p><span class="font-medium">SKUs vendidos no mês:</span> ${skusVendidos}</p>
    <p><span class="font-medium">Meta do mês:</span> R$ ${meta.toLocaleString('pt-BR')}</p>
    <p><span class="font-medium">Progresso:</span> ${progresso.toFixed(2)}%</p>
  `;
}

function initResultadosMentorado() {
  onAuthStateChanged(auth, user => {
    if (user) {
      carregarResultados();
    }
  });
}

window.initResultadosMentorado = initResultadosMentorado;
