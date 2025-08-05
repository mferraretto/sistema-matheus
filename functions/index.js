import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import axios from "axios";
import corsModule from "cors";

const DEEPSEEK_API_KEY = defineSecret("DEEPSEEK_API_KEY");
const cors = corsModule({ origin: true });

export const proxyDeepSeek = onRequest(
  {
    region: "us-central1",
    secrets: [DEEPSEEK_API_KEY],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        const pergunta = req.body.pergunta || "Me diga um insight";

        const resposta = await axios.post(
          "https://api.deepseek.com/chat/completions",
          {
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content: "Você é um especialista em performance de vendas para Shopee.",
              },
              {
                role: "user",
                content: pergunta,
              },
            ],
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${await DEEPSEEK_API_KEY.value()}`,
            },
          }
        );

        res.status(200).json(resposta.data);
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
