# SenstoSales Automated Build Script
# -----------------------------------------------------------------------------
# This script handles the complex orchestration of building Next.js Standalone
# and PyInstaller EXE, ensuring all assets (CSS, DB, Templates) are copied correctly.
# -----------------------------------------------------------------------------

Param(
    [string]$TargetDir
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting SenstoSales Build Process..." -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. CLEANUP
# -----------------------------------------------------------------------------
Write-Host "`n[1/5] Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "dist") {
    try {
        Remove-Item -Recurse -Force "dist" -ErrorAction Stop
    } catch {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        Write-Host "Warning: Could not delete 'dist' directory (files locked). Renaming to 'dist_old_$timestamp' and proceeding..." -ForegroundColor Cyan
        Move-Item "dist" "dist_old_$timestamp" -ErrorAction SilentlyContinue
    }
}
if (Test-Path "build") { Remove-Item -Recurse -Force "build" -ErrorAction SilentlyContinue }
if (Test-Path "frontend/.next") { Remove-Item -Recurse -Force "frontend/.next" }

# -----------------------------------------------------------------------------
# 2. FRONTEND BUILD (Next.js Standalone)
# -----------------------------------------------------------------------------
Write-Host "`n[2/5] Building Frontend (Next.js)..." -ForegroundColor Yellow
Push-Location frontend
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm ci
}
# Run build
cmd /c "npm run build"
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

# CRITICAL: Copy Static Assets for Standalone Mode
Write-Host "Copying static assets to standalone..." -ForegroundColor Cyan
$StandaloneDir = ".next/standalone"
$StaticDest = "$StandaloneDir/.next/static"
$PublicDest = "$StandaloneDir/public"

# Create destinations
New-Item -ItemType Directory -Force -Path $StaticDest | Out-Null

# Copy .next/static -> .next/standalone/.next/static (Fixes CSS/JS loading)
Copy-Item -Recurse -Force ".next/static/*" $StaticDest

# Copy public -> .next/standalone/public (Fixes Images/Fonts)
Copy-Item -Recurse -Force "public" $StandaloneDir

Pop-Location

# -----------------------------------------------------------------------------
# 3. BACKEND BUILD (PyInstaller)
# -----------------------------------------------------------------------------
Write-Host "`n[3/5] Building Backend (PyInstaller)..." -ForegroundColor Yellow

# Ensure DB seed exists
if (!(Test-Path "db/business.db")) {
    Write-Host "Creating fresh database seed..."
    # You might want to run a script here if db is missing, 
    # but we assume the dev environment has one.
    throw "db/business.db not found! Please run the app once to generate it."
}

# Run PyInstaller
pyinstaller --noconfirm --onedir --console --clean `
    --name "SenstoSales" `
    --distpath "dist/backend_dist" `
    --workpath "build" `
    --specpath "build" `
    --add-data "$PWD\backend\templates;backend\templates" `
    --add-data "$PWD\db\business.db;db" `
    --add-data "$PWD\migrations;migrations" `
    --hidden-import "uvicorn.logging" `
    --hidden-import "uvicorn.loops" `
    --hidden-import "uvicorn.loops.auto" `
    --hidden-import "uvicorn.protocols" `
    --hidden-import "uvicorn.protocols.http" `
    --hidden-import "uvicorn.protocols.http.auto" `
    --hidden-import "uvicorn.lifespan" `
    --hidden-import "uvicorn.lifespan.on" `
    --hidden-import "engineio.async_drivers.aiohttp" `
    --hidden-import "sqlite3" `
    --hidden-import "openpyxl" `
    --hidden-import "openpyxl.cell._writer" `
    --hidden-import "backend.services.excel_service" `
    --exclude-module "pandas" `
    --exclude-module "numpy" `
    --exclude-module "scipy" `
    --exclude-module "matplotlib" `
    --exclude-module "IPython" `
    --collect-all "certifi" `
    --collect-all "openpyxl" `
    backend/main.py

if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }

# Small sleep to let file handles settle after PyInstaller
Start-Sleep -Seconds 3

# -----------------------------------------------------------------------------
# 4. FINAL ASSEMBLY
# -----------------------------------------------------------------------------
Write-Host "`n[4/5] Assembling Distribution..." -ForegroundColor Yellow

$DistDir = if ($TargetDir) { $TargetDir } else { "dist/SenstoSales_v1.0" }

if (Test-Path $DistDir) {
    Write-Host "Cleaning existing dist directory at $DistDir..."
    Remove-Item -Recurse -Force $DistDir
}
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
$DistDir = (Resolve-Path $DistDir).Path

# Move Backend using robocopy (much more robust than Move-Item for locked files)
$backendSource = Join-Path (Get-Location) "dist/backend_dist/SenstoSales"
$backendDest = Join-Path $DistDir "backend"

Write-Host "Moving Backend via robocopy..."
# /MOVE: Move files and dirs (delete from source after copying)
# /E: Copy subdirectories, including empty ones
# /R:2: Retry 2 times on failed copies
# /W:5: Wait 5 seconds between retries
# /NFL /NDL /NJH /NJS: Suppress most output unless error
& robocopy $backendSource $backendDest /MOVE /E /R:3 /W:5 /NFL /NDL /NJH /NJS

# Robocopy exit codes 0-7 are success (with variations), 8+ are failure
if ($LASTEXITCODE -ge 8) {
    throw "Robocopy failed to move backend. Exit code: $LASTEXITCODE"
}

# Copy Frontend
Write-Host "Copying Frontend..."
$frontendSource = Join-Path (Get-Location) "frontend/.next/standalone/*"
$frontendDest = Join-Path $DistDir "frontend"
New-Item -ItemType Directory -Force -Path $frontendDest | Out-Null
Copy-Item -Recurse $frontendSource $frontendDest

# Create Launcher Script
$LauncherContent = @"
@echo off
setlocal enabledelayedexpansion

echo 🚀 Starting SenstoSales ERP...
echo -----------------------------------

:: 1. CLEANUP PORTS
echo [1/3] Cleaning up ports 3000 and 8000...
powershell -Command "Get-NetTCPConnection -LocalPort 3000,8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force"

:: 2. START BACKEND
echo [2/3] Starting Backend Engine...
if not exist "logs" mkdir logs
start /B "SenstoSales_Backend" "backend\SenstoSales.exe" > logs\startup.log 2>&1

:: 3. POLL FOR BACKEND LIVENESS
echo Waiting for backend to initialize...
set "retries=15"
:WAIT_LOOP
timeout /t 1 /nobreak >nul
netstat -ano | findstr :8000 >nul
if %ERRORLEVEL% equ 0 goto BACKEND_UP
set /a retries-=1
if %retries% leq 0 goto BACKEND_FAIL
echo .
goto WAIT_LOOP

:BACKEND_FAIL
echo.
echo ❌ ERROR: Backend failed to start within 15s.
echo Check logs\startup.log for details.
pause
exit /b 1

:BACKEND_UP
echo.
echo [3/3] Launching Interface...
start http://127.0.0.1:3000

echo Starting Web Server...
cd frontend
node server.js
"@
Set-Content -Path "$DistDir/launcher.bat" -Value $LauncherContent

# -----------------------------------------------------------------------------
# 5. VERIFICATION
# -----------------------------------------------------------------------------
Write-Host "`n[5/5] Build Complete!" -ForegroundColor Green
Write-Host "Output Location: $DistDir"
Write-Host "To run: Double-click $DistDir/launcher.bat"
