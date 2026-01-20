# SenstoSales EXE Build Guide

## Overview

**Architecture**: Two-process application  
- **Backend**: FastAPI Python server → PyInstaller EXE  
- **Frontend**: Next.js React app → Standalone Node server  
- **Launcher**: Batch script that starts both processes

**Build Tool**: `build_release.ps1` (automated)  
**Output**: `dist/SenstoSales_v1.0/` (~200MB distributable)

---

## Quick Start

```powershell
.\build_release.ps1
```

Then double-click `dist/SenstoSales_v1.0/launcher.bat` to run.

---

## Distribution Folder Structure

```
SenstoSales_v1.0/
├── backend/
│   ├── SenstoSales.exe       # PyInstaller EXE (36MB)
│   ├── _internal/            # Python dependencies
│   └── db/
│       └── business.db       # SQLite database
├── frontend/
│   ├── server.js             # Next.js standalone server
│   ├── package.json
│   ├── .next/                # Compiled Next.js
│   ├── public/               # Static assets (images, fonts)
│   └── node_modules/         # Node dependencies
├── launcher.bat              # Double-click to run
└── README.txt                # User instructions
```

---

## Prerequisites

1. **Python 3.11+** with PyInstaller: `pip install pyinstaller`
2. **Node.js 18+** with npm
3. **Database seed**: `db/business.db` must exist (run dev server once)

---

## Build Process (Automated)

The `build_release.ps1` script handles:

1. **Cleanup** - Removes previous `dist/`, `build/`, `.next/`
2. **Frontend Build** - `npm run build` + copies static assets
3. **Backend Build** - PyInstaller with hidden imports
4. **Assembly** - Combines into `dist/SenstoSales_v1.0/`

---

## Database Persistence & Robustness

When running as an EXE, SenstoSales uses a **Persistence Move** strategy to ensure your data is safe and writable:

1. **Seed Database**: A template database is bundled inside the EXE (`_MEIPASS/db/business.db`).
2. **Persistence Check**: On startup, the app checks if a `db/business.db` exists in the **same folder as the EXE**.
3. **Initialization**: If not found, it copies the Seed Database to the external folder.
4. **Permissions**: The app automatically sets `0o666` (read/write) permissions on the external database to prevent "Database is read-only" errors common with PyInstaller.

> [!IMPORTANT]
> Never delete the `db` folder next to your EXE unless you want to reset the application data.

5. **Native Folder Picker**: The app uses a PowerShell-based folder picker instead of `tkinter` to ensure maximum compatibility in the frozen environment without requiring heavy UI library bundling.

---

## Critical Configuration: LAN & Multi-Machine Access

**Problem**: Hardcoding `127.0.0.1` or `localhost` prevents the application from being accessed by other machines on the local network (LAN).

**Solution**: Use dynamic host binding and relative API paths.

1. **Backend (`main.py`)**:
   Bind to `0.0.0.0` to listen on all network interfaces.
   ```python
   if is_frozen:
       uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
   ```

2. **Frontend API (`lib/api.ts`)**:
   Set `API_BASE_URL` to an empty string to use relative paths. For client-side uploads that must hit port 8000 directly, use `window.location.hostname`.
   ```typescript
   export const API_BASE_URL = "";
   
   // For uploads:
   const baseUrl = typeof window !== "undefined" 
     ? `${window.location.protocol}//${window.location.hostname}:8000` 
     : "http://127.0.0.1:8000";
   ```

3. **Next Config (`next.config.ts`)**:
   Keep rewrites pointing to `127.0.0.1:8000` as the Node server and Python backend are colocated on the same host.
   ```typescript
   destination: `http://127.0.0.1:8000/api/:path*`,
   ```

4. **Launcher Script**:
   Use `0.0.0.0` in the launcher or simply start the local URL.
   ```batch
   start http://127.0.0.1:3000
   ```

---

## Launcher Script

`launcher.bat` (Auto-generated):
```batch
@echo off
echo Starting SenstoSales...
start /B backend\SenstoSales.exe
timeout /t 2 /nobreak >nul
start http://127.0.0.1:3000
cd frontend
node server.js
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED ::1:8000` | IPv6/IPv4 mismatch | App now uses `127.0.0.1` internally to bypass this. |
| **Connection Timed Out** (Remote) | Firewall blocking port | Allow `SenstoSales.exe` (port 8000) and `node.exe` (port 3000) in Windows Firewall. |
| **Frontend Build Failed** | TypeScript Errors | Run `npm run build` manually to see errors. |
| CSS/Styles Missing | Static assets not copied | Script must copy `.next/static` to `.next/standalone/.next/static` |
| **Excel Export Fails** | Missing `openpyxl` | Ensure `openpyxl` is in `--hidden-import` or `--collect-all` in PyInstaller. |
| PyInstaller "Module not found" | Hidden imports | Add `--hidden-import` and `--collect-all` for large packages (playwright, openpyxl) |

---

## Manual Build Commands

### Frontend
```bash
cd frontend
npm run build
# Copy static assets manually if not using script
```

### Backend
```bash
pyinstaller --noconfirm --onedir --console --clean ^
    --name "SenstoSales" ^
    --distpath "dist/backend_dist" ^
    --workpath "build" ^
    --specpath "build" ^
    --paths "scripts\automations" ^
    --add-data "backend\templates;backend\templates" ^
    --add-data "scripts\automations;scripts\automations" ^
    --add-data "db\business.db;db" ^
    --hidden-import "uvicorn.logging" ^
    --hidden-import "uvicorn.loops" ^
    --hidden-import "uvicorn.loops.auto" ^
    --collect-all "playwright" ^
    backend/main.py
```
