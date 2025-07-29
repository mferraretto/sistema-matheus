if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

async function importarShopeeAds() {
  const fileInput = document.getElementById('adsFileInput');
  const file = fileInput.files[0];
  if (!file) return alert('Selecione uma planilha Shopee Ads (.csv)');

  const reader = new FileReader();
  reader.onload = async (e) => {
    const linhas = e.target.result.split(/\\r?\\n/).slice(10); // Pula cabeçalho Shopee
    if (!linhas.length) return alert("❌ Planilha vazia ou inválida.");

    const cabecalho = linhas[0].split(",");
    const dados = linhas.slice(1).map(linha => linha.split(",")).filter(c => c.length === cabecalho.length);

    const pos = {
      data: cabecalho.findIndex(c => c.toLowerCase().includes("data")),
      campanha: cabecalho.findIndex(c => c.toLowerCase().includes("campanha")),
      produto: cabecalho.findIndex(c => c.toLowerCase().includes("produto")),
      impressoes: cabecalho.findIndex(c => c.toLowerCase().includes("impress")),
      cliques: cabecalho.findIndex(c => c.toLowerCase().includes("clique")),
      gasto: cabecalho.findIndex(c => c.toLowerCase().includes("gasto")),
      receita: cabecalho.findIndex(c => c.toLowerCase().includes("receita")),
      vendas: cabecalho.findIndex(c => c.toLowerCase().includes("venda")),
      roas: cabecalho.findIndex(c => c.toLowerCase().includes("roas")),
      cpc: cabecalho.findIndex(c => c.toLowerCase().includes("cpc")),
      ctr: cabecalho.findIndex(c => c.toLowerCase().includes("ctr"))
    };

    for (const linha of dados) {
      const dataRaw = linha[pos.data] || "";
      const dataFormatada = dataRaw.split(" ")[0]?.replaceAll("/", "-");
      const campanha = linha[pos.campanha] || "Campanha Desconhecida";
      const produto = linha[pos.produto] || "";

      const ref = doc(db, "ads", campanha, "desempenho", dataFormatada);
      await setDoc(ref, {
        produto,
        impressoes: parseInt(linha[pos.impressoes]) || 0,
        cliques: parseInt(linha[pos.cliques]) || 0,
        gasto: parseFloat(linha[pos.gasto]) || 0,
        receita: parseFloat(linha[pos.receita]) || 0,
        vendas: parseInt(linha[pos.vendas]) || 0,
        roas: parseFloat(linha[pos.roas]) || 0,
        cpc: parseFloat(linha[pos.cpc]) || 0,
        ctr: parseFloat((linha[pos.ctr] || "0").replace("%", "")) / 100 || 0,
        data: dataFormatada
      }, { merge: true });
    }

    alert("✅ Importação concluída com sucesso.");
  };

  reader.readAsText(file);
}


async function carregarGrafico() {
  const ctx = document.getElementById('graficoDesempenho').getContext('2d');
  const snap = await db.collectionGroup('desempenho').get();

  const dadosPorData = {};
  snap.forEach(doc => {
    const d = doc.data();
    if (!dadosPorData[d.data]) dadosPorData[d.data] = { gasto: 0, receita: 0 };
    dadosPorData[d.data].gasto += d.gasto;
    dadosPorData[d.data].receita += d.receita;
  });

  const labels = Object.keys(dadosPorData).sort();
  const gastos = labels.map(d => dadosPorData[d].gasto);
  const receitas = labels.map(d => dadosPorData[d].receita);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Gasto (R$)', data: gastos, borderColor: 'red', fill: false },
        { label: 'Receita (R$)', data: receitas, borderColor: 'green', fill: false }
      ]
    }
  });
}
