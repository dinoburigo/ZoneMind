ZoneMind 0.8.6.1 - Hotfix Assignment Explorer

Problema corretto:
- l'endpoint assignments restituisce un oggetto paginato con la proprietà "items";
- il vecchio caricamento sintetico della dashboard trattava la risposta come un array;
- questo causava l'errore JavaScript: assignments.forEach is not a function.

Installazione:
1. Arrestare Uvicorn.
2. Copiare public/admin/admin.js nel progetto, sostituendo il file esistente.
3. Riavviare api/run_api.bat.
4. Nel browser eseguire Ctrl+F5 per svuotare la cache della pagina.

Non modificare o cancellare api/data/zonemind.db.
