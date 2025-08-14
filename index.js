import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, doc, getDoc, collectionGroup, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { decryptString } from './crypto.js';
import { loadSecureDoc } from './secure-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
function toggleBlur(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const body = card.querySelector('.card-body');
  if (!body) return;
  const icon = card.querySelector('.toggle-blur i');
  const blurred = body.classList.toggle('blurred');
  if (icon) {
    icon.classList.toggle('fa-eye-slash', !blurred);
    icon.classList.toggle('fa-eye', blurred);
  }
  localStorage.setItem('blur_' + cardId, blurred);
}

function applyBlurStates() {
  document.querySelectorAll('[data-blur-id]').forEach(card => {
    const cardId = card.getAttribute('data-blur-id');
    const body = card.querySelector('.card-body');
    const icon = card.querySelector('.toggle-blur i');
    const blurred = localStorage.getItem('blur_' + cardId) === 'true';
    if (body) body.classList.toggle('blurred', blurred);
    if (icon) {
      icon.classList.toggle('fa-eye-slash', !blurred);
      icon.classList.toggle('fa-eye', blurred);
    }
    const btn = card.querySelector('.toggle-blur');
    if (btn) btn.addEventListener('click', () => toggleBlur(cardId));
  });
}

// apply saved blur settings for static cards immediately
applyBlurStates();

function startTour(force = false) {
  if (typeof introJs === 'undefined') return;
  if (!force && localStorage.getItem('tourSeen') === 'true') return;
  const intro = introJs.tour();
  intro.setOptions({
    steps: [
      { intro: 'Bem-vindo ao VendedorPro! Este tour apresenta os principais recursos da tela.' },
      { element: '#resumoFaturamentoCard', intro: 'Resumo do faturamento do mês.' },
      { element: '#topSkusCard', intro: 'Top 5 SKUs do mês.' },
      { element: '#tarefasCard', intro: 'Aqui ficam suas tarefas do dia.' },
      { element: '#atualizacoesCard', intro: 'Novidades e atualizações da Shopee.' }
    ],
    nextLabel: 'Próximo',
    prevLabel: 'Anterior',
    skipLabel: 'Pular',
    doneLabel: 'Finalizar'
  }).oncomplete(() => localStorage.setItem('tourSeen', 'true'))
    .onexit(() => localStorage.setItem('tourSeen', 'true'))
    .start();
}

document.addEventListener('navbarLoaded', () => {
  const btn = document.getElementById('startTourBtn');
  if (btn) {
    btn.classList.remove('hidden');
    btn.addEventListener('click', () => startTour(true));
  }
});

function maybeStartTour() {
  startTour(false);
}


async function carregarResumoFaturamento(uid, isAdmin) {
  const el = document.getElementById('resumoFaturamento');
  if (!el) return;
  el.innerHTML = 'Carregando...';
  const hoje = new Date();
  const mesAtual = hoje.toISOString().slice(0,7); // YYYY-MM
let totalLiquido = 0;
  let totalBruto = 0;
  let pedidos = 0;
 const snap = isAdmin
    ? await getDocs(collectionGroup(db, 'faturamento'))
    : await getDocs(collection(db, `uid/${uid}/faturamento`));
  for (const docSnap of snap.docs) {
    const [ano, mes] = docSnap.id.split('-');
    if (`${ano}-${mes}` !== mesAtual) continue;
  const ownerUid = isAdmin ? docSnap.ref.parent.parent.id : uid;
    const subRef = collection(db, `uid/${ownerUid}/faturamento/${docSnap.id}/lojas`);
    const subSnap = await getDocs(subRef);
    for (const s of subSnap.docs) {
      let d = s.data();
      if (d.encrypted) {
        const passFn =
          typeof window !== 'undefined' ? window.getPassphrase : null;
        const pass = passFn ? await passFn() : null;
        let txt;
        try {
 txt = await decryptString(d.encrypted, pass || ownerUid);
        } catch (e) {
          if (pass) {
            try {
              txt = await decryptString(d.encrypted, ownerUid);
            } catch (err) {
              console.error('Erro ao descriptografar faturamento', err);
            }
          } else {
            console.error('Erro ao descriptografar faturamento', e);
          }
        }
                if (txt) d = JSON.parse(txt);
      }
      totalLiquido += d.valorLiquido || 0;
      totalBruto += d.valorBruto || 0;
      pedidos += d.qtdVendas || 0;
    }
  }
  el.innerHTML = `
    <a href="/VendedorPro/CONTROLE%20DE%20SOBRAS%20SHOPEE.html?tab=registroFaturamento" class="card block" id="resumoFaturamentoCard" data-blur-id="resumoFaturamentoCard">
      <div class="card-header">
        <div class="card-header-icon"><i class="fas fa-wallet text-xl"></i></div>
        <div>
          <h2 class="text-xl font-bold text-gray-800">Faturamento do Mês</h2>
          <p class="text-gray-600 text-sm">${pedidos} pedidos</p>
        </div>
        <button type="button" class="ml-auto toggle-blur" data-card="resumoFaturamentoCard" onclick="event.preventDefault();event.stopPropagation();">
          <i class="fas fa-eye-slash"></i>
        </button>
      </div>
      <div class="card-body space-y-4">
        <div>
          <div class="text-sm text-gray-500">Líquido</div>
          <div class="text-4xl font-extrabold text-green-600">R$ ${totalLiquido.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
        </div>
        <div>
          <div class="text-sm text-gray-500">Bruto</div>
          <div class="text-2xl font-bold text-blue-600">R$ ${totalBruto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
        </div>
      </div>
    </a>`;
}

