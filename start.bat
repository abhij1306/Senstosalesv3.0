@echo off
echo Starting SenstoSales ERP...

echo Cleaning up ports 3000 and 8000...
powershell -Command "Get-NetTCPConnection -LocalPort 3000,8000 -ErrorAction SilentlyContinue | ForEach-Object { if ($_.OwningProcess) { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"

echo.
echo [1/2] Starting Backend Server...
start "Backend" cmd /k "cd /d "%~dp0" && python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

echo.
echo [2/2] Starting Frontend Server...
start "Frontend" cmd /k "cd /d "%~dp0\frontend" && npm run dev"

echo.
echo ✅ Both servers starting...
echo 📱 Frontend: http://127.0.0.1:3000
echo 🔧 Backend:  http://127.0.0.1:8000
echo.
pause