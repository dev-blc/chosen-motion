@echo off
echo ===================================================
echo   Chosen Motion - Local Development Runner
echo ===================================================

cd %~dp0\..

:: Verify backend virtual environment
if not exist "backend\.venv" (
    echo [ERROR] Virtual environment not found. Please run scripts\setup-dev.bat first.
    pause
    exit /b 1
)

:: Verify node modules
if not exist "frontend\node_modules" (
    echo [ERROR] Frontend dependencies not found. Please run scripts\setup-dev.bat first.
    pause
    exit /b 1
)

echo Starting Backend Service (FastAPI) in a separate window...
start "Chosen Motion - Backend" cmd /k "cd backend && .venv\Scripts\activate.bat && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting Frontend Service (Vite) in a separate window...
start "Chosen Motion - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting...
echo - Backend will run at: http://localhost:8000 (Swagger Docs at http://localhost:8000/docs)
echo - Frontend will run at: http://localhost:5173 (standard Vite)
echo.
echo Close the individual cmd windows to stop the servers.
echo ===================================================
pause
