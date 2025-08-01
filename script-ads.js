if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
  }
});

async function importarShopeeAds() {
  const fileInput = document.getElementById('adsFileInput');
  const file = fileInput.files[0];
  if (!file) return alert('Selecione uma planilha Shopee Ads (.csv)');

  const reader = new FileReader();
  reader.onload = async (e) => {
    const todasLinhas = e.target.result.split(/\r?\n/).filter(l => l.trim());

// 🟡 Captura nome do produto corretamente
let nomeProdutoRaw = "Campanha_Desconhecida";
const linhaProdutoIndex = todasLinhas.findIndex(l => l.includes("Nome do Produto / Anúncio"));
if (linhaProdutoIndex !== -1) {
  const linhaProduto = todasLinhas[linhaProdutoIndex];
  const partes = linhaProduto.split(",");
  nomeProdutoRaw = partes[1]?.replace(/^"|"$/g, "").trim() || nomeProdutoRaw;
}
const nomeProduto = nomeProdutoRaw
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]/g, "_");

    // 🗓️ Captura a data final do período
    const linhaPeriodoIndex = todasLinhas.findIndex(l => l.startsWith("Período"));
    let dataFormatada = new Date().toISOString().slice(0, 10); // fallback
    if (linhaPeriodoIndex !== -1) {
      const periodoRaw = todasLinhas[linhaPeriodoIndex].split(",")[1];
      const dataFinal = periodoRaw?.split(" - ")[1];
      if (dataFinal) {
        const partes = dataFinal.split("/");
        if (partes.length === 3) {
          dataFormatada = `${partes[2]}-${partes[1]}-${partes[0]}`;
        }
      }
    }

    // 🧠 Detecta o cabeçalho (linha que começa com "#,")
    const linhaCabecalhoIndex = todasLinhas.findIndex(l => l.startsWith("#,"));
    if (linhaCabecalhoIndex === -1) return alert("❌ Cabeçalho não encontrado.");

    const cabecalho = todasLinhas[linhaCabecalhoIndex].split(",");
    const dados = todasLinhas.slice(linhaCabecalhoIndex + 1)
      .map(l => l.split(","))
      .filter(l => l.length === cabecalho.length);

    console.log("📌 Campanha:", nomeProduto);
    console.log("📆 Data final:", dataFormatada);
    console.log("📄 Cabeçalho:", cabecalho);
    console.log("📦 Primeira linha:", dados[0]);

    const getIndex = (termo) =>
      cabecalho.findIndex(c =>
        c.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/gi, "").includes(termo)
      );

    const pos = {
      impressoes: getIndex("impressoes"),
      cliques: getIndex("cliques"),
      gasto: getIndex("despesas"),
      receita: getIndex("receita"),
      vendas: getIndex("itensvendidos"),
      roas: getIndex("roas"),
      cpc: getIndex("custoporconversao"),
      ctr: getIndex("ctr")
    };

    const user = firebase.auth().currentUser;
if (!user) {
  alert("⚠️ Você precisa estar logado para importar.");
  return;
}

// 🔐 Cria ou atualiza o documento da campanha com o UID
await db.collection("ads").doc(nomeProduto).set({
  uid: user.uid,
  produto: nomeProdutoRaw,
  ultimaImportacao: new Date().toISOString()
}, { merge: true });

// 🔁 Agora salva o desempenho por data
for (const linha of dados) {
  const ref = db
    .collection("ads")
    .doc(nomeProduto)
    .collection("desempenho")
    .doc(dataFormatada);

  const registro = {
    produto: nomeProdutoRaw,
    data: dataFormatada,
    impressoes: parseInt(linha[pos.impressoes]) || 0,
    cliques: parseInt(linha[pos.cliques]) || 0,
    gasto: parseFloat(linha[pos.gasto]?.replace(",", ".")) || 0,
    receita: parseFloat(linha[pos.receita]?.replace(",", ".")) || 0,
    vendas: parseInt(linha[pos.vendas]) || 0,
    roas: parseFloat(linha[pos.roas]?.replace(",", ".")) || 0,
    cpc: parseFloat(linha[pos.cpc]?.replace(",", ".")) || 0,
    ctr: parseFloat((linha[pos.ctr] || "0").replace("%", "").replace(",", ".")) / 100 || 0,
  };

  try {
    await ref.set(registro, { merge: true });
    console.log("✅ Salvo:", nomeProduto, dataFormatada);
  } catch (erro) {
    console.error("❌ Erro ao salvar:", erro);
  }
}


    alert("✅ Planilha importada com sucesso.");
  };

  reader.readAsText(file, "UTF-8");
}


// 🔽 Aqui fora da função importarShopeeAds()
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
window.importarShopeeAds = importarShopeeAds;

