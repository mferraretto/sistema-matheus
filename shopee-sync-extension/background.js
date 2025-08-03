import { db, collection, doc, setDoc } from './firebase-init.js';
import { encryptString } from './crypto.js';

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'salvarPedidos') {
    const { uid, passphrase, pedidos } = msg;
    if (!uid || !passphrase) {
      console.warn('UID ou senha ausente');
      return;
    }
    for (const pedido of pedidos) {
      try {
        const ref = doc(collection(db, `uid/${uid}/pedidosShopee`), pedido.id);
        const encrypted = await encryptString(JSON.stringify(pedido), passphrase);
        await setDoc(ref, { encrypted });
      } catch (e) {
        console.error('Erro ao salvar pedido:', e);
      }
    }
  }
});
