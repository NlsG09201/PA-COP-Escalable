# Abre el archivo para copiar/pegar en Render y deja 2 variables criticas en el portapapeles.
# Uso: .\deploy\render-pegar-ahora.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'generar-render-upload-env.ps1')

$upload = Join-Path $PSScriptRoot 'render-upload.env'
$passLine = Get-Content $upload | Where-Object { $_ -match '^\s*MONGODB_PASSWORD=' } | Select-Object -First 1
$redisLine = Get-Content $upload | Where-Object { $_ -match '^\s*REDIS_URL=' } | Select-Object -First 1

if (-not $passLine -or -not $redisLine) {
  Write-Error 'Falta MONGODB_PASSWORD o REDIS_URL en render-upload.env. Revisa .env local.'
}

Set-Clipboard -Value $passLine
Start-Process notepad.exe $upload

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ' RENDER: cop-nest-api -> Environment' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '1) En Render, ELIMINA el Secret File vacio (si existe):'
Write-Host '   Secret Files -> borrar cop-production.env vacio'
Write-Host '   (Tus logs: ..data 0 file(s) = montaje vacio)'
Write-Host ''
Write-Host '2) PORTAPAPELES = MONGODB_PASSWORD (pega ahora):'
Write-Host "   Key:   MONGODB_PASSWORD"
Write-Host '   Value: (ya copiado) -> Add -> pegar -> NO guardes aun'
Write-Host ''
Write-Host '3) Segunda variable - ejecuta en otra ventana PowerShell:'
Write-Host '   Set-Clipboard -Value ''' + ($redisLine -replace "'", "''") + ''''
Write-Host '   O copia la linea REDIS_URL= del Notepad abierto'
Write-Host ''
Write-Host '4) BORRA REDIS_URL si dice your-instance.upstash.io'
Write-Host ''
Write-Host '5) Save Changes (abajo) -> Manual Deploy'
Write-Host ''
Write-Host 'Notepad abierto con TODAS las variables (import From .env file).'
Write-Host ''

$resp = Read-Host 'Pulsa Enter cuando hayas pegado MONGODB_PASSWORD en Render'
Set-Clipboard -Value $redisLine
Write-Host 'PORTAPAPELES ahora = REDIS_URL. Pegala en Render y Save + Manual Deploy.'
