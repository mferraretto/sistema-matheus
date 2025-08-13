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
});

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
  const agregados = {};
  snap.forEach(doc => {
    const dados = doc.data();
    const sku = dados.sku || 'sem-sku';
    const qtd = dados.quantidade || 0;
    agregados[sku] = (agregados[sku] || 0) + qtd;
  });

  const linhas = Object.entries(agregados).map(([sku, quantidade]) => ({ SKU: sku, Quantidade: quantidade }));
  if (!linhas.length) {
    alert('Nenhum dado encontrado para o mês selecionado.');
    return;
  }

  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatorio');
  const mesStr = filtroMes || `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}`;
  XLSX.writeFile(wb, `sku_impressos_${mesStr}.xlsx`);
}

document.getElementById('exportarRelatorioBtn')?.addEventListener('click', exportarSkuImpressos);
