const functions = require('firebase-functions');
const fetch = require('node-fetch');
exports.proxyShopeeSearch = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET');

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
