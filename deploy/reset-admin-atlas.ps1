# Restablece / crea el usuario admin en MongoDB Atlas (arregla login 401).
#
#   .\deploy\reset-admin-atlas.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
node .\scripts\seed-atlas-completo.mjs --pacientes 0
Pop-Location
Write-Host 'Admin actualizado. Prueba login con APP_BOOTSTRAP_ADMIN_USERNAME y APP_BOOTSTRAP_ADMIN_PASSWORD de .env' -ForegroundColor Green
