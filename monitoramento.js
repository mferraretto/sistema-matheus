import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, query, where } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_EMAIL = 'admin@empresa.com';

async function buscarShopee(term) {
  try {
   const url =
      "https://us-central1-matheus-35023.cloudfunctions.net/proxyShopeeSearch?q=" +
      encodeURIComponent(term);
    const res = await fetch(url);

    if (!res.ok) {
      console.error('Erro ao buscar Shopee:', res.status);
      return [];
    }

    const data = await res.json();
    return data.items || data.data?.items || []; // depende do formato da API da Shopee
  } catch (err) {
    console.error('Falha na requisição Shopee:', err);
    return [];
  }
}

async function registrarHistorico(id, dadosAntigos, dadosNovos) {
  await addDoc(collection(db, 'monitoramento_historico'), {
    id,
    dataHora: new Date().toISOString(),
    dadosAntigos,
    dadosNovos,
    uid: auth.currentUser.uid
  });
}

async function monitorar() {
  const user = auth.currentUser;
  if (!user) {
    alert('Necessário login');
    return;
  }
  let qAnuncios = collection(db, 'anuncios');
  if (user.email !== ADMIN_EMAIL) {
    qAnuncios = query(qAnuncios, where('uid', '==', user.uid));
  }
  const snap = await getDocs(qAnuncios);
  for (const docSnap of snap.docs) {
    const dados = docSnap.data();
    const termo = dados.skuVariante || dados.nome || '';
    if (!termo) continue;
    const resultados = await buscarShopee(termo);
    if (!resultados.length) continue;
    const item = resultados[0];
    const ref = doc(db, 'monitoramento', docSnap.id);
    const antigaSnap = await getDoc(ref);
    const dadosNovos = {
      nome: item.name,
      preco: item.price,
      vendas: item.sold,
      shopId: item.shopid,
      itemId: item.itemid,
      imagem: item.image
    };
    if (antigaSnap.exists()) {
      const antigos = antigaSnap.data();
      const mudou = Object.keys(dadosNovos).some(k => dadosNovos[k] !== antigos[k]);
      if (mudou) {
        await setDoc(ref, dadosNovos);
        await registrarHistorico(docSnap.id, antigos, dadosNovos);
      }
    } else {
      await setDoc(ref, dadosNovos);
      await registrarHistorico(docSnap.id, {}, dadosNovos);
    }
  }
  alert('Monitoramento concluído');
}

window.executarMonitoramento = monitorar;
async function pesquisarShopee() {
  const termoInput = document.getElementById('termoPesquisaShopee');
  const termo = (termoInput && termoInput.value.trim()) || '';
  if (!termo) {
    alert('Digite um termo para pesquisar');
    return;
  }
  const container = document.getElementById('resultadoPesquisaShopee');
  container.innerHTML = '<div class="text-center">Carregando...</div>';
  const resultados = await buscarShopee(termo);
  if (!resultados.length) {
    container.innerHTML = '<div class="text-center">Nenhum resultado encontrado.</div>';
    return;
  }
  const linhas = resultados.map(r => {
    return `<tr><td>${r.name}</td><td>R$ ${r.price}</td><td>${r.sold}</td></tr>`;
  }).join('');
  container.innerHTML = `<table class="w-full text-sm"><thead><tr><th>Nome</th><th>Preço</th><th>Vendas</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

window.pesquisarShopee = pesquisarShopee;

async function carregarHistorico() {
  const container = document.getElementById('historicoMonitoramento');
  container.innerHTML = '<div class="text-center">Carregando...</div>';
  const user = auth.currentUser;
  let qHist = collection(db, 'monitoramento_historico');
  if (user.email !== ADMIN_EMAIL) {
    qHist = query(qHist, where('uid', '==', user.uid));
  }
  const snap = await getDocs(qHist);
  const registros = snap.docs.map(d => d.data());
  const linhas = registros.map(r => {
    return `<tr><td>${r.id}</td><td>${new Date(r.dataHora).toLocaleDateString()}</td><td>R$ ${r.dadosNovos.preco}</td><td>${r.dadosNovos.vendas}</td></tr>`;
  }).join('');
  container.innerHTML = `<table class="w-full text-sm"><thead><tr><th>ID</th><th>Data</th><th>Preço</th><th>Vendas</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

window.carregarHistoricoMonitoramento = carregarHistorico;
