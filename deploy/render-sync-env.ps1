# Sube variables críticas de .env (raíz) a Render — cop-nest-api.
# Corrige: MONGODB_PASSWORD=missing y REDIS_URL placeholder.
#
#   $env:RENDER_API_KEY = "rnd_..."   # https://dashboard.render.com/u/settings
#   .\deploy\render-sync-env.ps1
#
# Luego: Render → cop-nest-api → Manual Deploy

param(
  [string]$ServiceName = 'cop-nest-api'
)

$ErrorActionPreference = 'Stop'

if (-not $env:RENDER_API_KEY) {
  Write-Error @"
Falta RENDER_API_KEY.
1. https://dashboard.render.com/u/settings → API Keys → Create
2. `$env:RENDER_API_KEY = 'rnd_...'
3. .\deploy\render-sync-env.ps1
"@
}

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) {
  Write-Error "No existe $envFile"
}

function Get-DotEnvValue([string]$Key) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

function Resolve-MongoPassword {
  $p = Get-DotEnvValue 'MONGODB_PASSWORD'
  if ($p -and $p -notmatch '[<>]') { return $p }
  $url = Get-DotEnvValue 'MONGODB_URL'
  if ($url -match 'mongodb(\+srv)?://[^:]+:([^@]+)@') {
    $fromUrl = $Matches[2]
    if ($fromUrl -and $fromUrl -notmatch '[<>]') { return $fromUrl }
  }
  return $null
}

$mongoPass = Resolve-MongoPassword
$redisUrl = Get-DotEnvValue 'REDIS_URL'
$cors = Get-DotEnvValue 'CORS_ORIGINS'
$j48 = Get-DotEnvValue 'J48_URL'

$toSet = [ordered]@{}

if ($mongoPass) { $toSet['MONGODB_PASSWORD'] = $mongoPass }
else { Write-Warning 'Sin MONGODB_PASSWORD en .env — omitida' }

if ($redisUrl -and $redisUrl -match '^rediss?://' -and $redisUrl -notmatch 'your-instance\.upstash\.io|YOUR_UPSTASH') {
  $toSet['REDIS_URL'] = $redisUrl
} else {
  Write-Error 'REDIS_URL inválida o placeholder en .env. Pega la URL rediss:// de Upstash en .env primero.'
}

foreach ($k in @('CORS_ORIGINS', 'J48_URL', 'DASHBOARD_URL', 'PUBLIC_SITE_URL', 'PUBLIC_API_ORIGIN', 'JWT_SECRET')) {
  $v = Get-DotEnvValue $k
  if ($v) { $toSet[$k] = $v }
}

if (-not $toSet.Count) {
  Write-Error 'No hay variables para subir.'
}

$headers = @{
  Authorization  = "Bearer $($env:RENDER_API_KEY)"
  Accept         = 'application/json'
  'Content-Type' = 'application/json'
}

Write-Host "Buscando servicio $ServiceName..."
$serviceId = $null
$cursor = ''
do {
  $uri = 'https://api.render.com/v1/services?limit=100'
  if ($cursor) { $uri += "&cursor=$([uri]::EscapeDataString($cursor))" }
  $page = @(Invoke-RestMethod -Method Get -Uri $uri -Headers $headers)
  foreach ($item in $page) {
    if ($item.service.name -eq $ServiceName) {
      $serviceId = $item.service.id
      break
    }
  }
  if ($page.Count -gt 0 -and $page[-1].PSObject.Properties['cursor']) {
    $cursor = $page[-1].cursor
  } else {
    $cursor = ''
  }
} while (-not $serviceId -and $cursor)

if (-not $serviceId) {
  Write-Error "No se encontró '$ServiceName' en tu cuenta Render."
}

foreach ($entry in $toSet.GetEnumerator()) {
  $key = [uri]::EscapeDataString($entry.Key)
  $body = @{ value = $entry.Value } | ConvertTo-Json -Compress
  Write-Host "  $($entry.Key) = (set, len=$($entry.Value.Length))"
  Invoke-RestMethod -Method Put -Uri "https://api.render.com/v1/services/$serviceId/env-vars/$key" -Headers $headers -Body $body | Out-Null
}

Write-Host ""
Write-Host "Listo ($($toSet.Count) variables). Render → $ServiceName → Manual Deploy."
