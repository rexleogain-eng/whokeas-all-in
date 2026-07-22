@echo off
setlocal EnableExtensions
title WHOKEAS ALL IN - Autopilot CJS Repair
color 0A

echo.
echo ============================================================
echo       WHOKEAS GLOBAL AUTOPILOT - CJS REPAIR
echo ============================================================
echo.

set "PROJECT=%USERPROFILE%\Desktop\whokeas-all-in"
set "TARGET=%PROJECT%\src\db\repair-catalog-automation.ts"
set "BACKUP=%PROJECT%\src\db\repair-catalog-automation.before-cjs-fix.ts"

if not exist "%PROJECT%\package.json" (
  color 0C
  echo ERROR: Project not found at:
  echo %PROJECT%
  echo.
  pause
  exit /b 1
)

if exist "%TARGET%" copy /Y "%TARGET%" "%BACKUP%" >nul

echo Replacing the incompatible top-level-await migration...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$b='aW1wb3J0IHsgY29uZmlnIH0gZnJvbSAiZG90ZW52IjsKCmNvbmZpZyh7IHBhdGg6ICIuZW52LmxvY2FsIiB9KTsKCmFzeW5jIGZ1bmN0aW9uIG1haW4oKSB7CiAgY29uc3QgewogICAgZW5zdXJlQ2F0YWxvZ0F1dG9tYXRpb25TY2hlbWEsCiAgICBnZXRBdXRvbWF0aW9uRGFzaGJvYXJkRGF0YSwKICB9ID0gYXdhaXQgaW1wb3J0KCJAL2xpYi9jYXRhbG9nLWF1dG9tYXRpb24iKTsKICBjb25zdCB7IHN5bmNGeFJhdGVzIH0gPSBhd2FpdCBpbXBvcnQoIkAvbGliL2dsb2JhbC1tYXJrZXRzIik7CgogIGF3YWl0IGVuc3VyZUNhdGFsb2dBdXRvbWF0aW9uU2NoZW1hKCk7CgogIGxldCBmeFN0YXR1czogdW5rbm93biA9ICJjYWNoZWQvZmFsbGJhY2siOwogIHRyeSB7CiAgICBmeFN0YXR1cyA9IGF3YWl0IHN5bmNGeFJhdGVzKHsgZm9yY2U6IHRydWUgfSk7CiAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIGZ4U3RhdHVzID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpOwogIH0KCiAgY29uc3QgZGF0YSA9IGF3YWl0IGdldEF1dG9tYXRpb25EYXNoYm9hcmREYXRhKCk7CgogIGNvbnNvbGUubG9nKCJXSE9LRUFTIGdsb2JhbCBjYXRhbG9ndWUgYXV0b21hdGlvbiBzY2hlbWEgaXMgcmVhZHkuIik7CiAgY29uc29sZS5sb2coewogICAgZW5hYmxlZDogZGF0YS5jb25maWcuZW5hYmxlZCwKICAgIGF1dG9QdWJsaXNoOiBkYXRhLmNvbmZpZy5hdXRvUHVibGlzaCwKICAgIGNhdGVnb3J5UnVsZXM6IGRhdGEuY29uZmlnLmNhdGVnb3J5UnVsZXMubGVuZ3RoLAogICAgZW5hYmxlZE1hcmtldHM6IGRhdGEuY29uZmlnLm1hcmtldHMuZmlsdGVyKChtYXJrZXQpID0+IG1hcmtldC5lbmFibGVkKS5sZW5ndGgsCiAgICBwcmltYXJ5TWFya2V0OiBkYXRhLmNvbmZpZy5tYXJrZXRzLmZpbmQoKG1hcmtldCkgPT4gbWFya2V0LnByaW1hcnkpPy5uYW1lLAogICAgY2pQcm9kdWN0czogZGF0YS5zdGF0cy5jalByb2R1Y3RzLAogICAgZnhTdGF0dXMsCiAgfSk7Cn0KCm1haW4oKS5jYXRjaCgoZXJyb3IpID0+IHsKICBjb25zb2xlLmVycm9yKCJXSE9LRUFTIGF1dG9tYXRpb24gc2NoZW1hIHJlcGFpciBmYWlsZWQ6IiwgZXJyb3IpOwogIHByb2Nlc3MuZXhpdENvZGUgPSAxOwp9KTsK'; [IO.File]::WriteAllBytes('%TARGET%', [Convert]::FromBase64String($b))"
if errorlevel 1 (
  color 0C
  echo ERROR: Could not write the repaired migration file.
  pause
  exit /b 1
)

cd /d "%PROJECT%"

echo.
echo Running the Neon automation migration...
call npm run automation:repair
if errorlevel 1 (
  color 0C
  echo.
  echo MIGRATION FAILED. The CJS/top-level-await problem is fixed,
  echo but Neon returned a different error above.
  echo.
  pause
  exit /b 1
)

if exist ".next" rmdir /S /Q ".next"

echo.
echo Running production build verification...
call npm run build
if errorlevel 1 (
  color 0C
  echo.
  echo BUILD FAILED. Review the final error above.
  echo Backup file:
  echo %BACKUP%
  echo.
  pause
  exit /b 1
)

color 0A
echo.
echo ============================================================
echo   WHOKEAS GLOBAL AUTOPILOT REPAIR COMPLETED SUCCESSFULLY
echo ============================================================
echo.
echo The Node.js CJS top-level-await failure has been removed.
echo Next: npm run dev
echo Open: http://localhost:3000/admin/automation
echo.
pause
