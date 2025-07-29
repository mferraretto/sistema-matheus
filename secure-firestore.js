import { encryptString, decryptString } from './crypto.js';
import { doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

export async function saveSecureDoc(db, collectionName, id, data, passphrase) {
  const encrypted = await encryptString(JSON.stringify(data), passphrase);
  const ref = doc(db, collectionName, id);
  await setDoc(ref, { encrypted });
}

export async function loadSecureDoc(db, collectionName, id, passphrase) {
  const ref = doc(db, collectionName, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const { encrypted } = snap.data();
  if (!encrypted) return null;
  const plaintext = await decryptString(encrypted, passphrase);
  return JSON.parse(plaintext);
}
