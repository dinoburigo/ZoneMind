# Decision Log

## DL-001

Le SKU ereditano la zona dell'articolo padre.

Motivazione

Ridurre drasticamente il numero di scansioni.

---

## DL-002

Lo scanner rimane aperto fino a quando l'operatore cambia zona.

Motivazione

Ottimizzare il lavoro in negozio.

---

## DL-003

Gli EAN non riconosciuti vengono registrati ma non interrompono il processo.

Motivazione

La qualità dell'anagrafica non deve bloccare l'operatività.

---

## DL-004

L'unico controllo bloccante è la presenza dello stesso articolo su zone differenti.

Motivazione

Garantire la coerenza della mappa espositiva.

---

## DL-005 - Progressive disclosure

ZoneMind deve mostrare solo le funzioni necessarie al contesto operativo.

La modalità semplice è quella predefinita.

Le funzionalità avanzate vengono abilitate tramite configurazione.

Motivazione:

Ridurre l'effort dello store, facilitare l'adozione e mantenere la soluzione scalabile per negozi più complessi.

---


---

## DL-006 - Editor minimale per default

ZoneMind deve consentire la definizione delle zone con il minor numero possibile di interazioni.

Il flusso standard prevede:

- apertura della planimetria;
- attivazione della modalità di disegno;
- trascinamento per creare una zona;
- assegnazione automatica del codice;
- prosecuzione immediata con la zona successiva.

Non sono previste, nella modalità semplice:

- descrizione obbligatoria;
- modifica del codice;
- ridimensionamento;
- pannello proprietà;
- poligoni;
- gestione multipiano.

La correzione di una zona avviene mediante eliminazione e ricreazione.

### Motivazione

La maggior parte dei negozi ha strutture semplici e risorse operative limitate. La velocità e l’intuitività hanno priorità rispetto alla ricchezza funzionale.

---

## DL-007 - Codice zona automatico

Il codice zona viene generato automaticamente secondo il formato:

```text
A01, A02, A03...