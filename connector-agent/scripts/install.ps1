<#
.SYNOPSIS
  Tally Connect Desktop Agent PowerShell Installer
#>

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  TALLY CONNECT DESKTOP AGENT SETUP WIZARD (Windows)" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptDir
Set-Location $BaseDir

$SetupExe = Join-Path $BaseDir "dist\TallyConnectAgentSetup.exe"

if (Test-Path $SetupExe) {
    Write-Host "Launching Standalone Setup Wizard..." -ForegroundColor Green
    & $SetupExe --install
} else {
    Write-Host "Launching Setup Script via Node..." -ForegroundColor Yellow
    node "src\index.js" --install
}

Write-Host ""
Write-Host "Installation completed. Check logs\agent.log for live telemetry." -ForegroundColor Green
