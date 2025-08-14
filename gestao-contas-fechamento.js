import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, addDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const input = document.getElementById('inputPdfFechamento');
const btnProcessar = document.getElementById('btnProcessarPdf');
const btnExportar = document.getElementById('btnExportarExcel');
const tabelaDiv = document.getElementById('previewFechamento');
const paginacaoDiv = document.getElementById('paginacaoFechamento');
const totalDiv = document.getElementById('totalFechamento');
const statusDiv = document.getElementById('statusFechamento');

let lancamentos = [];
let paginaAtual = 1;
const pageSize = 20;

btnProcessar?.addEventListener('click', async () => {
  const files = Array.from(input?.files || []);
  if (!files.length) {
    statusDiv.textContent = 'Selecione um ou mais arquivos PDF.';
    return;
  }
  statusDiv.textContent = 'Processando...';
  lancamentos = [];
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const lines = agruparLinhas(textContent.items);
      parseLines(lines);
    }
  }
  if (lancamentos.length) {
    btnExportar.disabled = false;
    paginaAtual = 1;
    renderTabela();
    statusDiv.textContent = `${lancamentos.length} lançamentos carregados.`;
    await salvarContasFechamento();
  } else {
    statusDiv.textContent = 'Nenhum lançamento encontrado.';
  }
});

function agruparLinhas(items) {
  const lines = [];
  let line = [];
  let prevY = null;
  for (const item of items) {
    const y = Math.round(item.transform[5]);
    if (prevY === null || Math.abs(prevY - y) <= 1) {
      line.push(item.str);
    } else {
      lines.push(line.join('').trim());
      line = [item.str];
    }
    prevY = y;
  }
  if (line.length) lines.push(line.join('').trim());
  return lines;
}

const rxLinha = /^(?<doc>[A-Z]{2,3})\s+(?<numero>\d+)\s+(?<pc>\d+)\s+(?<tipo>[A-Z]{2})\s+(?<valor>[\d\.]+,\d{2})\s+(?<emissao>\d{2}\/\d{2}\/\d{4})\s+(?<vencto>\d{2}\/\d{2}\/\d{4})\s+(?<baixa>[\d,\. -]+)\s+(?<descontos>[\d\.,]+|0,00)\s+(?<abatimentos>[\d\.,]+|0,00)\s+(?<juros>[\d\.,]+|0,00)\s+(?<multa>[\d\.,]+|0,00)\s+(?<corrMonet>[\d\.,]+|0,00)\s+(?<valorAcess>[\d\.,]+|0,00)\s+(?<valorBaixado>[\d\.,]+|0,00)\s+(?<recAntecip>[\d\.,]+|0,00)\s+(?<acrescimo>[\d\.,]+|0,00)\s+(?<decrescimo>[\d\.,]+|0,00)\s+(?<saldo>[\d\.,]+|0,00)/;

let clienteAtual = '';
let carteiraAtual = '';

function parseLines(lines) {
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) continue;
    if (line.startsWith('CLIENTE :')) {
      clienteAtual = line.replace('CLIENTE :', '').trim();
      carteiraAtual = '';
      continue;
    }
    if (line.toUpperCase().startsWith('CARTEIRA')) {
      const parts = line.split(':');
      carteiraAtual = parts[1] ? parts[1].trim() : '';
      continue;
    }
    if (line.includes('Prf') && line.includes('Saldo')) {
      continue; // cabeçalho
    }
    if (/^TOTAL/i.test(line)) {
      continue;
    }
    const norm = line.replace(/\s{2,}/g, ' ');
    const m = rxLinha.exec(norm);
    if (m) {
      lancamentos.push({
        Prf: m.groups.doc,
        Numero: m.groups.numero,
        PC: m.groups.pc,
        Tipo: m.groups.tipo,
        'Valor Original': m.groups.valor,
        Emissao: m.groups.emissao,
        Vencto: m.groups.vencto,
        Baixa: m.groups.baixa.trim(),
        Descontos: m.groups.descontos,
        Abatimentos: m.groups.abatimentos,
        Juros: m.groups.juros,
        Multa: m.groups.multa,
        'Corr. Monet.': m.groups.corrMonet,
        'Valor Acessorio': m.groups.valorAcess,
        'Valor Baixado': m.groups.valorBaixado,
        'Rec. Antecip.': m.groups.recAntecip,
        Acrescimo: m.groups.acrescimo,
        Decrescimo: m.groups.decrescimo,
        'Saldo Atual': m.groups.saldo,
        Cliente: clienteAtual,
        'Carteira/Port.': carteiraAtual,
        invalida: false
      });
    } else {
      lancamentos.push({
        linha: line,
        Cliente: clienteAtual,
        'Carteira/Port.': carteiraAtual,
        invalida: true
      });
    }
  }
}

