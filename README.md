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

### Stato del progetto

**Versione corrente:** 0.3.0 - Minimal Zone Editor

### Completato

- Repository GitHub e GitHub Pages
- Struttura del progetto
- Mapper mobile
- Scanner barcode
- Scansione continua per zona
- Persistenza locale con IndexedDB
- Gestione EAN non riconosciuti
- Controllo articolo presente su zone differenti
- Editor minimale delle zone
- Codifica automatica A01, A02, A03...
- Creazione continua delle zone
- Selezione ed eliminazione zona
- Import / Export layout JSON
- Planimetria incorporata nel JSON di prototipo

### In corso

- Allineamento del JSON tra Editor e Mapper
- Configurazione modalità semplice / avanzata
- Consolidamento del modello dati

### Prossimo obiettivo

Utilizzare nel Mapper mobile il layout generato direttamente dall’Editor.

---

## Roadmap

- [x] Editor planimetria
- [x] Definizione zone
- [x] Import / Export JSON
- [x] Scanner barcode
- [x] Associazione articolo ↔ zona
- [x] Scansione continua
- [x] Editor minimale con codifica automatica
- [ ] Integrazione Editor → Mapper
- [ ] Gestione configurazione semplice / avanzata
- [ ] Sincronizzazione backend
- [ ] Viewer e Analytics
- [ ] Integrazione MicroStrategy
- [ ] Computer Vision