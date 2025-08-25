(async () => {
  try {
    const pedidos = [];
    // Geolocation request via ipapi.co removed to avoid network errors such as
    // net::ERR_NAME_NOT_RESOLVED when the service is unavailable.

    document.querySelectorAll(".order-card").forEach(card => {
      const idEl = card.querySelector(".order-sn");
      const valorEl = card.querySelector(".total-price");
      const statusEl = card.querySelector(".order-status");

      const id = idEl ? idEl.textContent.trim().replace("ID do Pedido", "").trim() : "";
      const valor = valorEl ? valorEl.textContent.trim() : "";
      const status = statusEl ? statusEl.textContent.trim() : "";

      if (id) {
        pedidos.push({
          id,
          valor,
          status,
          data: new Date().toISOString()
        });
      }
    });

    if (pedidos.length === 0) {
      alert("Nenhum pedido visível foi coletado. Role a página ou troque de aba.");
      return;
    }

    console.log("Pedidos capturados:", pedidos);
    alert(`Foram coletados ${pedidos.length} pedidos. Veja no console (F12).`);

    // Pede UID + senha do sistema
    window.postMessage("getShopeeUser", "*");

    // Aguarda apenas uma vez a resposta
    const handleMessage = (event) => {
      if (event.data?.type === "shopeeUserInfo") {
        window.removeEventListener("message", handleMessage); // Evita múltiplas execuções

        const { uid, passphrase } = event.data;

        if (!uid || !passphrase) {
          alert("Usuário não está logado no sistema ou senha não disponível.");
          return;
        }

        chrome.runtime?.sendMessage({
          tipo: "salvarPedidos",
          uid,
          passphrase,
          pedidos
        });
      }
    };

    window.addEventListener("message", handleMessage);
  } catch (err) {
    console.error("Erro na coleta de pedidos:", err);
  }
})();


