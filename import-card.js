(function () {
  // Toggle visibility of the Importar Produtos card on the precificação page
  window.toggleImportCard = function () {
    var card = document.getElementById('importarProdutosCard');
    var btn = document.getElementById('toggleImportarBtn');
    if (!card || !btn) return;
    card.classList.toggle('hidden');
    if (card.classList.contains('hidden')) {
      btn.textContent = 'Exibir Importar Produtos';
    } else {
      btn.textContent = 'Esconder Importar Produtos';
    }
  };

  // Generate a template spreadsheet for pricing imports, including dual Shopee rate flag
  window.downloadPricingTemplate = function () {
    const headers = [
      'Produto',
      'SKU',
      'Plataforma',
      'Custo (R$)',
      'Taxas da Plataforma (%)',
      'Custo Fixo Plataforma (R$)',
      'Frete (R$)',
      'Taxa de Transação (%)',
      'Taxa de Transferência (%)',
      'Taxa de Antecipação (%)',
      'Custos Variáveis (R$)',
      'Imposto (%)',
      'Comissão do Vendedor (%)',
      'Duas Taxas Shopee (S/N)',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, 'modelo_precificacao.xlsx');
  };

  // Import pricing data from a spreadsheet and optionally calculate Shopee prices for 14% and 20%
  window.importPricingFile = async function () {
    const fileInput = document.getElementById('pricingFileInput');
    const file = fileInput.files[0];

    if (!file) {
      showToast('Selecione um arquivo primeiro!', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (jsonData.length < 2) {
        showToast('Planilha vazia ou formato inválido!', 'warning');
        return;
      }

      const headers = jsonData[0];
      let imported = 0;

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row.length === 0) continue;

        const product = {};
        for (let j = 0; j < headers.length; j++) {
          product[headers[j]] = row[j];
        }

        const nome =
          product['Produto'] ||
          product['produto'] ||
          product['Nome do Produto'] ||
          '';
        const sku = product['SKU'] || product['sku'] || '';
        const plataforma = (
          product['Plataforma'] ||
          product['plataforma'] ||
          ''
        ).toUpperCase();
        const custo = parseFloat(
          product['Custo'] ||
            product['Custo do Produto'] ||
            product['Custo (R$)'] ||
            0,
        );

        if (!nome || !plataforma) continue;

        const duasVal = (product['Duas Taxas Shopee (S/N)'] || '')
          .toString()
          .trim()
          .toLowerCase();
        const usarDuas =
          plataforma === 'SHOPEE' &&
          ['s', 'sim', 'y', 'yes', '1', 'true'].includes(duasVal);

        const taxas = {
          'Taxas da Plataforma (%)': parseFloat(
            product['Taxas da Plataforma (%)'] ||
              product['Taxa da Plataforma'] ||
              0,
          ),
          'Custo Fixo Plataforma (R$)': parseFloat(
            product['Custo Fixo Plataforma (R$)'] || product['Custo Fixo'] || 0,
          ),
          'Frete (R$)': parseFloat(product['Frete (R$)'] || 0),
          'Taxa de Transação (%)': parseFloat(
            product['Taxa de Transação (%)'] || 0,
          ),
          'Taxa de Transferência (%)': parseFloat(
            product['Taxa de Transferência (%)'] || 0,
          ),
          'Taxa de Antecipação (%)': parseFloat(
            product['Taxa de Antecipação (%)'] || 0,
          ),
          'Custos Variáveis (R$)': parseFloat(
            product['Custos Variáveis (R$)'] || 0,
          ),
          'Imposto (%)': parseFloat(product['Imposto (%)'] || 0),
          'Comissão do Vendedor (%)': parseFloat(
            product['Comissão do Vendedor (%)'] || 0,
          ),
        };

        const totals = Object.entries(taxas).reduce(
          (acc, [key, val]) => {
            if (key.includes('(%)')) acc.percent += val || 0;
            else acc.fix += val || 0;
            return acc;
          },
          { percent: 0, fix: 0 },
        );

        const taxaPlataforma = taxas['Taxas da Plataforma (%)'] || 0;

        if (usarDuas) {
          const basePercent = totals.percent - taxaPlataforma;
          const resultados = [20, 14]
            .map((taxa) => {
              const totalPercent = basePercent + taxa;
              if (totalPercent >= 100) return null;
              const precoMinimo = (
                (custo + totals.fix) /
                (1 - totalPercent / 100)
              ).toFixed(2);
              const precoPromo = precoMinimo;
              const precoMedio = (precoMinimo * 1.05).toFixed(2);
              const precoIdeal = (precoMinimo * 1.1).toFixed(2);
              const taxasDetalhadas = {
                ...taxas,
                'Taxas da Plataforma (%)': taxa,
              };
              return {
                taxaPercentual: taxa,
                precoMinimo: parseFloat(precoMinimo),
                precoPromo: parseFloat(precoPromo),
                precoMedio: parseFloat(precoMedio),
                precoIdeal: parseFloat(precoIdeal),
                taxas: taxasDetalhadas,
              };
            })
            .filter(Boolean);

          if (resultados.length) {
            const salvo = await salvarProdutoMultiplasTaxas(
              nome,
              sku,
              plataforma,
              custo,
              resultados,
            );
            if (salvo) imported++;
          }
          continue;
        }

        if (totals.percent >= 100) continue;

        const precoMinimo = (
          (custo + totals.fix) /
          (1 - totals.percent / 100)
        ).toFixed(2);
        const precoPromo = precoMinimo;
        const precoMedio = (precoMinimo * 1.05).toFixed(2);
        const precoIdeal = (precoMinimo * 1.1).toFixed(2);

        const salvo = await salvarProduto(
          nome,
          sku,
          plataforma,
          precoMinimo,
          precoIdeal,
          precoMedio,
          precoPromo,
          custo,
          taxas,
        );
        if (salvo) imported++;
      }

      showToast(`${imported} produtos importados!`, 'success');
      fileInput.value = '';
    };

    reader.readAsArrayBuffer(file);
  };
})();
