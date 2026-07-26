# Decision Log 0.9.5

## DL-021 — Sincronizzazione idempotente
Ogni operazione offline possiede un `operationId` univoco. Il backend registra le operazioni completate e, in caso di reinvio, restituisce lo stesso risultato senza applicare nuovamente la modifica.

## DL-022 — Conflitti espliciti
Quando lo stato del server non coincide con lo stato atteso dall'operazione offline, la sincronizzazione non sovrascrive automaticamente i dati. L'operatore sceglie se mantenere la zona server oppure applicare la zona registrata offline.

## DL-023 — Ordine cronologico
Le operazioni pendenti vengono sincronizzate in ordine di creazione. Gli errori di rete sospendono il flusso; i conflitti vengono separati e possono essere risolti successivamente.
