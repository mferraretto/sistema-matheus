import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import {
  registrarSaque as registrarSaqueSvc,
  deletarSaque as deletarSaqueSvc,
  atualizarSaque as atualizarSaqueSvc,
  fecharMes as fecharMesSvc,
  watchResumoMes as watchResumoMesSvc,
  registrarComissaoRecebida as registrarComissaoRecebidaSvc
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
  const titulo = document.getElementById('tituloVendedor');
  if (titulo) {
    titulo.textContent = (user.displayName || 'VENDEDOR').toUpperCase();
  }
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

export async function registrarComissaoRecebida() {
  const dataISO = document.getElementById('dataComissao').value;
  const valor = parseFloat(document.getElementById('valorComissao').value);
  if (!dataISO || isNaN(valor) || valor <= 0) {
    alert('Preencha data e valor corretamente.');
    return;
  }
  await registrarComissaoRecebidaSvc({ db, uid: uidAtual, dataISO, valor });
  document.getElementById('valorComissao').value = '';
}

async function carregarSaques() {
  const anoMes = document.getElementById('filtroMes').value || anoMesBR();
  const tbody = document.getElementById('tbodySaques');
  const tfoot = document.getElementById('tfootResumo');

  tbody.innerHTML = '';
  if (tfoot) tfoot.innerHTML = '';
  selecionados.clear();
  atualizarResumoSelecionados();

  const col = collection(db, 'usuarios', uidAtual, 'comissoes', anoMes, 'saques');
  const snap = await getDocs(col);
  saquesCache = {};
  const dados = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.data.localeCompare(b.data));

  let totalValor = 0;
  let totalComissao = 0;
  let todosPagos = true;

  dados.forEach(s => {
    saquesCache[s.id] = s;
    const dia = (s.data || '').substring(0, 10);
    const status = s.percentualPago > 0 ? 'PAGO' : 'A PAGAR';
    if (status === 'A PAGAR') todosPagos = false;
    totalValor += Number(s.valor) || 0;
    totalComissao += Number(s.comissaoPaga) || 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-4 py-2 text-center">
        <input type="checkbox" class="saque-select" data-id="${s.id}" onchange="toggleSelecao('${s.id}', this.checked)" />
      </td>
      <td class="px-4 py-2">${dia}</td>
      <td class="px-4 py-2">${s.origem || '-'}</td>
      <td class="px-4 py-2 text-right">R$ ${(Number(s.valor)||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="px-4 py-2 text-right">${((Number(s.percentualPago)||0) * 100).toFixed(0)}%</td>
      <td class="px-4 py-2 text-right">R$ ${(Number(s.comissaoPaga)||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="px-4 py-2 text-right">${status}</td>
      <td class="px-4 py-2 text-right space-x-2">
        <button onclick="editarSaque('${s.id}')" class="text-blue-500"><i class="fas fa-edit"></i></button>
        <button onclick="excluirSaque('${s.id}')" class="text-red-500"><i class="fas fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Linha de resumo final dentro do <tfoot>
  if (tfoot) {
    if (dados.length === 0) {
      tfoot.innerHTML = `
        <tr>
          <td colspan="8" class="px-4 py-3 text-center text-sm text-gray-500">Sem saques registrados.</td>
        </tr>`;
    } else {
      const perc = totalValor > 0 ? (totalComissao / totalValor) * 100 : 0;
      tfoot.innerHTML = `
        <tr class="bg-gray-50 font-semibold">
          <td></td>
          <td colspan="2" class="px-4 py-2 text-right">TOTAL</td>
          <td class="px-4 py-2 text-right">R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="px-4 py-2 text-right">${perc.toFixed(0)}%</td>
          <td class="px-4 py-2 text-right">R$ ${totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="px-4 py-2 text-right">${todosPagos ? 'JÁ PAGO' : 'A PAGAR'}</td>
          <td></td>
        </tr>`;
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
  const perc = parseFloat(document.getElementById('percentualSelecionado')?.value || '0');
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

  // Cabeçalho principal
  const linhas = [['Data', 'Loja', 'Saque', '%', 'Comissão', 'Status'].join(';')];
  const resumo = {};

  // Linhas detalhadas e consolidação por loja
  selecionados.forEach(id => {
    const s = saquesCache[id];
    if (!s) return;
    const status = s.percentualPago > 0 ? 'PAGO' : 'A PAGAR';
    linhas.push([
      s.data.substring(0, 10),
      s.origem || '',
      s.valor.toFixed(2),
      (s.percentualPago * 100).toFixed(0) + '%',
      s.comissaoPaga.toFixed(2),
      status
    ].join(';'));

    if (!resumo[s.origem || '-']) {
      resumo[s.origem || '-'] = { total: 0, comissao: 0, pagos: true };
    }
    resumo[s.origem || '-'].total += s.valor;
    resumo[s.origem || '-'].comissao += s.comissaoPaga;
    resumo[s.origem || '-'].pagos = resumo[s.origem || '-'].pagos && s.percentualPago > 0;
  });

  // Tabela de resumo
  linhas.push('');
  linhas.push('Resumo Final');
  linhas.push(['Loja', 'Total', '%', 'Comissão Total', 'Status'].join(';'));
  Object.keys(resumo).forEach(loja => {
    const r = resumo[loja];
    const perc = r.total > 0 ? (r.comissao / r.total) * 100 : 0;
    linhas.push([
      loja,
      r.total.toFixed(2),
      perc.toFixed(0) + '%',
      r.comissao.toFixed(2),
      r.pagos ? 'PAGO' : 'A PAGAR'
    ].join(';'));
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
  const resumo = {};

  selecionados.forEach(id => {
    const s = saquesCache[id];
    if (!s) return;
    const valor = Number(s.valor || 0);
    const comissao = Number(s.comissaoPaga || 0);
    const perc = (typeof s.percentualPago === 'number' && isFinite(s.percentualPago))
      ? s.percentualPago * 100
      : (valor > 0 ? (comissao / valor) * 100 : 0);
    const status = s.percentualPago > 0 ? 'PAGO' : 'A PAGAR';

    body.push([
      (s.data || '').substring(0, 10),
      s.origem || '',
      valor.toFixed(2),
      `${perc.toFixed(0)}%`,
      comissao.toFixed(2),
      status
    ]);

    totalSaque += valor;
    totalComissaoPdf += comissao;

    if (!resumo[s.origem || '-']) {
      resumo[s.origem || '-'] = { total: 0, comissao: 0, pagos: true };
    }
    resumo[s.origem || '-'].total += valor;
    resumo[s.origem || '-'].comissao += comissao;
    resumo[s.origem || '-'].pagos = resumo[s.origem || '-'].pagos && s.percentualPago > 0;
  });

  doc.autoTable({
    head: [['Data', 'Loja', 'Saque', '%', 'Comissão', 'Status']],
    body,
    startY: 25
  });

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 25;

  // Resumo por loja
  const resumoBody = Object.keys(resumo).map(loja => {
    const r = resumo[loja];
    const perc = r.total > 0 ? (r.comissao / r.total) * 100 : 0;
    return [
      loja,
      r.total.toFixed(2),
      perc.toFixed(0) + '%',
      r.comissao.toFixed(2),
      r.pagos ? 'PAGO' : 'A PAGAR'
    ];
  });

  doc.autoTable({
    head: [['Loja', 'Total', '%', 'Comissão Total', 'Status']],
    body: resumoBody,
    startY: finalY
  });

  const finalY2 = doc.lastAutoTable ? doc.lastAutoTable.finalY : finalY;
  const percComissaoMedio = totalSaque > 0 ? (totalComissaoPdf / totalSaque) * 100 : 0;

  doc.setFontSize(12);
  doc.text(`Total de Saques: R$ ${totalSaque.toFixed(2)}`, 14, finalY2 + 10);
  doc.text(`Total de Comissão: R$ ${totalComissaoPdf.toFixed(2)}`, 14, finalY2 + 20);
  doc.text(`Percentual Médio: ${percComissaoMedio.toFixed(2)}%`, 14, finalY2 + 30);

  // Evite acentos no nome de arquivo para compatibilidade
  doc.save('fechamento-comissao.pdf');
}

function editarSaque(id) {
  const s = saquesCache[id];
  document.getElementById('dataSaque').value = s.data.substring(0, 10);
  document.getElementById('valorSaque').value = s.valor;
  document.getElementById('percentualSaque').value = String(s.percentualPago || 0);
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
          <div class="text-sm text-gray-500">Total comissão</div>
          <div class="text-xl font-bold">R$ ${(r.comissaoPrevista || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="text-sm text-gray-500">${(r.taxaFinal * 100).toFixed(0)}%</div>
        </div>
        <div>
          <div class="text-sm text-gray-500">Total comissão paga</div>
          <div class="text-xl font-bold">R$ ${(r.comissaoRecebida || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div>
          <div class="text-sm text-gray-500">Total comissão falta pagar</div>
          <div class="text-xl font-bold">R$ ${( (r.comissaoPrevista || 0) - (r.comissaoRecebida || 0) ).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      `;
      texto.textContent = `Faltam R$${r.faltamPara4.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para 4% | R$${r.faltamPara5.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para 5%`;
    }
  });
}

async function imprimirFechamento() {
  if (!window.jspdf) return;
  const { jsPDF } = window.jspdf;
  const anoMes = document.getElementById('filtroMes').value || anoMesBR();

  const colSaques = collection(db, 'usuarios', uidAtual, 'comissoes', anoMes, 'saques');
  const colRecebidas = collection(db, 'usuarios', uidAtual, 'comissoes', anoMes, 'recebidas');
  const [snapSaques, snapRecebidas] = await Promise.all([
    getDocs(colSaques),
    getDocs(colRecebidas)
  ]);

  const saques = snapSaques.docs.map(d => d.data()).sort((a, b) => a.data.localeCompare(b.data));
  const recebidas = snapRecebidas.docs.map(d => d.data()).sort((a, b) => a.data.localeCompare(b.data));

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Fechamento de Saques', 105, 15, { align: 'center' });

  const saquesBody = saques.map(s => [
    (s.data || '').substring(0, 10),
    s.origem || '',
    (Number(s.valor) || 0).toFixed(2)
  ]);

  doc.autoTable({
    head: [['Data', 'Loja', 'Saque']],
    body: saquesBody,
    startY: 25
  });

  let y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 25;

  const comissoesBody = recebidas.map(c => [
    (c.data || '').substring(0, 10),
    (Number(c.valor) || 0).toFixed(2)
  ]);

  doc.autoTable({
    head: [['Data', 'Comissão']],
    body: comissoesBody,
    startY: y
  });

  y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : y + 10;

  const totalSacado = saques.reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const totalPrev = saques.reduce((s, x) => s + (Number(x.comissaoPaga) || 0), 0);
  const totalPago = recebidas.reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const totalPagar = totalPrev - totalPago;

  doc.setFontSize(12);
  doc.text(`Total sacado: R$ ${totalSacado.toFixed(2)}`, 14, y);
  doc.text(`Total comissão: R$ ${totalPrev.toFixed(2)}`, 14, y + 10);
  doc.text(`Total já pago: R$ ${totalPago.toFixed(2)}`, 14, y + 20);
  doc.text(`Total a pagar: R$ ${totalPagar.toFixed(2)}`, 14, y + 30);

  doc.save('fechamento-saques.pdf');
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
  window.registrarComissaoRecebida = registrarComissaoRecebida;
  window.imprimirFechamento = imprimirFechamento;
}
