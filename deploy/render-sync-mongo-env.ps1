# Alias: usa render-sync-env.ps1 (Mongo + Redis + CORS).
#   $env:RENDER_API_KEY = "rnd_..."
#   .\deploy\render-sync-env.ps1

& (Join-Path $PSScriptRoot 'render-sync-env.ps1') @PSBoundParameters
