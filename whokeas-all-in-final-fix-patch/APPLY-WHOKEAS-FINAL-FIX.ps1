$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) {
  throw "Open PowerShell inside C:\Users\Hp\Desktop\whokeas-all-in and run this script again."
}

Write-Host "Repairing the WHOKEAS Neon catalogue..." -ForegroundColor Cyan
npm run catalog:repair

Write-Host "Clearing the old Next.js cache..." -ForegroundColor Cyan
Remove-Item -Recurse -Force ".\.next" -ErrorAction SilentlyContinue

Write-Host "Running the production build check..." -ForegroundColor Cyan
npm run build

Write-Host "" 
Write-Host "WHOKEAS FINAL FIX INSTALLED SUCCESSFULLY." -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Yellow
Write-Host "Then test these pages:" -ForegroundColor Yellow
Write-Host "http://localhost:3000/api/admin/catalog-health" -ForegroundColor Cyan
Write-Host "http://localhost:3000/admin/cj" -ForegroundColor Cyan
Write-Host "http://localhost:3000/admin/products" -ForegroundColor Cyan
Write-Host "http://localhost:3000" -ForegroundColor Cyan
