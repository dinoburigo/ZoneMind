# Decision Log 0.8.3

## DL-013 — Disattivazione logica dei negozi
Un negozio non viene cancellato fisicamente. Il campo `active_flag` lo esclude dalle operazioni correnti, preservando cataloghi, layout, associazioni e storico.

## DL-014 — Codice negozio immutabile
`store_code` è la chiave stabile usata da API e relazioni. Dopo la creazione sono modificabili nome, città, paese e stato, non il codice.

## DL-015 — Admin multi-negozio
La gestione anagrafica è centralizzata. Il selettore operativo mostra soltanto negozi attivi; l'elenco amministrativo mostra anche quelli disattivati.
