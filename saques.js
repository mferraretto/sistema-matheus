import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import {
  registrarSaque as registrarSaqueSvc,
  deletarSaque as deletarSaqueSvc,
  atualizarSaque as atualizarSaqueSvc,
  fecharMes as fecharMesSvc,
  watchResumoMes as watchResumoMesSvc
} from './comissoes-service.js';
import { anoMesBR } from './comissoes-utils.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let uidAtual = null;
let unsubscribeResumo = null;
let editandoId = null;
let saquesCache = {};
let selecionados = new Set();

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
  const origem = document.getElementById('lojaSaque').value.trim();
  if (!dataISO || isNaN(valor) || valor <= 0) {
    alert('Preencha data e valor corretamente.');
    return;
  }
  if (editandoId) {
    const anoMes = document.getElementById('filtroMes').value || anoMesBR();
    await atualizarSaqueSvc({ db, uid: uidAtual, anoMes, saqueId: editandoId, dataISO, valor, percentualPago: percentual, origem });
  } else {
    await registrarSaqueSvc({ db, uid: uidAtual, dataISO, valor, percentualPago: percentual, origem });
  }
  document.getElementById('valorSaque').value = '';
  document.getElementById('lojaSaque').value = '';
  editandoId = null;
  document.getElementById('btnRegistrar').innerHTML = '<i class="fas fa-plus mr-1"></i> Registrar';
  carregarSaques();
}

