@echo off
cd /d "%~dp0.."
python -m uvicorn api.app.main_sqlite_dwh:app --host 0.0.0.0 --port 8000 --reload
pause
