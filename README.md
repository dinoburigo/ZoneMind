# ZoneMind

## Vision

ZoneMind è una piattaforma che permette di trasformare la planimetria di un punto vendita in un gemello digitale (Digital Twin) del negozio.

L'obiettivo è collegare il layout fisico del negozio con:

- articoli esposti
- dati di vendita
- comportamento dei clienti
- analytics
- Business Intelligence

---

## Obiettivi

ZoneMind nasce per consentire:

- progettazione grafica delle aree espositive
- associazione articoli ↔ zone
- analisi del comportamento dei clienti
- integrazione con sistemi di BI (MicroStrategy)
- futura integrazione con sistemi di Computer Vision

---

## Componenti

### ZoneMind Web

- Layout Editor
- Zone Viewer
- Analytics
- Dashboard
- MicroStrategy Integration

### ZoneMind Mobile

- Selezione delle zone
- Scanner Barcode
- Associazione Articolo ↔ Zona
- Modalità offline

---

## Tecnologie

- HTML5
- CSS3
- JavaScript
- SVG
- JSON
- Progressive Web App (PWA)

---

## Stato del progetto

**Versione:** 0.2.0 - Continuous Mapping

### Completato

- Repository GitHub
- GitHub Pages
- Struttura del progetto
- Editor grafico delle zone
- Import / Export JSON
- Persistenza locale IndexedDB
- Prototipo mobile
- Scanner Barcode
- Scansione continua per zona
- Gestione anomalie EAN non riconosciuti
- Controllo articolo presente su zone differenti
- Interfaccia mobile ottimizzata

### In corso

- Gestione sessione di scansione
- Sincronizzazione dati con componente Web

### Prossimo obiettivo

Workflow completo:

Zona
↓

Scansione continua

↓

Associazione articoli

↓

Sincronizzazione

---

## Roadmap

- [x] Editor planimetria
- [x] Definizione zone
- [x] Export / Import JSON
- [x] Test scanner barcode
- [ ] Gestione proprietà delle zone
- [ ] Associazione articolo ↔ zona
- [ ] Viewer
- [ ] Analytics
- [ ] Computer Vision
- [ ] Dashboard BI