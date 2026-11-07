param(
  [string]$Source = (Join-Path $PSScriptRoot '..\docs\ANALISIS_TECNICO_SPRING_BOOT_COMPLETO.md'),
  [string]$Html = (Join-Path $PSScriptRoot '..\docs\ANALISIS_TECNICO_SPRING_BOOT_COMPLETO.html'),
  [string]$Pdf = (Join-Path $PSScriptRoot '..\docs\ANALISIS_TECNICO_SPRING_BOOT_COMPLETO.pdf')
)

$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path -LiteralPath $chrome)) { throw 'Google Chrome no está instalado en la ruta esperada.' }
if (-not (Test-Path -LiteralPath $Source)) { throw "No existe el documento fuente: $Source" }

function Escape-Html([string]$text) {
  return [System.Net.WebUtility]::HtmlEncode($text)
}

function Inline-Markdown([string]$text) {
  $encoded = Escape-Html $text
  $encoded = [regex]::Replace($encoded, '`([^`]+)`', '<code>$1</code>')
  $encoded = [regex]::Replace($encoded, '\*\*([^*]+)\*\*', '<strong>$1</strong>')
  return $encoded
}

$lines = Get-Content -LiteralPath $Source -Encoding UTF8
$body = [System.Text.StringBuilder]::new()
$inCode = $false
$inList = $false
$inOrderedList = $false
$tableRows = @()

function Flush-Table {
  if ($script:tableRows.Count -eq 0) { return }
  [void]$script:body.Append('<table>')
  for ($rowIndex = 0; $rowIndex -lt $script:tableRows.Count; $rowIndex++) {
    if ($rowIndex -eq 1 -and $script:tableRows.Count -gt 2) { continue }
    $cells = $script:tableRows[$rowIndex].Trim('|').Split('|') | ForEach-Object { $_.Trim() }
    $tag = if ($rowIndex -eq 0) { 'th' } else { 'td' }
    [void]$script:body.Append('<tr>')
    foreach ($cell in $cells) { [void]$script:body.Append("<$tag>$(Inline-Markdown $cell)</$tag>") }
    [void]$script:body.Append('</tr>')
  }
  [void]$script:body.Append('</table>')
  $script:tableRows = @()
}

function Close-Lists {
  if ($script:inList) { [void]$script:body.Append('</ul>'); $script:inList = $false }
  if ($script:inOrderedList) { [void]$script:body.Append('</ol>'); $script:inOrderedList = $false }
}

foreach ($line in $lines) {
  if ($line -match '^\|') { $tableRows += $line; continue }
  Flush-Table

  if ($line -match '^```') {
    Close-Lists
    if ($inCode) { [void]$body.Append('</code></pre>') } else { [void]$body.Append('<pre><code>') }
    $inCode = -not $inCode
    continue
  }
  if ($inCode) { [void]$body.Append("$(Escape-Html $line)`n"); continue }
  if ([string]::IsNullOrWhiteSpace($line)) { Close-Lists; continue }

  if ($line -match '^(#{1,3})\s+(.+)$') {
    Close-Lists
    $level = $matches[1].Length
    [void]$body.Append("<h$level>$(Inline-Markdown $matches[2])</h$level>")
    continue
  }
  if ($line -match '^[-*]\s+(.+)$') {
    if (-not $inList) { Close-Lists; [void]$body.Append('<ul>'); $inList = $true }
    [void]$body.Append("<li>$(Inline-Markdown $matches[1])</li>")
    continue
  }
  if ($line -match '^\d+\.\s+(.+)$') {
    if (-not $inOrderedList) { Close-Lists; [void]$body.Append('<ol>'); $inOrderedList = $true }
    [void]$body.Append("<li>$(Inline-Markdown $matches[1])</li>")
    continue
  }
  Close-Lists
  [void]$body.Append("<p>$(Inline-Markdown $line)</p>")
}
Flush-Table
Close-Lists

$title = 'Analisis tecnico completo - Centro COP Escalable y migracion a Spring Boot'
$document = @"
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>$title</title>
<style>
@page { size: A4; margin: 16mm 14mm 18mm; }
body { font-family: Arial, sans-serif; color: #1f2937; font-size: 9.4pt; line-height: 1.43; }
h1 { color: #075b5a; font-size: 23pt; line-height: 1.15; margin: 0 0 8mm; }
h2 { color: #075b5a; font-size: 15pt; border-bottom: 1px solid #9dc9c5; padding-bottom: 2mm; margin: 9mm 0 4mm; break-after: avoid; }
h3 { color: #25465c; font-size: 11.5pt; margin: 6mm 0 2mm; break-after: avoid; }
p { margin: 0 0 3.2mm; } ul, ol { margin: 0 0 3.2mm; padding-left: 6mm; } li { margin: 1.2mm 0; }
table { border-collapse: collapse; width: 100%; margin: 4mm 0 5mm; font-size: 8.2pt; break-inside: avoid; }
th, td { border: 1px solid #b9c8cf; padding: 2.1mm; text-align: left; vertical-align: top; }
th { background: #e3f2f0; color: #123c45; font-weight: bold; } tr:nth-child(even) td { background: #f7fafb; }
code { font-family: Consolas, monospace; font-size: 8.3pt; background: #eef3f5; padding: .2mm .7mm; border-radius: 2px; }
pre { background: #102a43; color: #eaf4f4; padding: 3mm; white-space: pre-wrap; border-radius: 3px; font-size: 8.1pt; }
pre code { color: inherit; background: transparent; padding: 0; } strong { color: #153e4e; }
@media print { h2 { break-after: avoid; } table { break-inside: avoid; } }
</style></head><body>$($body.ToString())</body></html>
"@

Set-Content -LiteralPath $Html -Value $document -Encoding UTF8
$htmlUri = [Uri]::new((Resolve-Path -LiteralPath $Html)).AbsoluteUri
& $chrome --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$Pdf" $htmlUri
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Pdf)) { throw 'Chrome no pudo generar el PDF.' }
Write-Host "PDF generado: $Pdf"
