# Decision Log 0.9.0

## DL-020 – Mapper online-first
Lo Sprint 0.9.0 realizza il flusso end-to-end online. Cache offline, coda e sincronizzazione differita sono rinviate agli sprint 0.9.1/0.9.2.

## DL-021 – Conflitto non distruttivo
Se un articolo è già associato a un'altra zona dello stesso layout, il Mapper blocca la scansione e non sposta automaticamente l'articolo.

## DL-022 – Una scansione identifica l'articolo
L'EAN serve a risalire all'articolo; l'associazione ufficiale è articolo-zona. Varianti dello stesso articolo non producono associazioni duplicate.
