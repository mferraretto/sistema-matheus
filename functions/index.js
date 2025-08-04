const functions = require("firebase-functions");
const axios = require("axios");
const cors = require("cors")({ origin: true });

const DEEPSEEK_API_KEY = functions.config().deepseek.key;

exports.proxyDeepSeek = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { model, messages, response_format, temperature } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "mensagens inválidas" });
      }

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
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
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
