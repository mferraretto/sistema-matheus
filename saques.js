import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import {
  registrarSaque as registrarSaqueSvc,
  deletarSaque as deletarSaqueSvc,
  fecharMes as fecharMesSvc,
  watchResumoMes as watchResumoMesSvc
} from './comissoes-service.js';
import { anoMesBR } from './comissoes-utils.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let uidAtual = null;
let unsubscribeResumo = null;

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  uidAtual = user.uid;
  const mesInput = document.getElementById('filtroMes');
  mesInput.value = anoMesBR();
  mesInput.addEventListener('change', () => {
    carregarSaques();
    assistirResumo();
  });
  carregarSaques();
  assistirResumo();
});

export async function registrarSaque() {
  const dataISO = document.getElementById('dataSaque').value;
  const valor = parseFloat(document.getElementById('valorSaque').value);
  const percentual = parseFloat(document.getElementById('percentualSaque').value);
  if (!dataISO || isNaN(valor) || valor <= 0) {
    alert('Preencha data e valor corretamente.');
    return;
  }
  await registrarSaqueSvc({ db, uid: uidAtual, dataISO, valor, percentualPago: percentual });
  document.getElementById('valorSaque').value = '';
  carregarSaques();
}

async function carregarSaques() {
  const anoMes = document.getElementById('filtroMes').value || anoMesBR();
  const tbody = document.getElementById('tbodySaques');
  tbody.innerHTML = '';
  const col = collection(db, 'usuarios', uidAtual, 'comissoes', anoMes, 'saques');
  const snap = await getDocs(col);
  snap.forEach(d => {
    const s = d.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-4 py-2">${s.data.substring(0, 10)}</td>
      <td class="px-4 py-2 text-right">R$ ${s.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="px-4 py-2 text-right">${(s.percentualPago * 100).toFixed(0)}%</td>
      <td class="px-4 py-2 text-right">R$ ${s.comissaoPaga.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="px-4 py-2 text-right"><button class="text-red-600" onclick="excluirSaque('${d.id}')"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
}

async function excluirSaque(id) {
  const anoMes = document.getElementById('filtroMes').value || anoMesBR();
  await deletarSaqueSvc({ db, uid: uidAtual, anoMes, saqueId: id });
  carregarSaques();
}

async function fecharMes() {
  const anoMes = document.getElementById('filtroMes').value || anoMesBR();
  const ajusteId = await fecharMesSvc({ db, uid: uidAtual, anoMes });
  alert(ajusteId ? 'Ajuste lançado!' : 'Sem ajuste necessário');
}

function assistirResumo() {
  const anoMes = document.getElementById('filtroMes').value || anoMesBR();
  if (unsubscribeResumo) unsubscribeResumo();
  unsubscribeResumo = watchResumoMesSvc({
    db,
    uid: uidAtual,
    anoMes,
    onChange: r => {
      const cards = document.getElementById('cardsResumo');
      const texto = document.getElementById('faltasTexto');
      if (!r) {
        cards.innerHTML = '<p class="text-gray-500">Sem dados</p>';
        texto.textContent = '';
        return;
      }
      cards.innerHTML = `
        <div>
          <div class="text-sm text-gray-500">Total sacado</div>
          <div class="text-xl font-bold">R$ ${r.totalSacado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div>
          <div class="text-sm text-gray-500">Taxa final</div>
          <div class="text-xl font-bold">${(r.taxaFinal * 100).toFixed(0)}%</div>
        </div>
        <div>
          <div class="text-sm text-gray-500">Ajuste estimado</div>
          <div class="text-xl font-bold">R$ ${r.ajusteFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      `;
      texto.textContent = `Faltam R$${r.faltamPara4.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para 4% | R$${r.faltamPara5.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para 5%`;
    }
  });
}

if (typeof window !== 'undefined') {
  window.registrarSaque = registrarSaque;
  window.excluirSaque = excluirSaque;
  window.fecharMes = fecharMes;
}