async function carregarSaques() {
  const anoMes = document.getElementById('filtroMes').value || anoMesBR();
  const tbody = document.getElementById('tbodySaques');
  tbody.innerHTML = '';
  selecionados.clear();
  atualizarResumoSelecionados();
  const chkAll = document.getElementById('chkAll');
  if (chkAll) chkAll.checked = false;
  const col = collection(db, 'usuarios', uidAtual, 'comissoes', anoMes, 'saques');
  const snap = await getDocs(col);
  saquesCache = {};
  const dados = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.data.localeCompare(b.data));
  const totais = {};
  dados.forEach(s => {
    const dia = s.data.substring(0, 10);
    saquesCache[s.id] = s;
    if (!totais[dia]) totais[dia] = { valor: 0, comissao: 0 };
    totais[dia].valor += s.valor;
    totais[dia].comissao += s.comissaoPaga;
  });

  for (let i = 0; i < dados.length; i++) {
    const s = dados[i];
    const dia = s.data.substring(0, 10);
    const pago = s.percentualPago > 0;
    const tr = document.createElement('tr');
    if (pago) tr.className = 'bg-green-100';
    tr.innerHTML = `
      <td class="px-4 py-2">
        <input type="checkbox" class="saque-select" data-id="${s.id}" onchange="toggleSelecao('${s.id}', this.checked)">
        ${pago ? `<span class=\"ml-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded\">PAGO ${(s.percentualPago * 100).toFixed(0)}%</span>` : ''}
      </td>
      <td class="px-4 py-2">${dia}</td>
      <td class="px-4 py-2">${s.origem || '-'}</td>
      <td class="px-4 py-2 text-right">R$ ${s.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="px-4 py-2 text-right">${(s.percentualPago * 100).toFixed(0)}%</td>
      <td class="px-4 py-2 text-right">R$ ${s.comissaoPaga.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="px-4 py-2 text-right flex gap-2 justify-end">
        <button class="text-blue-600" onclick="editarSaque('${s.id}')"><i class="fas fa-edit"></i></button>
        <button class="text-red-600" onclick="excluirSaque('${s.id}')"><i class="fas fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);

    const proxDia = dados[i + 1]?.data.substring(0, 10);
    if (proxDia !== dia) {
      const tot = totais[dia];
      const trTot = document.createElement('tr');
      trTot.className = 'bg-gray-100 font-semibold';
      trTot.innerHTML = `
        <td></td>
        <td class="px-4 py-2" colspan="2">Total do dia</td>
        <td class="px-4 py-2 text-right">R$ ${tot.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="px-4 py-2 text-right">-</td>
        <td class="px-4 py-2 text-right">R$ ${tot.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td></td>
      `;
      tbody.appendChild(trTot);
    }
  }
}

async function excluirSaque(id) {
  const anoMes = document.getElementById('filtroMes').value || anoMesBR();
  await deletarSaqueSvc({ db, uid: uidAtual, anoMes, saqueId: id });
  carregarSaques();
}

function toggleSelecao(id, marcado) {
  if (marcado) selecionados.add(id); else selecionados.delete(id);
  atualizarResumoSelecionados();
}

function toggleSelecaoTodos(marcado) {
  selecionados.clear();
  document.querySelectorAll('.saque-select').forEach(cb => {
    cb.checked = marcado;
    if (marcado) selecionados.add(cb.dataset.id);
  });
  atualizarResumoSelecionados();
}

function atualizarResumoSelecionados() {
  const div = document.getElementById('acoesSelecionados');
  const texto = document.getElementById('resumoSelecionados');
  if (!div || !texto) return;
  if (selecionados.size === 0) {
    div.style.display = 'none';
    texto.textContent = '';
    return;
  }
  let totalValor = 0;
  let totalComissaoSel = 0;
  selecionados.forEach(id => {
    const s = saquesCache[id];
    if (s) {
      totalValor += s.valor || 0;
      totalComissaoSel += s.comissaoPaga || 0;
    }
  });
  texto.textContent = `${selecionados.size} selecionado(s) - Valor: R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Comissão: R$ ${totalComissaoSel.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  div.style.display = 'flex';
}

async function marcarComoPagoSelecionados() {
  const perc = parseFloat(document.getElementById('percentualSelecionado').value);
  const anoMes = document.getElementById('filtroMes').value || anoMesBR();
  for (const id of selecionados) {
    const s = saquesCache[id];
    if (!s) continue;
    await atualizarSaqueSvc({ db, uid: uidAtual, anoMes, saqueId: id, dataISO: s.data, valor: s.valor, percentualPago: perc, origem: s.origem });
  }
  selecionados.clear();
  carregarSaques();
}

function mostrarResumoSelecionados() {
  const texto = document.getElementById('resumoSelecionados');
  if (texto) alert(texto.textContent);
}

function exportarSelecionadosExcel() {
  if (selecionados.size === 0) return;
  const campos = ['Data', 'Loja', 'Valor', '% Pago', 'Comissao'];
  const linhas = [campos.join(';')];
  selecionados.forEach(id => {
    const s = saquesCache[id];
    if (s) {
      linhas.push([
        s.data.substring(0, 10),
        s.origem || '',
        s.valor.toFixed(2),
        (s.percentualPago * 100).toFixed(0) + '%',
        s.comissaoPaga.toFixed(2)
      ].join(';'));
    }
  });
  const csv = linhas.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'saques.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function exportarSelecionadosPDF() {
  if (selecionados.size === 0 || !window.jspdf) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Fechamento Comissão', 105, 15, { align: 'center' });
  let totalSaque = 0;
  let totalComissaoPdf = 0;

  const body = [];

selecionados.forEach(id => {
  const s = saquesCache[id];
  if (!s) return;

  const valor = Number(s.valor || 0);
  const comissao = Number(s.comissaoPaga || 0);

  // Usa percentualPago (ex.: 0.03 => 3%) se existir; senão calcula pela razão
  const perc = (typeof s.percentualPago === 'number' && isFinite(s.percentualPago))
    ? s.percentualPago * 100
    : (valor > 0 ? (comissao / valor) * 100 : 0);

  body.push([
    (s.data || '').substring(0, 10),
    s.origem || '',
    valor.toFixed(2),
    `${perc.toFixed(0)}%`,
    comissao.toFixed(2)
  ]);

  totalSaque += valor;
  totalComissaoPdf += comissao;

});

doc.autoTable({
  head: [['Data', 'Loja', 'Valor Saque', '% Comissão', 'Comissão']],
  body,
  startY: 25
});

const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 25;
const percComissaoMedio = totalSaque > 0 ? (totalComissaoPdf / totalSaque) * 100 : 0;

doc.setFontSize(12);
doc.text(`Total de Saques: R$ ${totalSaque.toFixed(2)}`, 14, finalY + 10);
doc.text(`Total de Comissão: R$ ${totalComissaoPdf.toFixed(2)}`, 14, finalY + 20);

doc.text(`Percentual Médio: ${percComissaoMedio.toFixed(2)}%`, 14, finalY + 30);

// Evite acentos no nome de arquivo para compatibilidade
doc.save('fechamento-comissao.pdf');

}

function editarSaque(id) {
  const s = saquesCache[id];
  document.getElementById('dataSaque').value = s.data.substring(0, 10);
  document.getElementById('valorSaque').value = s.valor;
  document.getElementById('percentualSaque').value = s.percentualPago.toFixed(2);
  document.getElementById('lojaSaque').value = s.origem || '';
  editandoId = id;
  document.getElementById('btnRegistrar').innerHTML = '<i class="fas fa-save mr-1"></i> Atualizar';
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
  window.editarSaque = editarSaque;
  window.fecharMes = fecharMes;
  window.toggleSelecao = toggleSelecao;
  window.toggleSelecaoTodos = toggleSelecaoTodos;
  window.marcarComoPagoSelecionados = marcarComoPagoSelecionados;
  window.mostrarResumoSelecionados = mostrarResumoSelecionados;
  window.exportarSelecionadosExcel = exportarSelecionadosExcel;
  window.exportarSelecionadosPDF = exportarSelecionadosPDF;
}

