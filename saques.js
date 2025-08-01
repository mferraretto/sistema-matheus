import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { decryptString } from './crypto.js';
import { saveSecureDoc, loadSecureDoc } from './secure-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  await carregarSaques();
});

export async function registrarSaque() {
  const data = document.getElementById('dataSaque').value;
  const loja = document.getElementById('lojaSaque').value.trim();
  const valor = parseFloat(document.getElementById('valorSaque').value);

  if (!data || !loja || isNaN(valor) || valor <= 0) {
    alert('Preencha data, loja e valor corretamente.');
    return;
  }

  const uid = auth.currentUser.uid;
  const pass = getPassphrase() || `chave-${uid}`;
  const lojaId = loja.replace(/[.#$/\[\]]/g, '_');

  await saveSecureDoc(db, `usuarios/${uid}/saques/${data}/lojas`, lojaId, { loja, valor, uid }, pass);

  const snap = await getDocs(collection(db, `usuarios/${uid}/saques/${data}/lojas`));
  let total = 0;
  for (const d of snap.docs) {
    const enc = d.data().encrypted;
    if (!enc) continue;
    const txt = await decryptString(enc, pass);
    const obj = JSON.parse(txt);
    total += obj.valor || 0;
  }

  const existente = await loadSecureDoc(db, `usuarios/${uid}/saques`, data, pass);
  const pago = existente?.pago || false;

  await saveSecureDoc(db, `usuarios/${uid}/saques`, data, { data, valorTotal: total, pago, uid }, pass);

  document.getElementById('valorSaque').value = '';
  document.getElementById('lojaSaque').value = '';
  await carregarSaques();
}

export async function carregarSaques() {
  const container = document.getElementById('listaSaques');
  if (!container) return;
  container.innerHTML = '<p>Carregando...</p>';

  const filtroMes = document.getElementById('filtroMesSaques')?.value;
  const modo = document.getElementById('modoVisualizacaoSaques')?.value || 'cards';
  const uid = auth.currentUser.uid;
  const pass = getPassphrase() || `chave-${uid}`;
  const snap = await getDocs(collection(db, `usuarios/${uid}/saques`));
  container.innerHTML = '';
  container.className = modo === 'cards'
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4'
    : 'p-4 space-y-2';

  for (const docSnap of snap.docs) {
    const dados = await loadSecureDoc(db, `usuarios/${uid}/saques`, docSnap.id, pass);
    if (!dados) continue;
    if (filtroMes) {
      const [anoF, mesF] = filtroMes.split('-');
      const [ano, mes] = docSnap.id.split('-');
      if (ano !== anoF || mes !== mesF) continue;
    }
    const total = dados.valorTotal || 0;
    const pago = !!dados.pago;

    let elem;
    if (modo === 'cards') {
      elem = document.createElement('div');
      elem.className = 'bg-white rounded-2xl shadow-lg p-4 border border-gray-200 hover:shadow-xl transition';
      elem.innerHTML = `
        <div class="flex justify-between items-center mb-2">
          <div class="text-sm text-gray-500 flex items-center gap-2">
            <i class="fas fa-calendar-alt text-blue-600"></i>
            <span class="font-semibold">${docSnap.id}</span>
          </div>
          <label class="inline-flex items-center text-sm">
            <input type="checkbox" onchange="alternarPago('${docSnap.id}')" ${pago ? 'checked' : ''}>
            <span class="ml-1">Pago</span>
          </label>
        </div>
        <div class="text-xl font-bold text-green-600 mb-2">R$ ${total.toLocaleString('pt-BR')}</div>
        <div class="flex justify-between items-center">
          <button onclick="mostrarDetalhesSaque('${docSnap.id}')" class="btn btn-outline">
            <i class="fas fa-eye"></i> Ver Detalhes
          </button>
        </div>
        <div id="detalhes-${docSnap.id}" class="mt-3 text-sm text-gray-700" style="display:none;"></div>
      `;
    } else {
      elem = document.createElement('div');
      elem.className = 'bg-white rounded-lg p-3 border';
      elem.innerHTML = `
        <div class="flex justify-between items-center">
          <div class="text-sm text-gray-500 flex items-center gap-2 font-semibold">
            <i class="fas fa-calendar-alt text-blue-600"></i>${docSnap.id}
          </div>
          <label class="inline-flex items-center text-sm">
            <input type="checkbox" onchange="alternarPago('${docSnap.id}')" ${pago ? 'checked' : ''}>
            <span class="ml-1">Pago</span>
          </label>
        </div>
        <div class="flex justify-between items-center mt-1">
          <div class="text-lg font-bold text-green-600">R$ ${total.toLocaleString('pt-BR')}</div>
          <button onclick="mostrarDetalhesSaque('${docSnap.id}')" class="btn btn-outline text-sm"><i class="fas fa-eye"></i></button>
        </div>
        <div id="detalhes-${docSnap.id}" class="mt-2 text-sm text-gray-700" style="display:none;"></div>
      `;
    }
    container.appendChild(elem);
  }
  if (!container.children.length) {
    container.innerHTML = '<p class="text-gray-500">Nenhum saque encontrado</p>';
  }
}

export async function mostrarDetalhesSaque(dataRef) {
  const detalhesEl = document.getElementById('detalhes-' + dataRef);
  if (detalhesEl.style.display === 'block') {
    detalhesEl.style.display = 'none';
    return;
  }
  detalhesEl.innerHTML = '<div class="text-sm text-gray-500">Carregando...</div>';
  detalhesEl.style.display = 'block';

  const uid = auth.currentUser.uid;
  const pass = getPassphrase() || `chave-${uid}`;
  const snap = await getDocs(collection(db, `usuarios/${uid}/saques/${dataRef}/lojas`));
  let html = '';
  for (const docSnap of snap.docs) {
    const enc = docSnap.data().encrypted;
    if (!enc) continue;
    const txt = await decryptString(enc, pass);
    const d = JSON.parse(txt);
    const loja = d.loja || 'Loja';
    const valor = d.valor || 0;
    html += `<div class="mt-1 text-sm text-gray-800 border-t pt-1"><strong>${loja}</strong>: R$ ${valor.toLocaleString('pt-BR')}</div>`;
  }
  detalhesEl.innerHTML = html || '<p class="text-gray-500">Sem detalhes</p>';
}

export async function alternarPago(dataRef) {
  const uid = auth.currentUser.uid;
  const pass = getPassphrase() || `chave-${uid}`;
  const dados = await loadSecureDoc(db, `usuarios/${uid}/saques`, dataRef, pass);
  if (!dados) return;
  dados.pago = !dados.pago;
  await saveSecureDoc(db, `usuarios/${uid}/saques`, dataRef, { ...dados, uid }, pass);
  await carregarSaques();
}

if (typeof window !== 'undefined') {
  window.registrarSaque = registrarSaque;
  window.carregarSaques = carregarSaques;
  window.mostrarDetalhesSaque = mostrarDetalhesSaque;
  window.alternarPago = alternarPago;
}
