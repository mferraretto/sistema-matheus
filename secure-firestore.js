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

  const { encrypted, encryptedData, uid } = snap.data();
  const payload = encrypted || encryptedData;

  if (!payload) return null;

  try {
    // Verifica se payload é uma string JSON
    const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;

    const plaintext = await decryptString(JSON.stringify(parsedPayload), passphrase);
    const data = JSON.parse(plaintext);

    if (uid && !data.uid) data.uid = uid; // compatibilidade
    return data;
  } catch (err) {
    console.warn("🔐 Erro ao descriptografar documento:", id, err.message);
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
