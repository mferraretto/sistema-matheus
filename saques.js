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
import { anoMesBR, calcularResumo, taxaFinalPorTotal } from './comissoes-utils.js';

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
  document.getElementById('btnRegistrar').textContent = 'Registrar';
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
    const pago = s.percentualPago > 0;
    const status = pago ? 'Pago' : 'A pagar';
    if (!pago) todosPagos = false;
    totalValor += Number(s.valor) || 0;
    totalComissao += Number(s.comissaoPaga) || 0;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 even:bg-slate-50/50';
    tr.innerHTML = `
      <td class="px-4 py-3 text-center">
        <input type="checkbox" class="saque-select h-4 w-4 rounded border-slate-300" data-id="${s.id}" onchange="toggleSelecao('${s.id}', this.checked)" />
      </td>
      <td class="px-4 py-3 text-slate-800">${dia}</td>
      <td class="px-4 py-3 text-slate-600">${s.origem || '-'}</td>
      <td class="px-4 py-3 text-right font-medium text-slate-900">R$ ${(Number(s.valor)||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="px-4 py-3 text-right text-slate-600">${((Number(s.percentualPago)||0) * 100).toFixed(0)}%</td>
      <td class="px-4 py-3 text-right text-slate-800">R$ ${(Number(s.comissaoPaga)||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center rounded-full ${pago ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'} px-2 py-0.5 text-xs font-medium">${status}</span>
      </td>
      <td class="px-4 py-3 text-right">
        <div class="inline-flex gap-1">
          <button class="h-8 w-8 grid place-items-center rounded-lg border border-slate-200 hover:bg-slate-50" aria-label="Editar" onclick="editarSaque('${s.id}')">✎</button>
          <button class="h-8 w-8 grid place-items-center rounded-lg border border-slate-200 hover:bg-rose-50" aria-label="Excluir" onclick="excluirSaque('${s.id}')">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Linha de resumo final dentro do <tfoot>
  if (tfoot) {
    if (dados.length === 0) {
      tfoot.innerHTML = `
        <tr>
          <td colspan="8" class="px-4 py-3 text-center text-sm text-slate-500">Sem saques registrados.</td>
        </tr>`;
    } else {
      const perc = totalValor > 0 ? (totalComissao / totalValor) * 100 : 0;
      tfoot.innerHTML = `
        <tr>
          <td></td>
          <td colspan="2" class="px-4 py-3 font-medium text-slate-700">Total</td>
          <td class="px-4 py-3 text-right font-semibold text-slate-900">R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="px-4 py-3 text-right text-slate-700">${perc.toFixed(0)}%</td>
          <td class="px-4 py-3 text-right font-semibold text-slate-900">R$ ${totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td colspan="2"></td>
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

  // Reunir itens selecionados
  const itens = Array.from(selecionados)
    .map(id => saquesCache[id])
    .filter(Boolean);

  const totalSaque = itens.reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const taxaFinal = taxaFinalPorTotal(totalSaque);
  const body = [];
  const resumo = {};

  itens.forEach(s => {
    const valor = Number(s.valor || 0);
    const comissaoPrev = valor * taxaFinal;
    const status = s.percentualPago > 0 ? 'PAGO' : 'A PAGAR';

    body.push([
      (s.data || '').substring(0, 10),
      s.origem || '',
      valor.toFixed(2),
      `${(taxaFinal * 100).toFixed(0)}%`,
      comissaoPrev.toFixed(2),
      status
    ]);

    if (!resumo[s.origem || '-']) {
      resumo[s.origem || '-'] = { total: 0, pagos: true };
    }
    resumo[s.origem || '-'].total += valor;
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
    return [
      loja,
      r.total.toFixed(2),
      `${(taxaFinal * 100).toFixed(0)}%`,
      (r.total * taxaFinal).toFixed(2),
      r.pagos ? 'PAGO' : 'A PAGAR'
    ];
  });

  doc.autoTable({
    head: [['Loja', 'Total', '%', 'Comissão Total', 'Status']],
    body: resumoBody,
    startY: finalY
  });

  const finalY2 = doc.lastAutoTable ? doc.lastAutoTable.finalY : finalY;
  const totalComissaoPdf = totalSaque * taxaFinal;

  doc.setFontSize(12);
  doc.text(`Total de Saques: R$ ${totalSaque.toFixed(2)}`, 14, finalY2 + 10);
  doc.text(`Total de Comissão (${(taxaFinal * 100).toFixed(0)}%): R$ ${totalComissaoPdf.toFixed(2)}`, 14, finalY2 + 20);
  doc.text(`Percentual Médio: ${(taxaFinal * 100).toFixed(2)}%`, 14, finalY2 + 30);

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
  document.getElementById('btnRegistrar').textContent = 'Atualizar';
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
        cards.innerHTML = '<p class="text-slate-500">Sem dados</p>';
        texto.textContent = '';
        return;
      }
      cards.innerHTML = `
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="text-slate-600 text-xs font-medium tracking-wide uppercase">Total Saques</div>
          <div class="mt-2 text-2xl font-semibold text-slate-900">R$ ${r.totalSacado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="mt-1 text-xs text-slate-500">Mês atual</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="text-slate-600 text-xs font-medium tracking-wide uppercase">% Comissão</div>
          <div class="mt-2 text-2xl font-semibold text-slate-900">${(r.taxaFinal * 100).toFixed(0)}%</div>
          <div class="mt-1 text-xs text-slate-500">Padrão</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="text-slate-600 text-xs font-medium tracking-wide uppercase">Comissão Paga</div>
          <div class="mt-2 text-2xl font-semibold text-slate-900">R$ ${(r.comissaoRecebida || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="mt-1 text-xs text-slate-500">Até agora</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="text-slate-600 text-xs font-medium tracking-wide uppercase">Falta Pagar</div>
          <div class="mt-2 text-2xl font-semibold text-slate-900">R$ ${((r.comissaoPrevista || 0) - (r.comissaoRecebida || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="mt-1 text-xs text-slate-500">Estimado</div>
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

  const resumoCalc = calcularResumo(saques);
  const { totalSacado, taxaFinal, comissaoPrevista } = resumoCalc;
  const totalPago = recebidas.reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const totalPagar = comissaoPrevista - totalPago;

  doc.setFontSize(12);
  doc.text(`Total sacado: R$ ${totalSacado.toFixed(2)}`, 14, y);
  doc.text(`Total comissão (${(taxaFinal * 100).toFixed(0)}%): R$ ${comissaoPrevista.toFixed(2)}`, 14, y + 10);
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
