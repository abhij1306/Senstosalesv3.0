# Deployment Guide

This document outlines how to deploy the SenstoSales application.

## 🚀 Quickest Method: Production EXE (Recommended)
This method builds a self-contained executable for easy sharing on the local network.

### 1. Build
Run the automated build script in PowerShell from the project root:
```powershell
./scripts/build_release.ps1
```
*(This process takes 3-5 minutes)*

### 2. Output
The final application is generated at:  
`dist/SenstoSales_v1.0`

### 3. Run
1. Open the `dist/SenstoSales_v1.0` folder.
2. Double-click **`launcher.bat`**.
3. A console window will open (do not close it), and the dashboard will launch in your browser.

👉 **See [EXE_BUILD_GUIDE.md](./EXE_BUILD_GUIDE.md) for detailed build architecture.**

- **Launcher**: One-click startup script.

👉 **See [EXE_BUILD_GUIDE.md](./EXE_BUILD_GUIDE.md) for detailed build internals.**

---

## Manual Development Setup

### Backend (Python 3.11+)
1.  **Venv**: `python -m venv venv`
2.  **Install**: `pip install -r requirements.txt`
3.  **Database**: `python reinit_db.py` (Resets DB) OR ensure `db/business.db` exists.
4.  **Run**: `python entry_point.py`

### Frontend (Node 20+)
1.  **Install**: `npm install`
2.  **Run**: `npm run dev`

### Environment Variables
**Backend** (`backend/.env`):
```env
DATABASE_URL=sqlite:///../db/business.db
ENV_MODE=dev
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```
