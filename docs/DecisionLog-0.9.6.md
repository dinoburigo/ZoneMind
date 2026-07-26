# Decision Log 0.9.6 — PWA e consolidamento Mapper

## DL-023 — Il Mapper è una Progressive Web App
Manifest e Service Worker rendono disponibile la shell applicativa senza rete e consentono l'installazione sul dispositivo.

## DL-024 — Cache separata dai dati
Il Service Worker conserva solo shell e asset statici. Catalogo, layout, associazioni e coda restano in IndexedDB.

## DL-025 — Aggiornamento controllato
Una nuova versione viene applicata dopo conferma dell'utente, evitando aggiornamenti durante una sessione di scansione.

## DL-026 — Compatibilità scanner offline progressiva
La libreria scanner CDN viene memorizzata dal Service Worker dopo un caricamento controllato. L'inserimento manuale resta sempre disponibile.
