@echo off
echo ==========================================
echo   WarehouseAI — Python AI Service
echo ==========================================
echo.
cd /d "%~dp0"
echo Checking Python...
python --version
echo.
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Starting FastAPI server on http://localhost:8000
echo Press Ctrl+C to stop.
echo.
uvicorn main:app --reload --port 8000 --host 0.0.0.0
