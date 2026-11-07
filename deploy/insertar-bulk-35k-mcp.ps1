# Inserta lotes patients-batch-*.json vía MongoDB MCP (insert-many).
# Requiere MCP mongodb conectado en Cursor (.\deploy\configurar-mcp-atlas.ps1 + reiniciar MCP).
#
# Alternativa sin MCP: .\deploy\ejecutar-seed-35k-render.ps1 (después de deploy API)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$bulkDir = Join-Path $root 'deploy\mcp-payloads\bulk-35k'
$manifestPath = Join-Path $bulkDir '_manifest.json'
$firstBatchPath = Join-Path $bulkDir 'patients-batch-001.json'

if (-not (Test-Path $manifestPath) -or -not (Test-Path $firstBatchPath)) {
  Write-Host 'Generando payloads...' -ForegroundColor Cyan
  Set-Location $root
  node scripts/generate-mcp-bulk-35k.mjs
}

Write-Host @"

Para insertar con MCP en Cursor, pide al agente que ejecute insert-many por cada archivo:
  deploy/mcp-payloads/bulk-35k/patients-batch-001.json … patients-batch-070.json
  database: cop
  collection: patients

Catálogo de servicios (18 servicios × ~36 sedes):
  POST https://pa-cop-escalable.onrender.com/api/auth/seed-bulk-35k-catalog
  Header: X-COP-Setup-Secret: usa SETUP_ADMIN_SECRET desde un gestor seguro; no pegues el valor en el chat.
  Body: { "soloCatalogo": true }

Pacientes + catálogo completo:
  .\deploy\ejecutar-seed-35k-render.ps1

"@ -ForegroundColor Yellow
