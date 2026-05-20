# Configura cop-nest-api en Render sin editar .env (pide API key aqui).
# Uso: .\deploy\render-fix-interactivo.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host ''
Write-Host '=== Arreglo Render cop-nest-api ===' -ForegroundColor Cyan
Write-Host 'Crea API key: https://dashboard.render.com/u/settings -> API Keys'
Write-Host ''

$ApiKey = Read-Host 'Pega RENDER_API_KEY (rnd_...)'
$ApiKey = $ApiKey.Trim()
if (-not $ApiKey.StartsWith('rnd_')) {
  Write-Error 'La key debe empezar por rnd_'
}

& (Join-Path $PSScriptRoot 'generar-render-upload-env.ps1')

$env:RENDER_API_KEY = $ApiKey
& (Join-Path $PSScriptRoot 'render-configurar-todo.ps1') -NestOnly

Write-Host ''
Write-Host 'Listo. Espera 3-5 min y revisa Logs de cop-nest-api.' -ForegroundColor Green
Write-Host 'Debe decir: MONGODB_PASSWORD=set  REDIS_URL=ok' -ForegroundColor Green
Write-Host 'Health: https://cop-nest-api.onrender.com/health'
