# Ejecuta seed 15k pacientes + 15k J48 en Atlas vía API Render (Mongo desde el servidor).
# Requiere deploy reciente con POST /api/auth/seed-bulk-15k
#
#   .\deploy\ejecutar-seed-bulk-render.ps1
#   .\deploy\ejecutar-seed-bulk-render.ps1 -Forzar

param([switch]$Forzar)

$ErrorActionPreference = 'Stop'
$api = 'https://pa-cop-escalable.onrender.com'
$secret = 'cop-atlas-setup-2026'
$body = @{ forzar = [bool]$Forzar } | ConvertTo-Json -Compress

Write-Host "POST $api/api/auth/seed-bulk-15k (puede tardar 2-5 min)..." -ForegroundColor Cyan
try {
  $res = Invoke-RestMethod -Uri "$api/api/auth/seed-bulk-15k" -Method POST `
    -ContentType 'application/json' `
    -Headers @{ 'X-COP-Setup-Secret' = $secret } `
    -Body $body `
    -TimeoutSec 600
  $res | ConvertTo-Json -Depth 6
  Write-Host 'Seed bulk completado.' -ForegroundColor Green
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 404) {
    Write-Host '404: haz deploy del API en Render (push + Manual Deploy) y vuelve a ejecutar.' -ForegroundColor Yellow
  }
  Write-Host $_.ErrorDetails.Message
  exit 1
}
