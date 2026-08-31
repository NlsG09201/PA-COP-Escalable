# Crea deploy/render-upload.env para IMPORTAR en Render (cop-nest-api → Environment).
# Render: "Add Environment Variable" → "From .env" / pegar archivo completo.
#
#   .\deploy\generar-render-upload-env.ps1
#   .\deploy\generar-render-upload-env.ps1 -IncludeUpstashRedis   # solo si la URI Upstash es valida

param([switch]$IncludeUpstashRedis)

$ErrorActionPreference = 'Stop'
$defaultApiOrigin = 'https://pa-cop-escalable.onrender.com'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root '.env'
$dst = Join-Path $PSScriptRoot 'render-upload.env'

if (-not (Test-Path $src)) {
  Write-Error "No existe $src"
}

$keys = @(
  'NODE_ENV', 'MONGODB_URL', 'MONGODB_PASSWORD',
  'JWT_SECRET', 'JWT_ACCESS_EXPIRES',
  'APP_BOOTSTRAP_ADMIN_USERNAME', 'APP_BOOTSTRAP_ADMIN_PASSWORD',
  'APP_BOOTSTRAP_ADMIN_EMAIL', 'APP_BOOTSTRAP_ADMIN_ORG_ID',
  'APP_BOOTSTRAP_ADMIN_RESET', 'APP_BOOTSTRAP_ENFORCE_SOLE_ADMIN',
  'SETUP_ADMIN_SECRET',
  'PUBLIC_API_ORIGIN', 'DASHBOARD_URL', 'PUBLIC_SITE_URL',
  'VERCEL_PUBLIC_WEB_URL', 'VERCEL_DASHBOARD_URL',
  'CORS_ALLOW_VERCEL', 'CORS_ORIGINS', 'J48_URL', 'SEED_COLOMBIA_SITES',
  'GOOGLE_CLIENT_ID', 'AI_RELAPSE_URL', 'AI_DIAGNOSIS_URL', 'AI_EMOTION_URL',
  'OPENAI_API_KEY', 'OPENAI_MODEL'
)
if ($IncludeUpstashRedis) {
  $keys = @('REDIS_URL') + $keys
}

$redisHeader = if ($IncludeUpstashRedis) {
  '# REDIS: incluye REDIS_URL validada desde Upstash para cache/sesiones.'
} else {
  '# REDIS: no incluir REDIS_URL aqui si usas cop-redis del Blueprint (evita WRONGPASS con Upstash viejo)'
}
$lines = @(
  '# Importar en Render: servicio API (pa-cop-escalable o cop-nest-api) -> Environment',
  $redisHeader,
  ''
)

foreach ($key in $keys) {
  $m = Get-Content $src | Where-Object { $_ -match "^\s*$([regex]::Escape($key))\s*=" } | Select-Object -First 1
  if ($m) { $lines += $m.Trim() }
}

# URI con placeholder + password aparte (Render resuelve al arrancar)
$hasPass = $lines | Where-Object { $_ -match '^\s*MONGODB_PASSWORD=' -and $_ -notmatch '=\s*$' }
if ($hasPass) {
  $mongoLine = $lines | Where-Object { $_ -match '^\s*MONGODB_URL\s*=' } | Select-Object -First 1
  $placeholderMongoUrl = 'mongodb+srv://nelsonherazoi:<db_password>@cluster0.6oyhyja.mongodb.net/cop?retryWrites=true&w=majority&appName=Cluster0'
  if ($mongoLine) {
    $rawMongoUrl = (($mongoLine -split '=', 2)[1]).Trim().Trim('"').Trim("'")
    try {
      $mongoUri = [Uri]$rawMongoUrl
      if ($mongoUri.Scheme -match '^mongodb(\+srv)?$' -and $mongoUri.Host) {
        $userInfo = $mongoUri.UserInfo
        $mongoUser = 'nelsonherazoi'
        if ($userInfo) {
          $mongoUser = (($userInfo -split ':', 2)[0]).Trim()
        }
        $mongoDbAndQuery = $mongoUri.PathAndQuery
        if (-not $mongoDbAndQuery -or $mongoDbAndQuery -eq '/') {
          $mongoDbAndQuery = '/cop?retryWrites=true&w=majority&appName=Cluster0'
        }
        $placeholderMongoUrl = "$($mongoUri.Scheme)://${mongoUser}:<db_password>@$($mongoUri.Host)$mongoDbAndQuery"
      }
    } catch {
      Write-Warning "No se pudo interpretar MONGODB_URL; se usara el host Atlas por defecto del script."
    }
  }
  $lines = $lines | Where-Object { $_ -notmatch '^\s*MONGODB_URL=mongodb.*@[^<]+' }
  $lines += "MONGODB_URL=$placeholderMongoUrl"
}

