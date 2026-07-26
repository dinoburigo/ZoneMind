# Decision Log 0.9.3 – Smart Relocation

## DL-020 – Trasferimento dalla scansione

Quando il Mapper legge un EAN il cui articolo è già associato a una zona diversa, non modifica automaticamente l’associazione. Mostra la zona attuale e quella corrente e richiede una conferma esplicita.

Alla conferma, il backend aggiorna l’associazione e registra il trasferimento nella tabella `article_movement_log` all’interno della stessa transazione. In caso di concorrenza o errore, l’operazione viene annullata integralmente.

L’Admin Console resta in sola lettura rispetto alle associazioni operative.
