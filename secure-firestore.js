import { encryptString, decryptString } from './crypto.js';
import { doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

export async function saveSecureDoc(db, collectionName, id, data, passphrase) {
 // Store the UID outside the encrypted payload so we can query by owner
  const { uid, ...rest } = data || {};
  const encrypted = await encryptString(JSON.stringify(rest), passphrase);
  const payload = { encrypted };
  if (uid) payload.uid = uid;
  const ref = doc(db, collectionName, id);
  await setDoc(ref, payload);
}

export async function loadSecureDoc(db, collectionName, id, passphrase) {
  const ref = doc(db, collectionName, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const { encrypted, uid } = snap.data();
  if (!encrypted) return null;
  const plaintext = await decryptString(encrypted, passphrase);
const data = JSON.parse(plaintext);

  // Merge UID stored outside the encrypted payload (for backward compatibility)
  if (uid && !data.uid) data.uid = uid;

  return data;
}
