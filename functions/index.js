import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import axios from "axios";
import corsModule from "cors";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { pesquisarPedidosPorData, obterPedido, pesquisarProdutos } from "./tiny-client.js";

const DEEPSEEK_API_KEY = defineSecret("DEEPSEEK_API_KEY");
const SHOPEE_CLIENT_ID = defineSecret("SHOPEE_CLIENT_ID");
const SHOPEE_CLIENT_SECRET = defineSecret("SHOPEE_CLIENT_SECRET");
const TINY_TOKEN = defineSecret("TINY_TOKEN");
const cors = corsModule({ origin: true });

initializeApp();
const db = getFirestore();

export const proxyDeepSeek = onRequest(
  {
    region: "us-central1",
    secrets: [DEEPSEEK_API_KEY],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
const { model, messages, pergunta } = req.body;

console.log("📥 Requisição recebida:");
console.log("🔹 model:", model);
console.log("🔹 pergunta (separada):", pergunta);
console.log("🔹 messages:", JSON.stringify(messages, null, 2));

        const promptMessages = messages || [
          {
            role: "system",
            content: "Você é um especialista em performance de vendas para Shopee.",
          },
          {
            role: "user",
            content: pergunta || "Me diga um insight",
          },
        ];
const bodyParaDeepSeek = {
  model: model || "deepseek-chat",
  messages: promptMessages,
};

console.log("📤 Corpo enviado para DeepSeek:", JSON.stringify(bodyParaDeepSeek, null, 2));

        const resposta = await axios.post(
          "https://api.deepseek.com/chat/completions",
          {
            model: model || "deepseek-chat",
            messages: promptMessages,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${await DEEPSEEK_API_KEY.value()}`,
            },
          }
        );

        res.status(200).json(resposta.data);
        console.log("📬 Resposta recebida da DeepSeek:", JSON.stringify(resposta.data, null, 2));

      } catch (error) {
        const erroResposta = error.response?.data || {};
        console.error("Erro ao consultar DeepSeek:", erroResposta, error.message);
        res.status(500).json({
          erro: "Erro ao consultar DeepSeek",
          detalhes: erroResposta || error.message,
        });
      }
    });
  }
);

export const shopeeAuthCallback = onRequest(
  {
    region: "us-central1",
    secrets: [SHOPEE_CLIENT_ID, SHOPEE_CLIENT_SECRET],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        const { code, state } = req.query;
        if (!code || !state) {
          res.status(400).json({ erro: "Faltando code ou state" });
          return;
        }

        const tokenResponse = await axios.post(
          "https://partner.shopeemobile.com/api/v2/auth/token/get",
          {
            code,
            client_id: await SHOPEE_CLIENT_ID.value(),
            client_secret: await SHOPEE_CLIENT_SECRET.value(),
          }
        );

        await db.collection("shopee_tokens").doc(state).set(tokenResponse.data);

        res.redirect(302, "/gestao-contas.html");
      } catch (error) {
        console.error(
          "Erro ao obter tokens da Shopee:",
          error.response?.data || error.message
        );
        res.status(500).json({
          erro: "Erro ao obter tokens da Shopee",
          detalhes: error.response?.data || error.message,
        });
      }
    });
  }
);

export const syncTinyOrders = onRequest(
  { cors: true, region: "southamerica-east1", timeoutSeconds: 540, secrets: [TINY_TOKEN] },
  async (req, res) => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
      const { uid, dataInicial, dataFinal, dataAtualizacao } = req.body || {};
      if (!uid) return res.status(400).json({ error: 'uid obrigatório' });

      const token = TINY_TOKEN.value();
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      let pagina = 1, total = 0;
      while (true) {
        const ret = await pesquisarPedidosPorData({ dataInicial, dataFinal, dataAtualizacao, pagina }, token);
        const lista = ret.pedidos || [];
        for (const { pedido } of lista) {
          const det = await obterPedido(pedido.id, token);
          const canal = (det?.ecommerce?.nomeEcommerce || det?.canalVenda || '').toLowerCase();
          if (!canal.includes('shopee')) continue;

          const doc = {
            idTiny: det.id,
            numero: det.numero,
            numeroEcommerce: det.ecommerce?.numeroPedido || det.numero_pedido_ecommerce || null,
            canal: det?.ecommerce?.nomeEcommerce || det?.canalVenda || 'Shopee',
            data: det.data_pedido || det.dataCriacao || null,
            cliente: det.cliente?.nome || null,
            total: det.valor_total || det.totalProdutos || 0,
            status: det.situacao || det.status?.descricao || null,
            itens: (det.itens || []).map(i => ({
              sku: i.item?.codigo || i.codigo,
              produto: i.item?.descricao || i.descricao,
              variacao: i.item?.descricaoDetalhada || i.variacao || null,
              quantidade: i.item?.quantidade || i.quantidade || 1,
              preco: i.item?.valor_unitario || i.valor_unitario || 0
            })),
            updatedAt: Date.now()
          };

          await db.doc(`usuarios/${uid}/pedidosShopeeTiny/${doc.numero}`).set(doc, { merge: true });
          total++;
          await sleep(120);
        }
        if (ret.pagina >= ret.numero_paginas) break;
        pagina++;
        await sleep(200);
      }
      res.json({ ok: true, total });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  }
);

export const syncTinyProducts = onRequest(
  { cors: true, region: "southamerica-east1", timeoutSeconds: 540, secrets: [TINY_TOKEN] },
  async (req, res) => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
      const { uid, modo = 'scan' } = req.body || {};
      if (!uid) return res.status(400).json({ error: 'uid obrigatório' });

      const token = TINY_TOKEN.value();
      const prefixes = modo === 'scan' ? [...'abcdefghijklmnopqrstuvwxyz0123456789'] : ['a'];
      const vistos = new Set();
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      let total = 0;

      for (const p of prefixes) {
        let pagina = 1;
        while (true) {
          const ret = await pesquisarProdutos({ pesquisa: p, pagina }, token);
          const lista = ret.produtos || [];
          for (const { produto } of lista) {
            if (vistos.has(produto.id)) continue;
            vistos.add(produto.id);

            const doc = {
              idTiny: produto.id,
              sku: produto.codigo,
              nome: produto.nome,
              tipoVariacao: produto.tipoVariacao || null,
              preco: produto.preco ?? null,
              precoPromocional: produto.preco_promocional ?? null,
              gtin: produto.gtin ?? null,
              situacao: produto.situacao ?? null,
              updatedAt: Date.now()
            };

            await db.doc(`usuarios/${uid}/produtosTiny/${doc.idTiny}`).set(doc, { merge: true });
            total++;
          }
          if (ret.pagina >= ret.numero_paginas) break;
          pagina++;
          await sleep(150);
        }
      }
      res.json({ ok: true, total });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  }
);

