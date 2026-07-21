@echo off
setlocal EnableExtensions
title WHOKEAS ALL IN - Classic Visual Correction
color 0A

echo.
echo ============================================================
echo       WHOKEAS ALL IN - CLASSIC VISUAL CORRECTION
echo ============================================================
echo.

set "PROJECT=%USERPROFILE%\Desktop\whokeas-all-in"
set "PATCH=%~dp0patch"
set "BACKUP=%USERPROFILE%\Desktop\WHOKEAS-before-visual-fix-%RANDOM%"

if not exist "%PROJECT%\package.json" (
  color 0C
  echo ERROR: Project not found:
  echo %PROJECT%
  echo.
  pause
  exit /b 1
)

if not exist "%PATCH%\src\app\page.tsx" (
  color 0C
  echo ERROR: The patch folder is missing.
  echo Extract the complete ZIP before running this file.
  echo.
  pause
  exit /b 1
)

echo Creating a safety backup...
mkdir "%BACKUP%\src\app" >nul 2>&1
mkdir "%BACKUP%\src\components\store" >nul 2>&1

copy /Y "%PROJECT%\src\app\globals.css" "%BACKUP%\src\app\globals.css" >nul
copy /Y "%PROJECT%\src\app\page.tsx" "%BACKUP%\src\app\page.tsx" >nul
copy /Y "%PROJECT%\src\components\store\StoreHeader.tsx" "%BACKUP%\src\components\store\StoreHeader.tsx" >nul

echo Applying corrected logo, button contrast and anchor spacing...
robocopy "%PATCH%" "%PROJECT%" /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  color 0C
  echo ERROR: The corrected files could not be copied.
  echo.
  pause
  exit /b 1
)

cd /d "%PROJECT%"

if exist ".next" rmdir /S /Q ".next"

echo Running production build verification...
call npm run build
if errorlevel 1 (
  color 0C
  echo.
  echo BUILD FAILED.
  echo Your original three files were backed up here:
  echo %BACKUP%
  echo.
  pause
  exit /b 1
)

color 0A
echo.
echo ============================================================
echo   WHOKEAS CLASSIC VISUAL FIX INSTALLED SUCCESSFULLY
echo ============================================================
echo.
echo Corrected:
echo   - Stronger high-contrast logo presentation
echo   - Visible gold primary button text
echo   - Visible white secondary button text
echo   - Sticky-header anchor spacing
echo   - Products and support sections no longer hide behind header
echo.
echo Backup:
echo %BACKUP%
echo.
echo Next:
echo   cd "%PROJECT%"
echo   npm run dev
echo.
pause
