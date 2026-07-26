# Test Sprint 0.9.3 – Smart Relocation

1. Avviare l’API e aprire il Mapper con `Ctrl+F5`.
2. Associare un articolo alla zona A01.
3. Uscire dalla scansione e selezionare A02.
4. Leggere nuovamente lo stesso EAN.
5. Verificare la finestra con articolo, A01 come origine e A02 come destinazione.
6. Premere **Annulla** e verificare che l’articolo resti in A01.
7. Ripetere la scansione e premere **Sposta articolo**.
8. Verificare il messaggio `A01 → A02`, il conteggio aggiornato e la permanenza nella modalità scansione.
9. Controllare nell’Assignment Explorer che l’articolo risulti soltanto in A02.
10. Controllare nel database che `article_movement_log` contenga una riga con origine, destinazione, operatore ed EAN.

## Test di sicurezza

Con due sessioni aperte, modificare l’articolo dalla prima e confermare dalla seconda: la seconda deve ricevere HTTP 409 e ricaricare le associazioni, senza creare duplicati.
