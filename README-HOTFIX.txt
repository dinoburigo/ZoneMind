ZoneMind 0.9.5.1 Hotfix

Problema corretto:
- il Mapper restava su "Connessione..." e "Caricamento..."
- la funzione openDb() era stata omessa dal file mapper.js della release 0.9.5
- l'inizializzazione JavaScript si interrompeva prima delle chiamate API

Installazione:
1. Sostituire soltanto public/assets/js/mapper.js
2. Riavviare l'API
3. Premere Ctrl+F5 nel browser

Comportamento atteso:
- compare il badge API
- il menu negozi viene popolato
- IndexedDB apre correttamente meta, workspaces e operations
