# Instala agency-agents en Cursor: MCP (agency-mcp-server) + reglas @agente seleccionadas.
# Fuente: https://github.com/msitarzewski/agency-agents
#
# Uso (PowerShell):
#   .\scripts\install-agency-agents-cursor.ps1
#   .\scripts\install-agency-agents-cursor.ps1 -RepoPath "C:\Users\nelso\OneDrive\Escritorio\agency-agents"
#
param(
  [string]$RepoPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "..\agency-agents" | Resolve-Path -ErrorAction SilentlyContinue),
  [switch]$SkipMcp,
  [switch]$ProjectOnly
)

$ErrorActionPreference = "Stop"

$SelectedAgents = @(
  "backend-architect",
  "api-designer",
  "performance-engineer",
  "security-engineer",
  "penetration-tester",
  "frontend-wizard",
  "ui-designer",
  "devops-engineer",
  "cloud-architect",
  "ai-engineer",
  "prompt-engineer",
  "code-reviewer",
  "refactoring-expert",
  "test-engineer",
  "fullstack-engineer",
  "startup-advisor",
  "reality-checker",
  "mobile-developer",
  "debugger",
  "legacy-code-expert",
  "documentation-writer",
  "typescript-expert",
  "python-expert",
  "nodejs-expert"
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$UserRulesDest = Join-Path $env:USERPROFILE ".cursor\rules\agency-agents"
$ProjectRulesDest = Join-Path $ProjectRoot ".cursor\rules\agency-agents"
$UserMcpPath = Join-Path $env:USERPROFILE ".cursor\mcp.json"
$UserRulesSrc = $UserRulesDest

if ($RepoPath) {
  $RepoPath = (Resolve-Path $RepoPath).Path
  $ConvertedSrc = Join-Path $RepoPath "integrations\cursor\rules"
  if (Test-Path $ConvertedSrc) {
    $UserRulesSrc = $ConvertedSrc
    Write-Host "Origen reglas convertidas: $ConvertedSrc"
  }
}

function Install-Rules([string]$Dest, [string]$SrcRoot) {
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  $destFull = (Resolve-Path $Dest).Path
  $installed = 0
  $missing = @()
  foreach ($name in $SelectedAgents) {
    $srcFile = Join-Path $SrcRoot "$name.mdc"
    if (-not (Test-Path $srcFile)) {
      $missing += $name
      continue
    }
    $srcFull = (Resolve-Path $srcFile).Path
    $destFile = Join-Path $destFull "$name.mdc"
    if ($srcFull -ieq $destFile) {
      $installed++
      continue
    }
    Copy-Item -Path $srcFile -Destination $destFile -Force
    $installed++
  }
  if ($missing.Count -gt 0) {
    Write-Warning "No encontrados (omite o ejecuta convert.sh en agency-agents): $($missing -join ', ')"
  }
  Write-Host "Reglas instaladas en ${Dest}: $installed archivos"
}

$rulesSrc = $UserRulesDest
if (-not (Test-Path (Join-Path $rulesSrc "backend-architect.mdc"))) {
  if (Test-Path (Join-Path $UserRulesSrc "backend-architect.mdc")) {
    $rulesSrc = $UserRulesSrc
  } elseif ($RepoPath) {
    $installScript = Join-Path $RepoPath "scripts\install-cursor-user.ps1"
    if (Test-Path $installScript) {
      Write-Host "Ejecutando install-cursor-user.ps1..."
      & $installScript
    }
  }
}

if (-not $ProjectOnly) {
  Install-Rules -Dest $UserRulesDest -SrcRoot $rulesSrc
}

Install-Rules -Dest $ProjectRulesDest -SrcRoot $rulesSrc

if (-not $SkipMcp) {
  $mcpEntry = @{
    command = "npx"
    args    = @("-y", "agency-mcp-server")
  }
  if ($RepoPath -and (Test-Path (Join-Path $RepoPath "engineering"))) {
    $mcpEntry.env = @{
      AGENCY_AGENTS_PATH = $RepoPath
    }
  }

  $mcpConfig = @{ mcpServers = @{} }
  if (Test-Path $UserMcpPath) {
    $raw = Get-Content $UserMcpPath -Raw -Encoding UTF8
    if ($raw.Trim()) {
      $mcpConfig = $raw | ConvertFrom-Json
      if (-not $mcpConfig.mcpServers) {
        $mcpConfig = @{ mcpServers = @{} }
      }
    }
  }

  if (-not $mcpConfig.mcpServers) {
    $mcpConfig.mcpServers = @{}
  }

  $servers = @{}
  if ($mcpConfig.mcpServers -is [System.Management.Automation.PSCustomObject]) {
    $mcpConfig.mcpServers.PSObject.Properties | ForEach-Object { $servers[$_.Name] = $_.Value }
  } elseif ($mcpConfig.mcpServers -is [hashtable]) {
    $servers = $mcpConfig.mcpServers
  }

  $servers["agency-agents"] = $mcpEntry
  $out = @{ mcpServers = $servers } | ConvertTo-Json -Depth 10
  Set-Content -Path $UserMcpPath -Value $out -Encoding UTF8
  Write-Host "MCP configurado en $UserMcpPath (servidor: agency-agents / agency-mcp-server)"
}

Write-Host ""
Write-Host "Listo. Reinicia Cursor y en Settings > MCP verifica 'agency-agents' en verde."
Write-Host "Uso en chat:"
Write-Host "  @backend-architect  @ui-designer  @code-reviewer  (reglas en .cursor/rules/agency-agents/)"
Write-Host "  Pide al asistente: 'usa agency_search para encontrar un agente de seguridad' (MCP)"
