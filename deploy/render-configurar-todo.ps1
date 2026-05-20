# Configura cop-nest-api en Render: variables + Secret File + deploy.
# Requiere API key: https://dashboard.render.com/u/settings → API Keys
#
#   $env:RENDER_API_KEY = "rnd_..."
#   .\deploy\render-configurar-todo.ps1
#
# O en .env: RENDER_API_KEY=rnd_...
# O: .\deploy\render-configurar-todo.ps1 -ApiKey "rnd_..."

param(
  [string]$ServiceName = 'cop-nest-api',
  [string]$ApiKey = $env:RENDER_API_KEY
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
$uploadEnv = Join-Path $PSScriptRoot 'render-upload.env'

if (-not $ApiKey) {
  $line = Get-Content $envFile -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*RENDER_API_KEY\s*=' } | Select-Object -First 1
  if ($line) { $ApiKey = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'") }
}

if (-not $ApiKey) {
  Write-Error @"
Falta RENDER_API_KEY.
1. Crea una API key en https://dashboard.render.com/u/settings
2. Ejecuta: `$env:RENDER_API_KEY = 'rnd_...'; .\deploy\render-configurar-todo.ps1
   o añade RENDER_API_KEY=rnd_... en .env (raíz)
"@
}

if (-not (Test-Path $uploadEnv)) {
  & (Join-Path $PSScriptRoot 'generar-render-upload-env.ps1')
}

function Get-DotEnvValue([string]$Key) {
  if (-not (Test-Path $envFile)) { return $null }
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

$headers = @{
  Authorization  = "Bearer $ApiKey"
  Accept         = 'application/json'
  'Content-Type' = 'application/json'
}

function Get-RenderServiceId([string]$Name) {
  $cursor = ''
  do {
    $uri = 'https://api.render.com/v1/services?limit=100'
    if ($cursor) { $uri += "&cursor=$([uri]::EscapeDataString($cursor))" }
    $page = @(Invoke-RestMethod -Method Get -Uri $uri -Headers $headers)
    foreach ($item in $page) {
      if ($item.service.name -eq $Name) { return $item.service.id }
    }
    $cursor = ''
    if ($page.Count -gt 0 -and $page[-1].PSObject.Properties['cursor']) {
      $cursor = $page[-1].cursor
    }
  } while ($cursor)
  return $null
}

function Set-RenderEnvVar([string]$ServiceId, [string]$Key, [string]$Value) {
  $encKey = [uri]::EscapeDataString($Key)
  $body = @{ value = $Value } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Put -Uri "https://api.render.com/v1/services/$ServiceId/env-vars/$encKey" -Headers $headers -Body $body | Out-Null
  Write-Host "  env $Key (len=$($Value.Length))"
}

function Remove-RenderEnvVar([string]$ServiceId, [string]$Key) {
  $encKey = [uri]::EscapeDataString($Key)
  try {
    Invoke-RestMethod -Method Delete -Uri "https://api.render.com/v1/services/$ServiceId/env-vars/$encKey" -Headers $headers | Out-Null
    Write-Host "  deleted env $Key"
  } catch {
    Write-Host "  skip delete $Key ($($_.Exception.Message))"
  }
}

Write-Host "Buscando $ServiceName..."
$serviceId = Get-RenderServiceId $ServiceName
if (-not $serviceId) { Write-Error "Servicio '$ServiceName' no encontrado." }
Write-Host "Service ID: $serviceId"

# Secret file (el contenedor lee /etc/secrets/cop-production.env)
Write-Host "Subiendo Secret File cop-production.env..."
$secretContent = Get-Content $uploadEnv -Raw
$secretBody = @{ content = $secretContent } | ConvertTo-Json -Compress
$encName = [uri]::EscapeDataString('cop-production.env')
Invoke-RestMethod -Method Put -Uri "https://api.render.com/v1/services/$serviceId/secret-files/$encName" -Headers $headers -Body $secretBody | Out-Null
Write-Host "  secret file OK"

# Quitar REDIS_URL placeholder del dashboard (si existe)
Write-Host "Limpiando REDIS_URL placeholder..."
Remove-RenderEnvVar $serviceId 'REDIS_URL'

# Variables críticas en Environment (por si Secret File tarda un deploy)
Write-Host "Variables de entorno..."
$mongoPass = Get-DotEnvValue 'MONGODB_PASSWORD'
if (-not $mongoPass) {
  $url = Get-DotEnvValue 'MONGODB_URL'
  if ($url -match 'mongodb(\+srv)?://[^:]+:([^@]+)@') { $mongoPass = $Matches[2] }
}
if ($mongoPass) { Set-RenderEnvVar $serviceId 'MONGODB_PASSWORD' $mongoPass }

$redisUrl = Get-DotEnvValue 'REDIS_URL'
if ($redisUrl -and $redisUrl -notmatch 'your-instance\.upstash\.io') {
  Set-RenderEnvVar $serviceId 'REDIS_URL' $redisUrl
}

foreach ($k in @('CORS_ORIGINS', 'J48_URL', 'DASHBOARD_URL', 'PUBLIC_SITE_URL', 'PUBLIC_API_ORIGIN', 'JWT_SECRET', 'APP_BOOTSTRAP_ADMIN_USERNAME', 'APP_BOOTSTRAP_ADMIN_PASSWORD', 'APP_BOOTSTRAP_ADMIN_EMAIL', 'APP_BOOTSTRAP_ADMIN_ORG_ID', 'APP_BOOTSTRAP_ADMIN_RESET', 'APP_BOOTSTRAP_ENFORCE_SOLE_ADMIN', 'SEED_COLOMBIA_SITES')) {
  $v = Get-DotEnvValue $k
  if ($v) { Set-RenderEnvVar $serviceId $k $v }
}

Write-Host "Disparando deploy..."
try {
  Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services/$serviceId/deploys" -Headers $headers -Body '{}' | Out-Null
  Write-Host "Deploy iniciado."
} catch {
  Write-Host "Deploy API: $($_.Exception.Message) — haz Manual Deploy en el dashboard."
}

Write-Host ""
Write-Host "Listo. Revisa logs de cop-nest-api (Env check: MONGODB_PASSWORD=set, REDIS_URL=ok)."
