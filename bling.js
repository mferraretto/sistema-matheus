importar { initializeApp, getApps } de 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js' ;
 
importar { getFirestore, doc, setDoc } de 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js' ;
 

const BLING_API_KEY = 'f9c9f25ac92629f5e6ea58cbeb0ab499e51046118d68fbe87a097f03802e87c093b7e9b3' ;
 

const app = getApps (). comprimento ? getApps ()[ 0 ] : initializeApp (firebaseConfig);
const db = getFirestore (aplicativo);

exportar função assíncrona importarPedidosBling ( ) {
   
  const url = `https://bling.com.br/Api/v2/pedidos/json/?apikey= ${BLING_API_KEY} ` ;
  tentar {
    const res = aguardar busca (url);
 
    const json = await res. json ();
    if (json.retorno && json.retorno.erros) {
      console.error('Erro ao obter pedidos do Bling:', json.retorno.erros);
      alert('Erro ao importar pedidos do Bling');
      retornar ;
    }

    const pedidos = json.retorno?.pedidos || [];
    for (const obj of pedidos) {
      const pedido = obj.pedido || obj;
      const numero = String(pedido.numero);
      aguarde setDoc ( doc (db, 'ordersBling' , número), pedido);
 
    }

    atualizarTabelaPedidos(pedidos);
    alert(`${pedidos.length} pedidos importados`);
  } pegar (errar) {
    console.error('Falha ao importar pedidos do Bling:', err);
    alert ( 'Falha ao importar solicitações do Bling' );
  }
}

function atualizarTabelaPedidos(pedidos) {
  const tbody = document . querySelector ( '#tabelaPedidosBling tbody' );
  se (!tbody) retornar ;
  tbody.innerHTML = ' '
 ;
  for (const obj of pedidos) {
    const p = obj.pedido || obj;
    número constante = número p. || '' ;
    const item = Array.isArray(p.itens) ? p.itens[0]?.item : p.itens?.item;
    const sku = item?. codigo || '' ;
    const valorPago = parseFloat (p. totalvenda || p. total || 0 );
    const liquid = paymentValue; // valor líquido aproximado
    const tr = documento.createElement ( ' tr' ) ;
    tr.innerHTML = `
​
      <td> ${número} </td>
      <td> ${sku} </td>
      <td>R$ ${valorPago.toLocaleString( 'pt-BR' , { minimumFractionDigits: 2 })} </td>
      <td>R$ ${liquido.toLocaleString( 'pt-BR' , { minimumFractionDigits: 2 })} </td>
    ` ;
    tbody.appendChild (tr)
 ;
  }
}

// Expõe a função globalmente para o manipulador de botões embutidos
se ( tipo de janela !== 'indefinido' ) {
 
  janela . importarPedidosBling = importarPedidosBling;
}
índice.html
