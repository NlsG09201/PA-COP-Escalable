# Inserta 15.000 pacientes + 15.000 j48_predictions en Atlas.
# 1) Genera lotes JSON (MCP insert-many)
# 2) Inserta con Node (mismo formato que MCP) si hay red a Atlas
#
#   .\deploy\insertar-bulk-15k-mcp.ps1
#   .\deploy\insertar-bulk-15k-mcp.ps1 -SoloGenerar

param(
  [switch]$SoloGenerar,
  [switch]$Forzar
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host '=== Paso 1: generar lotes (500 docs) ===' -ForegroundColor Cyan
node (Join-Path $root 'scripts/generate-mcp-bulk-15k.mjs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($SoloGenerar) {
  Write-Host 'Lotes en deploy/mcp-payloads/bulk/' -ForegroundColor Green
  Write-Host 'En Cursor (MCP mongodb conectado): insert-many por cada patients-batch-*.json y j48_predictions-batch-*.json' -ForegroundColor Yellow
  exit 0
}

Write-Host ''
Write-Host '=== Paso 2: insertar en Atlas ===' -ForegroundColor Cyan
$args = @((Join-Path $root 'scripts/insert-mcp-bulk-15k.mjs'))
if ($Forzar) { $args += '--forzar' }
node @args
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'Si falla querySrv ENOTFOUND / ECONNREFUSED:' -ForegroundColor Yellow
  Write-Host '  1. Atlas -> Network Access -> 0.0.0.0/0 Active'
  Write-Host '  2. .\deploy\configurar-mcp-atlas.ps1 y reinicia MCP en Cursor'
  Write-Host '  3. En Cursor pide al agente: insertar deploy/mcp-payloads/bulk con insert-many'
  Write-Host '  4. O ejecuta desde otra red / VPN sin bloqueo DNS SRV'
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host 'Listo. Verifica en Atlas: patients y j48_predictions ~15000 c/u.' -ForegroundColor Green
