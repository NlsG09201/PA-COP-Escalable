# Carga sedes + admin + 15.000 pacientes en MongoDB Atlas.
#
#   .\deploy\cargar-atlas-completo.ps1
#
# Requiere en .env: MONGODB_PASSWORD (o MONGODB_URL Atlas) y APP_BOOTSTRAP_ADMIN_* .
# Atlas -> Network Access -> 0.0.0.0/0 Active antes de ejecutar.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path (Join-Path $root '.env'))) {
  Write-Error 'Falta .env en la raíz del repo.'
}

Write-Host '=== Carga completa a MongoDB Atlas ===' -ForegroundColor Cyan
Write-Host '  - Organización COP'
Write-Host '  - Sedes Colombia (catálogo)'
Write-Host '  - Usuario admin (APP_BOOTSTRAP_*)'
Write-Host '  - 15.000 pacientes'
Write-Host ''

Push-Location $root
try {
  if (-not (Test-Path 'node_modules/mongodb')) {
    Write-Host 'Instalando dependencia mongodb...' -ForegroundColor Yellow
    npm install mongodb --no-save 2>&1 | Out-Null
  }
  node .\scripts\seed-atlas-completo.mjs --pacientes 15000
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'Comprueba en Atlas -> Browse Collections -> cop' -ForegroundColor Green
Write-Host '  sites (~36), users (admin), patients (~15000)'
