# Troubleshooting Guide

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| **"Address already in use"** | Old process running | Run `.\stop.bat` (if created) or use Task Manager to kill `python.exe` / `node.exe`. |
| **"Database is read-only"** | Permissions or PyInstaller | Use the `reinit_db.py` script to reset, or check folder permissions. |
| **Frontend White Screen** | CSS missing | Copy `.next/static` to standalone folder (handled by build script). |

## Build Failures

### "Backend build failed"
- Check `dist/build/warn-SenstoSales.txt` for missing imports.
- Ensure `db/business.db` exists before building.

### "Frontend build failed"
- Run `npm run build` manually in `frontend/` to see the actual error message.
- Clear cache: `Remove-Item frontend/.next -Recurse -Force`.

## Logs
- **Backend Logs**: Run manually with `python entry_point.py` to see console output.
- **Frontend Logs**: Run `npm run dev` to see React errors.
