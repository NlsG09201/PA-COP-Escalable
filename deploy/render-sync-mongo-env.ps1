# Sube MONGODB_PASSWORD (y opcionalmente MONGODB_URL) a Render vía API.
# Requiere API key: https://dashboard.render.com/u/settings → API Keys → Create
#
#   $env:RENDER_API_KEY = "rnd_..."
#   .\deploy\render-sync-mongo-env.ps1
#
# Luego en Render: Manual Deploy de cop-nest-api.

param(
  [string]$ServiceName = 'cop-nest-api'
)

$ErrorActionPreference = 'Stop'
$apiKey = $env:RENDER_API_KEY
if (-not $apiKey) {
  Write-Error @"
Falta RENDER_API_KEY.
1. https://dashboard.render.com/u/settings → API Keys → Create
2. En PowerShell: `$env:RENDER_API_KEY = 'rnd_...'
3. Vuelve a ejecutar: .\deploy\render-sync-mongo-env.ps1
"@
}

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) {
  Write-Error "No existe $envFile"
}

function Get-DotEnvValue([string]$Key) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

$mongoPass = Get-DotEnvValue 'MONGODB_PASSWORD'
if (-not $mongoPass) {
  $mongoUrl = Get-DotEnvValue 'MONGODB_URL'
  if ($mongoUrl -match 'mongodb(\+srv)?://[^:]+:([^@]+)@') {
    $mongoPass = $Matches[2]
    if ($mongoPass -match '[<>]') { $mongoPass = $null }
  }
}
if (-not $mongoPass) {
  Write-Error 'Define MONGODB_PASSWORD o MONGODB_URL con contraseña real en .env'
}

$headers = @{
  Authorization = "Bearer $apiKey"
  Accept        = 'application/json'
  'Content-Type' = 'application/json'
}

Write-Host "Buscando servicio $ServiceName..."
$cursor = ''
$serviceId = $null
do {
  $uri = 'https://api.render.com/v1/services?limit=100'
  if ($cursor) { $uri += "&cursor=$cursor" }
  $page = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
  foreach ($item in $page) {
    $svc = $item.service
    if ($svc.name -eq $ServiceName) {
      $serviceId = $svc.id
      break
    }
  }
  $cursor = $page[-1].cursor
} while (-not $serviceId -and $cursor)

if (-not $serviceId) {
  Write-Error "No se encontró el servicio '$ServiceName' en tu cuenta Render."
}

$body = @{
  envVars = @(
    @{ key = 'MONGODB_PASSWORD'; value = $mongoPass }
  )
} | ConvertTo-Json -Depth 5

Write-Host "Actualizando MONGODB_PASSWORD en $ServiceName ($serviceId)..."
Invoke-RestMethod -Method Put -Uri "https://api.render.com/v1/services/$serviceId/env-vars" -Headers $headers -Body $body | Out-Null

Write-Host 'OK. Render → cop-nest-api → Manual Deploy para aplicar el cambio.'
