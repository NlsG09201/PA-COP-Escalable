param(
  [string]$Source = (Join-Path $PSScriptRoot '..\docs\ANALISIS_TECNICO_SPRING_BOOT_COMPLETO.md'),
  [string]$Pdf = (Join-Path $PSScriptRoot '..\docs\ANALISIS_TECNICO_SPRING_BOOT_COMPLETO.pdf')
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Source)) { throw "No existe el documento fuente: $Source" }

$wdCollapseEnd = 0
$wdAlignCenter = 1
$wdAlignJustify = 3
$wdPageNumberStyleArabic = 0
$wdFieldPage = 33
$wdExportFormatPDF = 17
$wdFormatDocumentDefault = 16
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$document = $word.Documents.Add()

try {
  $section = $document.Sections.Item(1)
  $section.PageSetup.PaperSize = 1 # Letter, as in the reference PDF
  $section.PageSetup.TopMargin = $word.InchesToPoints(0.85)
  $section.PageSetup.BottomMargin = $word.InchesToPoints(0.75)
  $section.PageSetup.LeftMargin = $word.InchesToPoints(0.8)
  $section.PageSetup.RightMargin = $word.InchesToPoints(0.8)

  $header = $section.Headers.Item(1).Range
  $header.Text = 'CENTRO COP ESCALABLE  |  ANALISIS TECNICO'
  $header.Font.Name = 'Calibri'
  $header.Font.Size = 8
  $header.Font.Color = 4210752
  $header.ParagraphFormat.Alignment = $wdAlignCenter
  $footer = $section.Footers.Item(1).Range
  $footer.Text = 'Documento tecnico interno  |  Pagina '
  $footer.Collapse($wdCollapseEnd)
  $footer.Fields.Add($footer, $wdFieldPage) | Out-Null
  $footer.Font.Name = 'Calibri'
  $footer.Font.Size = 8
  $footer.ParagraphFormat.Alignment = $wdAlignCenter

  function Add-Paragraph([string]$text, [string]$font, [double]$size, [int]$color, [int]$alignment = $wdAlignJustify, [bool]$bold = $false, [int]$spaceAfter = 6) {
    $range = $document.Content
    $range.Collapse($wdCollapseEnd)
    $range.Text = "$text`r"
    $range.Font.Name = $font
    $range.Font.Size = $size
    $range.Font.Bold = [int]$bold
    $range.Font.Color = $color
    $range.ParagraphFormat.Alignment = $alignment
    $range.ParagraphFormat.SpaceAfter = $spaceAfter
    return $range
  }

  Add-Paragraph 'ANALISIS TECNICO COMPLETO' 'Calibri' 25 4210752 $wdAlignCenter $true 8 | Out-Null
  Add-Paragraph 'Centro COP Escalable y migracion a Spring Boot' 'Calibri' 17 4210752 $wdAlignCenter $false 22 | Out-Null
  Add-Paragraph 'Inventario de servicios, arquitectura, seguridad, contratos y plan de migracion' 'Calibri' 11 8421504 $wdAlignCenter $false 16 | Out-Null
  Add-Paragraph 'Fecha de revision: 31 de agosto de 2026' 'Calibri' 10 8421504 $wdAlignCenter $false 5 | Out-Null
  Add-Paragraph 'Fuente: analisis actualizado del repositorio y alcance tecnico vigente.' 'Calibri' 9 8421504 $wdAlignCenter $false 20 | Out-Null

  $lines = Get-Content -LiteralPath $Source -Encoding UTF8
  $table = @()
  function Flush-Table {
    if ($script:table.Count -lt 3) { $script:table = @(); return }
    $rows = @($script:table | Where-Object { $_ -notmatch '^\|[-| ]+\|$' })
    $cells = $rows[0].Trim('|').Split('|').Count
    $anchor = $document.Content
    $anchor.Collapse($wdCollapseEnd)
    $wordTable = $document.Tables.Add($anchor, $rows.Count, $cells)
    $wordTable.Borders.Enable = 1
    $wordTable.Range.Font.Name = 'Calibri'
    $wordTable.Range.Font.Size = 9.5
    for ($r = 0; $r -lt $rows.Count; $r++) {
      $values = $rows[$r].Trim('|').Split('|') | ForEach-Object { $_.Trim() -replace '\*\*','' -replace '`','' }
      for ($c = 0; $c -lt $cells; $c++) {
        $cell = $wordTable.Cell($r + 1, $c + 1)
        $cell.Range.Text = " $($values[$c]) `r"
        if ($r -eq 0) { $cell.Range.Font.Bold = 1; $cell.Shading.BackgroundPatternColor = 14277081 }
      }
    }
    $after = $document.Content
    $after.Collapse($wdCollapseEnd)
    $after.InsertAfter("`r")
    $script:table = @()
  }

  foreach ($rawLine in $lines) {
    $line = $rawLine.TrimEnd()
    if ($line -match '^\|') { $table += $line; continue }
    Flush-Table
    if ([string]::IsNullOrWhiteSpace($line) -or $line -match '^```') { continue }
    if ($line -match '^# ') { continue }
    if ($line -match '^## (.+)$') { Add-Paragraph $matches[1] 'Calibri' 15 4210752 $wdAlignJustify $true 7 | Out-Null; continue }
    if ($line -match '^### (.+)$') { Add-Paragraph $matches[1] 'Calibri' 11.5 4210752 $wdAlignJustify $true 5 | Out-Null; continue }
    $text = $line -replace '\*\*','' -replace '`',''
    if ($text -match '^[-*]\s+(.+)$') { Add-Paragraph "- $($matches[1])" 'Calibri' 11.5 0 $wdAlignJustify $false 5 | Out-Null; continue }
    if ($text -match '^\d+\.\s+(.+)$') { Add-Paragraph "$($matches[0])" 'Calibri' 11.5 0 $wdAlignJustify $false 5 | Out-Null; continue }
    Add-Paragraph $text 'Calibri' 11.5 0 $wdAlignJustify $false 7 | Out-Null
  }
  Flush-Table
  $document.ExportAsFixedFormat($Pdf, $wdExportFormatPDF)
} finally {
  $document.Close($false)
  $word.Quit()
}

Get-Item -LiteralPath $Pdf | Select-Object FullName, Length, LastWriteTime
