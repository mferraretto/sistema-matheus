const TINY_BASE = 'https://api.tiny.com.br/api2/';

function formBody(params, token) {
  return new URLSearchParams({ token, formato: 'JSON', ...params }).toString();
}

async function callTiny(endpoint, params, token) {
  const res = await fetch(TINY_BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody(params, token),
  });
  const json = await res.json();
  const status = json?.retorno?.status;
  if (status !== 'OK') {
    throw new Error(`Tiny error ${endpoint}: ${JSON.stringify(json?.retorno?.erros || json)}`);
  }
  return json.retorno;
}

export async function pesquisarPedidosPorData({ dataInicial, dataFinal, dataAtualizacao, pagina = 1 }, token) {
  return callTiny('pedidos.pesquisa.php', { dataInicial, dataFinal, dataAtualizacao, pagina }, token);
}
export async function obterPedido(id, token) {
  const ret = await callTiny('pedido.obter.php', { id }, token);
  return ret.pedido;
}
export async function pesquisarProdutos({ pesquisa, pagina = 1 }, token) {
  return callTiny('produtos.pesquisar.php', { pesquisa, pagina }, token);
}
