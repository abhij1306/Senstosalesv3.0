# SenstoSales - Server Management Guide

Use these commands in **PowerShell** to manage your application.

## 🚀 Start Everything
Run these two commands in separate terminal tabs/windows:

### 1. Start Backend (API)
```powershell
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
*Wait ~5 seconds for "Application startup complete".*

### 2. Start Frontend (UI)
```powershell
cd frontend
npm run dev
```
*Wait ~15 seconds, then open [http://localhost:3000](http://localhost:3000)*

---

## 🛑 Stop Everything
To kill all running servers instantly (useful if they get stuck):

```powershell
# Kill processes on Port 3000 (Frontend) and 8000 (Backend)
Get-NetTCPConnection -LocalPort 3000,8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force
```

---

## 🛠 Troubleshooting

### Check if servers are running
```powershell
Get-NetTCPConnection -LocalPort 3000,8000 -ErrorAction SilentlyContinue
```
*   **3000**: Frontend
*   **8000**: Backend
*   **If empty**: Servers are down.

### "Address already in use" Error
If you see this error, it means a "zombie" process is holding the port. Run the **Stop Everything** command above to clear it.

---

### Verify PO Parser (Item Extraction)
Useful when item counts are wrong or duplicates appear.
```powershell
python -m backend.debug_po_4645266
```

### Run Bulk Parser Validation
Tests the parser against a sample of 50 random PO files to check for crashes or anomalies.
```powershell
python -m backend.test_bulk_pos
```

## 🔄 System Maintenance

### Format Code
Fix formatting issues in backend code.
```powershell
ruff check backend --fix
```

### Reset Database
**WARNING:** This deletes all data and re-creates the tables.
```powershell
# Stop the server first (Ctrl+C)
python reinit_db.py
.\start.bat # Start server again
```

## ⚡ PowerShell Cheat Sheet for Developers

### 💀 Process Management (Kill Commands)
Force kill servers if `Ctrl+C` doesn't work.
```powershell
# Kill ALL Node.js processes (Frontend)
taskkill /F /IM node.exe /T

# Kill ALL Python processes (Backend)
taskkill /F /IM python.exe /T

# Check what is running on ports 3000 and 8000
Get-NetTCPConnection -LocalPort 3000,8000 -ErrorAction SilentlyContinue
```

### 📂 File System Operations
```powershell
# Reset Database (Correct Way)
python reinit_db.py

# Delete Backend Cache (__pycache__)
Get-ChildItem -Path backend -Recurse -Filter "__pycache__" | Remove-Item -Recurse -Force

# Delete Frontend Cache (.next)
Remove-Item frontend/.next -Recurse -Force

# Count lines of code in backend
(Get-ChildItem -Path backend -Recurse -Filter "*.py" | Get-Content | Measure-Object -Line).Lines
```

### 🐍 Backend Development
```powershell
# Run backend server manually (Reload enabled)
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Run specific debug script (e.g., checking a specific PO file)
python -m backend.debug_po_4645266

# Run Bulk Test Script
python -m backend.test_bulk_pos

# Install dependencies
pip install -r requirements.txt
```

### ⚛️ Frontend Development
```powershell
# Install dependencies
cd frontend; npm install

# Run frontend server
cd frontend; npm run dev

# Run Linter (Fix auto-fixable issues)
cd frontend; npm run lint -- --fix

# Build for Production (Automated EXE + Frontend)
cd ..
./scripts/build_release.ps1
```

### 🔍 Search & Find
```powershell
# Find a file by name
Get-ChildItem -Path . -Recurse -Filter "filename.ext"

# Find text string inside files
Get-ChildItem -Path src -Recurse | Select-String -Pattern "search_term"
```