async function carregarTopSkus(uid, isAdmin) {
  const el = document.getElementById('topSkus');
  if (!el) return;
  el.innerHTML = 'Carregando...';
  const hoje = new Date();
  const mesAtual = hoje.toISOString().slice(0,7);
  const mapa = {};
  const snap = isAdmin
    ? await getDocs(collectionGroup(db, 'skusVendidos'))
    : await getDocs(collection(db, `uid/${uid}/skusVendidos`));
  for (const docSnap of snap.docs) {
    const [ano, mes] = docSnap.id.split('-');
    if (`${ano}-${mes}` !== mesAtual) continue;
    let ownerUid = uid;
    if (isAdmin) {
      const parentDoc = docSnap.ref.parent.parent;
      if (!parentDoc) {
        console.warn('Documento sem pai para skusVendidos:', docSnap.ref.path);
        continue;
      }
      ownerUid = parentDoc.id;
    }
    const listaRef = collection(db, `uid/${ownerUid}/skusVendidos/${docSnap.id}/lista`);
    const listaSnap = await getDocs(listaRef);
    listaSnap.forEach(s => {
      const d = s.data();
      const chave = `${d.sku}||${d.loja || ''}`;
      mapa[chave] = (mapa[chave] || 0) + (d.total || 0);
    });
  }
  const ordenado = Object.entries(mapa).sort((a,b) => b[1]-a[1]).slice(0,5);
  if (ordenado.length === 0) {
    el.innerHTML = '<p class="text-gray-500">Sem dados</p>';
    return;
  }
  const linhas = ordenado.map(([ch,q]) => {
    const [sku, loja] = ch.split('||');
    return `<tr><td>${sku}</td><td>${q}</td><td>${loja || '-'}</td></tr>`;
  }).join('');
  el.innerHTML = `<table class="data-table"><thead><tr><th>SKU</th><th>Qtd.</th><th>Loja</th></tr></thead><tbody>${linhas}</tbody></table>`;
}
async function carregarTarefas(uid, isAdmin) {
  const lista = document.getElementById('listaTarefas');
  const listaFeitas = document.getElementById('listaTarefasFeitas');
  if (!lista || !listaFeitas) return;
  lista.innerHTML = '<li class="placeholder text-gray-500">Carregando...</li>';
  listaFeitas.innerHTML = '';

  const tarefas = [
    '<a href="https://seller.shopee.com.br/portal/sale/order" target="_blank" rel="noopener">Baixar planilha vendas Shopee</a>',
    '<a href="https://mferraretto.github.io/VendedorPro/CONTROLE%20DE%20SOBRAS%20SHOPEE.html?tab=faturamento" target="_blank" rel="noopener">Registrar no sistema - Fechamento dia anterior</a>',
    '<a href="https://seller.shopee.com.br/portal/sale/mass/ship?mass_shipment_tab=201&filter.shipping_method=91003&filter.order_item_filter_type=item0&filter.order_process_status=1&filter.sort.sort_type=1&filter.sort.ascending=true&filter.pre_order=2&filter.shipping_urgency_filter.current_time=1755177333&filter.shipping_urgency_filter.shipping_urgency=1" target="_blank" rel="noopener">Organizar coleta e imprimir etiquetas + lista de empacotamento ZPL</a>',
    '<a href="https://mferraretto.github.io/VendedorPro/zpl-import.html" target="_blank" rel="noopener">Importar o arquivo ZPL para o sistema e aguardar a impressão das etiquetas do dia</a>'
  ];
  const hoje = new Date();
  const storageKey = `tarefasFeitas_${hoje.toISOString().slice(0,10)}`;
  const concluidas = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const pendentes = tarefas.filter(t => !concluidas.includes(t));
  const feitas = tarefas.filter(t => concluidas.includes(t));

const render = (t, done = false) => {
    const checked = done ? 'checked' : '';
    const completedClass = done ? ' completed' : '';
    return `<li class="task-item${completedClass}"><input type="checkbox" class="task-checkbox" data-tarefa="${t}" ${checked}><span class="task-text${completedClass}">${t}</span></li>`;
  };

  lista.innerHTML = pendentes.length
    ? pendentes.map(t => render(t)).join('')
    : '<li class="placeholder text-gray-500">Sem tarefas pendentes</li>';
  listaFeitas.innerHTML = feitas.length
    ? feitas.map(t => render(t, true)).join('')
    : '<li class="placeholder text-gray-500">Nenhuma tarefa concluída</li>';
function atualizarProgresso() {
    const total = lista.querySelectorAll('li:not(.placeholder)').length +
                  listaFeitas.querySelectorAll('li:not(.placeholder)').length;
    const concluidasQtd = listaFeitas.querySelectorAll('li:not(.placeholder)').length;
    const percent = total ? (concluidasQtd / total) * 100 : 0;
    const bar = document.getElementById('tarefasProgressBar');
    if (bar) bar.style.width = `${percent}%`;
  }

  function updateStorage(desc, done) {
    const arr = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const idx = arr.indexOf(desc);
    if (done && idx === -1) arr.push(desc);
    if (!done && idx !== -1) arr.splice(idx, 1);
    localStorage.setItem(storageKey, JSON.stringify(arr));
  }

  function updatePlaceholders() {
    if (!lista.children.length) {
      lista.innerHTML = '<li class="placeholder text-gray-500">Sem tarefas pendentes</li>';
    }
    if (!listaFeitas.children.length) {
      listaFeitas.innerHTML = '<li class="placeholder text-gray-500">Nenhuma tarefa concluída</li>';
    }
  }

  function moverTarefa(chk) {
    const li = chk.closest('li');
    const desc = chk.getAttribute('data-tarefa');
    if (chk.checked) {
      const ph = listaFeitas.querySelector('.placeholder');
      if (ph) ph.remove();
li.classList.add('completed');
      li.querySelector('.task-text').classList.add('completed');
      listaFeitas.appendChild(li);
      updateStorage(desc, true);
    } else {
      const ph = lista.querySelector('.placeholder');
      if (ph) ph.remove();
        li.classList.remove('completed');
      li.querySelector('.task-text').classList.remove('completed');
      lista.appendChild(li);
      updateStorage(desc, false);
    }
    updatePlaceholders();
        atualizarProgresso();
  }

  document.querySelectorAll('#listaTarefas input[type="checkbox"], #listaTarefasFeitas input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', () => moverTarefa(chk));
  });
    atualizarProgresso();
}

