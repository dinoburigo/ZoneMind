# Test Sprint 0.9.0 – Mapper Foundation

1. Avviare `api/run_api.bat` e aprire `http://localhost:8000/`.
2. Selezionare un negozio con catalogo e layout attivo.
3. Verificare caricamento di layout, zone, conteggi e associazioni esistenti.
4. Toccare una zona e autorizzare la fotocamera.
5. Scansionare un EAN presente nel catalogo: deve comparire conferma verde.
6. Verificare nell'Admin > Associazioni la nuova riga.
7. Scansionare lo stesso articolo nella stessa zona: nessun duplicato.
8. Scansionare lo stesso articolo in altra zona: errore, nessuno spostamento.
9. Inserire un EAN sconosciuto nel campo manuale: anomalia incrementata.
10. Chiudere lo scanner e verificare conteggi e attività recente.

Nota: su smartphone la fotocamera richiede HTTPS; `localhost` è ammesso per test sul PC.
