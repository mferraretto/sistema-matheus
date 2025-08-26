import {
  collection,
  addDoc,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  getDoc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { anoMesBR, calcularResumo } from './comissoes-utils.js';

export async function registrarSaque({ db, uid, dataISO, valor, percentualPago, origem }) {
  if (!uid) throw new Error('uid obrigatório');
  if (!dataISO) throw new Error('dataISO obrigatório');
  if (typeof valor !== 'number') throw new Error('valor inválido');
  if (![0.03, 0.04, 0.05].includes(percentualPago)) throw new Error('percentualPago inválido');

  const anoMes = anoMesBR(new Date(dataISO));
  const col = collection(db, 'usuarios', uid, 'comissoes', anoMes, 'saques');
  const comissaoPaga = valor * percentualPago;
  await addDoc(col, {
    data: dataISO,
    valor,
    percentualPago,
    comissaoPaga,
    ...(origem ? { origem } : {})
  });
  await recalcularResumoMes({ db, uid, anoMes });
}

export async function recalcularResumoMes({ db, uid, anoMes }) {
  const col = collection(db, 'usuarios', uid, 'comissoes', anoMes, 'saques');
  const snap = await getDocs(col);
  const saques = snap.docs.map(d => d.data());
  const resumo = calcularResumo(saques);
  const ref = doc(db, 'usuarios', uid, 'comissoes', anoMes);
  await setDoc(ref, {
    ...resumo,
    atualizadoEm: new Date().toISOString()
  });
}

export async function deletarSaque({ db, uid, anoMes, saqueId }) {
  const ref = doc(db, 'usuarios', uid, 'comissoes', anoMes, 'saques', saqueId);
  await deleteDoc(ref);
  await recalcularResumoMes({ db, uid, anoMes });
}

export async function fecharMes({ db, uid, anoMes }) {
  const resumoRef = doc(db, 'usuarios', uid, 'comissoes', anoMes);
  const snap = await getDoc(resumoRef);
  if (!snap.exists()) return null;
  const dados = snap.data();
  if ((dados.ajusteFinal || 0) > 0) {
    const ajustesCol = collection(db, 'usuarios', uid, 'comissoes', anoMes, 'ajustes');
    const ajuste = {
      data: new Date().toISOString(),
      valorAjuste: dados.ajusteFinal,
      taxaFinalAplicada: dados.taxaFinal
    };
    const docRef = await addDoc(ajustesCol, ajuste);
    return docRef.id;
  }
  return null;
}

export function watchResumoMes({ db, uid, anoMes, onChange }) {
  const ref = doc(db, 'usuarios', uid, 'comissoes', anoMes);
  return onSnapshot(ref, snap => {
    onChange(snap.exists() ? snap.data() : null);
  });
}
