# Valida REDIS_URL de Upstash, regenera render-upload.env y copia URI al portapapeles.
# Uso: .\deploy\upstash-redis-a-render.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

function Get-RedisUrl {
  $line = Get-Content $envFile | Where-Object { $_ -match '^\s*REDIS_URL\s*=' -and $_ -notmatch '^\s*#' } | Select-Object -First 1
  if (-not $line) { return '' }
  ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

$url = Get-RedisUrl
if (-not $url) {
  Write-Error "No hay REDIS_URL en .env. Pegala desde Upstash Connect (TLS / rediss://)."
}

$issues = @()
if ($url -notmatch '^rediss?://') { $issues += 'Debe empezar por rediss:// (TLS) o redis://' }
if ($url -match '^https?://') { $issues += 'Parece URL REST de Upstash; usa la URI Redis (rediss://)' }
if ($url -match 'redis-cli') { $issues += 'No pegues el comando redis-cli; solo rediss://...' }
if ($url -match 'your-instance|YOUR_UPSTASH|example\.upstash') { $issues += 'Sigue siendo un placeholder' }
if ($url -notmatch '@.+\.upstash\.io') { $issues += 'El host deberia ser *.upstash.io' }

if ($url -notmatch '^rediss?://[^:]+:[^@]+@[^:/]+:\d+') {
  $issues += 'Formato esperado: rediss://default:TOKEN@host.upstash.io:6379'
} else {
  if ($url -match ':([^:@]+)@') {
    $pass = $Matches[1]
    if ($pass.Length -lt 20) { $issues += "Token muy corto ($($pass.Length) chars); copia de nuevo desde Upstash Connect" }
    if ($pass -match 'AAAA{4,}') { $issues += 'Token parece truncado; regenera en Upstash y copia de nuevo' }
  }
}

if ($issues.Count) {
  Write-Host 'Problemas con REDIS_URL en .env:' -ForegroundColor Red
  $issues | ForEach-Object { Write-Host "  - $_" }
  Write-Host ''
  Write-Host 'Upstash: Console -> tu base -> Connect -> Node/ioredis -> TLS ON -> copia REDIS_URL'
  exit 1
}

& (Join-Path $PSScriptRoot 'generar-render-upload-env.ps1')

Set-Clipboard -Value $url

Write-Host ''
Write-Host 'REDIS_URL OK (formato Upstash)' -ForegroundColor Green
Write-Host "Host: $($url -replace '^rediss?://[^@]+@', 'rediss://***@')"
Write-Host ''
Write-Host 'Valor copiado al portapapeles.' -ForegroundColor Cyan
Write-Host 'Render -> cop-nest-api -> Environment:'
Write-Host '  1. Borra REDIS_URL vieja (cop-redis / your-instance / WRONGPASS)'
Write-Host '  2. Add REDIS_URL = Ctrl+V'
Write-Host '  3. Save Changes -> Manual Deploy'
Write-Host ''
Write-Host 'Ver: deploy/UPSTASH-RENDER.md'
