# Genera deploy/render-upload.env y copia COP_PRODUCTION_ENV_B64 al portapapeles
# para pegar UNA sola variable en Render (cop-nest-api -> Environment).
#
#   .\deploy\exportar-cop-production-env-b64.ps1

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'generar-render-upload-env.ps1')

$envFile = Join-Path $PSScriptRoot 'render-upload.env'
$content = Get-Content $envFile -Raw -Encoding UTF8
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$b64 = [Convert]::ToBase64String($bytes)

$out = Join-Path $PSScriptRoot 'cop-production-env.b64.txt'
$b64 | Set-Content -Path $out -Encoding ASCII -NoNewline

Set-Clipboard -Value $b64

Write-Host ''
Write-Host '=== Render: cop-nest-api -> Environment ===' -ForegroundColor Cyan
Write-Host '1. Add variable: COP_PRODUCTION_ENV_B64'
Write-Host '2. Value: pegado en portapapeles (tambien en deploy/cop-production-env.b64.txt)'
Write-Host '3. BORRA REDIS_URL si contiene your-instance.upstash.io (deja la de cop-redis o la de Upstash en el .env)'
Write-Host '4. Save Changes -> Manual Deploy'
Write-Host ''
Write-Host "Base64 length: $($b64.Length) chars"
