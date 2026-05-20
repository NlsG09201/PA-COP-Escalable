# Crea deploy/render-upload.env para IMPORTAR en Render (cop-nest-api → Environment).
# Render: "Add Environment Variable" → "From .env" / pegar archivo completo.
#
#   .\deploy\generar-render-upload-env.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root '.env'
$dst = Join-Path $PSScriptRoot 'render-upload.env'

if (-not (Test-Path $src)) {
  Write-Error "No existe $src"
}

$keys = @(
  'NODE_ENV', 'MONGODB_URL', 'MONGODB_PASSWORD', 'REDIS_URL',
  'JWT_SECRET', 'JWT_ACCESS_EXPIRES',
  'APP_BOOTSTRAP_ADMIN_USERNAME', 'APP_BOOTSTRAP_ADMIN_PASSWORD',
  'APP_BOOTSTRAP_ADMIN_EMAIL', 'APP_BOOTSTRAP_ADMIN_ORG_ID',
  'APP_BOOTSTRAP_ADMIN_RESET', 'APP_BOOTSTRAP_ENFORCE_SOLE_ADMIN',
  'PUBLIC_API_ORIGIN', 'DASHBOARD_URL', 'PUBLIC_SITE_URL',
  'CORS_ORIGINS', 'J48_URL', 'SEED_COLOMBIA_SITES'
)

$lines = @(
  '# Importar en Render: cop-nest-api -> Environment -> Add -> From .env file',
  '# Luego borra REDIS_URL si tiene your-instance.upstash.io (duplicado viejo)',
  ''
)

foreach ($key in $keys) {
  $m = Get-Content $src | Where-Object { $_ -match "^\s*$([regex]::Escape($key))\s*=" } | Select-Object -First 1
  if ($m) { $lines += $m.Trim() }
}

# URI con placeholder + password aparte (Render resuelve al arrancar)
$hasPass = $lines | Where-Object { $_ -match '^\s*MONGODB_PASSWORD=' -and $_ -notmatch '=\s*$' }
if ($hasPass) {
  $lines = $lines | Where-Object { $_ -notmatch '^\s*MONGODB_URL=mongodb.*@[^<]+' }
  $lines += 'MONGODB_URL=mongodb+srv://nelsonherazoi:<db_password>@cluster0.6oyhyja.mongodb.net/cop?retryWrites=true&w=majority&appName=Cluster0'
}

$lines | Set-Content -Path $dst -Encoding UTF8
Write-Host "Creado: $dst"
Write-Host ""
Write-Host "Siguiente paso en Render:"
Write-Host "  1. cop-nest-api -> Environment"
Write-Host "  2a. Secret Files -> Add -> filename: cop-production.env -> pegar contenido de render-upload.env"
Write-Host "  2b. O Environment -> From .env -> render-upload.env"
Write-Host "  3. Elimina REDIS_URL vieja si sigue con your-instance.upstash.io"
Write-Host "  4. Save Changes -> Manual Deploy"
