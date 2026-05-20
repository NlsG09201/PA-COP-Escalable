# Solo las 2 variables que bloquean el arranque. Copia al portapapeles para Render.
#   .\deploy\render-2-variables.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) { Write-Error "No existe $envFile" }

function Get-Val([string]$Key) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

$mongoPass = Get-Val 'MONGODB_PASSWORD'
if (-not $mongoPass) {
  $url = Get-Val 'MONGODB_URL'
  if ($url -match 'mongodb(\+srv)?://[^:]+:([^@]+)@') { $mongoPass = $Matches[2] }
}
$redis = Get-Val 'REDIS_URL'
if (-not $mongoPass) { Write-Error 'Falta MONGODB_PASSWORD en .env' }
if (-not $redis -or $redis -match 'your-instance\.upstash') { Write-Error 'Falta REDIS_URL real en .env' }

$text = @"
=== Render: cop-nest-api -> Environment ===

1) ELIMINAR variable: REDIS_URL (si tiene your-instance.upstash.io)

2) ANADIR variable:
MONGODB_PASSWORD=$mongoPass

3) ANADIR variable (o omitir si usas cop-redis del Blueprint):
REDIS_URL=$redis

4) Save Changes -> Manual Deploy

(Opcion mas facil: una sola variable COP_PRODUCTION_ENV_B64)
  .\deploy\exportar-cop-production-env-b64.ps1
"@

Set-Clipboard -Value $text
Write-Host $text
