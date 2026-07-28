<#
.SYNOPSIS
  Run the Fireline Command GPU perf harness NATIVELY on Windows.

.DESCRIPTION
  The perf numbers we have are worthless: the WSL worker has no access to
  the discrete GPU, so Chromium falls back to SwiftShader (CPU) and every
  run measures a software rasteriser. This runner executes the SAME
  harness (tools/perf_harness.mjs) on the Windows side, headed, on the
  real adapter - so the "gl" field in the summary should finally name the
  actual card instead of SwiftShader.

  It starts its own game server on a free port, so nothing else needs to
  be running.

.PARAMETER Duration
  Seconds of measured rendering (default 30).

.PARAMETER Seed
  Map seed for the measured war (default 2026).

.PARAMETER Angle
  ANGLE backend: d3d11 (default), d3d9, gl. Try 'gl' if d3d11 misreports.

.PARAMETER Headless
  Measure headless instead of headed. Usually WRONG for GPU numbers -
  provided only for comparison against the WSL baseline.

.PARAMETER InstallDeps
  Run 'npm ci' and 'npx playwright install chromium' first.

.EXAMPLE
  # On the PC, from the repo root:
  powershell -ExecutionPolicy Bypass -File tools\perf_native.ps1

.EXAMPLE
  # From WSL, without leaving your shell:
  powershell.exe -ExecutionPolicy Bypass -File "$(wslpath -w tools/perf_native.ps1)"
#>
[CmdletBinding()]
param(
  [int]$Duration = 30,
  [int]$Seed = 2026,
  [ValidateSet('d3d11', 'd3d9', 'gl')][string]$Angle = 'd3d11',
  [switch]$Headless,
  [switch]$InstallDeps
)

$ErrorActionPreference = 'Stop'

# The repo root is this script's parent's parent (tools/perf_native.ps1).
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repo
Write-Host "repo: $repo" -ForegroundColor DarkGray

# --- preflight -------------------------------------------------------
# A WSL-side node on the PATH would silently reintroduce the exact
# software-rendering problem this script exists to avoid.
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) {
  throw "node.exe not found on the Windows PATH. Install Node for Windows (not the WSL one) and re-run."
}
$nodeVersion = & node.exe --version
Write-Host "node: $nodeVersion ($($node.Source))" -ForegroundColor DarkGray
if ($node.Source -like '\\wsl$*' -or $node.Source -like '\\wsl.localhost*') {
  throw "That node.exe lives inside WSL ($($node.Source)) - it cannot reach the GPU. Install Node natively on Windows."
}

if ($InstallDeps) {
  Write-Host "installing dependencies..." -ForegroundColor Cyan
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed ($LASTEXITCODE)" }
  & npx.cmd playwright install chromium
  if ($LASTEXITCODE -ne 0) { throw "playwright install failed ($LASTEXITCODE)" }
}

if (-not (Test-Path 'node_modules\playwright')) {
  throw "playwright is not installed in this checkout. Re-run with -InstallDeps."
}

New-Item -ItemType Directory -Force -Path 'reports\sweeps' | Out-Null

# --- run -------------------------------------------------------------
$env:DURATION = "$Duration"
$env:SEED     = "$Seed"
$env:ANGLE    = $Angle
$env:HEADED   = if ($Headless) { '0' } else { '1' }

$mode = if ($Headless) { 'HEADLESS (comparison only)' } else { 'HEADED on the real adapter' }
Write-Host "running perf harness - $mode, angle=$Angle, ${Duration}s, seed $Seed" -ForegroundColor Cyan
Write-Host "a browser window will open and drive itself; leave it focused and do not minimise it." -ForegroundColor Yellow

$log = 'reports\sweeps\perf_native_run.log'
& node.exe tools\perf_harness.mjs 2>&1 | Tee-Object -FilePath $log
$exit = $LASTEXITCODE
if ($exit -ne 0) {
  throw "perf harness failed ($exit) - see $log"
}

# --- report ----------------------------------------------------------
$summaryPath = 'reports\sweeps\perf_summary.json'
if (-not (Test-Path $summaryPath)) { throw "harness produced no summary; see $log" }
$summary = Get-Content $summaryPath -Raw | ConvertFrom-Json

Write-Host ''
Write-Host '================ NATIVE PERF ================' -ForegroundColor Green
$summary.PSObject.Properties | ForEach-Object {
  Write-Host ("  {0,-16} {1}" -f $_.Name, $_.Value)
}
Write-Host '=============================================' -ForegroundColor Green

# The whole point of the exercise: did we actually get off SwiftShader?
$gl = "$($summary.gl)"
if ($gl -match 'SwiftShader|llvmpipe|Software') {
  Write-Warning "STILL SOFTWARE RENDERING (gl = '$gl')."
  Write-Warning "These numbers are NOT native. Try: -Angle gl, or check that the browser opened on the discrete GPU."
  exit 2
}
Write-Host "GPU confirmed: $gl" -ForegroundColor Green
Write-Host "CSV: reports\sweeps\perf.csv   summary: $summaryPath   log: $log"

# A stamped copy, so repeated runs do not overwrite each other.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item $summaryPath "reports\sweeps\perf_native_$stamp.json"
Write-Host "kept a stamped copy: reports\sweeps\perf_native_$stamp.json" -ForegroundColor DarkGray
