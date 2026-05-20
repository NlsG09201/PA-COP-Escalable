# Arreglo inmediato cop-nest-api en Render (sin API key).
# Ejecutar en la raiz: .\deploy\render-arreglo-urgente.ps1

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'exportar-cop-production-env-b64.ps1')

$upload = Join-Path $PSScriptRoot 'render-upload.env'
$lines = Get-Content $upload -Encoding UTF8 | Where-Object { $_ -match '^\s*(MONGODB_PASSWORD|REDIS_URL)=' }

Write-Host ''
Write-Host '=== OPCION 1 (mas simple): 2 variables en Render ===' -ForegroundColor Green
Write-Host 'Dashboard -> cop-nest-api -> Environment -> Add:'
foreach ($line in $lines) {
  $key = ($line -split '=', 2)[0].Trim()
  Write-Host "  - $key  (copia el valor desde deploy/render-upload.env)"
}
Write-Host 'BORRA la variable REDIS_URL si su valor contiene: your-instance.upstash.io'
Write-Host 'Save Changes -> Manual Deploy'
Write-Host ''
Write-Host '=== OPCION 2 (una sola variable): COP_PRODUCTION_ENV_B64 ===' -ForegroundColor Cyan
Write-Host 'Ya esta en el portapapeles y en deploy/cop-production-env.b64.txt'
Write-Host 'Add variable COP_PRODUCTION_ENV_B64 -> pegar TODO (una linea) -> Save -> Manual Deploy'
Write-Host ''
Write-Host '=== Secret File (solo si lo usas) ===' -ForegroundColor Yellow
Write-Host 'Nombre exacto del archivo: cop-production.env'
Write-Host 'Contenido: copiar TODO deploy/render-upload.env (no dejar vacio)'
Write-Host 'Si ..data sale (0 file(s)), el Secret File esta vacio o mal nombrado.'
Write-Host ''
Write-Host 'Tras deploy, logs deben mostrar:'
Write-Host '  COP_PRODUCTION_ENV_B64=set  (o Loaded N env var(s))'
Write-Host '  MONGODB_PASSWORD=set  REDIS_URL=ok'
