import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, addDoc, serverTimestamp, onSnapshot, orderBy } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const teamListEl = document.getElementById('teamList');
const selectEls = [document.getElementById('fileRecipients'), document.getElementById('messageRecipients'), document.getElementById('alertRecipients')];
const commsListEl = document.getElementById('commsList');

const chatModal = document.getElementById('chatModal');
const chatUserName = document.getElementById('chatUserName');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
const closeChat = document.getElementById('closeChat');
let chatUnsub = null;
let currentChatUser = null;
const usersMap = {};

function addUserOption(user) {
  const li = document.createElement('li');
  li.textContent = user.nome || user.email || user.id;
  li.className = 'cursor-pointer hover:underline';
  li.addEventListener('click', () => openChat(user));
  teamListEl.appendChild(li);
  usersMap[user.id] = user;
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

function getConversationId(a, b) {
  return [a, b].sort().join('_');
}

function renderChatMessage(msg) {
  const div = document.createElement('div');
  const isMe = msg.remetente === auth.currentUser.uid;
  div.className = `flex ${isMe ? 'justify-end' : 'justify-start'}`;
  const bubble = document.createElement('div');
  bubble.className = `px-3 py-2 rounded-lg ${isMe ? 'bg-green-500 text-white' : 'bg-gray-300'}`;
  bubble.textContent = msg.texto;
  div.appendChild(bubble);
  chatMessages.appendChild(div);
}

function openChat(userInfo) {
  currentChatUser = userInfo;
  chatUserName.textContent = userInfo.nome || userInfo.email || userInfo.id;
  chatModal.classList.remove('hidden');
  chatModal.classList.add('flex');
  if (chatUnsub) chatUnsub();
  chatMessages.innerHTML = '';
  const cid = getConversationId(auth.currentUser.uid, userInfo.id);
  const q = query(
    collection(db, 'comunicacao'),
    where('tipo', '==', 'mensagem'),
    where('conversa', '==', cid),
    orderBy('timestamp')
  );
  chatUnsub = onSnapshot(q, snap => {
    chatMessages.innerHTML = '';
    snap.forEach(d => renderChatMessage(d.data()));
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
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

closeChat.addEventListener('click', () => {
  chatModal.classList.add('hidden');
  if (chatUnsub) chatUnsub();
});

chatSend.addEventListener('click', async () => {
  const texto = chatInput.value.trim();
  if (!texto || !currentChatUser) return;
  const cid = getConversationId(auth.currentUser.uid, currentChatUser.id);
  await addDoc(collection(db, 'comunicacao'), {
    tipo: 'mensagem',
    texto,
    remetente: auth.currentUser.uid,
    destinatarios: [currentChatUser.id],
    conversa: cid,
    timestamp: serverTimestamp()
  });
  chatInput.value = '';
});

chatInput.addEventListener('keyup', e => {
  if (e.key === 'Enter') chatSend.click();
});

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
    const conversa = dest.length === 1 ? getConversationId(user.uid, dest[0]) : null;
    await addDoc(collection(db, 'comunicacao'), {
      tipo: 'mensagem',
      texto,
      remetente: user.uid,
      destinatarios: dest,
      ...(conversa && { conversa }),
      timestamp: serverTimestamp()
    });
    document.getElementById('messageText').value = '';
    if (conversa && usersMap[dest[0]]) openChat(usersMap[dest[0]]);
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
