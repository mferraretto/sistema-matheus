import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { saveUserDoc } from './secure-firestore.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function chamarIA(prompt, { json = false } = {}) {
    console.log("📤 Pergunta enviada para a IA:", prompt); // 👈 ADICIONE ESTA LINHA

  const body = {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }]
  };
  if (json) body.response_format = { type: 'json_object' };

  const resp = await fetch('https://us-central1-matheus-35023.cloudfunctions.net/proxyDeepSeek', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`IA request failed: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  const texto = data.choices?.[0]?.message?.content?.trim() || '';
  console.log("🧠 Resposta da IA (bruta):", texto);
  return texto;
}

window.gerarAnuncioIA = async function() {
  const nome = document.getElementById('nomeProduto').value;
  const preco = document.getElementById('precoBase').value;
  const caracteristicas = document.getElementById('caracteristicas').value;
  const material = document.getElementById('materialProduto').value;
  const medidas = document.getElementById('medidasProduto').value;
  const cor = document.getElementById('corProduto').value;
  const uso = document.getElementById('usoProduto').value;

  const prompt = `
Você é um especialista em anúncios da Shopee. Crie um anúncio com base nas informações abaixo e responda com um JSON válido no seguinte formato:

{
  "titulo": "...",
  "descricao": "...",
  "categoria": "...",
  "palavras_chave": ["...", "..."]
}

Informações do produto:
- Nome: ${nome}
- Preço: R$ ${preco}
- Características: ${caracteristicas}
- Material: ${material}
- Medidas: ${medidas}
- Cor: ${cor}
- Indicação de uso: ${uso}
`;

  try {
    const texto = await chamarIA(prompt, { json: true });

    let dados;
    try {
      dados = typeof texto === 'string' ? JSON.parse(texto) : texto;
    } catch {
      const match = texto.match(/\{[\s\S]+\}/);
      dados = match ? JSON.parse(match[0]) : {};
    }

    console.log("🎯 Dados processados:", dados);

    document.getElementById('sugestoes').classList.remove('hidden');
    document.getElementById('tituloIA').value = dados.titulo || '';
    document.getElementById('descricaoIA').value = dados.descricao || '';
    document.getElementById('categoriaIA').value = dados.categoria || '';
    document.getElementById('palavrasChaveIA').value = (dados.palavras_chave || []).join(', ');
  } catch (e) {
    alert('Erro ao gerar anúncio: ' + e.message);
  }
};


window.buscarPalavrasChave = async function () {
  const termo = document.getElementById('buscaKeyword').value;
const prompt = `
Você é um gerador de palavras-chave para Shopee.

IMPORTANTE:
Responda apenas com um array JSON válido.
Não adicione nenhuma explicação, comentário ou formatação Markdown.

Exemplo:
[
  { "palavra": "sapato confortável", "volume": "alto", "concorrencia": "baixa", "uso": "título" },
  ...
]
Produto: "${termo}"`;

  try {
    const texto = await chamarIA(prompt, { json: true });
    console.log("🧠 Resposta da IA (bruta):", texto);

    let lista;
    try {
      lista = typeof texto === 'string' ? JSON.parse(texto) : texto;
    } catch {
      const match = texto.match(/\[\s*\{[\s\S]+?\}\s*\]/); // Extrai array JSON do meio do texto
      if (match) {
        lista = JSON.parse(match[0]);
      } else {
        throw new Error("Não foi possível extrair JSON da resposta.");
      }
    }

    console.log("🔑 Palavras-chave:", lista);

    const tabela = document.getElementById('resultadoKeywords');
    let html = '<tr><th class="text-left p-2">Palavra</th><th class="text-left p-2">Volume</th><th class="text-left p-2">Concorrência</th><th class="text-left p-2">Uso</th></tr>';
    for (const item of lista) {
      html += `<tr><td class="p-2">${item.palavra}</td><td class="p-2">${item.volume}</td><td class="p-2">${item.concorrencia}</td><td class="p-2">${item.uso}</td></tr>`;
    }
    tabela.innerHTML = html;

  } catch (e) {
    alert('Erro ao buscar palavras-chave: ' + e.message);
  }
}


window.salvarRascunho = async function() {
  const user = auth.currentUser;
  if (!user) {
    alert('É necessário estar logado.');
    return;
  }
  const dados = {
    nomeProduto: document.getElementById('nomeProduto').value,
    precoBase: parseFloat(document.getElementById('precoBase').value || '0'),
    estoque: parseInt(document.getElementById('estoque').value || '0'),
    caracteristicas: document.getElementById('caracteristicas').value,
    imagemURL: '',
    tituloIA: document.getElementById('tituloIA').value,
    descricaoIA: document.getElementById('descricaoIA').value,
    categoriaIA: document.getElementById('categoriaIA').value,
    palavrasChaveIA: document.getElementById('palavrasChaveIA').value.split(',').map(s => s.trim()).filter(Boolean),
    dataCriacao: new Date().toISOString()
  };
  const id = crypto.randomUUID();
  try {
    await saveUserDoc(db, user.uid, 'anunciosCriados', id, dados, getPassphrase());
    alert('Rascunho salvo!');
  } catch (e) {
    alert('Erro ao salvar: ' + e.message);
  }
}

window.exportarCSV = function() {
  const nome = document.getElementById('nomeProduto').value;
  const titulo = document.getElementById('tituloIA').value;
  const descricao = document.getElementById('descricaoIA').value.replace(/\n/g, ' ');
  const categoria = document.getElementById('categoriaIA').value;
  const preco = document.getElementById('precoBase').value;
  const estoque = document.getElementById('estoque').value;
  const palavras = document.getElementById('palavrasChaveIA').value;
  const sku = 'SKU' + Math.floor(Math.random()*1000000);
  const linhas = [
    ['Nome','Título','Descrição','Categoria','Preço','Estoque','SKU','Palavras-chave'],
    [nome,titulo,descricao,categoria,preco,estoque,sku,palavras]
  ];
  const csv = linhas.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'anuncio-shopee.csv';
  a.click();
  URL.revokeObjectURL(url);
}
