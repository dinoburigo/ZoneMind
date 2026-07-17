# Installazione Sprint 0.6

Copia il contenuto nella root `C:\Progetti\ZoneMind`.

Non sovrascrivere per ora `public/index.html`, `mapper.css`, `db.js` e `mapper.js`.

```bat
cd C:\Progetti\ZoneMind
python -m venv .venv
.venv\Scripts\activate
pip install -r api\requirements.txt
api\run_api.bat
```

Apri `http://localhost:8000/admin`, importa `public\data\articles-demo.csv`, poi verifica `http://localhost:8000/api/health`.
