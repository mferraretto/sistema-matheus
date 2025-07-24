function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('active');
    }
    
    // Corrigido cálculo da área do cilindro (2 bases + lateral)
    function areaCilindro(h, d) {
      const pi = Math.PI;
      const r = d / 2;
      const areaBase = pi * r * r;
      const areaLateral = 2 * pi * r * h;
      return (2 * areaBase) + areaLateral;
    }

    function calcularMDF() {
      const chapas = window.chapas || [];
      let pecasComErro = false;
      let htmlErros = '';
      let total = 0;
      
      function calcularPeca(alturaId, diametroId, chapaId, pecaNum) {
        const altura = parseFloat(document.getElementById(alturaId).value) || 0;
        const diametro = parseFloat(document.getElementById(diametroId).value) || 0;
        const chapaIdValue = document.getElementById(chapaId).value;
        const chapa = chapas.find(c => c.id === chapaIdValue);

        if ((altura > 0 || diametro > 0) && chapaIdValue === "") {
          pecasComErro = true;
          htmlErros += `<div style="color: #e74c3c; margin: 5px 0;">
            <strong>⚠️ Atenção:</strong> Selecione uma chapa para a Peça ${pecaNum}
          </div>`;
          return 0;
        }
        
        if (!chapa || !chapa.comprimento || !chapa.largura || !chapa.preco) return 0;
        
        const area = areaCilindro(altura, diametro);
        const precoCm2 = chapa.preco / (chapa.comprimento * chapa.largura);
        const custo = area * precoCm2;
        total += custo;
        
        return custo;
      }
      
      const p1 = calcularPeca('alturaP1', 'diametroP1', 'chapaP1', 1);
      const p2 = calcularPeca('alturaP2', 'diametroP2', 'chapaP2', 2);
      const p3 = calcularPeca('alturaP3', 'diametroP3', 'chapaP3', 3);
      const p4 = calcularPeca('alturaP4', 'diametroP4', 'chapaP4', 4);
      
      let htmlResult = `<strong>🔍 Resultado:</strong><br>`;
      
      if (pecasComErro) {
        htmlResult += htmlErros + '<br>';
      }
      
      htmlResult += `
        ➤ Peça 1: R$ ${p1.toFixed(2)}<br>
        ➤ Peça 2: R$ ${p2.toFixed(2)}<br>
        ➤ Peça 3: R$ ${p3.toFixed(2)}<br>
        ➤ Peça 4: R$ ${p4.toFixed(2)}<br><br>
        <strong>💰 Custo total de MDF: R$ ${total.toFixed(2)}</strong>
      `;
      
      document.getElementById('resultadoMDF').innerHTML = htmlResult;
      
      // Atualiza o campo do Resumo Final
      const inputResumoMDF = document.getElementById('custoMDF');
      if (inputResumoMDF) {
        inputResumoMDF.value = total.toFixed(2);
      }
    }

    function calcularMaoObra() {
      const maoDireta = parseFloat(document.getElementById('maoDireta').value) || 0;
      const maoIndireta = parseFloat(document.getElementById('maoIndireta').value) || 0;
      const quantidadeMes = parseFloat(document.getElementById('quantidadeMes').value) || 0;

      const maoIndiretaUnit = quantidadeMes > 0 ? maoIndireta / quantidadeMes : 0;
      const custoTotalUnit = maoDireta + maoIndiretaUnit;

      document.getElementById('resultadoMaoObra').innerHTML = `
        <strong>🔍 Resultado:</strong><br>
        ➤ Mão de Obra Direta: R$ ${maoDireta.toFixed(2)}<br>
        ➤ Mão de Obra Indireta por peça: R$ ${maoIndiretaUnit.toFixed(2)}<br>
        ➤ <strong>Custo total de mão de obra por peça: R$ ${custoTotalUnit.toFixed(2)}</strong>
      `;

      const inputResumoMao = document.getElementById('custoMao');
      if (inputResumoMao) {
        inputResumoMao.value = custoTotalUnit.toFixed(2);
      }
    }

    function calcularEmbalagem() {
      const caixa = parseFloat(document.getElementById('caixa').value) || 0;
      const plastico = parseFloat(document.getElementById('plastico').value) || 0;
      const saco = parseFloat(document.getElementById('saco').value) || 0;
      const etiqueta = parseFloat(document.getElementById('etiqueta').value) || 0;
      const outros = parseFloat(document.getElementById('outros').value) || 0;

      const total = caixa + plastico + saco + etiqueta + outros;

      document.getElementById('resultadoEmbalagem').innerHTML = `
        <strong>🔍 Resultado:</strong><br>
        ➤ Caixa: R$ ${caixa.toFixed(2)}<br>
        ➤ Plástico Bolha: R$ ${plastico.toFixed(2)}<br>
        ➤ Saco: R$ ${saco.toFixed(2)}<br>
        ➤ Etiqueta: R$ ${etiqueta.toFixed(2)}<br>
        ➤ Outros: R$ ${outros.toFixed(2)}<br><br>
        <strong>Custo total de embalagem: R$ ${total.toFixed(2)}</strong>
      `;

      const inputResumoEmbalagem = document.getElementById('custoEmbalagem');
      if (inputResumoEmbalagem) {
        inputResumoEmbalagem.value = total.toFixed(2);
      }
    }
    
    async function salvarChapa() {
      const comprimento = document.getElementById('comprimentoChapa').value;
      const largura = document.getElementById('larguraChapaCadastro').value;
      const espessura = document.getElementById('espessuraChapa').value;
      const tipo = document.getElementById('tipoChapa').value;
      const preco = document.getElementById('precoChapaCadastro').value;

      if (!comprimento || !largura || !espessura || !tipo || !preco) {
        alert('Preencha todos os campos.');
        return;
      }

       if (!currentUser) {
        alert('Usuário não autenticado!');
        return;
      }

      try {
        await db.collection('chapasMDF').add({
          comprimento,
          largura,
          espessura,
          tipo,
          preco,
          uid: currentUser.uid,
          createdAt: new Date().toISOString()
        });
        listarChapas();
        preencherSelectChapas();
        alert('✅ Chapa cadastrada com sucesso!');
      } catch (e) {
        console.error('Erro ao salvar chapa', e);
        alert('❌ Erro ao salvar chapa');
      }
    }

    async function listarChapas() {
      if (!currentUser) return;
      const snapshot = await db.collection('chapasMDF')
        .where('uid', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get();
      chapas = [];
      snapshot.forEach(doc => {
        chapas.push({ id: doc.id, ...doc.data() });
      });
      const tabela = document.getElementById('tabelaChapas');
      tabela.innerHTML = '';

      if (chapas.length === 0) {
        tabela.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center;">Nenhuma chapa cadastrada ainda</td>
          </tr>
        `;
        return;
      }

      chapas.forEach((chapa, index) => {
        const linha = document.createElement('tr');
        linha.innerHTML = `
          <td>${chapa.comprimento}</td>
          <td>${chapa.largura}</td>
          <td>${chapa.espessura}</td>
          <td>${chapa.tipo}</td>
          <td>R$ ${parseFloat(chapa.preco).toFixed(2)}</td>
          <td>
            <button class="btn-danger" onclick="excluirChapa('${chapa.id}')">🗑 Excluir</button>
          </td>
        `;
        tabela.appendChild(linha);
      });
    }

    async function excluirChapa(id) {
      if (!confirm('Tem certeza que deseja excluir esta chapa?')) return;
        try {
        await db.collection('chapasMDF').doc(id).delete();
        listarChapas();
        preencherSelectChapas();
        alert('✅ Chapa excluída com sucesso!');
      } catch (e) {
        console.error('Erro ao excluir chapa', e);
        alert('❌ Erro ao excluir chapa');
      }
    }
    
    function preencherSelectChapas() {
      const selects = document.querySelectorAll('.chapaSelect');

      selects.forEach(select => {
        select.innerHTML = `<option value="">-- Escolha uma chapa --</option>`;
        chapas.forEach((chapa) => {
          const texto = `${chapa.tipo} - ${chapa.comprimento}x${chapa.largura}cm - ${chapa.espessura}mm - R$${parseFloat(chapa.preco).toFixed(2)}`;
          const option = document.createElement('option');
          option.value = chapa.id;
          option.textContent = texto;
          select.appendChild(option);
        });
      });
    }
    
    function calcularCustosIndiretos() {
      const campos = document.querySelectorAll('.indireto');
      let total = 0;
      campos.forEach(campo => {
        const valor = parseFloat(campo.value) || 0;
        total += valor;
      });

      document.getElementById('resultadoIndiretos').innerHTML = `
        <strong>🔍 Resultado:</strong><br>
        ➤ Total de Custos Indiretos Mensais: <strong>R$ ${total.toFixed(2)}</strong>
      `;

      const inputResumoIndireto = document.getElementById('custoIndiretoMensal');
      if (inputResumoIndireto) {
        inputResumoIndireto.value = total.toFixed(2);
      }
    }
    
    function calcularResumoFinal() {
      const nomeProduto = document.getElementById('nomeProduto')?.value || 'Produto não identificado';
      const codigoProduto = document.getElementById('codigoProduto')?.value || 'Sem código';

      const custoMDF = parseFloat(document.getElementById('custoMDF')?.value) || 0;
      const custoMao = parseFloat(document.getElementById('custoMao')?.value) || 0;
      const custoEmbalagem = parseFloat(document.getElementById('custoEmbalagem')?.value) || 0;
      const custoIndiretoMensal = parseFloat(document.getElementById('custoIndiretoMensal')?.value) || 0;
      const qtdMensal = parseFloat(document.getElementById('qtdMensal')?.value) || 1;
      const qtdVendida = parseFloat(document.getElementById('qtdVendida')?.value) || 0;

      const custoIndiretoUnit = custoIndiretoMensal / qtdMensal;
      const custoTotalUnit = custoMDF + custoMao + custoEmbalagem + custoIndiretoUnit;

      const preco20 = custoTotalUnit * 1.2;
      const preco25 = custoTotalUnit * 1.25;
      const preco30 = custoTotalUnit * 1.3;

      const lucroUnit20 = preco20 - custoTotalUnit;
      const lucroUnit25 = preco25 - custoTotalUnit;
      const lucroUnit30 = preco30 - custoTotalUnit;

      const pontoEquilibrio20 = lucroUnit20 > 0 ? custoIndiretoMensal / lucroUnit20 : 0;
      const pontoEquilibrio25 = lucroUnit25 > 0 ? custoIndiretoMensal / lucroUnit25 : 0;
      const pontoEquilibrio30 = lucroUnit30 > 0 ? custoIndiretoMensal / lucroUnit30 : 0;

      const lucroEstimado = lucroUnit20 * qtdVendida;

      // Mostra na tela com HTML estilizado
      const resumoHTML = `
        <strong>🧾 Identificação:</strong><br>
        ➤ Nome: <strong>${nomeProduto}</strong><br>
        ➤ Código: <strong>${codigoProduto}</strong><br><br>

        <strong>📋 Resumo:</strong><br>
        ➤ Custo MDF: R$ ${custoMDF.toFixed(2)}<br>
        ➤ Mão de Obra: R$ ${custoMao.toFixed(2)}<br>
        ➤ Embalagem: R$ ${custoEmbalagem.toFixed(2)}<br>
        ➤ Custo Indireto Unitário: R$ ${custoIndiretoUnit.toFixed(2)}<br>
        <strong>💰 Custo Total Unitário: R$ ${custoTotalUnit.toFixed(2)}</strong><br><br>

        <strong>Preços com Lucro:</strong><br>
        ➤ 20%: R$ ${preco20.toFixed(2)} | 📉 Ponto de Equilíbrio: ${Math.ceil(pontoEquilibrio20)} unidades<br>
        ➤ 25%: R$ ${preco25.toFixed(2)} | 📉 Ponto de Equilíbrio: ${Math.ceil(pontoEquilibrio25)} unidades<br>
        ➤ 30%: R$ ${preco30.toFixed(2)} | 📉 Ponto de Equilíbrio: ${Math.ceil(pontoEquilibrio30)} unidades<br><br>

        <strong>💸 Lucro com ${qtdVendida} vendidas (20% lucro):</strong> R$ ${lucroEstimado.toFixed(2)}
      `;

      const resultadoResumo = document.getElementById('resultadoResumo');
      if (resultadoResumo) {
        resultadoResumo.innerHTML = resumoHTML;
      }
    }
    
    function exportarResumoPDF() {
      // Aguarda a atualização da DOM antes de exportar
      setTimeout(() => {
        const element = document.getElementById('resumoContainer');
        const nomeProduto = document.getElementById('nomeProduto').value.trim() || 'Produto';
        const codigoProduto = document.getElementById('codigoProduto').value.trim() || 'codigo';

        const opt = {
          margin: 1,
          filename: `${nomeProduto}-${codigoProduto}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save();
      }, 100);
    }
    
    async function salvarResumo() {
      if (!currentUser) {
        alert('Usuário não autenticado!');
        return;
      }

      const resumo = {
        nomeProduto: document.getElementById('nomeProduto').value || '',
        codigoProduto: document.getElementById('codigoProduto').value || '',
        custoMDF: parseFloat(document.getElementById('custoMDF').value) || 0,
        custoMao: parseFloat(document.getElementById('custoMao').value) || 0,
        custoEmbalagem: parseFloat(document.getElementById('custoEmbalagem').value) || 0,
        custoIndiretoMensal: parseFloat(document.getElementById('custoIndiretoMensal').value) || 0,
        qtdMensal: parseFloat(document.getElementById('qtdMensal').value) || 0,
        qtdVendida: parseFloat(document.getElementById('qtdVendida').value) || 0,
        uid: currentUser.uid,
        timestamp: new Date().toISOString()
      };

      try {
        await db.collection('calculos').add(resumo);
        listarCalculos();
        alert('✅ Resumo salvo com sucesso!');
      } catch (e) {
        console.error('Erro ao salvar resumo', e);
        alert('❌ Erro ao salvar resumo');
      }
    }

    async function listarCalculos() {
      if (!currentUser) return;
      const snapshot = await db.collection('calculos')
        .where('uid', '==', currentUser.uid)
        .orderBy('timestamp', 'desc')
        .get();
      const tabela = document.getElementById('tabelaCalculos');
      tabela.innerHTML = '';
      if (snapshot.empty) {
        tabela.innerHTML = `<tr><td colspan="4" style="text-align:center;">Nenhum cálculo salvo</td></tr>`;
        return;
      }
      snapshot.forEach(doc => {
        const c = doc.data();
        const linha = document.createElement('tr');
        linha.innerHTML = `
          <td>${c.nomeProduto}</td>
          <td>${c.codigoProduto}</td>
          <td>${new Date(c.timestamp).toLocaleDateString()}</td>
          <td><button class="btn-danger" onclick="excluirCalculo('${doc.id}')">🗑 Excluir</button></td>
        `;
        tabela.appendChild(linha);
      });
    }

    async function excluirCalculo(id) {
      if (!confirm('Tem certeza que deseja excluir este cálculo?')) return;
      try {
        await db.collection('calculos').doc(id).delete();
        listarCalculos();
        alert('✅ Cálculo excluído com sucesso!');
      } catch (e) {
        console.error('Erro ao excluir cálculo', e);
        alert('❌ Erro ao excluir cálculo');
      }
    }
    
    // Funções de persistência de dados
    function salvarCustosIndiretos() {
      const campos = document.querySelectorAll('#custosIndiretos .indireto');
      campos.forEach(campo => {
        localStorage.setItem(`indireto_${campo.name}`, campo.value);
      });
    }

    function carregarCustosIndiretos() {
      const campos = document.querySelectorAll('#custosIndiretos .indireto');
      campos.forEach(campo => {
        const valor = localStorage.getItem(`indireto_${campo.name}`);
        if (valor !== null) {
          campo.value = valor;
        }
      });
    }
    
    // Inicialização do sistema
    window.onload = () => {
      
      const campos = document.querySelectorAll('#custosIndiretos .indireto');
      campos.forEach(campo => {
        campo.addEventListener('input', salvarCustosIndiretos);
      });
    };
