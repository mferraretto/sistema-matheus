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
  let usuarios = [{ uid: user.uid, nome: user.displayName || user.email }];
  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', user.email)));
    if (!snap.empty) {
      usuarios = snap.docs.map(d => ({ uid: d.id, nome: d.data().nome || d.id }));
    }
  } catch (err) {
    console.error('Erro ao verificar acesso financeiro:', err);
  }
  await carregarSkus(usuarios);
  await carregarSaques(usuarios);
});

async function carregarSkus(usuarios) {
  const container = document.getElementById('resumoSkus');
  if (!container) return;
  container.innerHTML = '';
  for (const usuario of usuarios) {
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/skusVendidos`));
    const resumo = {};
    for (const docSnap of snap.docs) {
      const listaRef = collection(db, `uid/${usuario.uid}/skusVendidos/${docSnap.id}/lista`);
      const listaSnap = await getDocs(listaRef);
      listaSnap.forEach(item => {
        const dados = item.data();
        const sku = dados.sku || 'sem-sku';
        const qtd = Number(dados.total || dados.quantidade) || 0;
        const sobra = Number(dados.valorLiquido || dados.sobraReal || 0);
        if (!resumo[sku]) resumo[sku] = { qtd: 0, sobra: 0 };
        resumo[sku].qtd += qtd;
        resumo[sku].sobra += sobra;
      });
    }
    const section = document.createElement('div');
    section.className = 'mb-4';
    const titulo = document.createElement('h3');
    titulo.className = 'font-bold';
    titulo.textContent = usuario.nome;
    section.appendChild(titulo);
    if (!Object.keys(resumo).length) {
      const p = document.createElement('p');
      p.className = 'text-gray-500';
      p.textContent = 'Nenhum SKU encontrado.';
      section.appendChild(p);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'list-disc pl-4 space-y-1';
      Object.entries(resumo).forEach(([sku, info]) => {
        const li = document.createElement('li');
        li.textContent = `${sku}: ${info.qtd} | Sobra: R$ ${info.sobra.toLocaleString('pt-BR')}`;
        ul.appendChild(li);
      });
      section.appendChild(ul);
    }
    container.appendChild(section);
  }
}

async function carregarSaques(usuarios) {
  const container = document.getElementById('resumoSaques');
  if (!container) return;
  container.innerHTML = 'Carregando...';
  let total = 0;
  let totalComissao = 0;
  for (const usuario of usuarios) {
    const pass = getPassphrase() || `chave-${usuario.uid}`;
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/saques`));
    for (const docSnap of snap.docs) {
      const dados = await loadSecureDoc(db, `uid/${usuario.uid}/saques`, docSnap.id, pass);
      if (!dados) continue;
      total += dados.valorTotal || 0;
      const lojasSnap = await getDocs(collection(db, `uid/${usuario.uid}/saques/${docSnap.id}/lojas`));
      for (const lojaDoc of lojasSnap.docs) {
        const lojaDados = await loadSecureDoc(db, `uid/${usuario.uid}/saques/${docSnap.id}/lojas`, lojaDoc.id, pass);
        if (!lojaDados) continue;
        const valor = lojaDados.valor || 0;
        const comissao = lojaDados.comissao || 0;
        totalComissao += valor * (comissao / 100);
      }
    }
  }
  container.innerHTML = `<p>Total de Saques: <strong>R$ ${total.toLocaleString('pt-BR')}</strong></p>` +
    `<p>Total de Comissões: <strong>R$ ${totalComissao.toLocaleString('pt-BR')}</strong></p>`;
}

