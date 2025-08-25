(async () => {
  try {
    const pedidos = [];
    // Nenhuma requisição de geolocalização externa é realizada aqui para evitar
    // erros de rede como net::ERR_NAME_NOT_RESOLVED quando serviços externos
    // (ex.: ipapi.co) estão indisponíveis.
    document.querySelectorAll('.order-card').forEach(card => {
      const idEl = card.querySelector('.order-sn');
      const valorEl = card.querySelector('.total-price');
      const statusEl = card.querySelector('.order-status');
      const id = idEl ? idEl.textContent.trim().replace('ID do Pedido', '').trim() : '';
      const valor = valorEl ? valorEl.textContent.trim() : '';
      const status = statusEl ? statusEl.textContent.trim() : '';
      if (id) {
        pedidos.push({ id, valor, status, data: new Date().toISOString() });
      }
    });

    if (!pedidos.length) {
      alert('Nenhum pedido visível foi coletado.');
      return;
    }

    const creds = await chrome.storage.local.get(['uid', 'passphrase']);
    if (!creds.uid || !creds.passphrase) {
      alert('Faça login na extensão antes de coletar.');
      return;
    }

    chrome.runtime.sendMessage({
      type: 'salvarPedidos',
      uid: creds.uid,
      passphrase: creds.passphrase,
      pedidos
    });
  } catch (err) {
    console.error('Erro ao coletar pedidos:', err);
  }
})();
