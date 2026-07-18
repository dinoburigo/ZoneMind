# Test ZoneMind 0.8.3

1. Avviare `api\run_api.bat` e verificare `/api/health`: versione 0.8.3.
2. Aprire `/admin/` e selezionare **Negozi** dal menu.
3. Creare `STORE002`, indicando nome, città e paese.
4. Verificare la presenza del nuovo negozio nella tabella e nel selettore Dashboard.
5. Selezionare la riga, modificare nome/città e salvare.
6. Disattivare il negozio: deve restare nell'anagrafica ma sparire dal selettore operativo.
7. Riattivarlo e verificare che ricompaia nel selettore.
8. Verificare che cataloghi, layout e associazioni esistenti non siano alterati.