# CORS + Vercel (PublicWeb en pa-cop-escalable-2qx1.vercel.app)
$defaultVercelPublic = 'https://pa-cop-escalable-2qx1.vercel.app'
$vercelPublic = $defaultVercelPublic
$vLine = $lines | Where-Object { $_ -match '^\s*VERCEL_PUBLIC_WEB_URL\s*=' } | Select-Object -First 1
if ($vLine) {
  $vercelPublic = (($vLine -split '=', 2)[1]).Trim().Trim('"').Trim("'")
}

if (-not ($lines | Where-Object { $_ -match '^\s*CORS_ALLOW_VERCEL\s*=' })) {
  $lines += 'CORS_ALLOW_VERCEL=true'
}

$origins = @()
$corsLine = $lines | Where-Object { $_ -match '^\s*CORS_ORIGINS\s*=' } | Select-Object -First 1
if ($corsLine) {
  $origins = (($corsLine -split '=', 2)[1]).Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}
foreach ($o in @($vercelPublic)) {
  if ($o -and $origins -notcontains $o) { $origins += $o }
}
$lines = @($lines | Where-Object { $_ -notmatch '^\s*CORS_ORIGINS\s*=' })
$lines += "CORS_ORIGINS=$($origins -join ',')"

if (-not ($lines | Where-Object { $_ -match '^\s*PUBLIC_API_ORIGIN\s*=' })) {
  $lines += "PUBLIC_API_ORIGIN=$defaultApiOrigin"
}

if (-not ($lines | Where-Object { $_ -match '^\s*SETUP_ADMIN_SECRET\s*=' })) {
  $lines += 'SETUP_ADMIN_SECRET=cop-atlas-setup-2026'
}

if (-not ($lines | Where-Object { $_ -match '^\s*APP_BOOTSTRAP_ADMIN_RESET\s*=' })) {
  $lines += 'APP_BOOTSTRAP_ADMIN_RESET=false'
}

# Evita REDIS_URL en el bundle salvo flag explicito (Blueprint cop-redis en Render)
if (-not $IncludeUpstashRedis) {
  $lines = $lines | Where-Object { $_ -notmatch '^\s*REDIS_URL\s*=' }
}

$lines | Set-Content -Path $dst -Encoding UTF8
Write-Host "Creado: $dst"
Write-Host "  CORS_ORIGINS incluye: $vercelPublic"
Write-Host ""
Write-Host "Siguiente paso en Render:"
Write-Host "  1. cop-nest-api -> Environment"
Write-Host "  2a. Secret Files -> Add -> filename: cop-production.env -> pegar contenido de render-upload.env"
Write-Host "  2b. O Environment -> From .env -> render-upload.env"
if ($IncludeUpstashRedis) {
  Write-Host "  3. En Render reemplaza cualquier REDIS_URL vieja por la de este archivo (Upstash validado)"
} else {
  Write-Host "  3. En Render BORRA REDIS_URL manual si ves WRONGPASS en logs (usa cop-redis del Blueprint)"
}
Write-Host "  4. API publica: $defaultApiOrigin"
Write-Host "  5. Save Changes -> Manual Deploy"
