# Nightly auto-link-videos runner. Invoked by Windows Task Scheduler at
# 2:30 AM Central daily (= 12:30 AM Pacific, just after YouTube's quota reset).
#
# Each run:
#   1. cd's to <repo>/server
#   2. Runs auto-link-videos.js with --general-only --apply --yes
#   3. The script's WHERE video_id IS NULL filter means it picks up wherever
#      the last run left off, and the circuit-breaker stops it cleanly once
#      daily YouTube quota is exhausted.
#   4. Output is captured to server/scripts/logs/auto-link-videos_<timestamp>.log
#
# To run on demand for testing:
#   Start-ScheduledTask -TaskName 'RepLab Nightly Link Videos'
# or just invoke this file directly:
#   powershell -ExecutionPolicy Bypass -File nightly-link-videos.ps1

$ErrorActionPreference = 'Continue'  # don't bail on first hiccup; we want the log

$ScriptDir = $PSScriptRoot
$ServerDir = Split-Path -Parent $ScriptDir
$LogDir    = Join-Path $ScriptDir 'logs'

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$Timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$LogFile   = Join-Path $LogDir "auto-link-videos_$Timestamp.log"

Set-Location $ServerDir

"[runner] $(Get-Date -Format 'o') starting auto-link-videos (cwd=$ServerDir)" | Tee-Object -FilePath $LogFile

& node --env-file=.env scripts/auto-link-videos.js --general-only --apply --yes 2>&1 |
    Tee-Object -FilePath $LogFile -Append

$ExitCode = $LASTEXITCODE
"[runner] $(Get-Date -Format 'o') finished (exit=$ExitCode)" | Tee-Object -FilePath $LogFile -Append

exit $ExitCode
