export async function getKeyMaterial(password) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(password), {name: 'PBKDF2'}, false, ['deriveKey']);
}

export async function deriveKey(password, salt) {
  const keyMaterial = await getKeyMaterial(password);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptString(str, password) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(str));
  const buffer = new Uint8Array(ciphertext);
  function toBase64(arr) {
    return btoa(String.fromCharCode(...arr));
  }
  return JSON.stringify({ iv: toBase64(iv), salt: toBase64(salt), data: toBase64(buffer) });
}
