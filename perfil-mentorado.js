import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const urlParams = new URLSearchParams(window.location.search);
const singleUid = urlParams.get('uid');

function createPerfilCard(uid, email, data = {}) {
  const card = document.createElement('div');
  card.className = 'border p-4 rounded space-y-2';
  card.innerHTML = `
    <h3 class="font-bold">${email}</h3>
    <input class="form-control" placeholder="Nome" value="${data.nome || ''}" data-field="nome">
    <input class="form-control" placeholder="Loja" value="${data.loja || ''}" data-field="loja">
    <input class="form-control" placeholder="Segmento" value="${data.segmento || ''}" data-field="segmento">
    <input class="form-control" placeholder="Tempo de operação" value="${data.tempoOperacao || ''}" data-field="tempoOperacao">
    <input class="form-control" placeholder="Link Shopee" value="${data.links?.shopee || ''}" data-field="shopee">
    <input class="form-control" placeholder="Link Mercado Livre" value="${data.links?.mercadoLivre || ''}" data-field="mercadoLivre">
    <input class="form-control" placeholder="Site próprio" value="${data.links?.site || ''}" data-field="site">
    <input class="form-control" placeholder="Instagram" value="${data.links?.instagram || ''}" data-field="instagram">
    <textarea class="form-control" placeholder="Objetivos">${data.objetivos || ''}</textarea>
    <button class="btn btn-primary salvar">Salvar</button>
  `;

  card.querySelector('.salvar').addEventListener('click', async () => {
    const getVal = (field) => card.querySelector(`[data-field="${field}"]`).value.trim();
    const payload = {
      nome: getVal('nome'),
      loja: getVal('loja'),
      segmento: getVal('segmento'),
      tempoOperacao: getVal('tempoOperacao'),
      links: {
        shopee: getVal('shopee'),
        mercadoLivre: getVal('mercadoLivre'),
        site: getVal('site'),
        instagram: getVal('instagram')
      },
      objetivos: card.querySelector('textarea').value.trim()
    };
    try {
      await setDoc(doc(db, 'perfilMentorado', uid), payload, { merge: true });
      alert('Perfil salvo!');
    } catch (e) {
      console.error('Erro ao salvar perfil:', e);
      alert('Erro ao salvar.');
    }
  });
  return card;
}

async function carregarPerfis() {
  const list = document.getElementById('perfilMentoradoList');
  list.innerHTML = '';

  if (singleUid) {
    try {
      const userDoc = await getDoc(doc(db, 'usuarios', singleUid));
      if (!userDoc.exists()) {
        list.innerHTML = '<p class="text-sm text-gray-500">Usuário não encontrado.</p>';
        return;
      }
      const email = userDoc.data().email || singleUid;
      let perfilData = {};
      try {
        const perfilSnap = await getDoc(doc(db, 'perfilMentorado', singleUid));
        if (perfilSnap.exists()) {
          perfilData = perfilSnap.data();
        }
      } catch (e) {
        console.error('Erro ao carregar perfil do mentorado:', e);
      }
      list.appendChild(createPerfilCard(singleUid, email, perfilData));
    } catch (e) {
      console.error('Erro ao carregar usuário:', e);
      list.innerHTML = '<p class="text-sm text-red-500">Erro ao carregar usuário.</p>';
    }
    return;
  }

  const q = query(collection(db, 'usuarios'), where('perfil', '==', 'Gestor'));
  const snap = await getDocs(q);
  for (const docSnap of snap.docs) {
    const uid = docSnap.id;
    const email = docSnap.data().email || uid;
    let perfilData = {};
    try {
      const perfilSnap = await getDoc(doc(db, 'perfilMentorado', uid));
      if (perfilSnap.exists()) {
        perfilData = perfilSnap.data();
      }
    } catch (e) {
      console.error('Erro ao carregar perfil do mentorado:', e);
    }
    list.appendChild(createPerfilCard(uid, email, perfilData));
  }
}

function initPerfilMentorado() {
  onAuthStateChanged(auth, user => {
    if (user) {
      carregarPerfis();
    }
  });
}

window.initPerfilMentorado = initPerfilMentorado;
