const functions = require('firebase-functions');
const fetch = require('node-fetch');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'https://mferraretto.github.io')
  .split(',')
  .map(o => o.trim());
exports.proxyShopeeSearch = functions.https.onRequest(async (req, res) => {
const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else {
    res.set('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).send('');

  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Missing q param' });

  try {
    const url = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=${encodeURIComponent(q)}&limit=10&newest=0&page_type=search&scenario=PAGE_GLOBAL_SEARCH`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
    console.error("Erro ao buscar Shopee:", err);
    res.status(500).json({ error: 'Erro ao buscar Shopee' });
  }
});

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
