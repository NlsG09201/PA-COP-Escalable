param(
    [string]$BaseUrl = "http://localhost:8080",
    [int]$TotalRequests = 20
)

$ErrorActionPreference = "Stop"

# 1. Fetch site for login
Write-Host "Fetching available sites..." -ForegroundColor Cyan
$sites = Invoke-RestMethod -Method Get -Uri "$BaseUrl/public/sites"
if ($sites.Count -eq 0) {
    throw "No active sites found to test login."
}
$siteId = $sites[0].id
Write-Host "Using Site: $($sites[0].name) ($siteId)" -ForegroundColor Gray

# 2. Login to get token
Write-Host "Logging in..." -ForegroundColor Cyan
$loginBody = @{
    username = "admin@cop.local"
    password = "Admin123ChangeMe"
    siteId = $siteId
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" -Body $loginBody -ContentType "application/json"
$token = $loginResponse.accessToken
$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

# 3. Get a patient ID for testing
Write-Host "Fetching patient for testing..." -ForegroundColor Cyan
try {
    $patients = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/patients" -Headers $headers
    if ($patients.Count -gt 0) {
        $patientId = $patients[0].id
    } else {
        throw "No patients found"
    }
} catch {
    Write-Host "Failed to fetch patient directly, attempting fallback..." -ForegroundColor Yellow
    $appts = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/appointments?from=2020-01-01T00:00:00Z&to=2030-01-01T00:00:00Z" -Headers $headers
    $patientId = $appts[0].patientId
}
Write-Host "Testing with Patient ID: $patientId" -ForegroundColor Gray

# 4. Psychology Analysis (Sentiment + Metrics)
Write-Host "`n--- Starting Psychology Analysis Test ($TotalRequests requests) ---" -ForegroundColor Yellow
$psychResults = @()
for ($i = 1; $i -le $TotalRequests; $i++) {
    $body = @{
        sourceType = "CLINICAL_INTERVIEW"
        clinicalContext = "Sesión $i. El paciente reporta mejoras en su estado de ánimo, aunque persiste algo de ansiedad por el trabajo."
    } | ConvertTo-Json
    $start = Get-Date
    try {
        $res = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/ai-assist/patients/$patientId/analyze-context" -Body $body -Headers $headers -ContentType "application/json"
        
        # Approve to trigger snapshot
        $sid = $res.id
        if (!$sid) { throw "No suggestion ID returned" }
        
        $approveBody = @{ note = "Benchmark approval" } | ConvertTo-Json
        Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/ai-assist/suggestions/$sid/approve" -Body $approveBody -Headers $headers -ContentType "application/json"
        
        $end = Get-Date
        $psychResults += [PSCustomObject]@{ Success = $true; ElapsedMs = ($end - $start).TotalMilliseconds }
        Write-Host "." -NoNewline
    } catch {
        $psychResults += [PSCustomObject]@{ Success = $false; ElapsedMs = ((Get-Date) - $start).TotalMilliseconds }
        Write-Host "X" -NoNewline
        Write-Verbose "Error in psychology test: $($_.Exception.Message)" -Verbose
    }
}

$psychAvg = ($psychResults | Measure-Object -Property ElapsedMs -Average).Average
$psychSuccess = ($psychResults | Where-Object { $_.Success }).Count
Write-Host "`nPsychology: Avg $($psychAvg.ToString("F2")) ms, Success $(($psychSuccess / $TotalRequests) * 100)%"

# 5. Odontology Planning
Write-Host "`n--- Starting Odontology Planning Test ($TotalRequests requests) ---" -ForegroundColor Yellow
$odoResults = @()
for ($i = 1; $i -le $TotalRequests; $i++) {
    $start = Get-Date
    try {
        $res = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/odontology/patients/$patientId/suggest-plan" -Headers $headers
        $end = Get-Date
        $odoResults += [PSCustomObject]@{ Success = $true; ElapsedMs = ($end - $start).TotalMilliseconds }
        Write-Host "." -NoNewline
    } catch {
        $odoResults += [PSCustomObject]@{ Success = $false; ElapsedMs = ((Get-Date) - $start).TotalMilliseconds }
        Write-Host "X" -NoNewline
    }
}

$odoAvg = ($odoResults | Measure-Object -Property ElapsedMs -Average).Average
$odoSuccess = ($odoResults | Where-Object { $_.Success }).Count
Write-Host "`nOdontology: Avg $($odoAvg.ToString("F2")) ms, Success $(($odoSuccess / $TotalRequests) * 100)%"
