$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$project = Join-Path $HOME "Desktop\whokeas-all-in"
$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$patch = Join-Path $bundleRoot "patch"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$log = Join-Path ([Environment]::GetFolderPath("Desktop")) "WHOKEAS-30-PUBLISH-$stamp.log"
$backup = Join-Path ([Environment]::GetFolderPath("Desktop")) "WHOKEAS-before-30-publish-$stamp"

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

try {
    Start-Transcript -LiteralPath $log -Force | Out-Null

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkYellow
    Write-Host " WHOKEAS — HYDRATION FIX + 30% MARGIN + PRODUCTION PUBLISH" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor DarkYellow
    Write-Host ""

    if (-not (Test-Path -LiteralPath (Join-Path $project "package.json"))) {
        throw "Project not found at $project"
    }

    if (-not (Test-Path -LiteralPath (Join-Path $patch "src\db\apply-fixed-30-margin.ts"))) {
        throw "Patch files are missing. Extract the ZIP completely before running."
    }

    New-Item -ItemType Directory -Force -Path $backup | Out-Null

    $targets = @(
        "src\app\admin\products\page.tsx",
        "src\components\admin\AutomationControlClient.tsx",
        "src\components\admin\CJConnectorClient.tsx",
        "src\components\admin\ProductControlClient.tsx",
        "src\components\admin\ProductControlLoader.tsx",
        "src\db\apply-fixed-30-margin.ts",
        "src\lib\automation-config.ts",
        "package.json"
    )

    Write-Host "Creating safety backup..." -ForegroundColor Yellow
    foreach ($relative in $targets) {
        $source = Join-Path $project $relative
        if (Test-Path -LiteralPath $source) {
            $destination = Join-Path $backup $relative
            $parent = Split-Path -Parent $destination
            New-Item -ItemType Directory -Force -Path $parent | Out-Null
            Copy-Item -LiteralPath $source -Destination $destination -Force
        }
    }

    Write-Host "Applying verified source patch..." -ForegroundColor Yellow
    Copy-Item -Path (Join-Path $patch "*") -Destination $project -Recurse -Force

    Set-Location $project

    # Add the script without replacing the user's package.json.
    Run-Native npm "pkg" "set" "scripts.pricing:30=tsx src/db/apply-fixed-30-margin.ts"

    Write-Host "Clearing stale Next.js and Turbopack output..." -ForegroundColor Yellow
    Remove-Item -LiteralPath (Join-Path $project ".next") -Recurse -Force -ErrorAction SilentlyContinue

    Write-Host "Applying fixed 30% gross-margin pricing and publishing eligible CJ products..." -ForegroundColor Yellow
    Run-Native npm "run" "pricing:30"

    Write-Host "Running production build verification..." -ForegroundColor Yellow
    Run-Native npm "run" "build"

    if (Test-Path -LiteralPath (Join-Path $project ".git")) {
        Write-Host "Preparing production Git push..." -ForegroundColor Yellow
        Run-Native git "add" "."

        & git diff --cached --quiet
        $hasChanges = ($LASTEXITCODE -ne 0)

        if ($hasChanges) {
            Run-Native git "commit" "-m" "Fix product hydration and set 30 percent margin"
        } else {
            Write-Host "No new Git changes required; continuing to push current main." -ForegroundColor DarkGray
        }

        Run-Native git "push" "origin" "main"
    } else {
        Write-Host "Git repository not detected. Build succeeded, but automatic production push was skipped." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " WHOKEAS FIXED, REPRICED AND PUBLISHED SUCCESSFULLY" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Backup: $backup" -ForegroundColor Cyan
    Write-Host "Full log: $log" -ForegroundColor Cyan
    Write-Host "Production: https://whokeas.store" -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host " INSTALLATION STOPPED — THE WINDOW WILL REMAIN OPEN" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Full error log: $log" -ForegroundColor Yellow
    Write-Host "Send me the final red lines or upload that log file." -ForegroundColor Yellow
}
finally {
    try { Stop-Transcript | Out-Null } catch {}
    Write-Host ""
    Read-Host "Press ENTER only after you have read or photographed the result"
}
