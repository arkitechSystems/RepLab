# One-time installer: registers the Windows Scheduled Task that runs
# auto-link-videos.js nightly at 2:30 AM America/Chicago (Central). YouTube's
# daily search quota resets at midnight Pacific, so 2:30 AM Central gives a
# 30-minute buffer before the run kicks off.
#
# Run once from PowerShell as your normal user:
#   powershell -ExecutionPolicy Bypass -File .\install-nightly-task.ps1
#
# To remove later:
#   Unregister-ScheduledTask -TaskName 'RepLab Nightly Link Videos' -Confirm:$false
#
# To run on demand (smoke test, doesn't wait for 2:30 AM):
#   Start-ScheduledTask -TaskName 'RepLab Nightly Link Videos'

$TaskName = 'RepLab Nightly Link Videos'
$Runner   = Join-Path $PSScriptRoot 'nightly-link-videos.ps1'

if (-not (Test-Path $Runner)) {
    Write-Error "Runner script not found at: $Runner"
    exit 1
}

# Action: launch PowerShell hidden, run the runner script.
$Action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`""

# Trigger: daily at 2:30 AM local time (America/Chicago per your profile).
$Trigger = New-ScheduledTaskTrigger -Daily -At '2:30AM'

# Settings: tolerate sleep/missed runs, run if network up, cap at 2h wall time.
$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -RunOnlyIfNetworkAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

# Principal: run as the currently-logged-in interactive user (you).
# Doesn't require admin, doesn't need a stored password, runs in your context
# so it can see your local .env, your node install, etc.
$Principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName    $TaskName `
    -Description 'Nightly resume of auto-link-videos.js against the REPLAB exercise library. Picks up wherever the last run left off (rows where video_id IS NULL). Self-aborts when YouTube daily quota is exhausted.' `
    -Action      $Action `
    -Trigger     $Trigger `
    -Settings    $Settings `
    -Principal   $Principal `
    -Force | Out-Null

Write-Host ''
Write-Host "Task registered: $TaskName" -ForegroundColor Green
Write-Host ''
Write-Host '  Next run: 2:30 AM Central (daily)'
Write-Host "  Runner:   $Runner"
Write-Host '  Logs:     server\scripts\logs\auto-link-videos_<timestamp>.log'
Write-Host ''
Write-Host 'Test it now (will burn ~80 exercises worth of YouTube quota):' -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ''
Write-Host 'View status:'
Write-Host "  Get-ScheduledTaskInfo -TaskName '$TaskName'"
Write-Host ''
Write-Host 'Disable when finished:'
Write-Host "  Disable-ScheduledTask -TaskName '$TaskName'"
Write-Host '  # or remove entirely:'
Write-Host "  Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
