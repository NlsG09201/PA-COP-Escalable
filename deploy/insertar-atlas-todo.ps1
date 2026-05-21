# 1) Crea todas las colecciones en Atlas
# 2) Inserta organización, sedes, admin, pacientes y datos de muestra
#
#   .\deploy\insertar-atlas-todo.ps1
#   .\deploy\insertar-atlas-todo.ps1 -SoloColecciones
#   .\deploy\insertar-atlas-todo.ps1 -Pacientes 0

param(
  [switch]$SoloColecciones,
  [switch]$SinMuestras,
  [int]$Pacientes = 15000,
  [string]$Uri = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

if (-not (Test-Path '.env')) {
  Write-Error 'Falta .env en la raíz (MONGODB_URL o MONGODB_PASSWORD + APP_BOOTSTRAP_*).'
}

Write-Host '=== Atlas: colecciones + datos ===' -ForegroundColor Cyan
Write-Host 'Requisito: Atlas -> Network Access -> 0.0.0.0/0 Active' -ForegroundColor DarkGray
Write-Host ''

if (-not (Test-Path 'node_modules/mongodb')) {
  Write-Host 'Instalando mongodb...' -ForegroundColor Yellow
  npm install mongodb --no-save 2>&1 | Out-Null
}

$args = @('scripts/seed-atlas-completo.mjs', '--pacientes', "$Pacientes")
if ($SoloColecciones) { $args += '--solo-colecciones' }
if ($SinMuestras) { $args += '--sin-muestras' }
if ($Uri) { $args += '--uri', $Uri }

node @args
$code = $LASTEXITCODE
if ($code -ne 0) { Pop-Location; exit $code }

if (-not $SoloColecciones) {
  $adminUser = (Get-Content .env | Where-Object { $_ -match '^\s*APP_BOOTSTRAP_ADMIN_USERNAME\s*=' } | Select-Object -First 1) -replace '.*=\s*', '' -replace '"', '' -replace "'", ''
  if ($adminUser) {
    Write-Host ''
    Write-Host '=== Roles admin ===' -ForegroundColor Cyan
    node scripts/asignar-rol-admin.mjs --user $adminUser.Trim()
  }
}

Pop-Location
Write-Host ''
Write-Host 'Atlas -> Browse Collections -> cop' -ForegroundColor Green
Write-Host '  19 colecciones + datos (org, sites, users, patients, ...)'
