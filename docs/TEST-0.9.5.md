# Test Sprint 0.9.5

1. Caricare online un negozio e attivare `Simula offline`.
2. Registrare un articolo in una nuova zona e verificare `1 in coda`.
3. Tornare online e premere `Sincronizza ora`: la coda deve tornare a zero.
4. Creare un conflitto: offline spostare un articolo da A01 ad A02; da un'altra sessione online spostarlo in A03.
5. Tornare online e sincronizzare. Deve comparire il dialogo con zona server A03 e zona offline A02.
6. Scegliere `Mantieni zona server`: l'articolo deve restare in A03.
7. Ripetere il conflitto e scegliere `Applica spostamento offline`: l'articolo deve finire in A02.
8. Re-inviare la stessa operazione (test tecnico): il backend non deve duplicare lo storico.
