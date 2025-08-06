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

  if (!payload) {
    return Object.keys(rest).length ? { ...rest, ...(uid && { uid }) } : null;
  }

  try {
 const cleaned = typeof payload === 'string' ? payload.trim() : JSON.stringify(payload);
const jsonStr = cleaned.startsWith('{') ? cleaned : cleaned.replace(/^"|"$/g, '');
console.log('📄 Documento:', id, 'Payload bruto:', payload);

console.log('Tentando descriptografar:', jsonStr);
    const plaintext = await decryptString(jsonStr, passphrase);
    const data = JSON.parse(plaintext);

    if (uid && !data.uid) data.uid = uid;
    return data;
  } catch (err) {
    console.warn('🔐 Erro ao descriptografar documento:', id, err.message);
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
