@echo off
setlocal
title WHOKEAS ALL IN - Safe Catalogue Expansion
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0INSTALL-WHOKEAS-SAFE-CATALOGUE-EXPANSION.ps1"
