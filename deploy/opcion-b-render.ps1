# Guía de operación para bootstrap del admin en Render.
# Los secretos se configuran en Render y se solicitan de forma segura al ejecutar el script.

$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot 'render-upload.env'

Write-Host '=== Bootstrap de admin en Render ===' -ForegroundColor Cyan
Write-Host ''
Write-Host '1. En Render, configura desde tu gestor seguro:' -ForegroundColor Yellow
Write-Host "   Archivo de variables: $envFile"
Write-Host '   APP_BOOTSTRAP_ADMIN_USERNAME, APP_BOOTSTRAP_ADMIN_PASSWORD y SETUP_ADMIN_SECRET'
Write-Host '   No pegues los valores en el chat ni los guardes en scripts.'
Write-Host '2. Guarda los cambios y espera a que el servicio quede Live.'
Write-Host ''
$ok = Read-Host '¿El servicio ya está Live? (s/n)'
if ($ok -notmatch '^s') {
  Write-Host 'Ejecuta de nuevo este script después del despliegue.' -ForegroundColor Yellow
  exit 0
}

Write-Host ''
Write-Host '3. Ejecuta la verificación interactiva del bootstrap y el login.' -ForegroundColor Yellow
& (Join-Path $PSScriptRoot 'crear-admin-render.ps1')
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Abre el panel e inicia sesión con la cuenta configurada en Render.' -ForegroundColor Green
