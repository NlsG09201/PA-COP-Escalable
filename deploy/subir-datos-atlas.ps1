# Sube una base MongoDB local (o un dump) a MongoDB Atlas.
#
# Requisitos (una de estas):
#   - MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools
#   - O Docker con el contenedor mongo del proyecto
#
# Uso típico (local Docker → Atlas):
#   1. Levanta Mongo local:  cd nest-migration; docker compose up -d mongodb
#   2. En .env (raíz) tienes MONGODB_URL apuntando a Atlas (base cop)
#   3. .\deploy\subir-datos-atlas.ps1
#
# Solo restaurar un dump ya hecho:
#   .\deploy\subir-datos-atlas.ps1 -SoloRestore -DumpDir .\deploy\mongo-dump
#
# Reemplazar colecciones existentes en Atlas (cuidado):
#   .\deploy\subir-datos-atlas.ps1 -ReemplazarColecciones

param(
  [string]$SourceUri = 'mongodb://127.0.0.1:27017',
  [string]$SourceDb = 'cop_escalable',
  [string]$TargetDb = 'cop',
  [string]$DumpDir = '',
  [switch]$SoloRestore,
  [switch]$ReemplazarColecciones,
  [switch]$UsarDocker,
  [string]$DockerContainer = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

if (-not $DumpDir) {
  $DumpDir = Join-Path $PSScriptRoot 'mongo-dump'
}

function Get-DotEnvValue([string]$Key) {
  if (-not (Test-Path $envFile)) { return $null }
  $line = Get-Content $envFile |
    Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" -and $_ -notmatch '^\s*#' } |
    Select-Object -First 1
  if (-not $line) { return $null }
  ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

function Test-MongoTool([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  return [bool]$cmd
}

function Resolve-DockerMongoContainer() {
  if ($DockerContainer) { return $DockerContainer }
  $names = @(docker ps --format '{{.Names}}' 2>$null)
  $match = $names | Where-Object { $_ -match 'mongo' } | Select-Object -First 1
  return $match
}

function Invoke-Mongodump([string]$OutDir) {
  $uri = "$SourceUri/$SourceDb"
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

  if ($UsarDocker -or -not (Test-MongoTool 'mongodump')) {
    $container = Resolve-DockerMongoContainer
    if (-not $container) {
      Write-Error @"
No hay mongodump en PATH ni contenedor mongo en Docker.
  Opción A: instala MongoDB Database Tools
  Opción B: cd nest-migration; docker compose up -d mongodb; .\deploy\subir-datos-atlas.ps1 -UsarDocker
"@
    }
    Write-Host "mongodump via Docker ($container)..." -ForegroundColor Cyan
    docker exec $container mongodump --db=$SourceDb --out=/tmp/mongo-dump | Out-Null
    if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    docker cp "${container}:/tmp/mongo-dump/$SourceDb" $OutDir
    docker exec $container rm -rf /tmp/mongo-dump | Out-Null
    return
  }

  Write-Host "mongodump $uri -> $OutDir" -ForegroundColor Cyan
  & mongodump --uri=$uri --out=$OutDir
}

function Resolve-AtlasUri() {
  $url = Get-DotEnvValue 'MONGODB_ATLAS_URI'
  if (-not $url) { $url = Get-DotEnvValue 'MONGODB_URL' }
  if (-not $url -or $url -match '<db_password>') {
    $pass = Get-DotEnvValue 'MONGODB_PASSWORD'
    if ($pass) {
      $user = Get-DotEnvValue 'MONGODB_USER'
      if (-not $user) { $user = 'nelsonherazoi' }
      $host = Get-DotEnvValue 'MONGODB_HOST'
      if (-not $host) { $host = 'cluster0.6oyhyja.mongodb.net' }
      $encUser = [uri]::EscapeDataString($user)
      $encPass = [uri]::EscapeDataString($pass)
      $url = "mongodb+srv://${encUser}:${encPass}@${host}/${TargetDb}?retryWrites=true&w=majority&appName=Cluster0"
    }
  }
  if (-not $url -or $url -notmatch '^mongodb') {
    Write-Error 'Falta MONGODB_URL o MONGODB_PASSWORD en .env (raíz) con URI de Atlas.'
  }
  if ($url -match '<db_password>') {
    Write-Error 'MONGODB_URL aún tiene <db_password>. Pon MONGODB_PASSWORD en .env.'
  }
  return $url
}

function Invoke-Mongorestore([string]$AtlasUri, [string]$DumpPath) {
  $sourceDumpDb = Join-Path $DumpPath $SourceDb
  if (-not (Test-Path $sourceDumpDb)) {
    $alt = Get-ChildItem -Path $DumpPath -Directory | Select-Object -First 1
    if ($alt) { $sourceDumpDb = $alt.FullName; $SourceDb = $alt.Name }
    else { Write-Error "No se encontró dump en $DumpPath (esperaba carpeta $SourceDb)" }
  }

  $args = @(
    '--uri', $AtlasUri,
    '--nsInclude', "${SourceDb}.*",
    '--nsFrom', "${SourceDb}.*",
    '--nsTo', "${TargetDb}.*"
  )
  if ($ReemplazarColecciones) { $args += '--drop' }

  if (Test-MongoTool 'mongorestore') {
    Write-Host "mongorestore -> Atlas (base $TargetDb)..." -ForegroundColor Cyan
    & mongorestore @args $DumpPath
    return
  }

  $container = Resolve-DockerMongoContainer
  if (-not $container) {
    Write-Error 'Instala mongorestore (MongoDB Database Tools) para subir a Atlas.'
  }

  Write-Host "mongorestore via Docker ($container)..." -ForegroundColor Cyan
  docker exec $container mkdir -p /tmp/mongo-restore | Out-Null
  docker cp $sourceDumpDb "${container}:/tmp/mongo-restore/$SourceDb"
  $dockerArgs = @(
    'exec', $container, 'mongorestore',
    "--uri=$AtlasUri",
    "--nsInclude=${SourceDb}.*",
    "--nsFrom=${SourceDb}.*",
    "--nsTo=${TargetDb}.*"
  )
  if ($ReemplazarColecciones) { $dockerArgs += '--drop' }
  $dockerArgs += "/tmp/mongo-restore"
  & docker @dockerArgs
  docker exec $container rm -rf /tmp/mongo-restore | Out-Null
}

Write-Host '=== Subir datos a MongoDB Atlas ===' -ForegroundColor Cyan
Write-Host "Origen:  $SourceDb @ $SourceUri"
Write-Host "Destino: $TargetDb (Atlas)"
Write-Host ''

$atlasUri = Resolve-AtlasUri

if (-not $SoloRestore) {
  Invoke-Mongodump -OutDir $DumpDir
}

Invoke-Mongorestore -AtlasUri $atlasUri -DumpPath $DumpDir

Write-Host ''
Write-Host 'Listo. Comprueba en Atlas -> Browse Collections -> base' $TargetDb -ForegroundColor Green
Write-Host 'O: https://pa-cop-escalable.onrender.com/health  (mongodb: ok)'
Write-Host ''
Write-Host 'Si Atlas estaba vacío y solo necesitas sedes + admin, también puedes:'
Write-Host '  Render Live + SEED_COLOMBIA_SITES=true + APP_BOOTSTRAP_ADMIN_* en Environment'
