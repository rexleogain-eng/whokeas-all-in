@echo off
setlocal EnableExtensions
chcp 65001 >nul
title WHOKEAS ALL IN - Classic Admin Suite
color 0A

echo.
echo ============================================================
echo        WHOKEAS ALL IN - CLASSIC ADMIN SUITE
echo ============================================================
echo.

set "PROJECT=%USERPROFILE%\Desktop\whokeas-all-in"
set "PATCH=%~dp0patch"
set "STAMP=%DATE:/=-%_%TIME::=-%"
set "STAMP=%STAMP: =0%"
set "BACKUP=%USERPROFILE%\Desktop\WHOKEAS-admin-backup-%RANDOM%"

if not exist "%PROJECT%\package.json" (
  color 0C
  echo ERROR: Project not found at:
  echo %PROJECT%
  echo.
  pause
  exit /b 1
)

if not exist "%PATCH%\src\components\admin\AdminShell.tsx" (
  color 0C
  echo ERROR: Patch files are missing.
  echo Extract the complete ZIP before running this installer.
  echo.
  pause
  exit /b 1
)

echo [1/4] Creating a safety backup...
mkdir "%BACKUP%\src\app\admin\login" >nul 2>&1
mkdir "%BACKUP%\src\app\admin\orders" >nul 2>&1
mkdir "%BACKUP%\src\app\admin\products" >nul 2>&1
mkdir "%BACKUP%\src\app\admin\cj" >nul 2>&1
mkdir "%BACKUP%\src\components\admin" >nul 2>&1

for %%F in (
  "src\app\admin\page.tsx"
  "src\app\admin\login\page.tsx"
  "src\app\admin\orders\page.tsx"
  "src\app\admin\products\page.tsx"
  "src\app\admin\cj\page.tsx"
  "src\components\admin\AdminShell.tsx"
  "src\components\admin\AdminLoginForm.tsx"
  "src\components\admin\OrderActions.tsx"
  "src\components\admin\ProductControlClient.tsx"
  "src\components\admin\CJConnectorClient.tsx"
) do (
  if exist "%PROJECT%\%%~F" (
    for %%D in ("%BACKUP%\%%~dpF") do mkdir "%%~D" >nul 2>&1
    copy /Y "%PROJECT%\%%~F" "%BACKUP%\%%~F" >nul
  )
)

echo Backup created:
echo %BACKUP%
echo.

echo [2/4] Installing the classic administration design...
robocopy "%PATCH%" "%PROJECT%" /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  color 0C
  echo ERROR: Files could not be copied into the project.
  echo.
  pause
  exit /b 1
)

cd /d "%PROJECT%"

echo [3/4] Clearing the old Next.js cache...
if exist ".next" rmdir /S /Q ".next"

echo [4/4] Running production build verification...
call npm run build
if errorlevel 1 (
  color 0C
  echo.
  echo BUILD FAILED.
  echo Your previous admin files are backed up here:
  echo %BACKUP%
  echo.
  pause
  exit /b 1
)

color 0A
echo.
echo ============================================================
echo   WHOKEAS CLASSIC ADMIN SUITE INSTALLED SUCCESSFULLY
echo ============================================================
echo.
echo Included:
echo   - New executive admin overview at /admin
echo   - Classic management sidebar and mobile navigation
echo   - Refined order verification workspace
echo   - Searchable and filterable product control centre
echo   - Premium CJ sourcing and landed-cost interface
echo   - Secure split-screen administrator login
echo   - Improved status, profit and workflow visibility
echo.
echo Next:
echo   cd "%PROJECT%"
echo   npm run dev
echo.
echo Open:
echo   http://localhost:3000/admin
echo.
pause
