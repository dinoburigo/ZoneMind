# Decision Log 0.8.4

## DL-014 — Catalogo come modulo di consultazione
Il Catalogo Admin è una vista operativa per negozio con ricerca, filtri, ordinamento, paginazione e dettaglio. In questa release non modifica le anagrafiche articolo.

## DL-015 — Stato di mappatura oggettivo
Un articolo è “Mappato” solo quando esiste un'associazione articolo-zona. “Non mappato” non indica errore né incompletezza della zona.

## DL-016 — Paginazione lato server
Ricerca, filtro, ordinamento e paginazione sono eseguiti dalle API per mantenere il modulo utilizzabile anche con cataloghi estesi.
