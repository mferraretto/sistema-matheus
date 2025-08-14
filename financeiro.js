import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { loadSecureDoc } from './secure-firestore.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  let targetUid = user.uid;
  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', user.email)));
    if (!snap.empty) {
      targetUid = snap.docs[0].id;
    }
  } catch (err) {
    console.error('Erro ao verificar acesso financeiro:', err);
  }
  await carregarSkus(targetUid);
  await carregarSaques(targetUid);
});

async function carregarSkus(uid) {
  const container = document.getElementById('resumoSkus');
  if (!container) return;
  container.innerHTML = 'Carregando...';
  const snap = await getDocs(collection(db, `uid/${uid}/skuimpressos`));
  const resumo = {};
  snap.forEach(doc => {
    const dados = doc.data();
    const sku = dados.sku || 'sem-sku';
    const qtd = Number(dados.quantidade) || 0;
    resumo[sku] = (resumo[sku] || 0) + qtd;
  });
  container.innerHTML = '';
  if (!Object.keys(resumo).length) {
    container.innerHTML = '<p class="text-gray-500">Nenhum SKU encontrado.</p>';
    return;
  }
  const ul = document.createElement('ul');
  ul.className = 'list-disc pl-4 space-y-1';
  Object.entries(resumo).forEach(([sku, qtd]) => {
    const li = document.createElement('li');
    li.textContent = `${sku}: ${qtd}`;
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

async function carregarSaques(uid) {
  const container = document.getElementById('resumoSaques');
  if (!container) return;
  container.innerHTML = 'Carregando...';
  const pass = getPassphrase() || `chave-${uid}`;
  const snap = await getDocs(collection(db, `uid/${uid}/saques`));
  let total = 0;
  let totalComissao = 0;
  for (const docSnap of snap.docs) {
    const dados = await loadSecureDoc(db, `uid/${uid}/saques`, docSnap.id, pass);
    if (!dados) continue;
    total += dados.valorTotal || 0;
    const lojasSnap = await getDocs(collection(db, `uid/${uid}/saques/${docSnap.id}/lojas`));
    for (const lojaDoc of lojasSnap.docs) {
      const lojaDados = await loadSecureDoc(db, `uid/${uid}/saques/${docSnap.id}/lojas`, lojaDoc.id, pass);
      if (!lojaDados) continue;
      const valor = lojaDados.valor || 0;
      const comissao = lojaDados.comissao || 0;
      totalComissao += valor * (comissao / 100);
    }
  }
  container.innerHTML = `<p>Total de Saques: <strong>R$ ${total.toLocaleString('pt-BR')}</strong></p>
<p>Total de Comissões: <strong>R$ ${totalComissao.toLocaleString('pt-BR')}</strong></p>`;
}