function parseValor(v) {
  return parseFloat((v || '0').replace(/\./g, '').replace(',', '.')) || 0;
}

function formatCurrency(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderTabela() {
  const start = (paginaAtual - 1) * pageSize;
  const dados = lancamentos.slice(start, start + pageSize);
  const headers = ['Prf', 'Numero', 'PC', 'Tipo', 'Valor Original', 'Emissao', 'Vencto', 'Baixa', 'Descontos', 'Abatimentos', 'Juros', 'Multa', 'Corr. Monet.', 'Valor Acessorio', 'Valor Baixado', 'Rec. Antecip.', 'Acrescimo', 'Decrescimo', 'Saldo Atual', 'Cliente', 'Carteira/Port.', 'Status'];
  let html = '<table class="w-full text-sm"><thead><tr>' + headers.map(h => `<th class="text-left px-1">${h}</th>`).join('') + '</tr></thead><tbody>';
  for (const l of dados) {
    if (l.invalida) {
      html += `<tr class="err"><td colspan="21">${l.linha}</td><td>Inválida</td></tr>`;
    } else {
      html += '<tr>' +
        `<td>${l.Prf}</td>` +
        `<td>${l.Numero}</td>` +
        `<td>${l.PC}</td>` +
        `<td>${l.Tipo}</td>` +
        `<td>${l['Valor Original']}</td>` +
        `<td>${l.Emissao}</td>` +
        `<td>${l.Vencto}</td>` +
        `<td>${l.Baixa}</td>` +
        `<td>${l.Descontos}</td>` +
        `<td>${l.Abatimentos}</td>` +
        `<td>${l.Juros}</td>` +
        `<td>${l.Multa}</td>` +
        `<td>${l['Corr. Monet.']}</td>` +
        `<td>${l['Valor Acessorio']}</td>` +
        `<td>${l['Valor Baixado']}</td>` +
        `<td>${l['Rec. Antecip.']}</td>` +
        `<td>${l.Acrescimo}</td>` +
        `<td>${l.Decrescimo}</td>` +
        `<td>${l['Saldo Atual']}</td>` +
        `<td>${l.Cliente || ''}</td>` +
        `<td>${l['Carteira/Port.'] || ''}</td>` +
        '<td>OK</td>' +
        '</tr>';
    }
  }
  html += '</tbody></table>';
  tabelaDiv.innerHTML = html;

  const totalBaixado = lancamentos.reduce((s, l) => s + (l.invalida ? 0 : parseValor(l['Valor Baixado'])), 0);
  const totalSaldo = lancamentos.reduce((s, l) => s + (l.invalida ? 0 : parseValor(l['Saldo Atual'])), 0);
  totalDiv.textContent = `Total Valor Baixado: ${formatCurrency(totalBaixado)} | Total Saldo Atual: ${formatCurrency(totalSaldo)}`;

  const totalPages = Math.ceil(lancamentos.length / pageSize);
  let pagHtml = '';
  if (totalPages > 1) {
    pagHtml += `<button ${paginaAtual <= 1 ? 'disabled' : ''} id="prevFech">Anterior</button>`;
    pagHtml += `<span class="muted"> Página ${paginaAtual}/${totalPages} </span>`;
    pagHtml += `<button ${paginaAtual >= totalPages ? 'disabled' : ''} id="nextFech">Próxima</button>`;
  }
  paginacaoDiv.innerHTML = pagHtml;
  document.getElementById('prevFech')?.addEventListener('click', () => {
    if (paginaAtual > 1) {
      paginaAtual--;
      renderTabela();
    }
  });
  document.getElementById('nextFech')?.addEventListener('click', () => {
    if (paginaAtual < totalPages) {
      paginaAtual++;
      renderTabela();
    }
  });
}

btnExportar?.addEventListener('click', () => {
  const table = tabelaDiv.querySelector('table');
  if (!table) return;
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Fechamentos' });
  XLSX.writeFile(wb, 'fechamentos.xlsx');
});

async function salvarContasFechamento() {
  try {
    const ops = lancamentos
      .filter(l => !l.invalida)
      .map(l => addDoc(collection(db, 'contasfechamento'), l));
    await Promise.all(ops);
  } catch (err) {
    console.error('Erro ao salvar contasfechamento', err);
  }
}

export {}; // for module scope

