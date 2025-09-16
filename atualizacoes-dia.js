import {
  initializeApp,
  getApps,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  getAuth,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  const q = query(
    collection(db, 'expedicaoMensagens'),
    where('destinatarios', 'array-contains', user.uid),
    orderBy('createdAt', 'desc'),
  );
  onSnapshot(q, (snap) => {
    const lista = document.getElementById('listaAtualizacoes');
    lista.innerHTML = '';
    if (snap.empty) {
      lista.innerHTML = '<p class="text-gray-500">Nenhuma atualização.</p>';
      return;
    }
    snap.forEach((doc) => {
      const dados = doc.data();
      const item = document.createElement('div');
      item.className = 'p-4 bg-white rounded shadow';
      const tipo = dados.tipo || 'sobras';
      if (tipo === 'status') {
        const texto = document.createElement('div');
        texto.className = 'text-sm text-gray-700';
        const statusChave = dados.status || '';
        const statusLabel =
          dados.statusLabel ||
          (statusChave === 'impresso'
            ? 'Impresso'
            : statusChave === 'concluido'
              ? 'Concluído'
              : statusChave);
        const responsavel =
          dados.responsavelNome ||
          dados.gestorNome ||
          dados.responsavelEmail ||
          dados.gestorEmail ||
          'Equipe de expedição';
        const arquivoNome = dados.arquivoNome || dados.arquivoId || 'Etiqueta';
        texto.textContent = `${responsavel} marcou a etiqueta ${arquivoNome} como ${statusLabel}.`;
        item.appendChild(texto);
      } else {
        const quantidade = document.createElement('div');
        quantidade.className = 'text-sm text-gray-700';
        quantidade.textContent = `Qtd não expedida: ${dados.quantidade || 0}`;
        item.appendChild(quantidade);
        if (dados.motivo) {
          const motivo = document.createElement('div');
          motivo.className = 'text-sm text-gray-700';
          motivo.textContent = `Motivo: ${dados.motivo}`;
          item.appendChild(motivo);
        }
      }
      const dataHora = dados.createdAt?.toDate
        ? dados.createdAt.toDate().toLocaleString('pt-BR')
        : '';
      const dataInfo = document.createElement('div');
      dataInfo.className = 'text-xs text-gray-500 mt-1';
      dataInfo.textContent = dataHora;
      item.appendChild(dataInfo);
      lista.appendChild(item);
    });
  });
});
