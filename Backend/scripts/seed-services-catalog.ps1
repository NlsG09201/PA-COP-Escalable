Param(
  [string]$BaseUrl = "http://localhost:8080",
  [string]$Username = "admin@cop.local",
  [string]$Password = "Admin123ChangeMe",
  [string]$SiteId = ""
)

$ErrorActionPreference = "Stop"

function Invoke-JsonGet {
  Param(
    [string]$Uri,
    [hashtable]$Headers = @{}
  )
  return Invoke-RestMethod -Method GET -Uri $Uri -Headers $Headers -TimeoutSec 30
}

function Invoke-JsonPost {
  Param(
    [string]$Uri,
    [hashtable]$Body,
    [hashtable]$Headers = @{}
  )
  return Invoke-RestMethod -Method POST -Uri $Uri -Headers $Headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10) -TimeoutSec 30
}

function Invoke-JsonPut {
  Param(
    [string]$Uri,
    [hashtable]$Body,
    [hashtable]$Headers = @{}
  )
  return Invoke-RestMethod -Method PUT -Uri $Uri -Headers $Headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10) -TimeoutSec 30
}

if ([string]::IsNullOrWhiteSpace($SiteId)) {
  $sites = Invoke-JsonGet -Uri "$BaseUrl/public/sites"
  if ($sites.Count -eq 0) {
    throw "No active public sites found in $BaseUrl/public/sites"
  }
  $SiteId = $sites[0].id
}

$login = Invoke-JsonPost -Uri "$BaseUrl/api/auth/login" -Body @{
  username = $Username
  password = $Password
  siteId = $SiteId
}

$authHeaders = @{
  Authorization = "Bearer $($login.accessToken)"
}

$seed = @(
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

$current = Invoke-JsonGet -Uri "$BaseUrl/api/services" -Headers $authHeaders
$index = @{}
foreach ($item in $current) {
  $key = ($item.name.ToLowerInvariant() + "|" + $item.category.ToUpperInvariant())
  $index[$key] = $item
}

$created = 0
$updated = 0
$failed = 0

foreach ($item in $seed) {
  $key = ($item.name.ToLowerInvariant() + "|" + $item.category.ToUpperInvariant())
  if ($index.ContainsKey($key)) {
    $existing = $index[$key]
    try {
      Invoke-JsonPut -Uri "$BaseUrl/api/services/$($existing.id)" -Headers $authHeaders -Body @{
        name = $item.name
        description = $item.description
        category = $item.category
        price = $item.price
        duration = $item.duration
      } | Out-Null
      $updated++
      Write-Host "updated: $($item.name)"
    } catch {
      $failed++
      Write-Host "failed update: $($item.name) -> $($_.Exception.Message)"
    }
    continue
  }

  try {
    Invoke-JsonPost -Uri "$BaseUrl/api/services" -Headers $authHeaders -Body @{
      name = $item.name
      description = $item.description
      category = $item.category
      price = $item.price
      duration = $item.duration
    } | Out-Null
    $created++
    Write-Host "created: $($item.name)"
  } catch {
    $failed++
    Write-Host "failed create: $($item.name) -> $($_.Exception.Message)"
  }
}

$final = Invoke-JsonGet -Uri "$BaseUrl/api/services" -Headers $authHeaders
Write-Host ""
Write-Host "done created=$created updated=$updated failed=$failed total=$($final.Count)"
