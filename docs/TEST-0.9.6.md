# Test Sprint 0.9.6

1. Avvia l'API e apri il Mapper con Ctrl+F5.
2. Verifica `Mapper 0.9.6` e `API 0.9.6`.
3. In Chrome DevTools > Application verifica Manifest e Service Worker attivo.
4. Ricarica una seconda volta online per consentire al Service Worker di controllare la pagina e memorizzare anche la libreria scanner.
5. Carica negozio e layout online.
6. Installa l'app dal pulsante `Installa app` o dal menu del browser.
7. Arresta l'API e riapri l'app: la shell e i dati già memorizzati devono essere disponibili.
8. Registra un EAN offline e verifica la coda.
9. Riavvia l'API, torna online e sincronizza.
10. Dopo una release successiva, verifica la comparsa dell'avviso `Aggiorna ora`.

Service Worker e installazione PWA funzionano su localhost oppure tramite HTTPS.
