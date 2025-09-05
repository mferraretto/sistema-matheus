import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, doc, getDoc, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { saveUserDoc } from './secure-firestore.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  let responsavelUid = null;
  try {
    const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
    const respEmail = userDoc.exists() ? userDoc.data().responsavelFinanceiroEmail : null;
    if (respEmail) {
      const respSnap = await getDocs(query(collection(db, 'usuarios'), where('email', '==', respEmail)));
      if (!respSnap.empty) responsavelUid = respSnap.docs[0].id;
    }
  } catch (e) {
    console.error('Erro ao buscar responsável financeiro', e);
  }
  setupForm(user.uid, responsavelUid);
});

function setupForm(uid, responsavelUid) {
  const form = document.getElementById('pecaForm');
  const msg = document.getElementById('msg');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const dados = {
      data: form.data.value,
      nomeCliente: form.nomeCliente.value.trim(),
      numero: form.numero.value.trim(),
      apelido: form.apelido.value.trim(),
      nf: form.nf.value.trim(),
      loja: form.loja.value.trim(),
      pecaFaltante: form.peca.value.trim(),
      uid
    };
    try {
      const pass = getPassphrase() || `chave-${uid}`;
      const id = Date.now().toString();
      await saveUserDoc(db, uid, 'problemas/pecasfaltando', id, dados, pass, responsavelUid);
      form.reset();
      msg.classList.remove('hidden');
      setTimeout(() => msg.classList.add('hidden'), 3000);
    } catch (err) {
      console.error('Erro ao salvar', err);
      msg.textContent = 'Erro ao salvar';
      msg.classList.remove('hidden');
      msg.classList.add('text-red-600');
      setTimeout(() => {
        msg.classList.add('hidden');
        msg.textContent = 'Registro salvo com sucesso!';
        msg.classList.remove('text-red-600');
      }, 3000);
    }
  });
  initTabs();
}

function initTabs() {
  const links = document.querySelectorAll('.tab-link');
  const contents = document.querySelectorAll('.tab-content');
  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.dataset.tab;
      links.forEach(l => l.classList.remove('border-b-2', 'border-blue-500', 'text-blue-500'));
      contents.forEach(c => c.classList.add('hidden'));
      document.getElementById(target).classList.remove('hidden');
      link.classList.add('border-b-2', 'border-blue-500', 'text-blue-500');
    });
  });
}
