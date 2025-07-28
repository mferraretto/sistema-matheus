const functions = require('firebase-functions');
const fetch = require('node-fetch');
const cors = require("cors")({ origin: true });
exports.proxyShopeeSearch = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const q = req.query.q;
  if (!q) {
    res.status(400).json({ error: 'Missing query parameter q' });
    return;
  }

  try {
    const url = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=${encodeURIComponent(q)}&limit=10&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await response.json();
    const items = (data?.items || []).map(it => {
      const item = it.item_basic || {};
      return {
        itemid: item.itemid,
        shopid: item.shopid,
        name: item.name,
        price: item.price / 100000,
        sold: item.sold,
        image: item.image
      };
    });
    res.json({ items });
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
});
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
