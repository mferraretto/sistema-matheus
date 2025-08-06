import { encryptString, decryptString } from './crypto.js';
import { doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
function buildRef(db, collectionPath, id) {
  const segments = collectionPath.split('/').filter(Boolean);
  return doc(db, ...segments, id);
}

export async function saveSecureDoc(db, collectionName, id, data, passphrase) {
 // Store the UID outside the encrypted payload so we can query by owner
  const { uid, ...rest } = data || {};
  const encrypted = await encryptString(JSON.stringify(rest), passphrase);
  const payload = { encrypted };
  if (uid) payload.uid = uid;
  const ref = buildRef(db, collectionName, id);
  await setDoc(ref, payload);
}

export async function loadSecureDoc(db, collectionName, id, passphrase) {
  const ref = buildRef(db, collectionName, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const { encrypted, encryptedData, uid, ...rest } = snap.data();
  const payload = encrypted || encryptedData;

// Se não houver dados criptografados, retorna os campos restantes
  if (!payload) {
    return Object.keys(rest).length ? { ...rest, ...(uid && { uid }) } : null;
  }
  try {
    const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const plaintext = await decryptString(jsonStr, passphrase);
    const data = JSON.parse(plaintext);

    if (uid && !data.uid) data.uid = uid; // compatibilidade
    return data;
  } catch (err) {
 console.warn('🔐 Erro ao descriptografar documento:', id, err.message);

    // ⚠️ Fallback: alguns documentos antigos podem estar salvos em texto puro
    // dentro do campo `encrypted`. Tentamos interpretar o payload como JSON
    // diretamente antes de desistir da leitura.
    try {
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (data && typeof data === 'object') {
        if (uid && !data.uid) data.uid = uid;
        return data;
      }
    } catch (_) {
      // ignore se não for JSON válido
    }
    // Caso a descriptografia falhe, tenta retornar dados não criptografados
    if (Object.keys(rest).length) {
      return { ...rest, ...(uid && { uid }) };
    }
    return null;
  }
}



// Helpers enforcing the standard `uid/<uid>/collection` pattern
export async function saveUserDoc(db, uid, collection, id, data, passphrase) {
  return saveSecureDoc(db, `uid/${uid}/${collection}`, id, { ...data, uid }, passphrase);
}

export async function loadUserDoc(db, uid, collection, id, passphrase) {
  return loadSecureDoc(db, `uid/${uid}/${collection}`, id, passphrase);
}
