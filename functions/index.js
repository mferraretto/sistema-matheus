const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const fetch = require("node-fetch");

exports.proxyShopeeSearch = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  (req, res) => {
    cors(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      const q = req.method === 'POST' ? req.body.q : req.query.q;
      if (!q) {
        return res.status(400).json({ error: 'Missing q param' });
      }

      console.debug("🔍 Buscando por:", q);
      const url = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&limit=5&keyword=${encodeURIComponent(q)}&newest=0&order=desc&page_type=search`;

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://shopee.com.br/',
          }
        });

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
        res.json({ items: [] });
      }
    });
  }
);


// 🤖 Função para encaminhar mensagens à IA DeepSeek
exports.proxyDeepSeek = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req, res) => {
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

    const apiKey = process.env.DEEPSEEK_API_KEY;
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
  }
);

// 🔄 Proxy to fetch Bling orders
exports.proxyBling = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const apiKey = process.env.BLING_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Missing API key' });
      return;
    }

    const url = `https://bling.com.br/Api/v2/pedidos/json/?apikey=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error('Proxy error:', err);
      res.status(500).json({ error: 'Proxy error' });
    }
  }
);
