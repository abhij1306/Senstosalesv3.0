---
name: Project Cleanup
description: Clear cache, temp, test artifacts, and build files to maintain a clean project workspace
---

# Project Cleanup Skill

This skill provides commands to clean up project artifacts, cache files, temporary files, and test outputs across different project types.

## Usage

When the user requests a project cleanup, execute the appropriate commands based on the detected project type.

---

## Detection

First, detect the project type by checking for these files in the project root:
- `package.json` → Node.js/Frontend project
- `pyproject.toml` or `requirements.txt` → Python project
- `Cargo.toml` → Rust project
- `go.mod` → Go project

---

## Cleanup Commands

### Node.js / Frontend Projects

```powershell
# Remove node_modules (optional - ask user first as reinstall takes time)
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# Remove build/dist directories
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue

# Remove cache directories
Remove-Item -Recurse -Force .cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .turbo -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .parcel-cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .vite -ErrorAction SilentlyContinue

# Remove test/coverage outputs
Remove-Item -Recurse -Force coverage -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .nyc_output -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force playwright-report -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force test-results -ErrorAction SilentlyContinue

# Remove TypeScript build info
Remove-Item -Force *.tsbuildinfo -ErrorAction SilentlyContinue
Remove-Item -Force tsconfig.tsbuildinfo -ErrorAction SilentlyContinue

# Remove lock files (optional - ask user first)
# Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

# Remove ESLint cache
Remove-Item -Force .eslintcache -ErrorAction SilentlyContinue
```

### Python Projects

```powershell
# Remove __pycache__ directories recursively
Get-ChildItem -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force

# Remove .pyc and .pyo files
Get-ChildItem -Recurse -Include *.pyc, *.pyo | Remove-Item -Force

# Remove virtual environments (optional - ask user first)
Remove-Item -Recurse -Force venv -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .venv -ErrorAction SilentlyContinue

# Remove build directories
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force *.egg-info -ErrorAction SilentlyContinue

# Remove cache directories
Remove-Item -Recurse -Force .pytest_cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .mypy_cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .ruff_cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .tox -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .nox -ErrorAction SilentlyContinue

# Remove coverage outputs
Remove-Item -Recurse -Force htmlcov -ErrorAction SilentlyContinue
Remove-Item -Force .coverage -ErrorAction SilentlyContinue
Remove-Item -Force coverage.xml -ErrorAction SilentlyContinue

# Remove PyInstaller artifacts
Remove-Item -Recurse -Force __pyinstaller -ErrorAction SilentlyContinue
```

### Rust Projects

```powershell
# Remove target directory (build artifacts)
Remove-Item -Recurse -Force target -ErrorAction SilentlyContinue

# Remove Cargo.lock (optional - ask for libraries)
# Remove-Item -Force Cargo.lock -ErrorAction SilentlyContinue
```

### Go Projects

```powershell
# Clean Go build cache
go clean -cache

# Remove vendor directory (if using vendoring)
Remove-Item -Recurse -Force vendor -ErrorAction SilentlyContinue
```

### Universal Cleanup (All Projects)

```powershell
# Remove common temp/editor files
Remove-Item -Recurse -Force .DS_Store -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force Thumbs.db -ErrorAction SilentlyContinue
Get-ChildItem -Recurse -Include *.swp, *.swo, *~ | Remove-Item -Force -ErrorAction SilentlyContinue

# Remove IDE cache
Remove-Item -Recurse -Force .idea -ErrorAction SilentlyContinue  # Optional - may have project settings
Remove-Item -Recurse -Force .vscode\*.log -ErrorAction SilentlyContinue

# Remove temp directories
Remove-Item -Recurse -Force tmp -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force temp -ErrorAction SilentlyContinue

# Remove log files
Get-ChildItem -Recurse -Include *.log | Where-Object { $_.DirectoryName -notlike "*node_modules*" } | Remove-Item -Force -ErrorAction SilentlyContinue

# Remove audit/lint output files (if not in version control)
Remove-Item -Force *-violations.json -ErrorAction SilentlyContinue
Remove-Item -Force *-violations.txt -ErrorAction SilentlyContinue
Remove-Item -Force audit-report-*.md -ErrorAction SilentlyContinue
```

---

## Cleanup Levels

Offer the user three cleanup levels:

| Level | Description | What Gets Deleted |
|-------|-------------|-------------------|
| **Light** | Quick cache cleanup | Cache dirs, temp files, logs |
| **Standard** | Full build cleanup | Above + build/dist, test outputs |
| **Deep** | Complete reset | Above + node_modules/venv (requires reinstall) |

---

## Important Notes

1. **Always ask before deleting**:
   - `node_modules` or `venv` (requires dependency reinstall)
   - Lock files (`package-lock.json`, `Cargo.lock`)
   - IDE directories (`.idea`, `.vscode`)

2. **Check for uncommitted changes** before cleanup:
   ```powershell
   git status --porcelain
   ```

3. **Preserve important files**:
   - Never delete `.git` directory
   - Never delete `.env` files without explicit confirmation
   - Never delete database files (`*.db`, `*.sqlite`)

4. **Report cleanup results**:
   - Show disk space freed if possible
   - List what was deleted
