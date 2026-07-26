# ZoneMind 0.9.0 - Admin Layout Editor integrato

## Scopo
Questa release sostituisce la sezione `Admin > Layout` con un flusso operativo:

1. selezione store;
2. creazione nuovo layout con nome funzionale;
3. caricamento planimetria;
4. disegno zone direttamente nell'Admin;
5. salvataggio layout come combinazione planimetria + zone;
6. attivazione/disattivazione layout per lo store.

## Novità principali
- più layout attivi per lo stesso negozio;
- nome layout gestibile da UI (`Estate`, `Inverno`, `Piano 1`, `Uomo`, `Donna`, `Bambino`, ecc.);
- editor integrato nella pagina `Admin > Layout`;
- mantenimento compatibilità con upload JSON legacy;
- il database esistente `api/data/zonemind.db` non deve essere cancellato.

## File da sostituire
Copiare il contenuto mantenendo la struttura cartelle:

- `api/app/database.py`
- `api/app/main.py`
- `public/admin/index.html`
- `public/admin/admin.js`
- `public/admin/admin.css`

## Avvio
```bat
cd C:\Progetti\ZoneMind
api\run_api.bat
```

Poi aprire:

```text
http://localhost:8000/admin/
```

E premere `Ctrl+F5` nel browser.

## Nota importante
Non cancellare o sostituire:

```text
api/data/zonemind.db
```

All'avvio il backend aggiunge automaticamente le colonne mancanti alla tabella `layouts`.
