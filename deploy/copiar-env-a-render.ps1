# Copia variables de .env (raíz) al portapapeles en formato lista para Render Dashboard.
# Uso: .\deploy\copiar-env-a-render.ps1
# Luego: Render → cop-nest-api → Environment → pegar cada KEY=VALUE (o bulk edit si lo permite).

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
  Write-Error "No existe $envFile. Crea .env en la raíz del repo primero."
  exit 1
}

$lines = Get-Content $envFile | Where-Object {
  $_ -match '^\s*[^#]' -and $_ -match '='
}

$renderKeys = @(
  'NODE_ENV', 'MONGODB_URL', 'REDIS_URL', 'JWT_SECRET', 'JWT_ACCESS_EXPIRES',
  'APP_BOOTSTRAP_ADMIN_USERNAME', 'APP_BOOTSTRAP_ADMIN_PASSWORD', 'APP_BOOTSTRAP_ADMIN_EMAIL',
  'APP_BOOTSTRAP_ADMIN_ORG_ID', 'APP_BOOTSTRAP_ADMIN_RESET', 'APP_BOOTSTRAP_ENFORCE_SOLE_ADMIN',
  'PUBLIC_API_ORIGIN', 'DASHBOARD_URL', 'PUBLIC_SITE_URL', 'CORS_ORIGINS',
  'J48_URL', 'SEED_COLOMBIA_SITES'
)

$out = @()
foreach ($key in $renderKeys) {
  $match = $lines | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
  if ($match) { $out += $match.Trim() }
}

$text = $out -join "`n"
Set-Clipboard -Value $text
Write-Host "Copiado al portapapeles ($($out.Count) variables para cop-nest-api):"
Write-Host $text
Write-Host ""
Write-Host "Render → cop-nest-api → Environment → pega y guarda → Manual Deploy."
