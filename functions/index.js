const functions = require("firebase-functions");
const axios = require("axios");
const cors = require("cors")({ origin: true });

exports.proxyDeepSeek = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const pergunta = req.body.pergunta || "Me diga um insight";

      const resposta = await axios.post(
        "https://api.deepseek.com/chat/completions", // ✅ endpoint correto
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
            "Authorization": "Bearer sk-2ada97f70b3b4ef89efc228801335b93", // ✅ prefixo "Bearer"
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
});

