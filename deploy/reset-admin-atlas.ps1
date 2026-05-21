# Crea/resetea admin + roles SUPER_ADMIN y ADMIN en Atlas.
#
#   .\deploy\reset-admin-atlas.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
node .\scripts\seed-atlas-completo.mjs --pacientes 0
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
node .\scripts\asignar-rol-admin.mjs
Pop-Location
