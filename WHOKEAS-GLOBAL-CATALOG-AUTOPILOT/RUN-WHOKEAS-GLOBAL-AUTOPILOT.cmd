@echo off
setlocal EnableExtensions
title WHOKEAS ALL IN - Global Catalogue Autopilot
color 0A

echo.
echo ============================================================
echo       WHOKEAS ALL IN - GLOBAL CATALOGUE AUTOPILOT
echo ============================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALL-WHOKEAS-GLOBAL-AUTOPILOT.ps1"
set "RESULT=%ERRORLEVEL%"

echo.
if not "%RESULT%"=="0" (
  color 0C
  echo INSTALLATION FAILED. Read the final error shown above.
) else (
  color 0A
  echo Installation and build verification completed.
)
echo.
pause
exit /b %RESULT%
