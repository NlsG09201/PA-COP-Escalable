# Sube solo REDIS_URL a cop-nest-api via Render API (Mongo ya configurado).
# Uso: $env:RENDER_API_KEY='rnd_...'; .\deploy\render-api-solo-redis.ps1

param([string]$ApiKey = $env:RENDER_API_KEY)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

if (-not $ApiKey) {
  $line = Get-Content $envFile -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*RENDER_API_KEY\s*=' -and $_ -notmatch '^\s*#' } | Select-Object -First 1
  if ($line) { $ApiKey = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'") }
}
if (-not $ApiKey) {
  Write-Host 'Sin API key. Manual: .\deploy\render-solo-redis.ps1 y pega en Render.'
  & (Join-Path $PSScriptRoot 'render-solo-redis.ps1')
  exit 1
}

function Get-Val([string]$Key) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" -and $_ -notmatch '^\s*#' } | Select-Object -First 1
  if (-not $line) { return '' }
  ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

$redis = Get-Val 'REDIS_URL'
if (-not $redis -or $redis -match 'your-instance\.upstash\.io') {
  Write-Error 'REDIS_URL invalida en .env. Actualiza desde Upstash Console -> Connect.'
}

$headers = @{
  Authorization  = "Bearer $ApiKey"
  Accept         = 'application/json'
  'Content-Type' = 'application/json'
}

$cursor = ''
$serviceId = $null
do {
  $uri = 'https://api.render.com/v1/services?limit=100'
  if ($cursor) { $uri += "&cursor=$([uri]::EscapeDataString($cursor))" }
  $page = @(Invoke-RestMethod -Method Get -Uri $uri -Headers $headers)
  foreach ($item in $page) {
    if ($item.service.name -eq 'cop-nest-api') { $serviceId = $item.service.id; break }
  }
  $cursor = ''
  if (-not $serviceId -and $page.Count -gt 0 -and $page[-1].PSObject.Properties['cursor']) {
    $cursor = $page[-1].cursor
  }
} while (-not $serviceId -and $cursor)

if (-not $serviceId) { Write-Error 'cop-nest-api no encontrado' }

$body = @{ value = $redis } | ConvertTo-Json -Compress
$encKey = [uri]::EscapeDataString('REDIS_URL')
Invoke-RestMethod -Method Put -Uri "https://api.render.com/v1/services/$serviceId/env-vars/$encKey" -Headers $headers -Body $body | Out-Null
Write-Host "REDIS_URL actualizada en cop-nest-api (len=$($redis.Length))"

try {
  Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services/$serviceId/deploys" -Headers $headers -Body '{}' | Out-Null
  Write-Host 'Deploy iniciado.'
} catch {
  Write-Host 'Haz Manual Deploy en el dashboard.'
}
