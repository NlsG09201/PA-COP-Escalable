# Crea/resetea el admin en Render (arregla login 401) sin acceso directo a Mongo.
# Requiere: API desplegado con POST /api/auth/setup-bootstrap y SETUP_ADMIN_SECRET en Render.
#
#   1. .\deploy\exportar-cop-production-env-b64.ps1  -> pegar en Render -> Manual Deploy
#   2. .\deploy\crear-admin-render.ps1

$ErrorActionPreference = 'Stop'
$secret = 'cop-atlas-setup-2026'
$api = 'https://pa-cop-escalable.onrender.com'

Write-Host "POST $api/api/auth/setup-bootstrap" -ForegroundColor Cyan
$resp = curl.exe -s -w "`nHTTP:%{http_code}" -X POST "$api/api/auth/setup-bootstrap" `
  -H "Content-Type: application/json" `
  -H "X-COP-Setup-Secret: $secret"

Write-Host $resp
Write-Host ''
Write-Host 'Login:' -ForegroundColor Green
Write-Host '  Usuario: nelsonherazoi'
Write-Host '  Contrasena: Nelson09092001 (APP_BOOTSTRAP_ADMIN_PASSWORD en Render)'
