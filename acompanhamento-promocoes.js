// Dados de exemplo de promoções
const promocoes = [
  {
    id: 1,
    nome: 'Queima de Estoque',
    tipo: 'Desconto',
    sku: 'SKU123',
    produto: 'Produto A',
    inicio: '2024-10-01',
    fim: '2024-10-10',
    vendas: 120,
    cliques: 1000,
    status: 'Ativa'
  },
  {
    id: 2,
    nome: 'Promoção Relâmpago',
    tipo: 'Oferta Relâmpago',
    sku: 'SKU456',
    produto: 'Produto B',
    inicio: '2024-09-20',
    fim: '2024-09-25',
    vendas: 80,
    cliques: 600,
    status: 'Expirada'
  },
  {
    id: 3,
    nome: 'Cupom 10%',
    tipo: 'Cupom de Vendedor',
    sku: 'SKU789',
    produto: 'Produto C',
    inicio: '2024-10-05',
    fim: '2024-10-20',
    vendas: 60,
    cliques: 500,
    status: 'Agendada'
  }
];

// Configurações de cores e ícones por tipo de promoção
const tipoConfig = {
  'Desconto': { color: '#dc2626', icon: '🔻' },
  'Oferta Relâmpago': { color: '#f97316', icon: '⚡' },
  'Cupom de Vendedor': { color: '#a855f7', icon: '🎫' },
  'Shopee Ads': { color: '#3b82f6', icon: '📢' },
  'Shopee Live': { color: '#16a34a', icon: '🎥' },
  'Moedas': { color: '#fbbf24', icon: '💰' },
  'Avaliação': { color: '#86efac', icon: '⭐' },
  'Afiliação': { color: '#ec4899', icon: '🤝' }
};

function filtrarPromocoes() {
  const tipo = document.getElementById('filtroTipo').value;
  const inicio = document.getElementById('filtroInicio').value;
  const fim = document.getElementById('filtroFim').value;
  const termo = document.getElementById('filtroSku').value.toLowerCase();
  const status = document.getElementById('filtroStatus').value;

  return promocoes.filter(p => {
    const dentroTipo = !tipo || p.tipo === tipo;
    const dentroStatus = !status || p.status === status;
    const dentroTermo = !termo || p.sku.toLowerCase().includes(termo) || p.produto.toLowerCase().includes(termo);
    const dentroPeriodo = (!inicio || p.fim >= inicio) && (!fim || p.inicio <= fim);
    return dentroTipo && dentroStatus && dentroTermo && dentroPeriodo;
  });
}

function renderTabela() {
  const tbody = document.querySelector('#tabelaPromocoes tbody');
  tbody.innerHTML = '';
  const dados = filtrarPromocoes();

  dados.forEach(p => {
    const tr = document.createElement('tr');
    const cfg = tipoConfig[p.tipo] || { color: '#000', icon: '' };
    const taxa = p.cliques ? ((p.vendas / p.cliques) * 100).toFixed(2) + '%' : '0%';

    tr.innerHTML = `
      <td>${p.nome}</td>
      <td><span class="flex items-center gap-1" style="color:${cfg.color}">${cfg.icon} ${p.tipo}</span></td>
      <td>${p.sku}</td>
      <td>${p.produto}</td>
      <td>${p.inicio}</td>
      <td>${p.fim}</td>
      <td>${p.vendas}</td>
      <td>${p.cliques}</td>
      <td>${taxa}</td>
      <td><button class="btn btn-secondary" onclick="verDetalhes(${p.id})">Ver Detalhes</button></td>
    `;
    tbody.appendChild(tr);
  });
}

['filtroTipo', 'filtroInicio', 'filtroFim', 'filtroSku', 'filtroStatus'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderTabela);
  document.getElementById(id).addEventListener('change', renderTabela);
});

renderTabela();

let grafico;
function verDetalhes(id) {
  const promo = promocoes.find(p => p.id === id);
  if (!promo) return;
  const labels = gerarLabels(promo.inicio, promo.fim);
  const vendas = labels.map(() => Math.floor(Math.random() * 20) + 1);
  const fora = labels.map(() => Math.floor(Math.random() * 15) + 1);
  const comparacao = labels.map(() => Math.floor(Math.random() * 25) + 1);

  const ctx = document.getElementById('graficoPromocao').getContext('2d');
  if (grafico) grafico.destroy();
  grafico = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Vendas', data: vendas, borderColor: '#f97316', fill: false },
        { label: 'Fora da promoção', data: fora, borderColor: '#94a3b8', borderDash: [5,5], fill: false },
        { label: 'Outra promoção', data: comparacao, borderColor: '#3b82f6', fill: false }
      ]
    }
  });
  document.getElementById('graficoContainer').style.display = 'block';
}

function gerarLabels(inicio, fim) {
  const start = new Date(inicio);
  const end = new Date(fim);
  const labels = [];
  while (start <= end) {
    labels.push(start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    start.setDate(start.getDate() + 1);
  }
  return labels;
}
