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

& (Join-Path $PSScriptRoot 'insertar-atlas-todo.ps1') -Pacientes 15000
