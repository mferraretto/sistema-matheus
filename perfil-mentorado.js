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
  const titulo = document.createElement('h3');
  titulo.className = 'font-bold';
  titulo.textContent = email;
  card.appendChild(titulo);

  const campos = [
    { field: 'nome', placeholder: 'Nome', value: data.nome || '' },
    { field: 'loja', placeholder: 'Loja', value: data.loja || '' },
    { field: 'segmento', placeholder: 'Segmento', value: data.segmento || '' },
    { field: 'tempoOperacao', placeholder: 'Tempo de operação', value: data.tempoOperacao || '' },
    { field: 'shopee', placeholder: 'Link Shopee', value: data.links?.shopee || '' },
    { field: 'mercadoLivre', placeholder: 'Link Mercado Livre', value: data.links?.mercadoLivre || '' },
    { field: 'site', placeholder: 'Site próprio', value: data.links?.site || '' },
    { field: 'instagram', placeholder: 'Instagram', value: data.links?.instagram || '' }
  ];

  campos.forEach(c => {
    const input = document.createElement('input');
    input.className = 'form-control';
    input.placeholder = c.placeholder;
    input.value = c.value;
    input.dataset.field = c.field;
    card.appendChild(input);
  });

  const objetivos = document.createElement('textarea');
  objetivos.className = 'form-control';
  objetivos.placeholder = 'Objetivos';
  objetivos.textContent = data.objetivos || '';
  card.appendChild(objetivos);

  const btn = document.createElement('button');
  btn.className = 'btn btn-primary salvar';
  btn.textContent = 'Salvar';
  card.appendChild(btn);

  btn.addEventListener('click', async () => {
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
      objetivos: objetivos.value.trim()
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
  list.textContent = '';

  if (singleUid) {
    try {
      const userDoc = await getDoc(doc(db, 'usuarios', singleUid));
      if (!userDoc.exists()) {
        const p = document.createElement('p');
        p.className = 'text-sm text-gray-500';
        p.textContent = 'Usuário não encontrado.';
        list.appendChild(p);
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
      const p = document.createElement('p');
      p.className = 'text-sm text-red-500';
      p.textContent = 'Erro ao carregar usuário.';
      list.appendChild(p);
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
