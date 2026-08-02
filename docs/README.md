# ZoneMind

## 1. Overview

ZoneMind è una piattaforma interna per la gestione visuale dei layout dei negozi e per la futura mappatura tra articoli, codici EAN e zone espositive.

La soluzione consente di trasformare la planimetria di un negozio in una rappresentazione digitale operativa, sulla quale disegnare zone e associare successivamente gli articoli rilevati tramite processi di mapping o scanner.

## 2. Release corrente

Release stabile:

```text
1.0.0
```

Branch stabile:

```text
main
```

Branch di sviluppo successivo:

```text
feature/mapper-v1
```

La release 1.0.0 consolida il nuovo Layout Editor integrato e costituisce la baseline stabile del progetto.

## 3. Obiettivi della release 1.0.0

La release 1.0.0 introduce e consolida:

- gestione multi-store;
- creazione e modifica layout per singolo negozio;
- caricamento planimetria direttamente dalla sezione Admin;
- disegno visuale delle zone sulla planimetria;
- salvataggio del layout come combinazione di planimetria e zone;
- possibilità di mantenere più layout attivi per lo stesso negozio;
- dashboard amministrativa;
- catalogo articoli;
- consultazione delle associazioni articolo-zona;
- console diagnostica di sistema.

## 4. Architettura applicativa

Struttura logica del progetto:

```text
ZoneMind
│
├── api
│   ├── app
│   │   ├── __init__.py
│   │   ├── database.py
│   │   └── main.py
│   ├── data
│   │   └── zonemind.db
│   ├── requirements.txt
│   └── run_api.bat
│
├── public
│   ├── admin
│   │   ├── index.html
│   │   ├── admin.js
│   │   └── admin.css
│   └── assets
│
├── docs
├── mobile
├── releases
├── test
├── web
│
├── .gitignore
├── README.md
└── INSTALL.md
```

## 5. Componenti principali

### Backend API

Il backend è realizzato in Python con FastAPI.

Responsabilità principali:

- esposizione API applicative;
- inizializzazione database SQLite;
- gestione negozi;
- gestione catalogo articoli;
- gestione layout;
- gestione associazioni articolo-zona;
- diagnostica applicativa.

### Database

Il database applicativo è SQLite.

Percorso atteso:

```text
api/data/zonemind.db
```

Il database viene creato e aggiornato automaticamente dal backend all'avvio dell'applicazione.

Non cancellare il database durante gli aggiornamenti ordinari, salvo esplicita necessità di reset dell'ambiente.

### Admin Console

La console Admin è esposta da:

```text
public/admin/index.html
```

Funzionalità principali:

- dashboard operativa;
- selezione negozio;
- gestione catalogo;
- gestione layout;
- editor planimetria integrato;
- assignment explorer;
- system console.

## 6. Layout Editor

Il Layout Editor è la funzionalità centrale della release 1.0.0.

Workflow operativo:

```text
Selezione negozio
        ↓
Nuovo layout
        ↓
Caricamento planimetria
        ↓
Disegno zone
        ↓
Salvataggio layout
        ↓
Attivazione layout
```

Un layout rappresenta:

```text
Layout = Nome layout + Planimetria + Zone
```

Esempi di layout:

```text
Piano Terra
Piano Primo
Uomo
Donna
Bambino
Estate 2027
Inverno 2027
```

È possibile avere più layout attivi contemporaneamente per lo stesso negozio, ad esempio per gestire piani differenti o aree funzionali diverse.

## 7. Zone

Le zone sono identificate da codici progressivi generati dall'editor:

```text
A01
A02
A03
...
```

Le zone non hanno attributi descrittivi aggiuntivi nella release 1.0.0.

La loro interpretazione è visuale e dipende dal posizionamento sulla planimetria.

## 8. Gestione ambiente Python

La virtual environment Python non fa parte del progetto.

La cartella seguente non deve essere versionata, copiata tra macchine o sincronizzata tramite OneDrive:

```text
.venv
```

Ogni macchina deve avere il proprio ambiente Python locale.

Esempi:

```text
C:\PythonEnv\ZoneMind
D:\Applications\ZoneMind\.venv
```

Il codice del progetto può risiedere in OneDrive, mentre l'ambiente Python deve essere specifico della macchina che esegue l'applicazione.

## 9. OneDrive e Git

La cartella progetto può essere mantenuta in OneDrive for Business, ad esempio:

```text
OneDrive - BENETTON GROUP SRL\PROGETTI\STOREZONE\ZoneMind
```

Il repository Git rimane la fonte di verità per il versionamento del codice.

Branch principali:

```text
main
feature/mapper-v1
```

La release stabile 1.0.0 è consolidata su `main`.

Lo sviluppo successivo del Mapper prosegue su `feature/mapper-v1`.

## 10. File da non versionare

Verificare che `.gitignore` escluda almeno:

```gitignore
.venv/
venv/
env/
__pycache__/
*.pyc
*.pyo
.env
api/data/*.db
api/data/*.db-shm
api/data/*.db-wal
```

## 11. Roadmap

### 1.0.0 - Layout Editor

Stato: chiusa.

Funzionalità principali:

- Layout Editor integrato;
- gestione layout per negozio;
- multi-layout attivo;
- dashboard amministrativa;
- catalogo articoli;
- assignment explorer;
- system console.

### 1.1.0 - Mapper v1

Obiettivo:

```text
EAN
↓
Articolo
↓
Zona
```

Il Mapper dovrà utilizzare i layout attivi e il catalogo articoli per consentire la mappatura operativa degli articoli nelle zone del negozio.

## 12. Stato release

La release 1.0.0 può essere considerata baseline stabile del progetto ZoneMind.

Le attività successive devono essere sviluppate su branch dedicati e poi integrate su `main` solo dopo test funzionale.
