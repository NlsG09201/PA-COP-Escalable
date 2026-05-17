# Entrena el clasificador del servicio ai-diagnosis-service dentro de Docker.
# Requisitos: perfil `ai` construido y un directorio de dataset montado (imagenes + etiquetas segun train/train_model.py).
#
# Ejemplo (PowerShell, desde la raiz del repo):
#   docker compose --profile ai build ai-diagnosis-service
#   .\scripts\ai-train-docker.ps1 -DataDir "C:\datos\dental-train"
#
param(
  [Parameter(Mandatory = $true)]
  [string] $DataDir,
  [int] $Epochs = 20
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Test-Path -LiteralPath $DataDir)) {
  throw "DataDir no existe: $DataDir"
}

docker compose --profile ai run --rm `
  -v "${DataDir}:/data/trainset:ro" `
  ai-diagnosis-service `
  python -m train.train_model --data-dir /data/trainset --epochs $Epochs
