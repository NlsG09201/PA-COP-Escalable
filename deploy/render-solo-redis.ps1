# Copia solo REDIS_URL al portapapeles para pegar en Render (cop-nest-api -> Environment).
# Uso: .\deploy\render-solo-redis.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

function Get-Val([string]$Key) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" -and $_ -notmatch '^\s*#' } | Select-Object -First 1
  if (-not $line) { return '' }
  ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

$redis = Get-Val 'REDIS_URL'
if (-not $redis -or $redis -match 'your-instance\.upstash\.io') {
  Write-Error 'Falta REDIS_URL valida en .env. Copiala desde Upstash Console -> Redis -> Connect.'
}

Set-Clipboard -Value $redis
Write-Host 'PORTAPAPELES = valor de REDIS_URL (solo el valor, sin el nombre REDIS_URL=)'
Write-Host ''
Write-Host 'Render -> cop-nest-api -> Environment -> Add:'
Write-Host '  Key:   REDIS_URL'
Write-Host '  Value: Ctrl+V (debe empezar por rediss:// o redis://)'
Write-Host 'Save Changes -> Manual Deploy'
Write-Host ''
Write-Host "Longitud URI: $($redis.Length) caracteres"
