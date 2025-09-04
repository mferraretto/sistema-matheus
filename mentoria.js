import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc, getDocs, orderBy, startAt, endAt } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { decryptString } from './crypto.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function carregarUsuariosFinanceiros(user) {
  const container = document.getElementById('mentoradosList');
  const mesAtual = new Date().toISOString().slice(0, 7);
  const q = query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', user.email));
  onSnapshot(q, async snap => {
    container.innerHTML = '';
    if (snap.empty) {
      container.innerHTML = '<p class="text-sm text-gray-500 col-span-full">Nenhum usuário encontrado.</p>';
      return;
    }
    for (const docSnap of snap.docs) {
      const dados = docSnap.data();
      const email = dados.email || '';
      let perfilData = {};
      let nome = dados.nome;
      try {
        const perfil = await getDoc(doc(db, 'perfilMentorado', docSnap.id));
        if (perfil.exists()) {
          perfilData = perfil.data();
          if (!nome) nome = perfilData.nome;
        }
      } catch (_) {}
      nome = nome || docSnap.id;
      const status = dados.status || '-';
      const inicio = dados.dataInicio?.toDate ? dados.dataInicio.toDate().toLocaleDateString('pt-BR') :
        dados.createdAt?.toDate ? dados.createdAt.toDate().toLocaleDateString('pt-BR') : '-';
      let meta = '-';
      try {
        const metaDoc = await getDoc(doc(db, `uid/${docSnap.id}/metasFaturamento`, mesAtual));
        if (metaDoc.exists()) {
          const valor = Number(metaDoc.data().valor) || 0;
          meta = `R$ ${valor.toLocaleString('pt-BR')}`;
        }
      } catch (_) {}
      const card = document.createElement('div');
      card.className = 'card p-4 space-y-1 cursor-pointer';
      card.innerHTML = `
        <h3 class="text-lg font-semibold">${nome}</h3>
        <p><span class="font-medium">Email:</span> ${email}</p>
        <p><span class="font-medium">Início:</span> ${inicio}</p>
        <p><span class="font-medium">Status:</span> ${status}</p>
        <p><span class="font-medium">Meta:</span> ${meta}</p>
        <a href="perfil-mentorado.html?uid=${docSnap.id}" class="text-blue-500 hover:underline" onclick="event.stopPropagation()">Editar</a>
      `;
      card.addEventListener('click', e => {
        if (e.target.tagName === 'A') return;
        window.open(`perfil-mentorado.html?uid=${docSnap.id}`, '_blank');
      });
      container.appendChild(card);
    }
  });
}

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

async function mostrarDetalhes(uid, dados, perfil) {
  const { bruto, liquido, vendas, skusVendidos } = await calcularResumo(uid);
  const modal = document.getElementById('mentorDetailModal');
  const content = document.getElementById('mentorDetailContent');
  const fullData = { uid, ...dados, ...perfil };
  const extra = Object.entries(fullData)
    .map(([k, v]) => `<p><span class="font-medium">${k}:</span> ${typeof v === 'object' ? JSON.stringify(v) : v}</p>`)
    .join('');
  content.innerHTML = `
    <h3 class="text-lg font-semibold mb-2">${fullData.nome || uid}</h3>
    <p><span class="font-medium">Faturamento bruto:</span> R$ ${bruto.toLocaleString('pt-BR')}</p>
    <p><span class="font-medium">Faturamento líquido:</span> R$ ${liquido.toLocaleString('pt-BR')}</p>
    <p><span class="font-medium">Quantidade de vendas:</span> ${vendas}</p>
    <p><span class="font-medium">SKUs vendidos no mês:</span> ${skusVendidos}</p>
    <hr class="my-2">
    ${extra}
  `;
  modal.classList.remove('hidden');
}

function initMentoria() {
  const modal = document.getElementById('mentorDetailModal');
  const closeBtn = document.getElementById('mentorDetailClose');
  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
  onAuthStateChanged(auth, user => {
    if (user) {
      carregarUsuariosFinanceiros(user);
    }
  });
}

window.initMentoria = initMentoria;

