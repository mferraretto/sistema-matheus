import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { loadSecureDoc } from './secure-firestore.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let usuariosCache = [];
let dadosSkusExport = [];
let dadosSaquesExport = [];

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  let usuarios = [{ uid: user.uid, nome: user.displayName || user.email }];
  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', user.email)));
    if (!snap.empty) {
      usuarios = snap.docs.map(d => ({ uid: d.id, nome: d.data().nome || d.id }));
    }
  } catch (err) {
    console.error('Erro ao verificar acesso financeiro:', err);
  }
  usuariosCache = usuarios;
  setupFiltros(usuarios);
  await carregar();
});

function setupFiltros(usuarios) {
  const userSel = document.getElementById('usuarioFiltro');
  const mesSel = document.getElementById('mesFiltro');
  if (!userSel || !mesSel) return;
  userSel.innerHTML = '';
  const optTodos = document.createElement('option');
  optTodos.value = 'todos';
  optTodos.textContent = 'Todos';
  userSel.appendChild(optTodos);
  usuarios.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.uid;
    opt.textContent = u.nome;
    userSel.appendChild(opt);
  });
  userSel.value = 'todos';
  mesSel.value = new Date().toISOString().slice(0,7);
  userSel.addEventListener('change', carregar);
  mesSel.addEventListener('change', carregar);
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      target.classList.toggle('hidden');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
      }
    });
  });
  const expSkus = document.getElementById('exportSkus');
  const expSaques = document.getElementById('exportSaques');
  if (expSkus) expSkus.addEventListener('click', exportarSkus);
  if (expSaques) expSaques.addEventListener('click', exportarSaques);
}

async function carregar() {
  const mes = document.getElementById('mesFiltro')?.value || '';
  const uid = document.getElementById('usuarioFiltro')?.value || 'todos';
  const listaUsuarios = uid === 'todos' ? usuariosCache : usuariosCache.filter(u => u.uid === uid);
  await carregarSkus(listaUsuarios, mes);
  await carregarSaques(listaUsuarios, mes);
}

async function carregarSkus(usuarios, mes) {
  const container = document.getElementById('resumoSkus');
  if (!container) return;
  container.innerHTML = '';
  dadosSkusExport = [];
  for (const usuario of usuarios) {
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/skusVendidos`));
    const resumo = {};
    for (const docSnap of snap.docs) {
      if (mes && !docSnap.id.includes(mes)) continue;
      const listaRef = collection(db, `uid/${usuario.uid}/skusVendidos/${docSnap.id}/lista`);
      const listaSnap = await getDocs(listaRef);
      listaSnap.forEach(item => {
        const dados = item.data();
        const sku = dados.sku || 'sem-sku';
        const qtd = Number(dados.total || dados.quantidade) || 0;
        const sobra = Number(dados.valorLiquido || dados.sobraReal || 0);
        if (!resumo[sku]) resumo[sku] = { qtd: 0, sobra: 0 };
        resumo[sku].qtd += qtd;
        resumo[sku].sobra += sobra;
      });
    }
    const section = document.createElement('div');
    section.className = 'mb-4';
    const titulo = document.createElement('h3');
    titulo.className = 'font-bold';
    titulo.textContent = usuario.nome;
    section.appendChild(titulo);
    if (!Object.keys(resumo).length) {
      const p = document.createElement('p');
      p.className = 'text-gray-500';
      p.textContent = 'Nenhum SKU encontrado.';
      section.appendChild(p);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'list-disc pl-4 space-y-1';
      Object.entries(resumo).forEach(([sku, info]) => {
        dadosSkusExport.push({ usuario: usuario.nome, sku, quantidade: info.qtd, sobra: info.sobra });
        const li = document.createElement('li');
        li.textContent = `${sku}: ${info.qtd} | Sobra: R$ ${info.sobra.toLocaleString('pt-BR')}`;
        ul.appendChild(li);
      });
      section.appendChild(ul);
    }
    container.appendChild(section);
  }
}

async function carregarSaques(usuarios, mes) {
  const container = document.getElementById('resumoSaques');
  if (!container) return;
  container.innerHTML = 'Carregando...';
  dadosSaquesExport = [];
  let totalGeral = 0;
  let totalComissaoGeral = 0;
  container.innerHTML = '';
  for (const usuario of usuarios) {
    const pass = getPassphrase() || `chave-${usuario.uid}`;
    const snap = await getDocs(collection(db, `uid/${usuario.uid}/saques`));
    let total = 0;
    let totalComissao = 0;
    for (const docSnap of snap.docs) {
      if (mes && !docSnap.id.includes(mes)) continue;
      const dados = await loadSecureDoc(db, `uid/${usuario.uid}/saques`, docSnap.id, pass);
      if (!dados) continue;
      total += dados.valorTotal || 0;
      const lojasSnap = await getDocs(collection(db, `uid/${usuario.uid}/saques/${docSnap.id}/lojas`));
      for (const lojaDoc of lojasSnap.docs) {
        const lojaDados = await loadSecureDoc(db, `uid/${usuario.uid}/saques/${docSnap.id}/lojas`, lojaDoc.id, pass);
        if (!lojaDados) continue;
        const valor = lojaDados.valor || 0;
        const comissao = lojaDados.comissao || 0;
        totalComissao += valor * (comissao / 100);
      }
    }
    totalGeral += total;
    totalComissaoGeral += totalComissao;
    dadosSaquesExport.push({ usuario: usuario.nome, total, comissao: totalComissao });
    const p = document.createElement('p');
    p.textContent = `${usuario.nome}: R$ ${total.toLocaleString('pt-BR')} | Comissões: R$ ${totalComissao.toLocaleString('pt-BR')}`;
    container.appendChild(p);
  }
  const resumoP = document.createElement('p');
  resumoP.innerHTML = `Total de Saques: <strong>R$ ${totalGeral.toLocaleString('pt-BR')}</strong><br>`+
    `Total de Comissões: <strong>R$ ${totalComissaoGeral.toLocaleString('pt-BR')}</strong>`;
  container.appendChild(resumoP);
}

function exportarSkus() {
  if (!dadosSkusExport.length) {
    alert('Sem dados para exportar');
    return;
  }
  exportarCSV(dadosSkusExport, ['usuario','sku','quantidade','sobra'], 'skus_vendidos');
}

function exportarSaques() {
  if (!dadosSaquesExport.length) {
    alert('Sem dados para exportar');
    return;
  }
  exportarCSV(dadosSaquesExport, ['usuario','total','comissao'], 'saques');
}

function exportarCSV(dados, campos, nome) {
  const linhas = [campos.join(';')];
  dados.forEach(l => {
    linhas.push(campos.map(c => l[c]).join(';'));
  });
  const csv = linhas.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

