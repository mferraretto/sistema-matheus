import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const teamListEl = document.getElementById('teamList');
const selectEls = [document.getElementById('fileRecipients'), document.getElementById('messageRecipients'), document.getElementById('alertRecipients')];
const commsListEl = document.getElementById('commsList');

function addUserOption(user) {
  const li = document.createElement('li');
  li.textContent = user.nome || user.email || user.id;
  teamListEl.appendChild(li);
  selectEls.forEach(sel => {
    const opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = user.nome || user.email || user.id;
    sel.appendChild(opt);
  });
}

function renderComm(c) {
  const li = document.createElement('li');
  li.className = 'border p-2 rounded';
  if (c.tipo === 'arquivo') {
    li.innerHTML = `<strong>Arquivo:</strong> <a href="${c.arquivoUrl}" target="_blank" class="text-blue-600 underline">${c.arquivoNome || 'Arquivo'}</a>`;
  } else if (c.tipo === 'mensagem') {
    li.innerHTML = `<strong>Mensagem:</strong> ${c.texto}`;
  } else if (c.tipo === 'alerta') {
    li.innerHTML = `<strong>Alerta:</strong> ${c.texto}`;
  }
  commsListEl.appendChild(li);
}

async function loadTeam(user, perfil, data) {
  let members = [];
  if (['gestor', 'mentor', 'adm', 'admin', 'administrador'].includes(perfil)) {
    const snap = await getDocs(query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', user.email)));
    members = snap.docs.map(d => ({ id: d.id, email: d.data().email || '', nome: d.data().nome || d.data().email || d.id }));
  } else {
    const emails = [];
    if (data.responsavelFinanceiroEmail) emails.push(data.responsavelFinanceiroEmail);
    if (Array.isArray(data.gestoresFinanceirosEmails)) emails.push(...data.gestoresFinanceirosEmails);
    for (const email of emails) {
      const snap = await getDocs(query(collection(db, 'usuarios'), where('email', '==', email)));
      snap.forEach(d => members.push({ id: d.id, email: email, nome: d.data().nome || email }));
    }
  }
  members.forEach(addUserOption);
}

async function loadComms(uid) {
  const snap = await getDocs(collection(db, 'comunicacao'));
  snap.forEach(docSnap => {
    const c = docSnap.data();
    if ((Array.isArray(c.destinatarios) && c.destinatarios.includes(uid)) || c.remetente === uid) {
      renderComm(c);
    }
  });
}

onAuthStateChanged(auth, async user => {
  if (!user) return;
  const userSnap = await getDoc(doc(db, 'usuarios', user.uid));
  const data = userSnap.exists() ? userSnap.data() : {};
  const perfil = (data.perfil || '').toLowerCase();
  await loadTeam(user, perfil, data);
  await loadComms(user.uid);

  document.getElementById('sendFileBtn').addEventListener('click', async () => {
    const file = document.getElementById('fileInput').files[0];
    const dest = Array.from(document.getElementById('fileRecipients').selectedOptions).map(o => o.value);
    if (!file || dest.length === 0) return;
    const storageRef = ref(storage, `comunicacao/${user.uid}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await addDoc(collection(db, 'comunicacao'), {
      tipo: 'arquivo',
      arquivoNome: file.name,
      arquivoUrl: url,
      remetente: user.uid,
      destinatarios: dest,
      timestamp: serverTimestamp()
    });
    document.getElementById('fileInput').value = '';
  });

  document.getElementById('sendMessageBtn').addEventListener('click', async () => {
    const texto = document.getElementById('messageText').value.trim();
    const dest = Array.from(document.getElementById('messageRecipients').selectedOptions).map(o => o.value);
    if (!texto || dest.length === 0) return;
    await addDoc(collection(db, 'comunicacao'), {
      tipo: 'mensagem',
      texto,
      remetente: user.uid,
      destinatarios: dest,
      timestamp: serverTimestamp()
    });
    document.getElementById('messageText').value = '';
  });

  document.getElementById('sendAlertBtn').addEventListener('click', async () => {
    const texto = document.getElementById('alertText').value.trim();
    const dest = Array.from(document.getElementById('alertRecipients').selectedOptions).map(o => o.value);
    if (!texto || dest.length === 0) return;
    await addDoc(collection(db, 'comunicacao'), {
      tipo: 'alerta',
      texto,
      remetente: user.uid,
      destinatarios: dest,
      timestamp: serverTimestamp()
    });
    document.getElementById('alertText').value = '';
  });
});
