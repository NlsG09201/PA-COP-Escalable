# Paso 1: configura MongoDB MCP en Cursor con la URI de tu .env
#
#   .\deploy\configurar-mcp-atlas.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
$cursorMcp = Join-Path $env:USERPROFILE '.cursor\mcp.json'
$wrongHost = 'cluster0.6oyhyja.mongodb.net'
$fixedHost = 'cluster0.5dduzba.mongodb.net'

if (-not (Test-Path $envFile)) {
  Write-Error "Falta $envFile. Copia compose.env.example y completa MONGODB_URL."
}

$content = Get-Content $envFile -Raw
if ($content.Contains($wrongHost)) {
  Write-Host "Corrigiendo host Atlas: $wrongHost -> $fixedHost" -ForegroundColor Yellow
  Set-Content -Path $envFile -Value $content.Replace($wrongHost, $fixedHost).TrimEnd() -Encoding UTF8
}

$uri = ''
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*MONGODB_URL\s*=\s*(.+)$' -and $line -notmatch '^\s*#') {
    $uri = $matches[1].Trim().Trim('"').Trim("'")
    break
  }
}
if (-not $uri -or $uri -notmatch '^mongodb') {
  $passLine = Get-Content $envFile | Where-Object { $_ -match '^\s*MONGODB_PASSWORD\s*=' } | Select-Object -First 1
  if ($passLine) {
    $p = ($passLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
    $uri = 'mongodb+srv://nelsonherazoi:' + $p + '@' + $fixedHost + '/cop?retryWrites=true&w=majority&appName=Cluster0'
  }
}
if (-not $uri) { Write-Error 'No se pudo leer MONGODB_URL de .env' }

[Environment]::SetEnvironmentVariable('MDB_MCP_CONNECTION_STRING', $uri, 'User')
Write-Host 'MDB_MCP_CONNECTION_STRING (usuario Windows) actualizada.' -ForegroundColor Green

$merged = @{ mcpServers = @{} }
if (Test-Path $cursorMcp) {
  $parsed = Get-Content $cursorMcp -Raw | ConvertFrom-Json
  if ($parsed.mcpServers) {
    $parsed.mcpServers.PSObject.Properties | ForEach-Object {
      $merged.mcpServers[$_.Name] = $_.Value
    }
  }
}
$merged.mcpServers['mongodb'] = @{
  command = 'npx'
  args    = @('-y', 'mongodb-mcp-server@latest')
  env     = @{ MDB_MCP_CONNECTION_STRING = $uri }
}
$merged | ConvertTo-Json -Depth 10 | Set-Content -Path $cursorMcp -Encoding UTF8

Write-Host ''
Write-Host '=== Paso 1 listo ===' -ForegroundColor Cyan
Write-Host "  Host: $fixedHost"
Write-Host "  Archivo: $cursorMcp"
Write-Host ''
Write-Host 'Reinicia el MCP mongodb en Cursor (Settings -> MCP).' -ForegroundColor Yellow
Write-Host 'Atlas -> Network Access -> 0.0.0.0/0 Active'
