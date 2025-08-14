import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, query, where, Timestamp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  verificarGestorExpedicao();
  carregarSobras();
});

async function verificarGestorExpedicao() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const snap = await getDocs(
      query(collection(db, 'usuarios'), where('gestoresExpedicaoEmails', 'array-contains', user.email))
    );
    if (!snap.empty) {
      document.getElementById('exportarRelatorioGestorBtn')?.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Erro ao verificar gestores de expedição:', err);
  }
}

async function carregarSobras() {
  const user = auth.currentUser;
  if (!user) return;
  const uid = user.uid;
  const filtroMes = document.getElementById('filtroMesRelatorio').value;
  const inicio = filtroMes ? new Date(filtroMes + '-01') : new Date();
  if (!filtroMes) inicio.setDate(1);
  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + 1);

  const q = query(
    collection(db, `uid/${uid}/diasExpedicao`),
    where('inicio', '>=', Timestamp.fromDate(inicio)),
    where('inicio', '<', Timestamp.fromDate(fim))
  );
  const snap = await getDocs(q);
  const lista = document.getElementById('sobrasList');
  lista.innerHTML = '';
  snap.forEach(doc => {
    const dados = doc.data();
    if (dados.sobrasQuantidade || dados.sobrasMotivo) {
      const p = document.createElement('p');
      p.textContent = `${doc.id}: ${dados.sobrasQuantidade || 0} - ${dados.sobrasMotivo || ''}`;
      lista.appendChild(p);
    }
  });
  if (!lista.hasChildNodes()) {
    lista.innerHTML = '<p class="text-gray-500">Sem sobras no período.</p>';
  }
}

export async function exportarSkuImpressos() {
  const user = auth.currentUser;
  if (!user) return;
  const uid = user.uid;
  const filtroMes = document.getElementById('filtroMesRelatorio').value;

  const inicio = filtroMes ? new Date(filtroMes + '-01') : new Date();
  if (!filtroMes) inicio.setDate(1);
  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + 1);

  const q = query(
    collection(db, `uid/${uid}/skuimpressos`),
    where('createdAt', '>=', Timestamp.fromDate(inicio)),
    where('createdAt', '<', Timestamp.fromDate(fim))
  );
  const snap = await getDocs(q);
  const linhas = [];
  snap.forEach(doc => {
    const dados = doc.data();
    const sku = dados.sku || 'sem-sku';
    const quantidade = Number(dados.quantidade) || 0;
    const loja = dados.loja || '';
    const data = dados.createdAt && dados.createdAt.toDate
      ? dados.createdAt.toDate().toLocaleDateString('pt-BR')
      : '';
    linhas.push({ SKU: sku, Quantidade: quantidade, Loja: loja, Data: data });
  });
  const sobras = [];
  const qSobras = query(
    collection(db, `uid/${uid}/diasExpedicao`),
    where('inicio', '>=', Timestamp.fromDate(inicio)),
    where('inicio', '<', Timestamp.fromDate(fim))
  );
  const sobrasSnap = await getDocs(qSobras);
  sobrasSnap.forEach(d => {
    const dados = d.data();
    if (dados.sobrasQuantidade || dados.sobrasMotivo) {
      sobras.push({ Data: d.id, Quantidade: dados.sobrasQuantidade || 0, Motivo: dados.sobrasMotivo || '' });
    }
  });

  if (!linhas.length && !sobras.length) {
    alert('Nenhum dado encontrado para o mês selecionado.');
    return;
  }

  const wsDetalhado = XLSX.utils.json_to_sheet(linhas);
  const resumoMap = linhas.reduce((acc, { SKU, Quantidade }) => {
    acc[SKU] = (acc[SKU] || 0) + Quantidade;
    return acc;
  }, {});
  const resumo = Object.keys(resumoMap).map(sku => ({ SKU: sku, Quantidade: resumoMap[sku] }));
  const wsResumo = XLSX.utils.json_to_sheet(resumo);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDetalhado, 'Relatorio');
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
  if (sobras.length) {
    const wsSobras = XLSX.utils.json_to_sheet(sobras);
    XLSX.utils.book_append_sheet(wb, wsSobras, 'Sobras');
  }

  const mesStr = filtroMes || `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}`;
  XLSX.writeFile(wb, `sku_impressos_${mesStr}.xlsx`);
}

export async function exportarSkuImpressosGestor() {
  const user = auth.currentUser;
  if (!user) return;
  const filtroMes = document.getElementById('filtroMesRelatorio').value;

  const inicio = filtroMes ? new Date(filtroMes + '-01') : new Date();
  if (!filtroMes) inicio.setDate(1);
  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + 1);

  const usuariosSnap = await getDocs(
    query(collection(db, 'usuarios'), where('gestoresExpedicaoEmails', 'array-contains', user.email))
  );

  const linhas = [];
  const sobras = [];
  const promessas = [];
  usuariosSnap.forEach(u => {
    const uid = u.id;
    const emailUsuario = u.data().email || 'sem-email';
    const q = query(
      collection(db, `uid/${uid}/skuimpressos`),
      where('createdAt', '>=', Timestamp.fromDate(inicio)),
      where('createdAt', '<', Timestamp.fromDate(fim))
    );
    promessas.push(
      getDocs(q).then(snap => {
        snap.forEach(doc => {
          const dados = doc.data();
          const sku = dados.sku || 'sem-sku';
          const quantidade = dados.quantidade || 0;
          const loja = dados.loja || '';
          const data = dados.createdAt && dados.createdAt.toDate
            ? dados.createdAt.toDate().toLocaleDateString('pt-BR')
            : '';
          linhas.push({ Usuario: emailUsuario, SKU: sku, Quantidade: quantidade, Loja: loja, Data: data });
        });
      })
    );
    const qSobras = query(
      collection(db, `uid/${uid}/diasExpedicao`),
      where('inicio', '>=', Timestamp.fromDate(inicio)),
      where('inicio', '<', Timestamp.fromDate(fim))
    );
    promessas.push(
      getDocs(qSobras).then(snapSobras => {
        snapSobras.forEach(diaDoc => {
          const dados = diaDoc.data();
          if (dados.sobrasQuantidade || dados.sobrasMotivo) {
            sobras.push({ Usuario: emailUsuario, Data: diaDoc.id, Quantidade: dados.sobrasQuantidade || 0, Motivo: dados.sobrasMotivo || '' });
          }
        });
      })
    );
  });

  await Promise.all(promessas);
  if (!linhas.length && !sobras.length) {
    alert('Nenhum dado encontrado para o mês selecionado.');
    return;
  }

  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatorio');
  if (sobras.length) {
    const wsSobras = XLSX.utils.json_to_sheet(sobras);
    XLSX.utils.book_append_sheet(wb, wsSobras, 'Sobras');
  }
  const mesStr = filtroMes || `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}`;
  XLSX.writeFile(wb, `sku_impressos_equipe_${mesStr}.xlsx`);
}

document.getElementById('exportarRelatorioBtn')?.addEventListener('click', exportarSkuImpressos);
document.getElementById('exportarRelatorioGestorBtn')?.addEventListener('click', exportarSkuImpressosGestor);
document.getElementById('filtroMesRelatorio')?.addEventListener('change', carregarSobras);
