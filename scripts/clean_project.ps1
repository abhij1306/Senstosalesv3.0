
# clean_project.ps1
# Removes temporary build artifacts and caches

Write-Host "Cleaning up project..." -ForegroundColor Cyan

# 1. Remove __pycache__ recursively
Get-ChildItem -Path . -Include "__pycache__" -Recurse -Force | Remove-Item -Recurse -Force
Write-Host "Removed __pycache__ directories." -ForegroundColor Green

# 2. Remove .next cache (requires rebuild)
if (Test-Path "frontend/.next") {
    Remove-Item "frontend/.next" -Recurse -Force
    Write-Host "Removed .next build cache." -ForegroundColor Green
}

# 3. Remove backend tmp/scratch
if (Test-Path "backend/tmp") {
    Remove-Item "backend/tmp" -Recurse -Force
    Write-Host "Removed backend/tmp." -ForegroundColor Green
}

Write-Host "Cleanup Complete!" -ForegroundColor Cyan
