# ZoneMind 0.7.0 - Installazione Admin Console

## File da sostituire

```text
api/app/database.py
api/app/main.py
public/admin/index.html
public/admin/admin.js
public/admin/admin.css
```

Il database esistente `api/data/zonemind.db` non deve essere cancellato.
All'avvio il backend aggiunge automaticamente la tabella e le colonne mancanti.

## Avvio

```bat
cd C:\Progetti\ZoneMind
.venv\Scripts\activate
api\run_api.bat
```

Aprire:

```text
http://localhost:8000/admin/
```

## Test minimo

1. Verificare lo stato `API 0.7.0`.
2. Selezionare `STORE001`.
3. Controllare articoli, EAN, layout e associazioni.
4. Importare nuovamente il CSV.
5. Pubblicare un JSON prodotto dall'Editor.
6. Verificare l'aggiornamento immediato della dashboard.
