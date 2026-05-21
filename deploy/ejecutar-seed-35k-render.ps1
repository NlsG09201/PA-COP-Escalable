# Carga 35k pacientes (odontología + psicología) y catálogo de servicios en Atlas vía Render.
#
#   .\deploy\ejecutar-seed-35k-render.ps1
#   .\deploy\ejecutar-seed-35k-render.ps1 -Forzar
#   .\deploy\ejecutar-seed-35k-render.ps1 -SoloCatalogo

param(
  [switch]$Forzar,
  [switch]$SoloCatalogo,
  [switch]$SoloPacientes
)

$ErrorActionPreference = 'Stop'
$api = 'https://pa-cop-escalable.onrender.com'
$secret = 'cop-atlas-setup-2026'
$body = @{
  forzar        = [bool]$Forzar
  soloCatalogo  = [bool]$SoloCatalogo
  soloPacientes = [bool]$SoloPacientes
} | ConvertTo-Json -Compress

Write-Host "POST $api/api/auth/seed-bulk-35k-catalog (puede tardar 5-10 min)..." -ForegroundColor Cyan
try {
  $res = Invoke-RestMethod -Uri "$api/api/auth/seed-bulk-35k-catalog" -Method POST `
    -ContentType 'application/json' `
    -Headers @{ 'X-COP-Setup-Secret' = $secret } `
    -Body $body `
    -TimeoutSec 900
  $res | ConvertTo-Json -Depth 8
  Write-Host 'Seed 35k + catálogo completado.' -ForegroundColor Green
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 404) {
    Write-Host '404: despliega el API en Render (push + Manual Deploy) y reintenta.' -ForegroundColor Yellow
  }
  Write-Host $_.ErrorDetails.Message
  exit 1
}
