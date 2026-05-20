# Configura Render + artefactos Vercel para despliegue sin CORS en nube.
#
#   .\deploy\aplicar-nube.ps1
#
# Con API key (automático en Render):
#   En .env: RENDER_API_KEY=rnd_...
#   .\deploy\aplicar-nube.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

if (-not (Test-Path $envFile)) {
  Write-Error "Falta .env en la raíz del repo."
}

Write-Host '=== 1/4 Generar render-upload.env ===' -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'generar-render-upload-env.ps1')

Write-Host '=== 2/4 COP_PRODUCTION_ENV_B64 (portapapeles) ===' -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'exportar-cop-production-env-b64.ps1')

Write-Host '=== 3/4 Preparar Vercel (env.js + vercel.json con proxy) ===' -ForegroundColor Cyan
$env:VERCEL = '1'
$env:VERCEL_URL = 'pa-cop-escalable-2qx1.vercel.app'
$env:RENDER_API_HOST = 'cop-nest-api.onrender.com'
$env:PUBLIC_SITE_URL = 'https://pa-cop-escalable-2qx1.vercel.app'
$env:VERCEL_API_PROXY = 'true'

Push-Location $root
node .\scripts\prepare-vercel.mjs PublicWeb
Pop-Location

$apiKey = $env:RENDER_API_KEY
if (-not $apiKey) {
  $line = Get-Content $envFile -ErrorAction SilentlyContinue |
    Where-Object { $_ -match '^\s*RENDER_API_KEY\s*=' -and $_ -notmatch '^\s*#' } |
    Select-Object -First 1
  if ($line) { $apiKey = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'") }
}

Write-Host '=== 4/4 Render API ===' -ForegroundColor Cyan
if ($apiKey) {
  $env:RENDER_API_KEY = $apiKey
  & (Join-Path $PSScriptRoot 'render-configurar-todo.ps1') -NestOnly
} else {
  Write-Host @'

Sin RENDER_API_KEY — pasos manuales en Render (obligatorio para quitar 404):

  1. https://dashboard.render.com → cop-nest-api (o Blueprint con render.yaml)
  2. Environment → COP_PRODUCTION_ENV_B64 = pegar portapapeles
  3. CORS_ALLOW_VERCEL = true
  4. Borrar REDIS_URL si tiene your-instance.upstash.io
  5. Save → Manual Deploy → esperar Live

  Comprueba:
    https://cop-nest-api.onrender.com/health/live

'@ -ForegroundColor Yellow
}

Write-Host ''
Write-Host '=== Vercel ===' -ForegroundColor Cyan
Write-Host @'
Variables en el proyecto PublicWeb (Production):
  RENDER_API_HOST=cop-nest-api.onrender.com
  PUBLIC_SITE_URL=https://pa-cop-escalable-2qx1.vercel.app
  (borra DASHBOARD_URL si es your-dashboard.vercel.app)

Sube estos cambios a git y Redeploy en Vercel.
Tras el deploy:
  env.js → API_BASE_URL="/render-api"
  https://pa-cop-escalable-2qx1.vercel.app/render-api/health/live

'@

curl.exe -sI "https://cop-nest-api.onrender.com/health/live" 2>$null |
  Select-String -Pattern 'HTTP|x-render' |
  ForEach-Object { Write-Host "API ahora: $_" }
