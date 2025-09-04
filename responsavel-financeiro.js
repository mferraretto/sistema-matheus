import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

export async function fetchResponsavelFinanceiroUsuarios(db, responsavelUid) {
  const snap = await getDocs(collection(db, 'responsaveis', responsavelUid, 'geridos'));
  const usuarios = [];
  for (const d of snap.docs) {
    try {
      const userDoc = await getDoc(doc(db, 'usuarios', d.id));
      if (userDoc.exists()) {
        const dados = userDoc.data();
        usuarios.push({ uid: d.id, nome: dados.nome || dados.email || d.id, email: dados.email || '' });
      }
    } catch (_) {}
  }
  return usuarios;
}

export async function carregarUsuariosFinanceiros(db, user) {
  const docSnap = await getDoc(doc(db, 'usuarios', user.uid));
  const perfil = docSnap.exists() ? String(docSnap.data().perfil || '').toLowerCase().trim() : '';
  const extras = await fetchResponsavelFinanceiroUsuarios(db, user.uid);
  const isResponsavelFinanceiro = extras.length > 0 || ['responsavel', 'gestor financeiro'].includes(perfil);
  const isGestor = perfil === 'gestor';
  const usuarios = [{ uid: user.uid, nome: user.displayName || user.email, email: user.email }, ...extras];
  return { usuarios, isGestor, isResponsavelFinanceiro, perfil };
}
