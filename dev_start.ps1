# Start both servers for LOCAL DEVELOPMENT
# ----------------------------------------

# 1. Start Backend (New Window) - Running from Root
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m uvicorn backend.main:app --reload --port 8000"

# 2. Start Frontend (New Window)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "Local Development Environment Started!" -ForegroundColor Green
Write-Host "Backend: http://localhost:8000"
Write-Host "Frontend: http://localhost:3000"
