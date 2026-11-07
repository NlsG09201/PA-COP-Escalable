# Despliegue al 100%: genera env, configura Render (API) y despliega servicios COP.
# Uso: .\deploy\render-desplegar-100.ps1

param([string]$ApiKey = $env:RENDER_API_KEY)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

Write-Host '=== COP despliegue 100% ===' -ForegroundColor Cyan

& (Join-Path $PSScriptRoot 'generar-render-upload-env.ps1')
& (Join-Path $PSScriptRoot 'exportar-cop-production-env-b64.ps1') | Out-Null

if (-not $ApiKey) {
  $line = Get-Content $envFile -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*RENDER_API_KEY\s*=' -and $_ -notmatch '^\s*#' } | Select-Object -First 1
  if ($line) { $ApiKey = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'") }
}

if (-not $ApiKey) {
  Write-Host ''
  Write-Host 'Sin RENDER_API_KEY. La API arrancara tras el proximo push (Redis ya no bloquea).' -ForegroundColor Yellow
  Write-Host 'Para Redis completo, en Render pega REDIS_URL:' -ForegroundColor Yellow
  & (Join-Path $PSScriptRoot 'render-solo-redis.ps1')
  Write-Host ''
  Write-Host 'Manual: cop-nest-api -> Environment -> import deploy/render-upload.env -> Save -> Manual Deploy'
  exit 0
}

$env:RENDER_API_KEY = $ApiKey
& (Join-Path $PSScriptRoot 'render-configurar-todo.ps1')

Write-Host ''
Write-Host 'Comprueba:' -ForegroundColor Green
Write-Host '  https://cop-nest-api.onrender.com/health/live'
Write-Host '  https://cop-nest-api.onrender.com/health (mongodb ok; redis puede ser degraded)'
