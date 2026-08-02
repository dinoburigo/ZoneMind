# ZoneMind 1.0.0 - Installazione

## 1. Scopo

Questa guida descrive l'installazione e l'esecuzione di ZoneMind 1.0.0 su una workstation o su un server.

La release 1.0.0 utilizza:

- progetto condiviso tramite OneDrive o Git;
- ambiente Python locale per ogni macchina;
- backend FastAPI;
- database SQLite locale al progetto;
- console Admin esposta via browser.

## 2. Requisiti

Software richiesto:

- Python 3.12 o superiore;
- Git;
- accesso alla cartella progetto ZoneMind;
- browser moderno;
- accesso alla rete locale se l'applicazione deve essere esposta da server.

## 3. Posizione progetto

Percorso consigliato in OneDrive:

```text
OneDrive - BENETTON GROUP SRL\PROGETTI\STOREZONE\ZoneMind
```

Il progetto deve contenere codice, documentazione e file applicativi.

Non deve contenere ambienti virtuali Python condivisi tra macchine.

## 4. Regola fondamentale sulla virtual environment

La cartella `.venv` non deve essere copiata tra macchine.

Motivo: una virtual environment Python contiene riferimenti assoluti al Python installato sulla macchina che l'ha creata.

Esempio di problema:

```text
No Python at C:\Users\utente_originale\AppData\Local\Programs\Python\Python312\python.exe
```

Questo accade quando la `.venv` viene copiata o sincronizzata su una macchina diversa.

## 5. Creazione ambiente Python locale

Ogni macchina deve creare il proprio ambiente Python.

### Opzione A - Ambiente fuori dal progetto consigliato

Esempio workstation:

```bat
python -m venv C:\PythonEnv\ZoneMind
```

Attivazione:

```bat
C:\PythonEnv\ZoneMind\Scripts\activate
```

### Opzione B - Ambiente nel progetto solo locale

Se si preferisce usare `.venv` nella root del progetto, assicurarsi che non venga versionata e non venga sincronizzata come elemento condiviso.

```bat
cd "C:\Users\<utente>\OneDrive - BENETTON GROUP SRL\PROGETTI\STOREZONE\ZoneMind"
python -m venv .venv
.venv\Scripts\activate
```

## 6. Verifica Python attivo

Dopo l'attivazione dell'ambiente:

```bat
where python
```

Il primo risultato deve puntare alla virtual environment locale.

Esempio corretto:

```text
C:\PythonEnv\ZoneMind\Scripts\python.exe
```

oppure:

```text
...\ZoneMind\.venv\Scripts\python.exe
```

Se compare prima il Python globale della macchina, l'ambiente non è attivo correttamente.

## 7. Installazione dipendenze

Dalla root del progetto:

```bat
pip install -r api\requirements.txt
```

Pacchetti principali:

- fastapi;
- uvicorn;
- python-multipart.

## 8. Avvio applicazione

Dalla root del progetto:

```bat
api\run_api.bat
```

In alternativa, con ambiente Python già attivo:

```bat
python -m uvicorn api.app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 9. URL applicativi

Applicazione:

```text
http://localhost:8000
```

Console Admin:

```text
http://localhost:8000/admin
```

Health check:

```text
http://localhost:8000/api/health
```

Risposta attesa:

```json
{
  "status": "ok"
}
```

## 10. Esecuzione da server

Se ZoneMind viene eseguito da server:

1. mantenere il progetto nella cartella condivisa OneDrive o in una cartella locale sincronizzata;
2. creare una virtual environment dedicata sul server;
3. installare le dipendenze con `pip install -r api\requirements.txt`;
4. avviare `api\run_api.bat` oppure un comando equivalente;
5. esporre la porta configurata, di default `8000`.

Esempio accesso da altra macchina:

```text
http://<nome-server>:8000/admin
```

## 11. Database

Il database SQLite è collocato in:

```text
api\data\zonemind.db
```

Il file viene creato automaticamente se assente.

Durante gli aggiornamenti ordinari non cancellare:

```text
api\data\zonemind.db
```

## 12. Aggiornamento release

Aggiornamento via Git:

```bat
git pull
```

Poi, se sono cambiate le dipendenze:

```bat
pip install -r api\requirements.txt
```

Riavviare l'applicazione:

```bat
api\run_api.bat
```

## 13. Problemi comuni

### Errore: No module named uvicorn

Causa: dipendenze non installate nell'ambiente Python attivo.

Soluzione:

```bat
pip install -r api\requirements.txt
```

### Errore: No Python at ...

Causa: virtual environment copiata da un'altra macchina.

Soluzione:

```bat
rmdir /s /q .venv
python -m venv .venv
.venv\Scripts\activate
pip install -r api\requirements.txt
```

Oppure creare la venv fuori dal progetto.

### `where python` non punta alla venv

Causa: ambiente non attivato correttamente.

Soluzione:

```bat
.venv\Scripts\activate
where python
```

oppure attivare il path della venv esterna.

### Il browser continua a caricare una vecchia versione del frontend

Soluzione:

```text
Ctrl + F5
```

oppure aprire DevTools, scheda Network, e selezionare `Disable cache` durante il refresh.

## 14. File e cartelle da non condividere

Non versionare e non condividere:

```text
.venv/
venv/
env/
__pycache__/
*.pyc
.env
```

## 15. Verifica finale installazione

Checklist:

```text
[ ] where python punta alla venv corretta
[ ] pip install -r api\requirements.txt eseguito
[ ] api\run_api.bat avvia Uvicorn
[ ] /api/health risponde correttamente
[ ] /admin apre la console
[ ] il Layout Editor carica planimetrie e consente il disegno zone
```

## 16. Note release 1.0.0

La release 1.0.0 chiude il modulo Layout Editor e costituisce la baseline per lo sviluppo del Mapper v1.

Il prossimo sviluppo applicativo deve avvenire su branch dedicato, ad esempio:

```text
feature/mapper-v1
```
