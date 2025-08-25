// Gestão de Produtos - simples gerenciamento no navegador
let produtos = JSON.parse(localStorage.getItem('gestaoProdutos') || '[]');

function salvar() {
  localStorage.setItem('gestaoProdutos', JSON.stringify(produtos));
}

function adicionarProduto() {
  const nome = document.getElementById('produtoNome').value.trim();
  const sku = document.getElementById('produtoSku').value.trim();
  if (!nome || !sku) return;
  const estoque = Number(document.getElementById('produtoEstoque').value) || 0;
  const vendas = Number(document.getElementById('produtoVendas').value) || 0;
  const margemIdeal = Number(document.getElementById('margemIdeal').value) || 0;
  const margemMinima = Number(document.getElementById('margemMinima').value) || 0;
  const margemPraticada = Number(document.getElementById('margemPraticada').value) || 0;
  produtos.push({ nome, sku, estoque, vendas, margemIdeal, margemMinima, margemPraticada });
  salvar();
  limparFormulario();
  renderTudo();
}

function limparFormulario() {
  ['produtoNome','produtoSku','produtoEstoque','produtoVendas','margemIdeal','margemMinima','margemPraticada'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function criarTabela(colunas, dados) {
  let html = '<table class="min-w-full text-left"><thead><tr>' +
    colunas.map(c => `<th class="px-2 py-1 border-b">${c.label}</th>`).join('') +
    '</tr></thead><tbody>';
  html += dados.map(d => '<tr>' +
    colunas.map(c => `<td class="px-2 py-1 border-b">${d[c.key] ?? ''}</td>`).join('') +
    '</tr>').join('');
  html += '</tbody></table>';
  return html;
}

function renderProdutos() {
  const colunas = [
    { key: 'nome', label: 'Nome' },
    { key: 'sku', label: 'SKU' },
    { key: 'estoque', label: 'Estoque' },
    { key: 'vendas', label: 'Vendas' }
  ];
  document.getElementById('tabelaProdutos').innerHTML = criarTabela(colunas, produtos);
}

function renderMaisVendidos() {
  const dados = [...produtos].sort((a,b) => b.vendas - a.vendas);
  const colunas = [
    { key: 'nome', label: 'Nome' },
    { key: 'vendas', label: 'Vendas' }
  ];
  document.getElementById('maisVendidos').innerHTML = criarTabela(colunas, dados);
}

function renderBaixoGiro() {
  const dados = produtos.filter(p => p.estoque > 0 && p.vendas === 0);
  const colunas = [
    { key: 'nome', label: 'Nome' },
    { key: 'estoque', label: 'Estoque' },
    { key: 'vendas', label: 'Vendas' }
  ];
  document.getElementById('baixoGiro').innerHTML = criarTabela(colunas, dados);
}

function renderMargens() {
  const colunas = [
    { key: 'nome', label: 'Nome' },
    { key: 'margemIdeal', label: 'Margem ideal (%)' },
    { key: 'margemMinima', label: 'Margem mínima (%)' },
    { key: 'margemPraticada', label: 'Margem praticada (%)' }
  ];
  document.getElementById('margemProdutos').innerHTML = criarTabela(colunas, produtos);
}

function renderTudo() {
  renderProdutos();
  renderMaisVendidos();
  renderBaixoGiro();
  renderMargens();
}

document.getElementById('btnAdicionarProduto')?.addEventListener('click', adicionarProduto);

renderTudo();
