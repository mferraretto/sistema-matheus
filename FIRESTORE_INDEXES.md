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
