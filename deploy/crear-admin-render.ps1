# Crea/resetea el admin en Render (arregla login 401) sin acceso directo a Mongo.
#
#   1. .\deploy\generar-render-upload-env.ps1
#   2. Render -> Environment (render-upload.env) -> Manual Deploy
#   3. .\deploy\crear-admin-render.ps1
#
# Tras desplegar codigo con POST /api/auth/ensure-bootstrap, el paso 3 funciona sin secreto
# si no hay admin o la contraseña del bootstrap no coincide con APP_BOOTSTRAP_*.

$ErrorActionPreference = 'Stop'
$api = 'https://pa-cop-escalable.onrender.com'
$secrets = @(
  'cop-atlas-setup-2026',
  'Nelson09092001',
  'NelsonH09092001'
)

function Invoke-CopPost($path, [hashtable]$Headers = @{}) {
  $h = @('Content-Type: application/json') + @($Headers.GetEnumerator() | ForEach-Object { "$($_.Key):$($_.Value)" })
  $args = @('-s', '-w', "`nHTTP:%{http_code}", '-X', 'POST', "$api$path") + ($h | ForEach-Object { '-H'; $_ })
  $out = & curl.exe @args
  return $out
}

Write-Host "1) POST $api/api/auth/ensure-bootstrap (sin secreto, si el API ya lo tiene)" -ForegroundColor Cyan
$ensure = Invoke-CopPost '/api/auth/ensure-bootstrap'
Write-Host $ensure
if ($ensure -match 'HTTP:200') {
  Write-Host 'OK: admin reparado via ensure-bootstrap' -ForegroundColor Green
} else {
  Write-Host "2) POST $api/api/auth/setup-bootstrap (con secreto)" -ForegroundColor Cyan
  $ok = $false
  foreach ($secret in $secrets) {
    Write-Host "   Probando X-COP-Setup-Secret: $secret" -ForegroundColor DarkGray
    $resp = Invoke-CopPost '/api/auth/setup-bootstrap' @{ 'X-COP-Setup-Secret' = $secret }
    Write-Host $resp
    if ($resp -match 'HTTP:200') {
      $ok = $true
      break
    }
  }
  if (-not $ok) {
    Write-Host ''
    Write-Host 'Fallo: en Render define SETUP_ADMIN_SECRET=cop-atlas-setup-2026' -ForegroundColor Yellow
    Write-Host '  y APP_BOOTSTRAP_ADMIN_USERNAME/PASSWORD/ORG_ID + APP_BOOTSTRAP_ADMIN_RESET=true' -ForegroundColor Yellow
    Write-Host '  Luego Manual Deploy y vuelve a ejecutar este script.' -ForegroundColor Yellow
    exit 1
  }
}

Write-Host ''
Write-Host 'Login panel:' -ForegroundColor Green
Write-Host '  Usuario: nelsonherazoi'
Write-Host '  Contrasena: Nelson09092001 (debe coincidir con APP_BOOTSTRAP_ADMIN_PASSWORD en Render)'

Write-Host ''
Write-Host 'Comprobando login...' -ForegroundColor Cyan
$loginBody = @{
  username = 'nelsonherazoi'
  password = 'Nelson09092001'
} | ConvertTo-Json -Compress
try {
  $login = Invoke-RestMethod -Uri "$api/api/auth/login" -Method POST -ContentType 'application/json' -Body $loginBody
  Write-Host "Login OK (Render). Token recibido para $($login.user.username)" -ForegroundColor Green
} catch {
  Write-Host "Login fallo: $($_.ErrorDetails.Message)" -ForegroundColor Red
}
