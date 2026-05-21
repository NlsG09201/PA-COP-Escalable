# Sube sedes + admin + pacientes al cluster Atlas.
#
#   .\deploy\subir-colecciones-atlas.ps1
#   .\deploy\subir-colecciones-atlas.ps1 -Pacientes 15000

param(
  [string]$Uri = '',
  [string]$AdminUser = '',
  [string]$AdminPassword = '',
  [int]$Pacientes = 15000,
  [switch]$SoloAdmin
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

function Get-EnvVal([string]$Key) {
  if (-not (Test-Path $envFile)) { return '' }
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" -and $_ -notmatch '^\s*#' } | Select-Object -First 1
  if (-not $line) { return '' }
  ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

if (-not $Uri) {
  if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^\s*MONGODB_URL\s*=' -and $_ -notmatch '^\s*#' } | Select-Object -First 1
    if ($line) { $Uri = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'") }
  }
}

if (-not $Uri -or $Uri -notmatch '^mongodb') {
  Write-Error 'Falta MONGODB_URL en .env o parametro -Uri'
}

if (-not $AdminUser) { $AdminUser = Get-EnvVal 'APP_BOOTSTRAP_ADMIN_USERNAME' }
if (-not $AdminPassword) { $AdminPassword = Get-EnvVal 'APP_BOOTSTRAP_ADMIN_PASSWORD' }
if (-not $AdminUser -or -not $AdminPassword) {
  Write-Error 'Falta APP_BOOTSTRAP_ADMIN_USERNAME/PASSWORD en .env'
}

if ($SoloAdmin) { $Pacientes = 0 }

Write-Host '=== Atlas: colecciones + sedes + admin + pacientes + muestras ===' -ForegroundColor Cyan
Write-Host "Admin: $AdminUser"
Write-Host "Pacientes: $Pacientes"
Write-Host ''

Push-Location $root
if (-not (Test-Path 'node_modules/mongodb')) {
  npm install mongodb --no-save | Out-Null
}

$nodeArgs = @(
  'scripts/seed-atlas-completo.mjs',
  '--uri', $Uri,
  '--pacientes', "$Pacientes",
  '--admin-user', $AdminUser,
  '--admin-password', $AdminPassword
)
if ($env:SEED_FORZAR_PACIENTES -eq '1') {
  $nodeArgs += '--forzar-pacientes'
}

node @nodeArgs
$code = $LASTEXITCODE
if ($code -ne 0) { Pop-Location; exit $code }

Write-Host ''
Write-Host '=== Roles administrador ===' -ForegroundColor Cyan
$roleArgs = @('scripts/asignar-rol-admin.mjs', '--user', $AdminUser)
node @roleArgs
$code = $LASTEXITCODE
Pop-Location

if ($code -ne 0) { exit $code }

Write-Host ''
Write-Host 'Login panel:' -ForegroundColor Green
Write-Host "  Usuario: $AdminUser"
Write-Host "  Contrasena: (la que definiste en -AdminPassword)"
Write-Host '  Atlas -> Browse Collections -> cop'
