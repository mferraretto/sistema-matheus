import { db } from './firebase-config.js';
import {
  doc,
  getDoc,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const profileCache = {};

export async function loadUserProfile(uid) {
  if (!uid) return null;
  if (profileCache[uid]) return profileCache[uid];
  const key = `userProfile:${uid}`;
  try {
    const cached = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (cached) {
      const obj = JSON.parse(cached);
      profileCache[uid] = obj;
      return obj;
    }
  } catch {}

  const usuarioSnap = await getDoc(doc(db, 'usuarios', uid));
  const perfilSnap = await getDoc(doc(db, 'perfil', uid));
  const mentSnap = await getDoc(doc(db, 'perfilMentorado', uid));
  if (!usuarioSnap.exists()) return null;
  const usuario = usuarioSnap.data() || {};
  const perfil = perfilSnap.exists() ? perfilSnap.data() : {};
  const perfilMentorado = mentSnap.exists() ? mentSnap.data() : {};

  const data = {
    uid,
    perfil: usuario.perfil || perfil.perfil || 'usuario',
    nome: usuario.nome || perfil.nome || '',
    email: usuario.email || perfil.email || '',
    isAdm: !!usuario.isAdm,
    lojas: usuario.lojas || perfil.lojas || [],
    ...perfil,
    perfilMentorado,
  };
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {}
  profileCache[uid] = data;
  return data;
}

export function clearUserProfileCache(uid) {
  const key = `userProfile:${uid}`;
  delete profileCache[uid];
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
