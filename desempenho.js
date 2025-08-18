import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { decryptString } from './crypto.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let usuarios = [];

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  usuarios = [{ uid: user.uid, nome: user.displayName || user.email }];
  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), where('responsavelFinanceiroEmail', '==', user.email)));
    if (!snap.empty) {
      usuarios = snap.docs.map(d => ({ uid: d.id, nome: d.data().nome || d.id }));
    }
  } catch (err) {
    console.error('Erro ao verificar acesso financeiro:', err);
  }
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioInput = document.getElementById('inicio');
  const fimInput = document.getElementById('fim');
  if (inicioInput) inicioInput.value = inicio.toISOString().slice(0,10);
  if (fimInput) fimInput.value = hoje.toISOString().slice(0,10);
  document.getElementById('carregar')?.addEventListener('click', carregar);
  await carregar();
});

async function carregar() {
  const inicio = document.getElementById('inicio')?.value;
  const fim = document.getElementById('fim')?.value;
  if (!inicio || !fim) return;
  const evolucaoDiaria = {};
  const ranking = [];
  for (const u of usuarios) {
    const snap = await getDocs(collection(db, `uid/${u.uid}/faturamento`));
    let totalUsuario = 0;
    for (const doc of snap.docs) {
      const dia = doc.id;
      if (dia < inicio || dia > fim) continue;
      const valor = await calcularFaturamentoDia(u.uid, dia);
      totalUsuario += valor;
      evolucaoDiaria[dia] = (evolucaoDiaria[dia] || 0) + valor;
    }
    ranking.push({ usuario: u.nome, total: totalUsuario });
  }
  ranking.sort((a,b) => b.total - a.total);
  renderRanking(ranking);
  renderEvolucao(evolucaoDiaria);
}

async function calcularFaturamentoDia(uid, dia) {
  const lojasSnap = await getDocs(collection(db, `uid/${uid}/faturamento/${dia}/lojas`));
  let totalDia = 0;
  for (const lojaDoc of lojasSnap.docs) {
    let dados = lojaDoc.data();
    if (dados.encrypted) {
      const pass = getPassphrase() || `chave-${uid}`;
      let txt;
      try {
        txt = await decryptString(dados.encrypted, pass);
      } catch (e) {
        try { txt = await decryptString(dados.encrypted, uid); } catch (_) {}
      }
      if (txt) dados = JSON.parse(txt);
    }
    totalDia += Number(dados.valorLiquido) || 0;
  }
  return totalDia;
}

function renderRanking(lista) {
  const table = document.getElementById('rankingTable');
  if (!table) return;
  const rows = lista.map((r, i) => `<tr><td>${i+1}</td><td>${r.usuario}</td><td>R$ ${r.total.toLocaleString('pt-BR')}</td></tr>`).join('');
  table.innerHTML = `<thead><tr><th>#</th><th>Vendedor</th><th>Vendas</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderEvolucao(diaria) {
  const dias = Object.keys(diaria).sort();
  const diarioEl = document.getElementById('diarioTable');
  const semanalEl = document.getElementById('semanalTable');
  const mensalEl = document.getElementById('mensalTable');
  if (diarioEl) {
    const rows = dias.map(d => `<tr><td>${formatarData(d)}</td><td>R$ ${diaria[d].toLocaleString('pt-BR')}</td></tr>`).join('');
    diarioEl.innerHTML = `<thead><tr><th>Data</th><th>Vendas</th></tr></thead><tbody>${rows}</tbody>`;
  }
  const semanal = {};
  const mensal = {};
  dias.forEach(d => {
    const semana = getSemana(d);
    semanal[semana] = (semanal[semana] || 0) + diaria[d];
    const mes = d.slice(0,7);
    mensal[mes] = (mensal[mes] || 0) + diaria[d];
  });
  if (semanalEl) {
    const rows = Object.keys(semanal).sort().map(s => `<tr><td>${s}</td><td>R$ ${semanal[s].toLocaleString('pt-BR')}</td></tr>`).join('');
    semanalEl.innerHTML = `<thead><tr><th>Semana</th><th>Vendas</th></tr></thead><tbody>${rows}</tbody>`;
  }
  if (mensalEl) {
    const rows = Object.keys(mensal).sort().map(m => `<tr><td>${formatarMes(m)}</td><td>R$ ${mensal[m].toLocaleString('pt-BR')}</td></tr>`).join('');
    mensalEl.innerHTML = `<thead><tr><th>Mês</th><th>Vendas</th></tr></thead><tbody>${rows}</tbody>`;
  }
}

function getSemana(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const onejan = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${date.getFullYear()}-S${String(week).padStart(2, '0')}`;
}

function formatarData(str) {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(str);
  if (match) {
    const [_, a, m, d] = match;
    const data = new Date(Number(a), Number(m) - 1, Number(d));
    return data.toLocaleDateString('pt-BR');
  }
  return str;
}

function formatarMes(str) {
  const [ano, mes] = str.split('-').map(Number);
  const data = new Date(ano, mes - 1, 1);
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
