[CmdletBinding()]
param(
    [switch]$Offline,
    [int]$Port = 8000,
    [switch]$SkipBuild
)

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$RepoRoot = Split-Path -Parent $ScriptDir
Set-Location $RepoRoot

$ErrorActionPreference = 'Stop'
# Always rebuild in live API mode (a stub-mode dist would silently show fixtures); -SkipBuild reuses the last build.
if (-not $SkipBuild) {
    Push-Location frontend
    if (-not (Test-Path "node_modules")) { npm ci; if ($LASTEXITCODE -ne 0) { Pop-Location; throw "npm ci failed" } }
    $env:VITE_API_MODE = 'live'
    $env:VITE_API_BASE_URL = '/'
    npx vite build
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "frontend build failed" }
    Pop-Location
}

$mode = if ($Offline) { 'off' } else { 'recorded' }
$env:AEGIS_DEMO_MODE = '1'
$env:AEGIS_LLM_MODE = $mode

if (-not (Test-Path "work")) {
    New-Item -ItemType Directory -Path "work" | Out-Null
}
$env:AEGIS_DB_PATH = "work/aegis-demo.sqlite3"

Write-Host "AegisShield demo: http://127.0.0.1:$Port  (LLM: $mode)"

Start-Job -ScriptBlock {
    param($url)
    Start-Sleep -Seconds 3
    try {
        Start-Process $url
    } catch {}
} -ArgumentList "http://127.0.0.1:$Port" | Out-Null

python -m uvicorn backend.app.main:app --host 127.0.0.1 --port $Port
