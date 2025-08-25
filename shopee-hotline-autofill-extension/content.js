const norm = s => (s || "")
  .toString()
  .toLowerCase()
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .trim();

const LABELS = {
  linkLoja: ["link da sua loja", "link da loja"],
  outrasLojas: ["voce tem outras lojas no mesmo endereco de coleta", "outras lojas"],
  contatoTel: ["gostaria de receber nosso contato por telefone", "contato por telefone"],
  telefone: ["melhor numero de telefone para retornarmos o contato", "telefone"],
  responsavel: ["nome do responsavel para contato", "responsavel"],
  modeloLogistico: ["em qual modelo logistico voce esta enfrentando dificuldades", "modelo logistico"],
  descricao: ["descricao do problema", "descricao"]
};

function byText(el) {
  return norm(
    el?.textContent ||
    el?.innerText ||
    el?.getAttribute?.("aria-label") ||
    el?.placeholder ||
    ""
  );
}

function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function collectFields() {
  const inputs = $all("input, textarea, select");
  const labels = $all("label");
  const labelFor = new Map();

  for (const lb of labels) {
    const t = byText(lb);
    const id = lb.getAttribute("for");
    if (id) labelFor.set(id, t);
  }

  const items = inputs.map(el => {
    let guess = "";
    const id = el.getAttribute("id");
    if (id && labelFor.has(id)) guess = labelFor.get(id);
    else {
      const near = el.closest("label") || el.parentElement?.querySelector?.("label");
      if (near) guess = byText(near);
    }
    if (!guess) guess = byText(el);
    return { el, label: guess, labelNorm: norm(guess), tag: el.tagName.toLowerCase(), type: (el.type || "").toLowerCase() };
  });

  return items;
}

function pickField(fields, aliases) {
  const set = new Set(aliases.map(norm));
  return fields.find(f => set.has(f.labelNorm)) ||
         fields.find(f => [...set].some(a => f.labelNorm.includes(a)));
}

function selectByVisibleText(selectEl, text) {
  const wanted = norm(text);
  const opt = Array.from(selectEl.options).find(o => norm(o.textContent).includes(wanted));
  if (opt) { selectEl.value = opt.value; selectEl.dispatchEvent(new Event("change", { bubbles: true })); return true; }
  return false;
}

function fill(el, value) {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "select") return selectByVisibleText(el, value);
  el.focus();
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.blur();
  return true;
}

function clickSubmit() {
  const buttons = $all('button, [role="button"], input[type="submit"]');
  const btn = buttons.find(b => /(enviar|submit)/.test(byText(b)));
  if (btn) { btn.scrollIntoView({behavior:"smooth", block:"center"}); btn.click(); return true; }
  return false;
}

async function autofillHotline(data) {
  const fields = collectFields();

  const map = {
    linkLoja: pickField(fields, LABELS.linkLoja),
    outrasLojas: pickField(fields, LABELS.outrasLojas),
    contatoTel: pickField(fields, LABELS.contatoTel),
    telefone: pickField(fields, LABELS.telefone),
    responsavel: pickField(fields, LABELS.responsavel),
    modeloLogistico: pickField(fields, LABELS.modeloLogistico),
    descricao: pickField(fields, LABELS.descricao)
  };

  // 1) Link da loja
  if (data.linkLoja) fill(map.linkLoja?.el, data.linkLoja);

  // 2) Outras lojas? (select)
  if (map.outrasLojas?.el) selectByVisibleText(map.outrasLojas.el, data.temOutrasLojasMesmoEndereco ? "Sim" : "Não");

  // 3) Contato por telefone? (select)
  if (map.contatoTel?.el) selectByVisibleText(map.contatoTel.el, data.aceitaContatoPorTelefone ? "Sim" : "Não");

  // 4) Telefone (DDI + número)
  //   - Muitas páginas usam 2 campos. Tente achar um select/combobox próximo ao campo de telefone.
  if (map.telefone?.el) {
    // tenta achar sibling select para DDI
    const container = map.telefone.el.closest("div") || document;
    const ddiSelect = container.querySelector("select");
    if (ddiSelect && data.ddi) selectByVisibleText(ddiSelect, data.ddi);
    fill(map.telefone.el, data.telefone);
  }

  // 5) Responsável
  if (data.nomeResponsavel) fill(map.responsavel?.el, data.nomeResponsavel);

  // 6) Modelo logístico (select por texto)
  if (map.modeloLogistico?.el && data.modeloLogistico) {
    if (!selectByVisibleText(map.modeloLogistico.el, data.modeloLogistico)) {
      // fallback: tenta digitar (caso seja combobox custom)
      fill(map.modeloLogistico.el, data.modeloLogistico);
    }
  }

  // 7) Descrição
  if (data.descricao) fill(map.descricao?.el, data.descricao);

  // 8) enviar?
  if (data.submit) clickSubmit();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SHOPEE_HOTLINE_AUTOFILL") {
    autofillHotline(msg.payload)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true; // async
  }
});

// debug no console:
window._hotlineDebug = () => {
  const f = collectFields();
  console.table(f.map(x => ({label:x.label, tag:x.tag, type:x.type})));
  return f;
};
