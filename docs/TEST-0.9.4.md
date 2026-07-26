# Test Sprint 0.9.4

1. Avvia ZoneMind online e carica STORE001.
2. Verifica che layout, zone, barcode e associazioni siano visibili.
3. In DevTools > Network seleziona Offline, oppure arresta l’API lasciando aperta la pagina.
4. Ricarica il Mapper e carica nuovamente STORE001: il workspace deve aprirsi dalla cache.
5. Seleziona una zona e inserisci manualmente un EAN valido non ancora associato.
6. Verifica il messaggio “salvato offline” e il contatore “1 in coda”.
7. Prova anche uno spostamento zona e conferma: deve essere registrato nella coda locale.
8. Riattiva la rete/API e premi “Sincronizza ora”.
9. Verifica che il contatore torni a zero e che Admin > Associazioni mostri il dato.

Nota: i conflitti reali tra modifiche concorrenti verranno gestiti nello Sprint 0.9.5.
