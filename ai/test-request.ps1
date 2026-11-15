param(
    [string]$Uri = "http://127.0.0.1:3001/generate-missions",
    [string]$Token = "demo-token",
    [switch]$ShowRequest
)

$ErrorActionPreference = "Stop"

$payload = @{
    contract_version = "1.1"
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
    check_in = @{ mood = 3; stress = 4; energy = 2; loneliness = 3 }
    trend_summary = @{
        window_days = 3
        sleep = "decreasing"
        mood = "stable"
        stress = "increasing"
        energy = "decreasing"
        connection = "insufficient_data"
    }
    alerts = @()
    task_catalog = @(
        @{
            template_id = "earth_gaze_reset"; category = "recovery"
            title = "Take a two-minute Earth-view or quiet-view reset when available."
            duration_minutes = 2; intensity = "low"
            reason_codes = @("high_stress", "protect_energy", "short_sleep")
        }
        @{
            template_id = "crew_voice_checkin"; category = "social"
            title = "Share a short voice check-in with a crew member."
            duration_minutes = 5; intensity = "low"
            reason_codes = @("low_connection", "support_mood")
        }
        @{
            template_id = "single_priority_block"; category = "focus"
            title = "Choose one priority for the next work block."
            duration_minutes = 3; intensity = "low"
            reason_codes = @("protect_energy", "support_focus", "balanced_day")
        }
        @{
            template_id = "quiet_listening"; category = "recovery"
            title = "Spend a few minutes listening to a calming sound if your duties allow."
            duration_minutes = 3; intensity = "low"
            reason_codes = @("high_stress", "protect_energy")
        }
        @{
            template_id = "effort_acknowledgement"; category = "reflection"
            title = "Acknowledge one effort you made today."
            duration_minutes = 2; intensity = "low"
            reason_codes = @("support_mood", "low_energy")
        }
        @{
            template_id = "hydration_reminder"; category = "hydration"
            title = "Set a reminder for your existing mission-approved hydration schedule."
            duration_minutes = 2; intensity = "low"
            reason_codes = @("balanced_day", "support_focus")
        }
    )
    reason_catalog = @(
        @{ reason_code = "short_sleep"; description = "Recent sleep is short or decreasing." }
        @{ reason_code = "high_stress"; description = "Reported stress is high or increasing." }
        @{ reason_code = "low_energy"; description = "Reported energy is low." }
        @{ reason_code = "protect_energy"; description = "Keep this action short and low intensity." }
        @{ reason_code = "low_connection"; description = "Support a small moment of crew connection." }
        @{ reason_code = "support_mood"; description = "Support reported mood with a small action." }
        @{ reason_code = "support_focus"; description = "Support a bounded next work block." }
        @{ reason_code = "balanced_day"; description = "Provide a balanced preventive action." }
    )
    constraints = @{
        task_count = 3
        distinct_templates = $true
        no_diagnosis = $true
        max_duration_minutes = 10
        allowed_intensities = @("low")
    }
}

$headers = @{}
if ($Token) { $headers.Authorization = "Bearer $Token" }

Write-Host "Sending contract 1.1 test data to $Uri ..." -ForegroundColor Cyan
$json = $payload | ConvertTo-Json -Depth 12
if ($ShowRequest) {
    Write-Host "`nRequest JSON (secrets excluded):" -ForegroundColor Yellow
    Write-Output $json
    Write-Host "`nResponse JSON:" -ForegroundColor Yellow
}

try {
    $result = Invoke-RestMethod `
        -Method Post `
        -Uri $Uri `
        -ContentType "application/json" `
        -Headers $headers `
        -Body $json `
        -TimeoutSec 20

    Write-Host "Success: AI returned three approved templates with reason codes." -ForegroundColor Green
    $result | ConvertTo-Json -Depth 10
}
catch {
    $status = $_.Exception.Response.StatusCode.value__
    if (-not $status) { $status = "connection-error" }
    Write-Host "Request failed ($status)." -ForegroundColor Red
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message } else { Write-Host $_.Exception.Message }
    exit 1
}
