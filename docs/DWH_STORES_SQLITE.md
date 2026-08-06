# ZoneMind - Integrazione Negozi DWH su SQLite

## Vista sorgente

```text
V_ZONEMIND_STORE
```

Colonne attese:

```text
COD_NEGOZIO
DES_NEGOZIO
DES_CITTA
DES_NAZIONE
```

## File aggiunti

```text
api/app/dwh_stores.py
public/admin/stores-dwh.js
tools/apply_dwh_stores_integration.py
```

## File modificati dalla patch

```text
api/app/main.py
public/admin/index.html
```

## .env

Aggiungere se non presente:

```env
ZONEMIND_DWH_STORES_VIEW=V_ZONEMIND_STORE
```

La patch riutilizza le variabili Oracle già usate per il catalogo articoli:

```env
ZONEMIND_DWH_USER=...
ZONEMIND_DWH_PASSWORD=...
ZONEMIND_DWH_DSN=...
ZONEMIND_ORACLE_CLIENT_LIB_DIR=C:\oracle\instantclient_19_xx
```

## Applicazione patch

Dalla root del progetto:

```bat
python tools\apply_dwh_stores_integration.py
```

## Endpoint

```text
GET  /api/admin/stores/dwh/health
GET  /api/admin/stores/dwh/status
POST /api/admin/stores/dwh/full
POST /api/admin/stores/dwh/sync
POST /api/admin/stores/dwh/sync-store/{store}
```

## Nota funzionale

La tabella tecnica `zm_stores` viene ricostruita con il full reload, ma la tabella operativa `stores` non viene mai svuotata. Questo consente di mantenere eventuali negozi manuali di test.
