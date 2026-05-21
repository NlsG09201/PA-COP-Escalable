# Prepara payloads y guía el despliegue Atlas vía MCP MongoDB en Cursor.
#
#   .\deploy\ejecutar-mcp-atlas.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

Write-Host '=== MCP Atlas: generar payloads ===' -ForegroundColor Cyan
node scripts/generate-mcp-atlas-payloads.mjs
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }

Write-Host ''
Write-Host '=== Siguiente paso (en Cursor) ===' -ForegroundColor Yellow
Write-Host '1. Configura MDB_MCP_CONNECTION_STRING en Settings -> MCP -> MongoDB'
Write-Host '2. Pide al agente: "Despliega deploy/mcp-payloads en cop con insert-many"'
Write-Host '3. Para 15000 pacientes: .\deploy\insertar-atlas-todo.ps1'
Write-Host ''
Write-Host 'Guia completa: deploy\MCP-ATLAS-DESPLIEGUE.md' -ForegroundColor Green
Pop-Location
