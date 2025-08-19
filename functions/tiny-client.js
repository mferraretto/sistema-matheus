const TINY_BASE = 'https://api.tiny.com.br/api2/';

function body(params, token) {
  return new URLSearchParams({ token, formato: 'JSON', ...params }).toString();
}

async function callTiny(endpoint, params, token) {
  const res = await fetch(TINY_BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body(params, token),
  });
  const json = await res.json();
  if (json?.retorno?.status !== 'OK') {
    throw new Error(`Tiny API erro em ${endpoint}: ${JSON.stringify(json?.retorno?.erros || json)}`);
  }
  return json.retorno;
}

export async function tinyTestToken(token) {
  // chamada barata pra validar token: pega 1 página de produtos por 'a'
  try {
    await callTiny('produtos.pesquisar.php', { pesquisa: 'a', pagina: 1 }, token);
    return true;
  } catch { return false; }
}

export async function pesquisarPedidos({ dataInicial, dataFinal, dataAtualizacao, pagina = 1 }, token) {
  return callTiny('pedidos.pesquisa.php', { dataInicial, dataFinal, dataAtualizacao, pagina }, token);
}
export async function obterPedido(id, token) {
  const ret = await callTiny('pedido.obter.php', { id }, token);
  return ret.pedido;
}
export async function pesquisarProdutos({ pesquisa, pagina = 1 }, token) {
  return callTiny('produtos.pesquisar.php', { pesquisa, pagina }, token);
}
