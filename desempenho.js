import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, query, where, doc, getDoc, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig, getPassphrase } from './firebase-config.js';
import { decryptString } from './crypto.js';
import { carregarUsuariosFinanceiros } from './responsavel-financeiro.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let usuarios = [];
let diarioChart, semanalChart, mensalChart;

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html?login=1';
    return;
  }
  try {
    const { usuarios: lista } = await carregarUsuariosFinanceiros(db, user);
    usuarios = lista;
  } catch (err) {
    console.error('Erro ao verificar acesso financeiro:', err);
    usuarios = [{ uid: user.uid, nome: user.displayName || user.email }];
  }
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioInput = document.getElementById('inicio');
  const fimInput = document.getElementById('fim');
  if (inicioInput) inicioInput.value = inicio.toISOString().slice(0,10);
  if (fimInput) fimInput.value = hoje.toISOString().slice(0,10);
  document.getElementById('carregar')?.addEventListener('click', carregar);
  document.getElementById('evolucaoTabs')?.addEventListener('click', mudarAba);
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
  renderKpis(ranking, evolucaoDiaria);
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
  const rows = lista.map((r, i) => {
    const pos = i + 1;
    const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
    return `<tr><td>${medal}</td><td>${r.usuario}</td><td class="text-green-600 font-bold">R$ ${r.total.toLocaleString('pt-BR')}</td></tr>`;
  }).join('');
  table.innerHTML = `<thead><tr><th>#</th><th>Vendedor</th><th>Vendas</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderEvolucao(diaria) {
  const dias = Object.keys(diaria).sort();
  const diarioEl = document.getElementById('diarioTable');
  const semanalEl = document.getElementById('semanalTable');
  const mensalEl = document.getElementById('mensalTable');
  if (diarioEl) {
    const rows = dias.map(d => `<tr><td>${formatarData(d)}</td><td class="text-green-600 font-bold">R$ ${diaria[d].toLocaleString('pt-BR')}</td></tr>`).join('');
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
    const rows = Object.keys(semanal).sort().map(s => `<tr><td>${s}</td><td class="text-green-600 font-bold">R$ ${semanal[s].toLocaleString('pt-BR')}</td></tr>`).join('');
    semanalEl.innerHTML = `<thead><tr><th>Semana</th><th>Vendas</th></tr></thead><tbody>${rows}</tbody>`;
  }
  if (mensalEl) {
    const rows = Object.keys(mensal).sort().map(m => `<tr><td>${formatarMes(m)}</td><td class="text-green-600 font-bold">R$ ${mensal[m].toLocaleString('pt-BR')}</td></tr>`).join('');
    mensalEl.innerHTML = `<thead><tr><th>Mês</th><th>Vendas</th></tr></thead><tbody>${rows}</tbody>`;
  }

  if (diarioChart) diarioChart.destroy();
  if (semanalChart) semanalChart.destroy();
  if (mensalChart) mensalChart.destroy();

  const diarioCtx = document.getElementById('diarioChart');
  if (diarioCtx) {
    diarioChart = new Chart(diarioCtx, {
      type: 'line',
      data: {
        labels: dias.map(formatarData),
        datasets: [{
          label: 'Vendas diárias',
          data: dias.map(d => diaria[d]),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.2)',
          tension: 0.3
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const semanalCtx = document.getElementById('semanalChart');
  if (semanalCtx) {
    const semanas = Object.keys(semanal).sort();
    semanalChart = new Chart(semanalCtx, {
      type: 'bar',
      data: {
        labels: semanas,
        datasets: [{
          label: 'Vendas semanais',
          data: semanas.map(s => semanal[s]),
          backgroundColor: '#6366f1'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const mensalCtx = document.getElementById('mensalChart');
  if (mensalCtx) {
    const meses = Object.keys(mensal).sort();
    mensalChart = new Chart(mensalCtx, {
      type: 'bar',
      data: {
        labels: meses.map(formatarMes),
        datasets: [{
          label: 'Vendas mensais',
          data: meses.map(m => mensal[m]),
          backgroundColor: '#3b82f6'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
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

function renderKpis(ranking, diaria) {
  const container = document.getElementById('kpiCards');
  if (!container) return;
  const total = Object.values(diaria).reduce((a,b)=>a+b,0);
  const melhorVendedor = ranking[0]?.usuario || '-';
  const dias = Object.keys(diaria).length;
  const media = dias ? total / dias : 0;
  const melhorDia = Object.entries(diaria).sort((a,b)=>b[1]-a[1])[0];
  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-lg p-4 flex items-center gap-3"><span class="text-2xl">📈</span><div><p class="text-sm text-gray-500 uppercase tracking-wide">Vendas no período</p><p class="text-lg font-bold text-green-600">R$ ${total.toLocaleString('pt-BR')}</p></div></div>
    <div class="bg-white rounded-2xl shadow-lg p-4 flex items-center gap-3"><span class="text-2xl">👤</span><div><p class="text-sm text-gray-500 uppercase tracking-wide">Melhor vendedor</p><p class="text-lg font-bold text-green-600">${melhorVendedor}</p></div></div>
    <div class="bg-white rounded-2xl shadow-lg p-4 flex items-center gap-3"><span class="text-2xl">💰</span><div><p class="text-sm text-gray-500 uppercase tracking-wide">Média diária</p><p class="text-lg font-bold text-green-600">R$ ${media.toLocaleString('pt-BR')}</p></div></div>
    <div class="bg-white rounded-2xl shadow-lg p-4 flex items-center gap-3"><span class="text-2xl">🔥</span><div><p class="text-sm text-gray-500 uppercase tracking-wide">Melhor dia do mês</p><p class="text-lg font-bold text-green-600">${melhorDia ? formatarData(melhorDia[0]) : '-'}</p></div></div>
  `;
}

function mudarAba(ev) {
  const btn = ev.target.closest('.tab-btn');
  if (!btn) return;
  const tab = btn.dataset.tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('bg-gray-200','text-gray-700'));
  btn.classList.add('bg-gray-200','text-gray-700');
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById(`tab-${tab}`)?.classList.remove('hidden');
}
