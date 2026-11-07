# Restablece el admin bootstrap y verifica el acceso al API.
# Solicita los secretos de forma interactiva; no los escribe a archivos ni a la consola.

$ErrorActionPreference = 'Stop'
$api = 'https://pa-cop-escalable.onrender.com'

$setupSecretSecure = Read-Host 'SETUP_ADMIN_SECRET configurado en Render' -AsSecureString
$adminPasswordSecure = Read-Host 'APP_BOOTSTRAP_ADMIN_PASSWORD configurado en Render' -AsSecureString
$username = (Read-Host 'APP_BOOTSTRAP_ADMIN_USERNAME configurado en Render').Trim()
$siteId = (Read-Host 'ID de una sede activa para verificar el login').Trim()

if (-not $username -or -not $siteId) {
  throw 'Se requiere el usuario bootstrap y un ID de sede para la verificación.'
}

$setupBstr = [IntPtr]::Zero
$passwordBstr = [IntPtr]::Zero

try {
  $setupBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($setupSecretSecure)
  $passwordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPasswordSecure)
  $setupSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($setupBstr)
  $adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordBstr)
  if (-not $setupSecret -or -not $adminPassword) {
    throw 'Los secretos requeridos no pueden estar vacíos.'
  }

  $setup = Invoke-RestMethod -Uri "$api/api/auth/setup-bootstrap" -Method POST `
    -ContentType 'application/json' `
    -Headers @{ 'X-COP-Setup-Secret' = $setupSecret } `
    -Body '{}' -TimeoutSec 60
  if (-not $setup.verified) {
    throw 'El bootstrap no confirmó la verificación de credenciales.'
  }

  $loginBody = @{
    username = $username
    password = $adminPassword
    siteId   = $siteId
  } | ConvertTo-Json -Compress

  $login = Invoke-RestMethod -Uri "$api/api/auth/login" -Method POST `
    -ContentType 'application/json' -Body $loginBody -TimeoutSec 30
  if (-not $login.user) {
    throw 'El API no confirmó el inicio de sesión.'
  }
  Write-Host 'Bootstrap y login verificados correctamente.' -ForegroundColor Green

  try {
    $null = Invoke-RestMethod -Uri 'https://pa-cop-escalable-2qx1.vercel.app/render-api/api/auth/login' `
      -Method POST -ContentType 'application/json' -Body $loginBody -TimeoutSec 30
    Write-Host 'El proxy Vercel también respondió correctamente.' -ForegroundColor Green
  } catch {
    Write-Warning 'El login directo funciona; revisa el proxy o vuelve a desplegar el frontend.'
  }
} catch {
  Write-Error 'Falló la verificación. Confirma las variables de Render, la sede y el estado del servicio.'
  exit 1
} finally {
  if ($setupBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($setupBstr) }
  if ($passwordBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordBstr) }
  $setupSecret = $null
  $adminPassword = $null
  $loginBody = $null
}
