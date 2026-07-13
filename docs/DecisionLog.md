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

## DL-006 - L'Editor privilegia la velocità rispetto alla precisione

La creazione delle zone deve richiedere il minor numero possibile di interazioni.

Le zone sono rettangolari.

Non è previsto il ridimensionamento.

La modifica avviene eliminando e ricreando la zona.

Motivazione

La definizione del layout è un'attività occasionale.

Ridurre la complessità dell'interfaccia aumenta la velocità di utilizzo e riduce il tempo di formazione.