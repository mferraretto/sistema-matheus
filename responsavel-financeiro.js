import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

export async function fetchResponsavelFinanceiroUsuarios(db, email) {
  const [snapUsuarios, snapUid] = await Promise.all([
    getDocs(
      query(
        collection(db, 'usuarios'),
        where('responsavelFinanceiroEmail', '==', email),
      ),
    ),
    getDocs(
      query(
        collection(db, 'uid'),
        where('responsavelFinanceiroEmail', '==', email),
      ),
    ),
  ]);
  const vistos = new Set();
  const usuarios = [];
  const docs = [...snapUsuarios.docs, ...snapUid.docs];
  for (const d of docs) {
    if (vistos.has(d.id)) continue;
    vistos.add(d.id);
    const dados = d.data();
    let nome = dados.nome;
    if (!nome) {
      try {
        const perfilDoc = await getDoc(doc(db, 'perfilMentorado', d.id));
        if (perfilDoc.exists()) nome = perfilDoc.data().nome;
      } catch (_) {}
    }
    const emailUser = dados.email || '';
    usuarios.push({
      uid: d.id,
      nome: nome || emailUser || d.id,
      email: emailUser,
    });
  }
  return usuarios;
}

export async function carregarUsuariosFinanceiros(db, user) {
  const docSnap = await getDoc(doc(db, 'usuarios', user.uid));
  const perfil = docSnap.exists()
    ? String(docSnap.data().perfil || '')
        .toLowerCase()
        .trim()
    : '';
  const extras = await fetchResponsavelFinanceiroUsuarios(db, user.email);
  const isResponsavelFinanceiro =
    extras.length > 0 || ['responsavel', 'gestor financeiro'].includes(perfil);
  const isGestor = perfil === 'gestor';
  const usuarios = [
    { uid: user.uid, nome: user.displayName || user.email, email: user.email },
    ...extras,
  ];
  return { usuarios, isGestor, isResponsavelFinanceiro, perfil };
}
