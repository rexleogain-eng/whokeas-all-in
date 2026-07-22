@echo off
setlocal
title WHOKEAS — Stay Open Installer
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0INSTALL-WHOKEAS-30-AND-PUBLISH.ps1"
