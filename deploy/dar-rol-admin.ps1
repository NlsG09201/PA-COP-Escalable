# Asigna SUPER_ADMIN + ADMIN a nelsonherazoi (u otro usuario) en Atlas.
#
#   .\deploy\dar-rol-admin.ps1
#   .\deploy\dar-rol-admin.ps1 -Usuario nelsonherazoi

param([string]$Usuario = '')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

$args = @('scripts/asignar-rol-admin.mjs')
if ($Usuario) { $args += '--user', $Usuario }

node @args
Pop-Location
