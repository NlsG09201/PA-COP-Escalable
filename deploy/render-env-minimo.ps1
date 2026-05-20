# Genera deploy/render-env.local.txt con SOLO lo que falta en Render (Mongo).
# REDIS_URL se puede resolver con Blueprint + servicio cop-redis (ver render.yaml).
#
# Uso: .\deploy\render-env-minimo.ps1
# Luego abre render-env.local.txt y copia cada línea en cop-nest-api → Environment.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
$outFile = Join-Path $PSScriptRoot 'render-env.local.txt'

if (-not (Test-Path $envFile)) {
  Write-Error "Crea $envFile primero (copia desde .env.example)."
}

function Get-Val([string]$Key) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" } | Select-Object -First 1
  if (-not $line) { return '' }
  ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

$mongoPass = Get-Val 'MONGODB_PASSWORD'
if (-not $mongoPass) {
  $url = Get-Val 'MONGODB_URL'
  if ($url -match 'mongodb(\+srv)?://[^:]+:([^@]+)@') { $mongoPass = $Matches[2] }
}

if (-not $mongoPass -or $mongoPass -match '[<>]') {
  Write-Error 'Falta MONGODB_PASSWORD (o MONGODB_URL con contraseña) en .env'
}

$redis = Get-Val 'REDIS_URL'
if ($redis -match 'your-instance\.upstash\.io') { $redis = '' }

$lines = @(
  '# === Pegar en Render: cop-nest-api -> Environment (NO Secret Files) ==='
  '# 1. Borra Secret File cop-production.env si ..data sale (0 file(s))'
  '# 2. Add cada linea KEY=VALUE abajo (solo la parte despues del = en Value)'
  '# 3. Borra REDIS_URL vieja con your-instance.upstash.io'
  '# 4. Save Changes (obligatorio) -> Manual Deploy'
  ''
  "MONGODB_PASSWORD=$mongoPass"
)
if ($redis) { $lines += "REDIS_URL=$redis" }

$lines | Set-Content -Path $outFile -Encoding UTF8
Write-Host "Escrito: $outFile"
Write-Host ""
Get-Content $outFile | Where-Object { $_ -notmatch '^#' -and $_.Trim() }
Write-Host ""
Write-Host "Abre el archivo, copia MONGODB_PASSWORD=... al dashboard de Render."
