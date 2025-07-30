import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, query, where } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { saveSecureDoc, loadSecureDoc } from './secure-firestore.js';
import { encryptString, decryptString } from './crypto.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let isAdmin = false;

onAuthStateChanged(auth, async user => {

  if (!user) {
    window.location.href = 'index.html?login=1';
     return;
  }
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    isAdmin = snap.exists() && String(snap.data().perfil || '').toLowerCase() === 'adm';
  } catch (err) {
    console.error('Erro ao verificar perfil do usuário:', err);
    isAdmin = false;
  }
});

async function buscarShopee(term) {
  try {
const url = `https://proxyshopeesearch-g6u4niudyq-uc.a.run.app?q=${encodeURIComponent(term)}`;
    const res = await fetch(url, { method: "GET" });

    if (!res.ok) {
      console.error('Erro ao buscar Shopee:', res.status);
      return [];
    }

    const data = await res.json();
    return data.items || data.data?.items || []; // ajusta conforme resposta real da Shopee
  } catch (err) {
    console.error('Falha na requisição Shopee:', err);
    return [];
  }
}


async function registrarHistorico(id, dadosAntigos, dadosNovos) {
  const payload = {
    id,
    dataHora: new Date().toISOString(),
    dadosAntigos,
    dadosNovos,
    uid: auth.currentUser.uid
   };
  const encrypted = await encryptString(JSON.stringify(payload), window.sistema.passphrase);
 // Salva o uid fora da carga criptografada para possibilitar filtragem
  await addDoc(collection(db, 'monitoramento_historico'), { uid: payload.uid, encrypted });
}

async function monitorar() {
  const user = auth.currentUser;
  if (!user) {
    alert('Necessário login');
    return;
  }

  let qAnuncios = collection(db, 'anuncios');
    let snap;
  if (!isAdmin) {
    qAnuncios = query(qAnuncios, where('uid', '==', user.uid));
     snap = await getDocs(qAnuncios);
    if (snap.empty) {
      qAnuncios = collection(db, 'anuncios');
      snap = await getDocs(qAnuncios);
    }
  } else {
    snap = await getDocs(qAnuncios);
  }

  for (const docSnap of snap.docs) {
    const dados = await loadSecureDoc(db, 'anuncios', docSnap.id, window.sistema.passphrase) || {};
     if (!isAdmin && dados.uid && dados.uid !== user.uid) {
      continue;
    }
    const termo = (dados.nome || '').trim();  // <- CORRIGIDO
    if (!termo) continue;

    console.log("Buscando por:", termo);

    const resultados = await buscarShopee(termo);
    if (!resultados.length) continue;

    const item = resultados[0];
    const ref = doc(db, 'monitoramento', docSnap.id);
    const antigaSnap = await getDoc(ref);
 let antigos = {};
    if (antigaSnap.exists()) {
      const enc = antigaSnap.data().encrypted;
      if (enc) {
        const txt = await decryptString(enc, window.sistema.passphrase);
        antigos = JSON.parse(txt);
      }
    }
    const dadosNovos = {
      nome: item.name,
      preco: item.price,
      vendas: item.sold,
      shopId: item.shopid,
      itemId: item.itemid,
      imagem: item.image
    };

    if (antigaSnap.exists()) {
      const mudou = Object.keys(dadosNovos).some(k => dadosNovos[k] !== antigos[k]);
      if (mudou) {
        await saveSecureDoc(db, 'monitoramento', docSnap.id, dadosNovos, window.sistema.passphrase);
        await registrarHistorico(docSnap.id, antigos, dadosNovos);
      }
    } else {
      await saveSecureDoc(db, 'monitoramento', docSnap.id, dadosNovos, window.sistema.passphrase);
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
// Permitir que o Enter no campo de busca acione a pesquisa
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('termoPesquisaShopee');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        pesquisarShopee();
      }
    });
  }
});

async function carregarHistorico() {
  const container = document.getElementById('historicoMonitoramento');
  container.innerHTML = '<div class="text-center">Carregando...</div>';
  const user = auth.currentUser;
  let qHist = collection(db, 'monitoramento_historico');
    let snap;
  if (!isAdmin) {
    qHist = query(qHist, where('uid', '==', user.uid));
     snap = await getDocs(qHist);
    if (snap.empty) {
      qHist = collection(db, 'monitoramento_historico');
      snap = await getDocs(qHist);
    }
  } else {
    snap = await getDocs(qHist);
  }
    const registros = [];
  for (const d of snap.docs) {
    const enc = d.data().encrypted;
    if (!enc) continue;
    const txt = await decryptString(enc, window.sistema.passphrase);
const obj = JSON.parse(txt);
    if (!isAdmin && obj.uid && obj.uid !== user.uid) {
      continue;
    }
    registros.push(obj);
  }
  const linhas = registros.map(r => {
    return `<tr><td>${r.id}</td><td>${new Date(r.dataHora).toLocaleDateString()}</td><td>R$ ${r.dadosNovos.preco}</td><td>${r.dadosNovos.vendas}</td></tr>`;
  }).join('');
  container.innerHTML = `<table class="w-full text-sm"><thead><tr><th>ID</th><th>Data</th><th>Preço</th><th>Vendas</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

window.carregarHistoricoMonitoramento = carregarHistorico;