async function iniciarPainel(user) {
  const uid = user?.uid;
  let isAdmin = false;

  if (uid) {
    try {
      const snap = await getDoc(doc(db, 'usuarios', uid)); // <- aqui era 'uid'
      if (snap.exists()) {
        const perfil = String(snap.data().perfil || '').toLowerCase();
        isAdmin = (perfil === 'adm' || perfil === 'admin');
      } else {
        console.warn(`Documento de usuário ${uid} não encontrado em 'usuarios'`);
      }
    } catch (e) {
      console.error('Erro ao carregar perfil do usuário:', e);
    }
  }

  await Promise.all([
    carregarResumoFaturamento(uid, isAdmin),
    carregarGraficoFaturamento(uid, isAdmin),
    carregarTopSkus(uid, isAdmin),
    carregarTarefas(uid, isAdmin)
  ]);

  const filtroMes = document.getElementById('filtroMesFaturamento');
  if (filtroMes) {
    filtroMes.value = new Date().toISOString().slice(0,7);
    filtroMes.addEventListener('change', () =>
      carregarGraficoFaturamento(uid, isAdmin)
    );
  }

  applyBlurStates();
  maybeStartTour();
}
onAuthStateChanged(auth, user => {
  if (user) iniciarPainel(user);
});

async function carregarGraficoFaturamento(uid, isAdmin) {
  const canvasLinha = document.getElementById('chartFaturamentoMeta');
  if (!canvasLinha || typeof Chart === 'undefined') return;
  const ctxLinha = canvasLinha.getContext('2d');

  const filtro = document.getElementById('filtroMesFaturamento');
  const mesFiltro = filtro?.value || new Date().toISOString().slice(0, 7);

  const snap = isAdmin
    ? await getDocs(collectionGroup(db, 'faturamento'))
    : await getDocs(collection(db, `uid/${uid}/faturamento`));

  const dados = [];
  let totalLiquido = 0;

  for (const docSnap of snap.docs) {
    const [ano, mes, dia] = (docSnap.id || '').split('-');
    if (`${ano}-${mes}` !== mesFiltro) continue;

    const ownerUid = isAdmin ? docSnap.ref.parent.parent.id : uid;
    const subRef = collection(db, `uid/${ownerUid}/faturamento/${docSnap.id}/lojas`);
    const subSnap = await getDocs(subRef);

    let liquido = 0;
    for (const s of subSnap.docs) {
      let d = s.data();
      if (d.encrypted) {
        const passFn = typeof window !== 'undefined' ? window.getPassphrase : null;
        const pass = passFn ? await passFn() : null;
        let txt;
        try {
          txt = await decryptString(d.encrypted, pass || ownerUid);
        } catch (e) {
          if (pass) {
            try { txt = await decryptString(d.encrypted, ownerUid); } catch (_) {}
          }
        }
        if (txt) d = JSON.parse(txt);
      }
      liquido += Number(d.valorLiquido) || 0;
    }

    totalLiquido += liquido;
    dados.push({ dia, liquido });
  }

  dados.sort((a, b) => a.dia.localeCompare(b.dia));
  const labels = dados.map(d => d.dia);
  const valores = dados.map(d => d.liquido);

  // Destroy previous chart instance if it exists and supports destroy
  if (window.chartFaturamentoMeta?.destroy)
    window.chartFaturamentoMeta.destroy();
  window.chartFaturamentoMeta = new Chart(ctxLinha, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Líquido',
        data: valores,
        borderColor: '#34D399',
        backgroundColor: 'rgba(52,211,153,0.2)',
        tension: 0.1,
        fill: true
      }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });

  // --- Gráfico comparativo (opcional) ---
  const canvasBar = document.getElementById('chartComparativoMeta');
  if (canvasBar) {
    const ctxBar = canvasBar.getContext('2d');

    let meta = 0;
    if (isAdmin) {
      const metasSnap = await getDocs(collectionGroup(db, 'metasFaturamento'));
      metasSnap.forEach(m => {
        if (m.id === mesFiltro) meta += Number(m.data().valor || 0);
      });
    } else if (uid) {
      const metaDoc = await getDoc(doc(db, `uid/${uid}/metasFaturamento`, mesFiltro));
      if (metaDoc.exists()) meta = Number(metaDoc.data().valor) || 0;
    }

    // Destroy previous comparative chart if available
    if (window.chartComparativoMeta?.destroy)
      window.chartComparativoMeta.destroy();
    window.chartComparativoMeta = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: ['Faturado', 'Meta'],
        datasets: [{
          data: [totalLiquido, meta],
          backgroundColor: ['#34D399', '#F87171']
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}
