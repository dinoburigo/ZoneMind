# DL-021 — Offline Foundation

Il Mapper conserva in IndexedDB l’ultimo workspace caricato per negozio: layout, planimetria, zone, catalogo barcode e associazioni.

Le operazioni effettuate senza connettività vengono applicate subito allo stato locale e registrate in una coda persistente con identificativo univoco.

La versione 0.9.4 non risolve automaticamente i conflitti funzionali: questa responsabilità è demandata alla 0.9.5.
