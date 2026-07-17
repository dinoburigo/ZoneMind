@echo off
cd /d "%~dp0.."
python -m uvicorn api.app.main:app --host 0.0.0.0 --port 8000 --reload
pause
