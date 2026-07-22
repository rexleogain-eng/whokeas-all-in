$ErrorActionPreference = "Stop"

$project = Join-Path $HOME "Desktop\whokeas-all-in"
$patch = Join-Path $PSScriptRoot "patch"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path ([Environment]::GetFolderPath("Desktop")) "WHOKEAS-before-global-autopilot-$timestamp"
$vercelNote = Join-Path ([Environment]::GetFolderPath("Desktop")) "WHOKEAS-ADD-TO-VERCEL.txt"

if (-not (Test-Path (Join-Path $project "package.json"))) {
  throw "WHOKEAS project was not found at $project"
}

if (-not (Test-Path (Join-Path $patch "src\lib\global-markets.ts"))) {
  throw "The patch folder is incomplete. Extract the entire ZIP before running the installer."
}

Write-Host "Creating a safety backup..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force $backup | Out-Null

Get-ChildItem -LiteralPath $patch -Recurse -File | ForEach-Object {
  $relative = $_.FullName.Substring($patch.Length).TrimStart('\')
  $source = Join-Path $project $relative
  if (Test-Path -LiteralPath $source) {
    $destination = Join-Path $backup $relative
    $parent = Split-Path -Parent $destination
    if ($parent) { New-Item -ItemType Directory -Force $parent | Out-Null }
    Copy-Item -LiteralPath $source -Destination $destination -Force
  }
}

Write-Host "Installing the global catalogue engine..." -ForegroundColor Cyan
Get-ChildItem -LiteralPath $patch -Recurse -File | ForEach-Object {
  $relative = $_.FullName.Substring($patch.Length).TrimStart('\')
  $destination = Join-Path $project $relative
  $parent = Split-Path -Parent $destination
  if ($parent) { New-Item -ItemType Directory -Force $parent | Out-Null }
  Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
}

$envPath = Join-Path $project ".env.local"
if (-not (Test-Path $envPath)) {
  New-Item -ItemType File -Path $envPath -Force | Out-Null
}

$envText = Get-Content -LiteralPath $envPath -Raw -ErrorAction SilentlyContinue
if ($null -eq $envText) { $envText = "" }

$cronMatch = [regex]::Match(
  $envText,
  '(?m)^\s*CRON_SECRET\s*=\s*["'']?([^"''\r\n]+)'
)

if ($cronMatch.Success) {
  $cronSecret = $cronMatch.Groups[1].Value.Trim()
} else {
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $cronSecret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  if ($envText.Length -gt 0 -and -not $envText.EndsWith("`n")) { $envText += "`r`n" }
  $envText += "CRON_SECRET=`"$cronSecret`"`r`n"
}

if ($envText -notmatch '(?m)^\s*FX_API_URL\s*=') {
  if ($envText.Length -gt 0 -and -not $envText.EndsWith("`n")) { $envText += "`r`n" }
  $envText += "FX_API_URL=`"https://open.er-api.com/v6/latest/USD`"`r`n"
}

[System.IO.File]::WriteAllText(
  $envPath,
  $envText,
  [System.Text.UTF8Encoding]::new($false)
)

$note = @"
WHOKEAS GLOBAL AUTOPILOT — VERCEL VARIABLES

Add these under Vercel > Project > Settings > Environment Variables:

CRON_SECRET=$cronSecret
FX_API_URL=https://open.er-api.com/v6/latest/USD

Also confirm these existing variables are present:
DATABASE_URL
ADMIN_SECRET
CJ_API_KEY

After adding them, redeploy the project.
"@

[System.IO.File]::WriteAllText(
  $vercelNote,
  $note,
  [System.Text.UTF8Encoding]::new($false)
)

Set-Location $project

Write-Host "Preparing Neon tables and international price records..." -ForegroundColor Cyan
npm run automation:repair
if ($LASTEXITCODE -ne 0) {
  throw "The Neon automation migration failed. Review the error above."
}

Write-Host "Clearing the old Next.js cache..." -ForegroundColor Cyan
Remove-Item -LiteralPath (Join-Path $project ".next") -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Running production build verification..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  throw "The production build failed. Your previous files are backed up at $backup"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " WHOKEAS GLOBAL CATALOGUE AUTOPILOT INSTALLED SUCCESSFULLY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backup: $backup" -ForegroundColor DarkCyan
Write-Host "Vercel variables note: $vercelNote" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "Next run:" -ForegroundColor Yellow
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Open:" -ForegroundColor Yellow
Write-Host "  http://localhost:3000/admin/automation" -ForegroundColor White
Write-Host "  http://localhost:3000/admin/products" -ForegroundColor White
Write-Host "  http://localhost:3000/admin/cj" -ForegroundColor White
