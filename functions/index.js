const functions = require("firebase-functions");
const fetch = require("node-fetch");

// 🚀 Função para buscar anúncios da Shopee
exports.proxyShopeeSearch = functions.https.onRequest(async (req, res) => {
  const q = req.method === 'POST' ? req.body.q : req.query.q;

  if (!q) {
    console.debug("❌ Parâmetro 'q' ausente.");
    return res.status(400).json({ error: 'Missing q param' });
  }

  console.debug("🔍 Buscando por:", q);

  const url = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&limit=5&keyword=${encodeURIComponent(q)}&newest=0&order=desc&page_type=search`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`status ${response.status}`);

    const data = await response.json();

    const items = (data?.items || []).map(({ item_basic: p }) => ({
      name: p.name,
      price: p.price / 100000,
      sold: p.sold,
      image: p.image,
      itemid: p.itemid,
      shopid: p.shopid
    }));

    res.json({ items });
  } catch (err) {
    console.error('Erro ao buscar Shopee:', err);
    // fallback opcional com dummyjson
    try {
      const fRes = await fetch(`https://dummyjson.com/products/search?q=${encodeURIComponent(q)}`);
      const data = await fRes.json();
      const items = (data.products || []).map(p => ({
        name: p.title,
        price: p.price,
        sold: p.stock,
        image: Array.isArray(p.images) ? p.images[0] : '',
        itemid: p.id,
        shopid: p.brand || ''
      }));
      res.json({ items });
    } catch (fallbackErr) {
      console.error('Fallback error:', fallbackErr);
      res.json({ items: [] });
    }
  }
});

// 🤖 Função para encaminhar mensagens à IA DeepSeek
exports.proxyDeepSeek = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const apiKey = functions.config().deepseek?.key || process.env.DEEPSEEK_API_KEY;
  const body = req.body;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
});
