# Decision Log 0.8.1

## DL-011 - Componenti frontend condivisi
Le funzioni trasversali dell'Admin vengono estratte da `admin.js` e collocate in `public/assets/js/components`.

## DL-012 - Shell Admin stabile
Header, sidebar, navigazione e gestione responsive costituiscono la shell comune delle future pagine Admin.

## DL-013 - Refactoring senza modifica funzionale
Lo step 0.8.1 non modifica schema database o API. La priorità è ridurre duplicazioni e predisporre la crescita modulare.

## DL-014 - Navigazione incrementale
Le voci future sono già visibili ma disabilitate. Verranno abilitate una alla volta nei successivi micro-step dello Sprint 0.8.
