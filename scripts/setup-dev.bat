@echo off
echo ===================================================
echo   Chosen Motion - Local Development Setup Script
echo ===================================================

:: Ensure scripts directory doesn't mess with paths
cd %~dp0\..

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python 3.12.
    exit /b 1
)

:: Check if Node is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH. Please install Node.js.
    exit /b 1
)

echo.
echo [1/4] Setting up Backend Virtual Environment...
if not exist "backend\.venv" (
    python -m venv backend\.venv
    echo Virtual environment created at backend\.venv
) else (
    echo Virtual environment already exists. Skipping creation.
)

echo.
echo [2/4] Installing Backend Dependencies...
call backend\.venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
call deactivate

echo.
echo [3/4] Installing Frontend Dependencies...
cd frontend
call npm install
cd ..

echo.
echo [4/4] Setting up environment templates...
if not exist "backend\.env" (
    copy backend\.env.example backend\.env
    echo Created backend\.env from example. Please update it with Supabase credentials.
)
if not exist "frontend\.env" (
    copy frontend\.env.example frontend\.env
    echo Created frontend\.env from example. Please update it with Supabase credentials.
)

echo.
echo ===================================================
echo Setup complete!
echo Next: Run start-dev.bat to boot both servers.
echo ===================================================
pause
