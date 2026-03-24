Param(
  [string]$BaseUrl = "http://localhost:8080",
  [string]$Username = "admin@cop.local",
  [string]$Password = "Admin123ChangeMe",
  [string]$SiteId = ""
)

$ErrorActionPreference = "Stop"

function Normalize-Name([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return "" }
  $v = $value.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($c in $v.ToCharArray()) {
    $cat = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($c)
    if ($cat -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($c)
    }
  }
  $ascii = $sb.ToString().Normalize([Text.NormalizationForm]::FormC).ToLowerInvariant()
  $ascii = ($ascii -replace "[^a-z0-9]+", " ").Trim()
  return $ascii
}

function Invoke-JsonGet($uri, $headers = @{}) {
  Invoke-RestMethod -Method GET -Uri $uri -Headers $headers -TimeoutSec 30
}

function Invoke-JsonPost($uri, $body, $headers = @{}) {
  Invoke-RestMethod -Method POST -Uri $uri -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 10) -TimeoutSec 30
}

function Invoke-JsonPut($uri, $body, $headers = @{}) {
  Invoke-RestMethod -Method PUT -Uri $uri -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 10) -TimeoutSec 30
}

if ([string]::IsNullOrWhiteSpace($SiteId)) {
  $sites = Invoke-JsonGet "$BaseUrl/public/sites"
  if ($sites.Count -eq 0) { throw "No public sites found" }
  $SiteId = $sites[0].id
}

$login = Invoke-JsonPost "$BaseUrl/api/auth/login" @{
  username = $Username
  password = $Password
  siteId = $SiteId
}
$headers = @{ Authorization = "Bearer $($login.accessToken)" }

$canonical = @(
  @{ name = "Blanqueamiento Dental"; category = "ODONTOLOGIA"; price = 350000; duration = 60; description = "Tratamiento estetico para aclarar el tono dental." },
  @{ name = "Brackets Esteticos (Ceramica, Zafiro)"; category = "ODONTOLOGIA"; price = 100000; duration = 60; description = "Ortodoncia estetica con materiales de baja visibilidad." },
  @{ name = "Brackets Metalicos"; category = "ODONTOLOGIA"; price = 100000; duration = 60; description = "Ortodoncia tradicional para alineacion dental." },
  @{ name = "Carillas de Porcelana y Resina"; category = "ODONTOLOGIA"; price = 100000; duration = 60; description = "Rehabilitacion estetica con carillas." },
  @{ name = "Contorneado Estetico"; category = "ODONTOLOGIA"; price = 100000; duration = 45; description = "Redefinicion estetica de bordes y forma dental." },
  @{ name = "Coronas Dentales"; category = "ODONTOLOGIA"; price = 100000; duration = 60; description = "Restauracion con coronas funcionales y esteticas." },
  @{ name = "Coronas sobre Implantes"; category = "ODONTOLOGIA"; price = 2500000; duration = 90; description = "Coronas fijas sobre implantes osteointegrados." },
  @{ name = "Empastes y Restauraciones"; category = "ODONTOLOGIA"; price = 100000; duration = 45; description = "Tratamiento de caries y restauracion funcional." },
  @{ name = "Endodoncias (Tratamientos de Conducto)"; category = "ODONTOLOGIA"; price = 100000; duration = 90; description = "Tratamiento de conductos para conservar piezas dentales." },
  @{ name = "Extracciones Dentales"; category = "ODONTOLOGIA"; price = 100000; duration = 45; description = "Extraccion simple o compleja de piezas dentales." },
  @{ name = "Implantes de Titanio"; category = "ODONTOLOGIA"; price = 2500000; duration = 90; description = "Rehabilitacion oral con implantes." },
  @{ name = "Limpieza y Profilaxis"; category = "ODONTOLOGIA"; price = 85000; duration = 45; description = "Higiene oral profesional preventiva." },
  @{ name = "Ortodoncia Invisible (Aligners)"; category = "ODONTOLOGIA"; price = 1500000; duration = 60; description = "Alineadores transparentes para ortodoncia." },
  @{ name = "Puentes sobre Implantes"; category = "ODONTOLOGIA"; price = 2500000; duration = 90; description = "Puentes dentales soportados sobre implantes." },
  @{ name = "Regeneracion Osea"; category = "ODONTOLOGIA"; price = 100000; duration = 60; description = "Procedimiento de regeneracion osea guiada." },
  @{ name = "Retenedores"; category = "ODONTOLOGIA"; price = 100000; duration = 45; description = "Dispositivos de contencion post-ortodoncia." },
  @{ name = "Evaluacion Psicologica"; category = "PSICOLOGIA"; price = 100000; duration = 60; description = "Evaluacion inicial del estado psicologico." },
  @{ name = "Terapia de Pareja"; category = "PSICOLOGIA"; price = 120000; duration = 60; description = "Sesion de acompanamiento para parejas." },
  @{ name = "Terapia Individual"; category = "PSICOLOGIA"; price = 120000; duration = 60; description = "Sesion individual de psicoterapia." },
  @{ name = "Terapia Infantil"; category = "PSICOLOGIA"; price = 120000; duration = 60; description = "Intervencion psicologica para ninos." }
)

