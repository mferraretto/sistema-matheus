import {
  initializeApp,
  getApps,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  collectionGroup,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { saveSecureDoc, loadSecureDoc } from './secure-firestore.js';
import { encryptString, decryptString } from './crypto.js';
import logger from './logger.js';
import {
  getAuth,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let isAdmin = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  try {
    const snap = await getDoc(doc(db, 'uid', user.uid));
    const perfil = String(snap.data().perfil || '')
      .toLowerCase()
      .trim();
    isAdmin =
      snap.exists() && ['adm', 'admin', 'administrador'].includes(perfil);
  } catch (err) {
    console.error('Erro ao verificar perfil do usuário:', err);
    isAdmin = false;
  }
});

async function buscarShopee(term) {
  try {
    const url = `https://proxyshopeesearch-g6u4niudyq-uc.a.run.app?q=${encodeURIComponent(term)}`;
    const res = await fetch(url, { method: 'GET' });

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

async function registrarHistorico(uid, id, dadosAntigos, dadosNovos) {
  const payload = {
    id,
    dataHora: new Date().toISOString(),
    dadosAntigos,
    dadosNovos,
    uid,
  };
  const encrypted = await encryptString(
    JSON.stringify(payload),
    getPassphrase(),
  );
  await addDoc(collection(db, `uid/${uid}/monitoramento_historico`), {
    encrypted,
  });
}

async function monitorar() {
  const user = auth.currentUser;
  if (!user) {
    alert('Necessário login');
    return;
  }

  let snap;

  if (!isAdmin) {
    qAnuncios = query(qAnuncios, where('uid', '==', user.uid));
    snap = await getDocs(collection(db, `uid/${user.uid}/anuncios`));
  } else {
    snap = await getDocs(collectionGroup(db, 'anuncios'));
  }

  for (const docSnap of snap.docs) {
    const ownerUid = docSnap.ref.parent.parent.id;
    const dados =
      (await loadSecureDoc(
        db,
        `uid/${ownerUid}/anuncios`,
        docSnap.id,
        getPassphrase(),
      )) || {};
    if (!isAdmin && ownerUid !== user.uid) {
      continue;
    }
    const termo = (dados.nome || '').trim(); // <- CORRIGIDO
    if (!termo) continue;

    logger.log('Buscando por:', termo);

    const resultados = await buscarShopee(termo);
    if (!resultados.length) continue;

    const item = resultados[0];
    const ref = doc(db, 'uid', ownerUid, 'monitoramento', docSnap.id);
    const antigaSnap = await getDoc(ref);
    let antigos = {};
    if (antigaSnap.exists()) {
      const enc = antigaSnap.data().encrypted;
      if (enc) {
        const txt = await decryptString(enc, getPassphrase());
        antigos = JSON.parse(txt);
      }
    }
    const dadosNovos = {
      nome: item.name,
      preco: item.price,
      vendas: item.sold,
      shopId: item.shopid,
      itemId: item.itemid,
      imagem: item.image,
    };

    if (antigaSnap.exists()) {
      const mudou = Object.keys(dadosNovos).some(
        (k) => dadosNovos[k] !== antigos[k],
      );
      if (mudou) {
        await saveSecureDoc(
          db,
          `uid/${ownerUid}/monitoramento`,
          docSnap.id,
          dadosNovos,
          getPassphrase(),
        );
        await registrarHistorico(ownerUid, docSnap.id, antigos, dadosNovos);
      }
    } else {
      await saveSecureDoc(
        db,
        `uid/${ownerUid}/monitoramento`,
        docSnap.id,
        dadosNovos,
        getPassphrase(),
      );
      await registrarHistorico(ownerUid, docSnap.id, {}, dadosNovos);
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
    container.innerHTML =
      '<div class="text-center">Nenhum resultado encontrado.</div>';
    return;
  }
  const linhas = resultados
    .map((r) => {
      return `<tr><td>${r.name}</td><td>R$ ${r.price}</td><td>${r.sold}</td></tr>`;
    })
    .join('');
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
  let snap;
  if (!isAdmin) {
    snap = await getDocs(
      collection(db, `uid/${user.uid}/monitoramento_historico`),
    );
  } else {
    snap = await getDocs(collectionGroup(db, 'monitoramento_historico'));
  }
  const registros = [];
  for (const d of snap.docs) {
    const enc = d.data().encrypted;
    if (!enc) continue;
    const txt = await decryptString(enc, getPassphrase());
    const obj = JSON.parse(txt);
    if (isAdmin) obj.uid = d.ref.parent.parent.id;
    registros.push(obj);
  }
  const linhas = registros
    .map((r) => {
      return `<tr><td>${r.id}</td><td>${new Date(r.dataHora).toLocaleDateString()}</td><td>R$ ${r.dadosNovos.preco}</td><td>${r.dadosNovos.vendas}</td></tr>`;
    })
    .join('');
  container.innerHTML = `<table class="w-full text-sm"><thead><tr><th>ID</th><th>Data</th><th>Preço</th><th>Vendas</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

window.carregarHistoricoMonitoramento = carregarHistorico;
