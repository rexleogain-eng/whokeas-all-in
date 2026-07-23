$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$project = Join-Path $HOME "Desktop\whokeas-all-in"
$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$patch = Join-Path $bundleRoot "patch"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$desktop = [Environment]::GetFolderPath("Desktop")
$backup = Join-Path $desktop "WHOKEAS-before-catalogue-expansion-$stamp"
$log = Join-Path $desktop "WHOKEAS-CATALOGUE-EXPANSION-$stamp.log"
$setupSource = Join-Path $bundleRoot "WHOKEAS-AUTOMATION-SETUP.txt"
$setupDestination = Join-Path $desktop "WHOKEAS-AUTOMATION-SETUP.txt"

function Run-Native {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    Write-Host ""
    Write-Host "> $Command $($Arguments -join ' ')" -ForegroundColor Cyan
    & $Command @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE"
    }
}

function Backup-RelativeFile {
    param([string]$RelativePath)

    $source = Join-Path $project $RelativePath
    if (-not (Test-Path -LiteralPath $source)) { return }

    $destination = Join-Path $backup $RelativePath
    $parent = Split-Path -Parent $destination
    if ($parent) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    Copy-Item -LiteralPath $source -Destination $destination -Force
}

function Ensure-EnvEntry {
    param(
        [string]$Name,
        [string]$Value
    )

    $envFile = Join-Path $project ".env.local"
    if (-not (Test-Path -LiteralPath $envFile)) {
        New-Item -ItemType File -Path $envFile -Force | Out-Null
    }

    $exists = Select-String -LiteralPath $envFile -Pattern "^\s*$([regex]::Escape($Name))\s*=" -Quiet
    if (-not $exists) {
        Add-Content -LiteralPath $envFile -Value "`r`n$Name=`"$Value`""
        Write-Host "Added local setting: $Name" -ForegroundColor DarkCyan
    }
}

try {
    Start-Transcript -LiteralPath $log -Force | Out-Null

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkYellow
    Write-Host " WHOKEAS — SAFE CATALOGUE EXPANSION" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor DarkYellow
    Write-Host ""

    if (-not (Test-Path -LiteralPath (Join-Path $project "package.json"))) {
        throw "Project not found at $project"
    }

    if (-not (Test-Path -LiteralPath (Join-Path $patch "src\lib\catalogue-expansion.ts"))) {
        throw "Patch files are missing. Extract the ZIP completely before running."
    }

    New-Item -ItemType Directory -Force -Path $backup | Out-Null

    $patchFiles = Get-ChildItem -LiteralPath $patch -Recurse -File
    foreach ($file in $patchFiles) {
        $relative = $file.FullName.Substring($patch.Length + 1)
        Backup-RelativeFile $relative
    }

    $obsoleteSeedFiles = @(
        "src\db\force-catalog.ts",
        "src\db\repair-catalog.ts",
        "src\db\seed.ts",
        "src\db\seed-variants.ts",
        "connect-neon-products.ps1",
        "deep-fix-product-pages.ps1",
        "repair-product-catalog.ps1",
        "seed-catalog-through-running-app.ps1"
    )

    foreach ($relative in $obsoleteSeedFiles) {
        Backup-RelativeFile $relative
    }

    Write-Host "Applying the safe catalogue queue and admin control page..." -ForegroundColor Yellow
    Copy-Item -Path (Join-Path $patch "*") -Destination $project -Recurse -Force

    Set-Location $project

    Run-Native npm "pkg" "set" "scripts.catalogue:expand:repair=tsx src/db/repair-catalogue-expansion.ts"
    Run-Native npm "pkg" "set" "scripts.catalogue:trials:clean=tsx src/db/cleanup-trial-products.ts"

    Ensure-EnvEntry "CJ_MIN_REQUEST_INTERVAL_MS" "1400"
    Ensure-EnvEntry "CJ_MAX_RETRIES" "4"
    Ensure-EnvEntry "CJ_DEFAULT_MARGIN_PERCENT" "30"

    Write-Host "Repairing the Neon queue schema..." -ForegroundColor Yellow
    Run-Native npm "run" "catalogue:expand:repair"

    Write-Host "Removing the original design-trial products..." -ForegroundColor Yellow
    Run-Native npm "run" "catalogue:trials:clean"

    Write-Host "Disabling old seed scripts so the trial catalogue cannot return..." -ForegroundColor Yellow
    foreach ($relative in $obsoleteSeedFiles) {
        $path = Join-Path $project $relative
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }

    if (Test-Path -LiteralPath $setupSource) {
        Copy-Item -LiteralPath $setupSource -Destination $setupDestination -Force
    }

    Write-Host "Clearing stale Next.js output..." -ForegroundColor Yellow
    Remove-Item -LiteralPath (Join-Path $project ".next") -Recurse -Force -ErrorAction SilentlyContinue

    Write-Host "Running production build verification..." -ForegroundColor Yellow
    Run-Native npm "run" "build"

    if (Test-Path -LiteralPath (Join-Path $project ".git")) {
        Write-Host "Publishing the verified catalogue expansion to GitHub..." -ForegroundColor Yellow
        Run-Native git "add" "."

        & git diff --cached --quiet
        $hasChanges = ($LASTEXITCODE -ne 0)

        if ($hasChanges) {
            Run-Native git "commit" "-m" "Add safe bulk catalogue expansion and remove trial products"
        } else {
            Write-Host "No new Git commit was required." -ForegroundColor DarkGray
        }

        Run-Native git "push" "origin" "main"
    } else {
        Write-Host "Git repository not detected; local build succeeded but automatic push was skipped." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " WHOKEAS SAFE CATALOGUE EXPANSION INSTALLED" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Trial products have been cleaned." -ForegroundColor Green
    Write-Host "The CJ queue is serialized and throttling-aware." -ForegroundColor Green
    Write-Host "The price policy remains approximately 30% gross margin." -ForegroundColor Green
    Write-Host ""
    Write-Host "Admin page: http://localhost:3000/admin/catalogue" -ForegroundColor Cyan
    Write-Host "Production: https://whokeas.store" -ForegroundColor Cyan
    Write-Host "Setup guide: $setupDestination" -ForegroundColor Cyan
    Write-Host "Backup: $backup" -ForegroundColor Cyan
    Write-Host "Log: $log" -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host " INSTALLATION STOPPED — THIS WINDOW WILL REMAIN OPEN" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Backup: $backup" -ForegroundColor Yellow
    Write-Host "Full log: $log" -ForegroundColor Yellow
}
finally {
    try { Stop-Transcript | Out-Null } catch {}
    Write-Host ""
    Read-Host "Press ENTER only after you have read or photographed the result"
}
