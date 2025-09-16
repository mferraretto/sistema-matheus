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

Os novos quadros compartilham informações por equipe e filtram pelos participantes (e-mail) ordenando pela data de criação. Crie os índices abaixo em Firestore:

- Coleção: `painelAtualizacoesMensagens`
  - Campos: `participantesEmails` array-contains, `createdAt` descending, `__name__` ascending
- Coleção: `painelAtualizacoesProblemas`
  - Campos: `participantesEmails` array-contains, `createdAt` descending, `__name__` ascending
- Coleção: `painelAtualizacoesProdutos`
  - Campos: `participantesEmails` array-contains, `createdAt` descending, `__name__` ascending
