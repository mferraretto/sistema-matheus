// ---------- V1 EXPRESS para resolver CORS do BLING ----------
const functions = require('firebase-functions'); // V1
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

// Bling (resolvido com v1 + express)
const appBling = express();
appBling.use(cors({ origin: true }));
appBling.use(express.json());

appBling.post('/', async (req, res) => {
  const { apiKey, endpoint = "pedidos", parametros = "" } = req.body;

  if (!apiKey) return res.status(400).json({ error: "API key obrigatória" });

  const url = `https://bling.com.br/Api/v2/${endpoint}/json/?apikey=${apiKey}${parametros}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Erro ao acessar Bling:", err);
    res.status(500).json({ error: "Erro ao acessar Bling" });
  }
});

exports.proxyBling = functions.https.onRequest(appBling);


// ---------- V2 FUNCTIONS ----------
const { onRequest } = require("firebase-functions/v2/https");

// Shopee Search (v2)
exports.proxyShopeeSearch = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).send('');

  const q = req.method === 'POST' ? req.body.q : req.query.q;
  if (!q) return res.status(400).json({ error: 'Missing q param' });

  const url = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&limit=5&keyword=${encodeURIComponent(q)}&newest=0&order=desc&page_type=search`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
        'Referer': 'https://shopee.com.br/',
      }
    });

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
    console.error('Erro Shopee:', err);
    res.json({ items: [] });
  }
});

// DeepSeek (v2)
exports.proxyDeepSeek = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST');

  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

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
    console.error('Erro DeepSeek:', err);
    res.status(500).json({ error: 'Proxy error' });
  }
});
