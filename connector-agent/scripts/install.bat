@echo off
setlocal
title Tally Connect Agent Setup

echo ==============================================================
echo   TALLY CONNECT DESKTOP AGENT INSTALLER
echo ==============================================================
echo.

cd /d "%~dp0\.."

if exist "dist\TallyConnectAgentSetup.exe" (
  echo Launching Standalone Setup Wizard...
  "dist\TallyConnectAgentSetup.exe" --install
) else (
  echo Launching Setup Script...
  node src\index.js --install
)

echo.
pause
