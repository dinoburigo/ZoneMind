# ZoneMind - Integrazione Catalogo DWH su SQLite

## File aggiunti

- `api/app/dwh_catalog.py`
- `public/admin/catalog-dwh.js`
- `tools/apply_dwh_integration.py`

## File modificati dalla patch

- `api/app/main.py`
- `public/admin/index.html`

## Configurazione .env

```env
ZONEMIND_DWH_USER=...
ZONEMIND_DWH_PASSWORD=...
ZONEMIND_DWH_DSN=host:1521/service
ZONEMIND_DWH_ARTICLES_VIEW=V_ZONEMIND_ARTICLES
ZONEMIND_DWH_FETCH_SIZE=5000
```

## Applicazione patch

Dalla root del progetto:

```bat
python tools\apply_dwh_integration.py
```

## Endpoint disponibili tramite api\run_api.bat

```text
GET  /api/admin/catalog/dwh/health
GET  /api/admin/catalog/dwh/status
POST /api/admin/catalog/dwh/full
POST /api/admin/catalog/dwh/sync
POST /api/admin/catalog/dwh/sync-store/{store}
```

## Test

1. Avviare `api\run_api.bat`
2. Aprire `/docs`
3. Cercare `catalog/dwh`
4. Eseguire `GET /api/admin/catalog/dwh/health`
5. Eseguire `POST /api/admin/catalog/dwh/full`
