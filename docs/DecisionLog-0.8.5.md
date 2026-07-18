# Decision Log 0.8.5

## DL-014 - Versionamento layout
Ogni pubblicazione conserva le versioni precedenti. Per ciascun negozio può esistere un solo layout attivo.

## DL-015 - Riattivazione non distruttiva
Una versione storica può essere riattivata senza cancellare dati. Le associazioni restano riferite al relativo layoutId.

## DL-016 - JSON come formato canonico
Il JSON esportato dall Editor rimane il formato canonico di scambio e può essere riscaricato dall Admin.
