# Opcion B: arreglar login solo con Render (sin Mongo local)
#
#   .\deploy\opcion-b-render.ps1
#
# Requiere haber importado deploy\render-upload.env en Render y hecho Manual Deploy.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $PSScriptRoot 'render-upload.env'

Write-Host '=== Opcion B: Admin en Render ===' -ForegroundColor Cyan
Write-Host ''
Write-Host 'PASO 1 — Render Dashboard' -ForegroundColor Yellow
Write-Host '  Servicio: pa-cop-escalable (API Nest)'
Write-Host '  Environment -> Import / pegar variables de:'
Write-Host "  $envFile"
Write-Host '  Comprueba especialmente:'
Write-Host '    APP_BOOTSTRAP_ADMIN_USERNAME=nelsonherazoi'
Write-Host '    APP_BOOTSTRAP_ADMIN_PASSWORD=Nelson09092001'
Write-Host '    APP_BOOTSTRAP_ADMIN_RESET=true'
Write-Host '    SETUP_ADMIN_SECRET=cop-atlas-setup-2026'
Write-Host '    MONGODB_PASSWORD=Nelson09092001'
Write-Host '  Save Changes -> Manual Deploy (espera Live)'
Write-Host ''
$ok = Read-Host '¿Ya hiciste Manual Deploy y el servicio esta Live? (s/n)'
if ($ok -notmatch '^s') {
  Write-Host 'Vuelve a ejecutar este script cuando Render este Live.' -ForegroundColor Yellow
  exit 0
}

Write-Host ''
Write-Host 'PASO 2 — Crear/resetear admin en la API' -ForegroundColor Yellow
& (Join-Path $PSScriptRoot 'crear-admin-render.ps1')
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'PASO 3 — Login en Vercel' -ForegroundColor Green
Write-Host '  https://pa-cop-escalable-2qx1.vercel.app'
Write-Host '  Usuario: nelsonherazoi'
Write-Host '  Contrasena: Nelson09092001'
Write-Host '  Sede: elige cualquiera del listado'
