if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Função no script-ads.js
async function importarShopeeAds() {
  const fileInput = document.getElementById('adsFileInput');
  const file = fileInput.files[0];
  if (!file) return alert('Selecione uma planilha Shopee Ads (.csv)');

  const reader = new FileReader();
  reader.onload = async (e) => {
  const todasLinhas = e.target.result.split(/\r?\n/);

// Detecta a linha onde está o cabeçalho da Shopee Ads: "#,Palavra-chave,..."
const linhaCabecalhoIndex = todasLinhas.findIndex(l => l.startsWith("#,"));

if (linhaCabecalhoIndex === -1) {
  return alert("❌ Cabeçalho da tabela não encontrado. Verifique a planilha.");
}

const cabecalho = todasLinhas[linhaCabecalhoIndex].split(",");
const dados = todasLinhas.slice(linhaCabecalhoIndex + 1)
  .map(l => l.split(","))
  .filter(l => l.length === cabecalho.length);

    const getIndex = (termo) =>
      cabecalho.findIndex(c => c.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/gi, "").includes(termo));

    const pos = {
      data: getIndex("data"),
      campanha: getIndex("campanha"),
      produto: getIndex("produto"),
      impressoes: getIndex("impressoes"),
      cliques: getIndex("cliques"),
      gasto: getIndex("gasto"),
      receita: getIndex("receita"),
      vendas: getIndex("vendas"),
      roas: getIndex("roas"),
      cpc: getIndex("cpc"),
      ctr: getIndex("ctr")
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
        gasto: parseFloat(linha[pos.gasto].replace(",", ".")) || 0,
        receita: parseFloat(linha[pos.receita].replace(",", ".")) || 0,
        vendas: parseInt(linha[pos.vendas]) || 0,
        roas: parseFloat(linha[pos.roas].replace(",", ".")) || 0,
        cpc: parseFloat(linha[pos.cpc].replace(",", ".")) || 0,
        ctr: parseFloat((linha[pos.ctr] || "0").replace("%", "").replace(",", ".")) / 100 || 0,
        data: dataFormatada
      }, { merge: true });
    }

    alert("✅ Planilha importada com sucesso.");
  };

  reader.readAsText(file, "UTF-8");
}


async function carregarGrafico() {
  const ctx = document.getElementById('graficoDesempenho').getContext('2d');
  const campanhasSnap = await db.collection('ads').get();

  const dadosPorData = {};
  for (const campDoc of campanhasSnap.docs) {
    const desempenhoSnap = await campDoc.ref.collection('desempenho').get();
    desempenhoSnap.forEach(doc => {
      const d = doc.data();
      if (!dadosPorData[d.data]) dadosPorData[d.data] = { gasto: 0, receita: 0 };
      dadosPorData[d.data].gasto += d.gasto;
      dadosPorData[d.data].receita += d.receita;
    });
  }

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
