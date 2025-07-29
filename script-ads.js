if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

async function importarShopeeAds() {
  const fileInput = document.getElementById('adsFileInput');
  const file = fileInput.files[0];
  if (!file) return alert('Selecione uma planilha.');

  const reader = new FileReader();
  reader.onload = async (e) => {
    const workbook = XLSX.read(e.target.result, { type: 'binary' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    for (const row of data) {
      const campanha = row['Campanha'] || 'Desconhecida';
      const dataRef = (row['Data'] || '').split(' ')[0].replaceAll('/', '-');
      if (!dataRef) continue;
      await db.collection("ads").doc(campanha).collection("desempenho").doc(dataRef).set({
        produto: row['Produto'] || '',
        impressoes: Number(row['Impressões']) || 0,
        cliques: Number(row['Cliques']) || 0,
        gasto: Number(row['Gasto (R$)']) || 0,
        receita: Number(row['Receita (R$)']) || 0,
        vendas: Number(row['Vendas']) || 0,
        ctr: parseFloat((row['CTR'] || '').toString().replace('%', '')) / 100 || 0,
        cpc: Number(row['CPC']) || 0,
        roas: Number(row['ROAS']) || 0,
        data: dataRef,
      }, { merge: true });
    }

    alert("✅ Dados importados com sucesso.");
    carregarGrafico();
  };
  reader.readAsBinaryString(file);
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