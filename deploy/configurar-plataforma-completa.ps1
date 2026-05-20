# Punto de entrada: prepara archivos locales y configura Render (si hay API key).
#
#   1. Rellena .env en la raiz (Mongo, Redis, JWT, URLs Render)
#   2. Descomenta RENDER_API_KEY=rnd_... en .env
#   3. .\deploy\configurar-plataforma-completa.ps1
#
# Sin API key: genera render-upload.env + Base64 para pegar en el dashboard.

param(
  [string]$ApiKey = $env:RENDER_API_KEY,
  [switch]$SoloGenerarArchivos
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

Write-Host '=== COP - configurar plataforma ==='
Write-Host ''

function Ensure-EnvLine([string]$Key, [string]$DefaultValue) {
  if (-not (Test-Path $envFile)) { return }
  $exists = Get-Content $envFile | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" -and $_ -notmatch '^\s*#' }
  if ($exists) { return }
  Add-Content -Path $envFile -Value "$Key=$DefaultValue"
  Write-Host "  + .env: $Key"
}

if (Test-Path $envFile) {
  Ensure-EnvLine 'AI_RELAPSE_URL' 'https://cop-recommendation-engine.onrender.com'
  Ensure-EnvLine 'NEXT_PUBLIC_API_URL' 'https://cop-nest-api.onrender.com'
  Ensure-EnvLine 'PUBLIC_API_ORIGIN' 'https://cop-nest-api.onrender.com'
  Ensure-EnvLine 'DASHBOARD_URL' 'https://cop-web-dashboard.onrender.com'
  Ensure-EnvLine 'PUBLIC_SITE_URL' 'https://cop-web-public.onrender.com'
  Ensure-EnvLine 'VERCEL_PUBLIC_WEB_URL' 'https://pa-cop-escalable-2qx1.vercel.app'
  Ensure-EnvLine 'CORS_ALLOW_VERCEL' 'true'
  Ensure-EnvLine 'CORS_ORIGINS' 'https://pa-cop-escalable-2qx1.vercel.app,https://cop-web-public.onrender.com,https://cop-web-dashboard.onrender.com'
  Ensure-EnvLine 'J48_URL' 'https://cop-j48-python.onrender.com'
}

Write-Host '[1/4] Generando deploy/render-upload.env ...'
& (Join-Path $PSScriptRoot 'generar-render-upload-env.ps1')

Write-Host ''
Write-Host '[2/4] Base64 para COP_PRODUCTION_ENV_B64 ...'
& (Join-Path $PSScriptRoot 'exportar-cop-production-env-b64.ps1')

if ($SoloGenerarArchivos) {
  Write-Host ''
  Write-Host 'Modo solo archivos. Siguiente paso: deploy/RENDER-CHECKLIST.md'
  exit 0
}

if (-not $ApiKey) {
  $line = Get-Content $envFile -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*RENDER_API_KEY\s*=' -and $_ -notmatch '^\s*#' } | Select-Object -First 1
  if ($line) { $ApiKey = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'") }
}

if (-not $ApiKey) {
  Write-Host ''
  Write-Host '--- Sin RENDER_API_KEY: configuracion manual ---'
  Write-Host 'Opcion A: En .env anade RENDER_API_KEY=rnd_... y vuelve a ejecutar este script.'
  Write-Host 'Opcion B: Render - cop-nest-api - Environment:'
  Write-Host '  - Pega variable COP_PRODUCTION_ENV_B64 (portapapeles)'
  Write-Host '  - O Secret File cop-production.env = deploy/render-upload.env'
  Write-Host '  - Borra REDIS_URL si dice your-instance.upstash.io'
  Write-Host '  - Fronts: NEXT_PUBLIC_API_URL=https://cop-nest-api.onrender.com'
  Write-Host '  - Manual Deploy'
  Write-Host ''
  Write-Host 'Ver: deploy/RENDER-CHECKLIST.md'
  exit 0
}

Write-Host ''
Write-Host '[3/4] Aplicando configuracion via Render API ...'
$env:RENDER_API_KEY = $ApiKey
& (Join-Path $PSScriptRoot 'render-configurar-todo.ps1')

Write-Host ''
Write-Host '[4/4] Dashboard local (opcional) ...'
$dashEnv = Join-Path $root 'web-dashboard\.env.local'
if (-not (Test-Path $dashEnv)) {
  $api = 'https://cop-nest-api.onrender.com'
  if (Test-Path $envFile) {
    $m = Get-Content $envFile | Where-Object { $_ -match '^\s*NEXT_PUBLIC_API_URL\s*=' -and $_ -notmatch '^\s*#' } | Select-Object -First 1
    if ($m) { $api = ($m -split '=', 2)[1].Trim() }
  }
  $lines = @(
    '# Generado por configurar-plataforma-completa.ps1',
    "NEXT_PUBLIC_API_URL=$api"
  )
  $lines | Set-Content -Path $dashEnv -Encoding UTF8
  Write-Host '  Creado web-dashboard/.env.local'
}

Write-Host ''
Write-Host '=== Fin ==='
