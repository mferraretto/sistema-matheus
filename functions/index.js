import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import cors from "cors";
import axios from "axios";

// Carrega variáveis .env se desejar localmente (dev)
import "dotenv/config";

const corsHandler = cors({ origin: true });

export const proxyDeepSeek = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { model, messages, response_format, temperature } = req.body;

      const resposta = await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model: model || "deepseek-chat",
          messages,
          response_format,
          temperature: temperature || 0.8
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.DEEPSEEK_KEY}`
          }
        }
      );

      res.status(200).json(resposta.data);
    } catch (error) {
      logger.error("Erro ao consultar DeepSeek", error);
      res.status(500).json({
        erro: "Erro ao consultar DeepSeek",
        detalhes: error.response?.data || error.message
      });
    }
  });
});