$existing = Invoke-JsonGet "$BaseUrl/api/services" $headers

# Build canonical key set
$canonicalMap = @{}
foreach ($c in $canonical) {
  $key = (Normalize-Name $c.name) + "|" + $c.category
  $canonicalMap[$key] = $c
}

# Group existing services by normalized key
$groups = @{}
foreach ($s in $existing) {
  $key = (Normalize-Name $s.name) + "|" + $s.category
  if (-not $groups.ContainsKey($key)) { $groups[$key] = @() }
  $groups[$key] += $s
}

$updated = 0
$deleted = 0
$created = 0

# Ensure exactly one service per canonical key
foreach ($entry in $canonicalMap.GetEnumerator()) {
  $key = $entry.Key
  $target = $entry.Value
  $matches = @()
  if ($groups.ContainsKey($key)) { $matches = $groups[$key] }

  if ($matches.Count -eq 0) {
    Invoke-JsonPost "$BaseUrl/api/services" @{
      name = $target.name
      description = $target.description
      category = $target.category
      price = $target.price
      duration = $target.duration
    } $headers | Out-Null
    $created++
    Write-Host "created: $($target.name)"
    continue
  }

  # Keep newest item as canonical holder
  $keep = $matches | Sort-Object createdAt -Descending | Select-Object -First 1

  Invoke-JsonPut "$BaseUrl/api/services/$($keep.id)" @{
    name = $target.name
    description = $target.description
    category = $target.category
    price = [int64]$target.price
    duration = [int]$target.duration
  } $headers | Out-Null
  $updated++
  Write-Host "updated: $($target.name)"

  $duplicates = $matches | Where-Object { $_.id -ne $keep.id }
  foreach ($dup in $duplicates) {
    Invoke-RestMethod -Method DELETE -Uri "$BaseUrl/api/services/$($dup.id)" -Headers $headers -TimeoutSec 30 | Out-Null
    $deleted++
    Write-Host "deleted duplicate: $($dup.name) ($($dup.id))"
  }
}

# Remove services not in canonical set
$after = Invoke-JsonGet "$BaseUrl/api/services" $headers
foreach ($s in $after) {
  $key = (Normalize-Name $s.name) + "|" + $s.category
  if (-not $canonicalMap.ContainsKey($key)) {
    Invoke-RestMethod -Method DELETE -Uri "$BaseUrl/api/services/$($s.id)" -Headers $headers -TimeoutSec 30 | Out-Null
    $deleted++
    Write-Host "deleted extra: $($s.name) ($($s.id))"
  }
}

$final = Invoke-JsonGet "$BaseUrl/api/services" $headers
Write-Host ""
Write-Host "done created=$created updated=$updated deleted=$deleted total=$($final.Count)"
