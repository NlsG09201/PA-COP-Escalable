# Configura todos los servicios COP en Render (API, fronts, J48, recommendation-engine).
# Requiere API key: https://dashboard.render.com/u/settings → API Keys
#
#   $env:RENDER_API_KEY = "rnd_..."
#   .\deploy\render-configurar-todo.ps1
#
# O en .env (raíz): RENDER_API_KEY=rnd_...

param(
  [string]$ApiKey = $env:RENDER_API_KEY,
  [switch]$SkipDeploy,
  [switch]$NestOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
$uploadEnv = Join-Path $PSScriptRoot 'render-upload.env'

if (-not $ApiKey) {
  $line = Get-Content $envFile -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*RENDER_API_KEY\s*=' -and $_ -notmatch '^\s*#' } | Select-Object -First 1
  if ($line) { $ApiKey = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'") }
}

if (-not $ApiKey) {
  Write-Error @"
Falta RENDER_API_KEY.
1. Crea una API key en https://dashboard.render.com/u/settings
2. Añade en .env: RENDER_API_KEY=rnd_...
3. Ejecuta: .\deploy\configurar-plataforma-completa.ps1
"@
}

if (-not (Test-Path $uploadEnv)) {
  & (Join-Path $PSScriptRoot 'generar-render-upload-env.ps1')
}

function Get-DotEnvValue([string]$Key) {
  if (-not (Test-Path $envFile)) { return $null }
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" -and $_ -notmatch '^\s*#' } | Select-Object -First 1
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
  Write-Host "    $Key (len=$($Value.Length))"
}

function Remove-RenderEnvVar([string]$ServiceId, [string]$Key) {
  $encKey = [uri]::EscapeDataString($Key)
  try {
    Invoke-RestMethod -Method Delete -Uri "https://api.render.com/v1/services/$ServiceId/env-vars/$encKey" -Headers $headers | Out-Null
    Write-Host "    deleted $Key"
  } catch {
    Write-Host "    skip delete $Key"
  }
}

function Invoke-RenderDeploy([string]$ServiceId, [string]$Name) {
  if ($SkipDeploy) { return }
  try {
    Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services/$ServiceId/deploys" -Headers $headers -Body '{}' | Out-Null
    Write-Host "  deploy iniciado: $Name"
  } catch {
    Write-Host "  deploy manual en dashboard: $Name"
  }
}

$apiUrl = Get-DotEnvValue 'PUBLIC_API_ORIGIN'
if (-not $apiUrl) { $apiUrl = Get-DotEnvValue 'NEXT_PUBLIC_API_URL' }
if (-not $apiUrl) { $apiUrl = 'https://cop-nest-api.onrender.com' }

$redisUrl = Get-DotEnvValue 'REDIS_URL'
$mongoUri = Get-DotEnvValue 'MONGODB_URL'
$mongoPass = Get-DotEnvValue 'MONGODB_PASSWORD'
if (-not $mongoPass -and $mongoUri -match 'mongodb(\+srv)?://[^:]+:([^@]+)@') {
  $mongoPass = $Matches[2]
}

$aiRelapse = Get-DotEnvValue 'AI_RELAPSE_URL'
if (-not $aiRelapse) { $aiRelapse = 'https://cop-recommendation-engine.onrender.com' }

$j48Url = Get-DotEnvValue 'J48_URL'
if (-not $j48Url) { $j48Url = 'https://cop-j48-python.onrender.com' }

# --- cop-nest-api ---
Write-Host "`n=== cop-nest-api ==="
$nestId = Get-RenderServiceId 'cop-nest-api'
if (-not $nestId) {
  Write-Warning "cop-nest-api no existe en Render. Crea el Blueprint primero."
} else {
  Write-Host "  id: $nestId"
  Write-Host "  Secret File cop-production.env..."
  $secretContent = Get-Content $uploadEnv -Raw
  $secretBody = @{ content = $secretContent } | ConvertTo-Json -Compress
  $encName = [uri]::EscapeDataString('cop-production.env')
  Invoke-RestMethod -Method Put -Uri "https://api.render.com/v1/services/$nestId/secret-files/$encName" -Headers $headers -Body $secretBody | Out-Null

  Remove-RenderEnvVar $nestId 'REDIS_URL'
  if ($mongoPass) { Set-RenderEnvVar $nestId 'MONGODB_PASSWORD' $mongoPass }
  if ($redisUrl -and $redisUrl -notmatch 'your-instance\.upstash\.io') {
    Set-RenderEnvVar $nestId 'REDIS_URL' $redisUrl
  }

  $b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content $uploadEnv -Raw)))
  Set-RenderEnvVar $nestId 'COP_PRODUCTION_ENV_B64' $b64

  Set-RenderEnvVar $nestId 'CORS_ALLOW_VERCEL' 'true'

  foreach ($k in @(
    'CORS_ORIGINS', 'CORS_ALLOW_VERCEL', 'J48_URL', 'DASHBOARD_URL', 'PUBLIC_SITE_URL', 'PUBLIC_API_ORIGIN',
    'JWT_SECRET', 'JWT_ACCESS_EXPIRES',
    'APP_BOOTSTRAP_ADMIN_USERNAME', 'APP_BOOTSTRAP_ADMIN_PASSWORD', 'APP_BOOTSTRAP_ADMIN_EMAIL',
    'APP_BOOTSTRAP_ADMIN_ORG_ID', 'APP_BOOTSTRAP_ADMIN_RESET', 'APP_BOOTSTRAP_ENFORCE_SOLE_ADMIN',
    'SEED_COLOMBIA_SITES', 'GOOGLE_CLIENT_ID',
    'AI_RELAPSE_URL', 'AI_DIAGNOSIS_URL', 'AI_EMOTION_URL',
    'OPENAI_API_KEY', 'OPENAI_MODEL',
    'WOMPI_PUBLIC_KEY', 'WOMPI_PRIVATE_KEY', 'WOMPI_INTEGRITY_SECRET', 'WOMPI_EVENTS_SECRET',
    'STRIPE_SECRET_KEY', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_MODE'
  )) {
    $v = Get-DotEnvValue $k
    if ($v) { Set-RenderEnvVar $nestId $k $v }
  }
  if (-not (Get-DotEnvValue 'AI_RELAPSE_URL')) {
    Set-RenderEnvVar $nestId 'AI_RELAPSE_URL' $aiRelapse
  }

  Invoke-RenderDeploy $nestId 'cop-nest-api'
}

