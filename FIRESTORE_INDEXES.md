# Firestore Indexes

## Comunicação

The communication history query filters by recipients and type while ordering by timestamp. To support this, add the following composite index in Firestore:

- Collection: `comunicacao`
- Fields:
  - `destinatarios` array-contains
  - `tipo` ascending
  - `timestamp` descending

This index matches the paginated query used in `comunicacao.js`:

```js
query(
  collection(db, 'comunicacao'),
  where('destinatarios', 'array-contains', uid),
  where('tipo', 'in', ['alerta', 'arquivo']),
  orderBy('timestamp', 'desc'),
  limit(PAGE_SIZE)
)
```

## Painel de Atualizações Gerais

O painel consolidado utiliza um único conjunto de dados para mensagens, problemas e produtos. Cada consulta filtra pela categoria desejada e pelos participantes autorizados, ordenando pela data de criação. Crie o índice composto abaixo:

- Collection: `painelAtualizacoesGerais`
- Fields:
  - `participantes` array-contains
  - `categoria` ascending
  - `createdAt` descending

Esse índice atende, por exemplo, à consulta de mensagens em `painel-atualizacoes-gerais.js`:

```js
query(
  collection(db, 'painelAtualizacoesGerais'),
  where('categoria', '==', 'mensagem'),
  where('participantes', 'array-contains', currentUser.uid),
  orderBy('createdAt', 'desc')
)
```
