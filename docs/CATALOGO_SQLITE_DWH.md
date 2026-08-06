# ZoneMind - Caricamento V_ZONEMIND_ARTICLES su SQLite

## Scopo

Questa estensione carica la vista DWH `V_ZONEMIND_ARTICLES` dentro il database SQLite operativo di ZoneMind (`api/data/zonemind.db`).

Il caricamento aggiorna sia le tabelle esistenti della release 1.0.0:

- `stores`
- `articles`
- `article_barcodes`
- `store_articles`

sia una nuova tabella tecnica:

- `zm_articles`

La tabella `zm_articles` conserva la granularità completa:

```text
COD_STAGIONE
COD_NEGOZIO
COD_ARTICOLO
COD_EAN
COD_COLORE
COD_TAGLIA
```

## File inclusi

```text
api/app/main_sqlite_dwh.py
api/run_api_sqlite_dwh.bat
public/admin/catalog-sqlite-dwh.js
```

## Driver Oracle

Installare nella virtual environment locale una libreria Oracle:

```bat
pip install oracledb
```

oppure:

```bat
pip install cx_Oracle
```

## Variabili ambiente

Configurare l'ambiente della macchina che esegue ZoneMind:

```bat
set ZONEMIND_DWH_USER=utente_dwh
set ZONEMIND_DWH_PASSWORD=password_dwh
set ZONEMIND_DWH_DSN=host:porta/service_name
set ZONEMIND_DWH_ARTICLES_VIEW=V_ZONEMIND_ARTICLES
```

## Avvio

Usare:

```bat
api\run_api_sqlite_dwh.bat
```

oppure:

```bat
python -m uvicorn api.app.main_sqlite_dwh:app --host 0.0.0.0 --port 8000 --reload
```

## Frontend

Copiare:

```text
public/admin/catalog-sqlite-dwh.js
```

Poi aggiungere in `public/admin/index.html`, subito dopo `admin.js`:

```html
<script type="module" src="./catalog-sqlite-dwh.js"></script>
```

## Endpoint

```text
GET  /api/admin/catalog/sqlite-dwh/health
GET  /api/admin/catalog/sqlite-dwh/status
POST /api/admin/catalog/sqlite-dwh/full
POST /api/admin/catalog/sqlite-dwh/sync
POST /api/admin/catalog/sqlite-dwh/sync-store/{store}
```

## Regole funzionali

- `sync` non cancella mai righe già presenti.
- `full` è pensato per primo caricamento o rebuild.
- Il caricamento popola anche le tabelle usate oggi dalla pagina Catalogo.
- La lista EAN resta in SQLite, coerente con l'obiettivo offline del Mapper.
