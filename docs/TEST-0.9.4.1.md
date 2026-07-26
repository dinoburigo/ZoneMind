# Test hotfix 0.9.4.1

1. Avviare ZoneMind con API disponibile.
2. Caricare un negozio: il banner giallo non deve essere visibile.
3. Premere **Simula offline**: il badge deve diventare `Offline simulato` e il banner deve comparire.
4. Registrare un EAN valido: l’operazione deve finire nella coda locale.
5. Premere **Torna online**: il Mapper deve ricontrollare l’API e tentare la sincronizzazione.
6. Verificare che il badge mostri la versione reale restituita dal backend.

La simulazione vale solo per la scheda del browser corrente (sessionStorage).
