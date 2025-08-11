import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, doc, getDoc, collectionGroup, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { decryptString } from './crypto.js';
import { loadSecureDoc } from './secure-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

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
    <div class="card" id="resumoFaturamentoCard" data-blur-id="resumoFaturamentoCard">
      <div class="card-header">
        <div class="card-header-icon"><i class="fas fa-chart-line text-xl"></i></div>
        <div>
          <h2 class="text-xl font-bold text-gray-800">Faturamento do Mês</h2>
          <p class="text-gray-600 text-sm">${pedidos} pedidos</p>
        </div>
         <button type="button" class="ml-auto toggle-blur" data-card="resumoFaturamentoCard">
          <i class="fas fa-eye-slash"></i>
        </button>
      </div>
      <div class="card-body">
<div class="text-3xl font-bold text-green-600">Líquido: R$ ${totalLiquido.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
        <div class="text-xl font-semibold text-blue-600 mt-1">Bruto: R$ ${totalBruto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
        </div>
    </div>`;
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
     const ownerUid = isAdmin ? docSnap.ref.parent.parent.id : uid;
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

  const tarefas = [];
  const hoje = new Date();
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(hoje.getDate() - 7);

  // Top SKUs
  const mapa = {};
  const snapSkus = isAdmin
    ? await getDocs(collectionGroup(db, 'skusVendidos'))
    : await getDocs(collection(db, `uid/${uid}/skusVendidos`));
  for (const docSnap of snapSkus.docs) {
    const dataDoc = new Date(docSnap.id);
    if (isNaN(dataDoc) || dataDoc < seteDiasAtras || dataDoc > hoje) continue;
    const ownerUid = isAdmin ? docSnap.ref.parent.parent.id : uid;
    const listaRef = collection(db, `uid/${ownerUid}/skusVendidos/${docSnap.id}/lista`);
    const listaSnap = await getDocs(listaRef);
    listaSnap.forEach(s => {
      const d = s.data();
      const chave = `${d.sku}||${d.loja || ''}`;
      mapa[chave] = (mapa[chave] || 0) + (d.total || 0);
    });
  }
  const ordenado = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  if (ordenado[0]) {
    const sku1 = ordenado[0][0].split('||')[0];
    tarefas.push(`Criar 5 anúncios novos do SKU ${sku1}`);
  }
  if (ordenado[1]) {
    const sku1 = ordenado[0][0].split('||')[0];
    const sku2 = ordenado[1][0].split('||')[0];
    tarefas.push(`Criar 3 kits com os SKUs ${sku1} e ${sku2}`);
  }

  // Anúncios para excluir ou modificar
  const snapAnuncios = isAdmin
    ? await getDocs(collectionGroup(db, 'anuncios'))
    : await getDocs(collection(db, `uid/${uid}/anuncios`));
  const pass = typeof getPassphrase === 'function' ? getPassphrase() : null;
  for (const docSnap of snapAnuncios.docs) {
    const ownerUid = isAdmin ? docSnap.ref.parent.parent.id : uid;
    const dados = await loadSecureDoc(db, `uid/${ownerUid}/anuncios`, docSnap.id, pass);
    if (!dados || !dados.dataCriacao) continue;
    const dataCriacao = new Date(dados.dataCriacao);
    const diasAtivo = (hoje - dataCriacao) / (1000 * 60 * 60 * 24);
    if (diasAtivo <= 15) continue;

    const desempenhoRef = collection(db, `uid/${ownerUid}/anuncios/${docSnap.id}/desempenho`);
    const desempenhoQuery = query(desempenhoRef, orderBy('__name__', 'desc'), limit(30));
    const desempenhoSnap = await getDocs(desempenhoQuery);
    let visualizacoes = 0;
    let vendas = 0;
    desempenhoSnap.forEach(d => {
      const dataDoc = new Date(d.id);
      const diffDias = (hoje - dataDoc) / (1000 * 60 * 60 * 24);
      if (diffDias <= 15) {
        const v = d.data();
        visualizacoes += Number(v.visualizacoes || 0);
        vendas += Number(v.unidadesPago || v.vendasPago || 0);
      }
    });
    if (vendas === 0) {
      const nome = dados.nome || docSnap.id;
      if (visualizacoes < 100) {
        tarefas.push(`Excluir anúncio ${nome} (sem vendas e poucas visualizações)`);
      } else if (visualizacoes > 200) {
        tarefas.push(`Modificar anúncio ${nome} (muitas visualizações sem vendas)`);
      }
    }
  }

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
      const snap = await getDoc(doc(db, 'uid', uid));
      isAdmin = snap.exists() && String(snap.data().perfil || '').toLowerCase() === 'adm';
    } catch (e) { console.error(e); }
  }
  await Promise.all([
    carregarResumoFaturamento(uid, isAdmin),
  carregarTopSkus(uid, isAdmin),
    carregarTarefas(uid, isAdmin)
  ]);
  applyBlurStates();
}

onAuthStateChanged(auth, user => {
  if (user) iniciarPainel(user);
});
