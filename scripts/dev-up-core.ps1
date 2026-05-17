# Levanta el stack local recomendado (API + datos + SPAs). Requiere Docker Desktop.
# Uso (PowerShell, desde la raiz del repo):
#   .\scripts\dev-up-core.ps1
#
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker no esta en el PATH."
}

# Incluye perfil `ai` (diagnostico, emociones, recomendaciones, depth 3D). Quita `--profile ai` si solo quieres core.
docker compose --profile core --profile ai up -d --build

Write-Host ""
Write-Host "Listo. URLs habituales:"
Write-Host "  API (gateway)  http://localhost:8080/health"
Write-Host "  Dashboard      http://localhost:5173"
Write-Host "  Web publica    http://localhost:5174"
Write-Host "  Swagger Nest   http://localhost:8080/api/docs"
Write-Host ""
Write-Host "Estado: docker compose --profile core --profile ai ps"
Write-Host "Si aparece 'network ... not found': docker compose --profile core --profile ai down; docker compose --profile core --profile ai up -d"
