param(
    [string]$Uri = "http://127.0.0.1:3002/generate-missions",
    [string]$Token = "demo-token"
)

$ErrorActionPreference = "Stop"

$payload = @{
    contract_version = "1.0"
    astronaut_id = "orbiton-demo"
    mission_date = (Get-Date).ToString("yyyy-MM-dd")
    health = @{
        value = 82
        used_fields = @("heart_rate", "spo2", "sleep_hours")
        missing_fields = @()
        calculated_at = "2026-11-15T09:00:00Z"
        observed_at = "2026-11-15T08:59:59Z"
        stale = $false
        is_demo = $true
    }
    mood = @{
        value = 56
        used_fields = @("mood", "stress", "energy", "loneliness")
        missing_fields = @()
        calculated_at = "2026-11-15T09:00:00Z"
        observed_at = "2026-11-15T08:58:00Z"
        stale = $false
        is_demo = $true
    }
    latest_measurement = @{
        id = "measurement-demo-001"
        astronaut_id = "orbiton-demo"
        measured_at = "2026-11-15T08:59:59Z"
        heart_rate = 72
        spo2 = 98
        sleep_hours = 6.2
        steps = 1200
        body_temperature_c = 36.7
        source = "simulator"
    }
    check_in = @{
        mood = 3
        stress = 4
        energy = 2
        loneliness = 3
    }
    alerts = @()
    task_catalog = @(
        @{ template_id = "quiet_rest"; category = "rest"; title = "Take a five-minute quiet rest break." }
        @{ template_id = "breathing_pause"; category = "breathing"; title = "Take a short, comfortable breathing break." }
        @{ template_id = "positive_moment"; category = "reflection"; title = "Write down one positive moment from today." }
        @{ template_id = "energy_note"; category = "reflection"; title = "Note how your energy has changed today." }
        @{ template_id = "crew_connection"; category = "social"; title = "Check in with a crew member for a few minutes." }
        @{ template_id = "gentle_mobility"; category = "mobility"; title = "Try a brief, comfortable mobility break if your mission guidance allows it." }
        @{ template_id = "medical_review"; category = "medical_review"; title = "Ask the mission medical team to review the flagged readings." }
    )
    constraints = @{
        task_count = 3
        distinct_templates = $true
        no_diagnosis = $true
    }
}

$headers = @{}
if ($Token) {
    $headers.Authorization = "Bearer $Token"
}

Write-Host "Sending contract 1.0 test data to $Uri ..." -ForegroundColor Cyan

try {
    $result = Invoke-RestMethod `
        -Method Post `
        -Uri $Uri `
        -ContentType "application/json" `
        -Headers $headers `
        -Body ($payload | ConvertTo-Json -Depth 10) `
        -TimeoutSec 20

    Write-Host "Success: AI returned three approved templates." -ForegroundColor Green
    $result | ConvertTo-Json -Depth 10
}
catch {
    $status = $_.Exception.Response.StatusCode.value__
    if (-not $status) { $status = "connection-error" }
    Write-Host "Request failed ($status)." -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message
    } else {
        Write-Host $_.Exception.Message
    }
    exit 1
}
