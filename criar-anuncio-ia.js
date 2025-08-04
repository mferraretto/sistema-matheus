import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { saveUserDoc } from './secure-firestore.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function chamarIA(prompt, { json = false } = {}) {
  const body = {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }]
  };
  if (json) body.response_format = { type: 'json_object' };  const resp = await fetch('https://us-central1-matheus-35023.cloudfunctions.net/proxyDeepSeek', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`IA request failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

window.gerarAnuncioIA = async function() {
  const nome = document.getElementById('nomeProduto').value;
  const preco = document.getElementById('precoBase').value;
  const caracteristicas = document.getElementById('caracteristicas').value;
  const prompt = `Você é um assistente de marketing da Shopee. Gere um anúncio em formato JSON com as chaves titulo, descricao, categoria e palavras_chave (lista).\nProduto: ${nome}\nPreço: ${preco}\nCaracterísticas: ${caracteristicas}`;
  try {
const texto = await chamarIA(prompt, { json: true });
    const dados = JSON.parse(texto);
    document.getElementById('sugestoes').classList.remove('hidden');
    document.getElementById('tituloIA').value = dados.titulo || '';
    document.getElementById('descricaoIA').value = dados.descricao || '';
    document.getElementById('categoriaIA').value = dados.categoria || '';
    document.getElementById('palavrasChaveIA').value = (dados.palavras_chave || []).join(', ');
  } catch (e) {
    alert('Erro ao gerar anúncio: ' + e.message);
  }
}

window.buscarPalavrasChave = async function() {
  const termo = document.getElementById('buscaKeyword').value;
  const prompt = `Retorne um array JSON com 10 objetos contendo as chaves palavra, volume, concorrencia e uso para o produto "${termo}".`;
  try {
 const texto = await chamarIA(prompt, { json: true });
    const lista = JSON.parse(texto);
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
