import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { saveUserDoc } from './secure-firestore.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function chamarIA(prompt) {
  const apiKey = window.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não definido');
  }
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

window.gerarAnuncioIA = async function() {
  const nome = document.getElementById('nomeProduto').value;
  const preco = document.getElementById('precoBase').value;
  const caracteristicas = document.getElementById('caracteristicas').value;
  const prompt = `Crie um anúncio otimizado para Shopee com base nas seguintes informações:\nProduto: ${nome}\nPreço: ${preco}\nCaracterísticas: ${caracteristicas}\nSugira um título atrativo, uma descrição com bullet points, a melhor categoria possível e palavras-chave relacionadas.`;
  try {
    const texto = await chamarIA(prompt);
    document.getElementById('sugestoes').classList.remove('hidden');
    const titulo = /T[íi]tulo:\s*(.*)/i.exec(texto)?.[1] || '';
    const descMatch = /Descri[cç][ãa]o:\s*([\s\S]*?)Categoria:/i.exec(texto);
    const categoria = /Categoria:\s*(.*)/i.exec(texto)?.[1] || '';
    const palavras = /Palavras-chave:\s*(.*)/i.exec(texto)?.[1] || '';
    document.getElementById('tituloIA').value = titulo.trim();
    document.getElementById('descricaoIA').value = descMatch ? descMatch[1].trim() : '';
    document.getElementById('categoriaIA').value = categoria.trim();
    document.getElementById('palavrasChaveIA').value = palavras.trim();
  } catch (e) {
    alert('Erro ao gerar anúncio: ' + e.message);
  }
}

window.buscarPalavrasChave = async function() {
  const termo = document.getElementById('buscaKeyword').value;
  const prompt = `Liste 10 palavras-chave relevantes para o produto "${termo}", com volume de busca (alto/médio/baixo), concorrência e sugestão de onde usá-la no anúncio (título, descrição ou tags).`;
  try {
    const texto = await chamarIA(prompt);
    const tabela = document.getElementById('resultadoKeywords');
    tabela.innerHTML = '';
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    let html = '<tr><th class="text-left p-2">Palavra</th><th class="text-left p-2">Volume</th><th class="text-left p-2">Concorrência</th><th class="text-left p-2">Uso</th></tr>';
    for (const l of linhas) {
      const partes = l.split('-').map(p => p.trim());
      if (partes.length >= 4) {
        html += `<tr><td class="p-2">${partes[0]}</td><td class="p-2">${partes[1]}</td><td class="p-2">${partes[2]}</td><td class="p-2">${partes[3]}</td></tr>`;
      }
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
