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

