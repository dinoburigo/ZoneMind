# Decision Log - Sprint 0.5.0

## DL-010 - Planimetria come centro operativo del Mapper

La planimetria costituisce il principale strumento di navigazione del Mapper.

L'operatore seleziona liberamente la zona sulla quale desidera lavorare. La selezione effettuata direttamente sulla planimetria attiva la lettura barcode per quella zona.

Il sistema non introduce il concetto di zona completata e non impone una sequenza di lavoro, perché non conosce il numero atteso di articoli per ciascuna zona.

Sotto la planimetria viene mostrato un riepilogo delle zone con il numero di articoli distinti associati.

La selezione di una zona dal riepilogo è destinata alla consultazione e non attiva automaticamente lo scanner.

## DL-011 - Conteggi derivati dalle associazioni

Il numero di articoli associati a una zona non viene memorizzato nel layout JSON. Viene calcolato dinamicamente dalle associazioni presenti in IndexedDB, filtrate per layout corrente e raggruppate per articolo distinto.

## DL-012 - Distinzione tra azione operativa e consultazione

- tap sulla planimetria: selezione operativa e avvio scanner;
- tap sul riepilogo: selezione consultiva senza avvio scanner.
