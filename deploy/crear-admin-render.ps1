# Crea/resetea el admin en Render y verifica login (arregla 401 en Vercel).
#
#   .\deploy\crear-admin-render.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$api = 'https://pa-cop-escalable.onrender.com'
$secret = 'cop-atlas-setup-2026'
$username = 'nelsonherazoi'
$password = 'Nelson09092001'
$setupJson = Join-Path $PSScriptRoot 'setup-bootstrap-body.json'

@(@{ password = $password } | ConvertTo-Json -Compress) | Set-Content -Path $setupJson -Encoding UTF8 -NoNewline

Write-Host "POST $api/api/auth/setup-bootstrap" -ForegroundColor Cyan
$setup = curl.exe -s -w "`nHTTP:%{http_code}" -X POST "$api/api/auth/setup-bootstrap" `
  -H "Content-Type: application/json" `
  -H "X-COP-Setup-Secret: $secret" `
  --data-binary "@$setupJson"
Write-Host $setup

if ($setup -notmatch 'HTTP:200') {
  Write-Host ''
  Write-Host 'Si falla: importa deploy\render-upload.env en Render -> Manual Deploy -> vuelve a ejecutar.' -ForegroundColor Yellow
  Write-Host 'Tras push del codigo nuevo, setup-bootstrap exige verificacion de contraseña.' -ForegroundColor Yellow
  exit 1
}

Start-Sleep -Seconds 2

Write-Host ''
Write-Host 'Comprobando login...' -ForegroundColor Cyan
$loginBody = (@{
  username = $username
  password = $password
  siteId   = '9b912e9a-b30a-4a0f-87bc-6f99d5de1f7e'
} | ConvertTo-Json -Compress)
try {
  $login = Invoke-RestMethod -Uri "$api/api/auth/login" -Method POST -ContentType 'application/json' -Body $loginBody
  Write-Host "Login OK (Render): $($login.user.username)" -ForegroundColor Green
} catch {
  Write-Host "Login fallo (Render): $($_.ErrorDetails.Message)" -ForegroundColor Red
  exit 1
}

try {
  $vercel = Invoke-RestMethod -Uri 'https://pa-cop-escalable-2qx1.vercel.app/render-api/api/auth/login' -Method POST -ContentType 'application/json' -Body $loginBody
  Write-Host "Login OK (Vercel): $($vercel.user.username)" -ForegroundColor Green
} catch {
  Write-Host "Vercel proxy: $($_.ErrorDetails.Message) (redeploy Frontend si persiste)" -ForegroundColor Yellow
}

Write-Host ''
Write-Host "Panel: usuario $username | contraseña $password | sede obligatoria" -ForegroundColor Green
Write-Host 'En Render -> Environment: APP_BOOTSTRAP_ADMIN_PASSWORD debe ser exactamente esa misma clave.' -ForegroundColor Yellow