if ($NestOnly) {
  Write-Host "`nListo (solo API). Logs: MONGODB_PASSWORD=set, REDIS_URL=ok, env-loader v3"
  exit 0
}

# --- Frontends ---
foreach ($pair in @(
  @{ Name = 'cop-web-public'; Keys = @{ 'NEXT_PUBLIC_API_URL' = $apiUrl } },
  @{ Name = 'cop-web-dashboard'; Keys = @{ 'NEXT_PUBLIC_API_URL' = $apiUrl } }
)) {
  Write-Host "`n=== $($pair.Name) ==="
  $sid = Get-RenderServiceId $pair.Name
  if (-not $sid) { Write-Warning "  no encontrado"; continue }
  foreach ($entry in $pair.Keys.GetEnumerator()) {
    Set-RenderEnvVar $sid $entry.Key $entry.Value
  }
  Invoke-RenderDeploy $sid $pair.Name
}

# --- cop-recommendation-engine ---
Write-Host "`n=== cop-recommendation-engine ==="
$recoId = Get-RenderServiceId 'cop-recommendation-engine'
if (-not $recoId) {
  Write-Warning "  no encontrado. Añade el servicio en render.yaml y Sync Blueprint."
} else {
  if ($mongoUri) { Set-RenderEnvVar $recoId 'RECO_MONGODB_URI' $mongoUri }
  Set-RenderEnvVar $recoId 'RECO_MONGODB_DB' 'cop'
  if ($redisUrl -and $redisUrl -notmatch 'your-instance\.upstash\.io') {
    Set-RenderEnvVar $recoId 'RECO_REDIS_URL' $redisUrl
  }
  Invoke-RenderDeploy $recoId 'cop-recommendation-engine'
}

# --- cop-j48-python (solo NODE_ENV si hace falta; J48 usa env del Dockerfile) ---
Write-Host "`n=== cop-j48-python ==="
$j48Id = Get-RenderServiceId 'cop-j48-python'
if ($j48Id) {
  Write-Host "  id: $j48Id (sin cambios de env; URL base: $j48Url)"
  if (-not $SkipDeploy) { Invoke-RenderDeploy $j48Id 'cop-j48-python' }
} else {
  Write-Warning "  no encontrado"
}

Write-Host "`n=== Resumen ==="
Write-Host "API:      $apiUrl"
Write-Host "IA:       $aiRelapse"
Write-Host "J48:      $j48Url"
Write-Host "Revisa logs cop-nest-api: env-loader v3, MONGODB_PASSWORD=set, REDIS_URL=ok"
