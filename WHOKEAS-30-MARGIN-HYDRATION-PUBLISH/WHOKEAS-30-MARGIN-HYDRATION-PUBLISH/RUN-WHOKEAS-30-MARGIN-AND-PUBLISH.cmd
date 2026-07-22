@echo off
setlocal EnableExtensions
set "TITLE=WHOKEAS ALL IN - Hydration Fix, 30 Percent Margin and Publish"
title %TITLE%
color 0A

set "PROJECT=%USERPROFILE%\Desktop\whokeas-all-in"
set "PATCH=%~dp0patch"
set "STAMP=%RANDOM%-%RANDOM%"
set "BACKUP=%USERPROFILE%\Desktop\WHOKEAS-before-30-margin-%STAMP%"

echo.
echo ============================================================
echo   WHOKEAS ADMIN FIX + 30%% GROSS MARGIN + PRODUCTION PUSH
echo ============================================================
echo.
echo IMPORTANT: Stop npm run dev with Ctrl+C before continuing.
echo.

if not exist "%PROJECT%\package.json" (
  color 0C
  echo ERROR: Project not found at:
  echo %PROJECT%
  goto :FAIL
)

if not exist "%PATCH%\src\components\admin\ProductControlLoader.tsx" (
  color 0C
  echo ERROR: Patch files are missing.
  echo Extract the complete ZIP first, then run this CMD from the extracted folder.
  goto :FAIL
)

mkdir "%BACKUP%" >nul 2>&1

echo [1/7] Creating a safety backup...
for %%F in (
  "package.json"
  "src\app\admin\products\page.tsx"
  "src\components\admin\ProductControlLoader.tsx"
  "src\components\admin\ProductControlClient.tsx"
  "src\components\admin\AutomationControlClient.tsx"
  "src\components\admin\CJConnectorClient.tsx"
  "src\lib\automation-config.ts"
  "src\db\apply-fixed-30-margin.ts"
) do (
  if exist "%PROJECT%\%%~F" (
    for %%D in ("%BACKUP%\%%~F") do mkdir "%%~dpD" >nul 2>&1
    copy /Y "%PROJECT%\%%~F" "%BACKUP%\%%~F" >nul
  )
)

echo [2/7] Applying the hydration and pricing repair...
robocopy "%PATCH%" "%PROJECT%" /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  color 0C
  echo ERROR: Patch files could not be copied.
  goto :FAIL
)

cd /d "%PROJECT%"

echo [3/7] Applying 30%% gross-margin pricing and publishing eligible products...
call npm run pricing:30
if errorlevel 1 (
  color 0C
  echo ERROR: Neon pricing or publication migration failed.
  goto :FAIL
)

echo [4/7] Removing stale Next.js and Turbopack output...
if exist ".next" rmdir /S /Q ".next"

echo [5/7] Running the production build...
call npm run build
if errorlevel 1 (
  color 0C
  echo ERROR: Production build failed. Nothing will be pushed.
  goto :FAIL
)

echo [6/7] Creating the Git commit...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  color 0E
  echo WARNING: Local fix succeeded, but this folder is not a Git repository.
  goto :LOCAL_SUCCESS
)

git add package.json ^
  src/app/admin/products/page.tsx ^
  src/components/admin/ProductControlLoader.tsx ^
  src/components/admin/ProductControlClient.tsx ^
  src/components/admin/AutomationControlClient.tsx ^
  src/components/admin/CJConnectorClient.tsx ^
  src/lib/automation-config.ts ^
  src/db/apply-fixed-30-margin.ts

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Fix admin hydration and enforce 30 percent gross margin"
  if errorlevel 1 (
    color 0C
    echo ERROR: Git commit failed. Check your Git name and email configuration.
    goto :FAIL
  )
) else (
  echo No new source changes needed; continuing to push the current branch.
)

echo [7/7] Pushing to GitHub main...
git push origin HEAD:main
if errorlevel 1 (
  color 0E
  echo.
  echo LOCAL FIX COMPLETED, BUT GITHUB PUSH FAILED.
  echo The build is valid and the database was repriced.
  echo Review the Git error above, then run: git push origin HEAD:main
  goto :LOCAL_SUCCESS
)

echo.
echo ============================================================
echo   WHOKEAS FIXED, REPRICED AND PUSHED SUCCESSFULLY
 echo ============================================================
echo.
echo GitHub received the production source.
echo A connected Vercel project should now create a deployment.
echo.
echo Check:
echo   https://whokeas.store
echo   http://localhost:3000/admin/products
echo   http://localhost:3000/admin/automation
echo.
echo Backup created at:
echo   %BACKUP%
echo.
pause
exit /b 0

:LOCAL_SUCCESS
echo.
echo ============================================================
echo   LOCAL REPAIR COMPLETED SUCCESSFULLY
 echo ============================================================
echo.
echo Backup created at:
echo   %BACKUP%
echo.
echo Start locally with:
echo   cd /d "%PROJECT%"
echo   npm run dev
echo.
pause
exit /b 0

:FAIL
echo.
echo ============================================================
echo   INSTALLATION STOPPED - THE WINDOW WILL REMAIN OPEN
 echo ============================================================
echo.
echo Backup folder:
echo   %BACKUP%
echo.
echo Read the final error above and send a screenshot of it.
echo.
pause
exit /b 1
