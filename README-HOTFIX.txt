ZoneMind 0.8.5.1 - Hotfix Layout History

Problema corretto:
- il caricamento del layout veniva salvato correttamente;
- la successiva lettura dello storico restituiva HTTP 500 perché nei database
  creati con versioni precedenti mancava la colonna layouts.created_at.

Installazione:
1. Arrestare Uvicorn con CTRL+C.
2. Sostituire api/app/database.py.
3. NON cancellare api/data/zonemind.db.
4. Riavviare api/run_api.bat.
5. Riaprire /admin/ e selezionare Layout.

La migrazione aggiunge automaticamente layouts.created_at e valorizza i record
esistenti. Il layout già pubblicato non deve essere ricaricato.
