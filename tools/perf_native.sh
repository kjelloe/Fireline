#!/bin/bash
# tools/perf_native.sh - run the native Windows GPU perf harness from WSL.
# Thin wrapper over tools/perf_native.ps1 (docs: tools/perf_native.md).
#
#   bash tools/perf_native.sh                     # 30 s measured run
#   bash tools/perf_native.sh -InstallDeps        # first run on a fresh PC
#   bash tools/perf_native.sh -Duration 60 -Angle gl
#
# Every argument is passed through to PowerShell, so the .ps1's own
# parameters work unchanged from here. (The first version of this
# wrapper took no arguments, which made -InstallDeps silently do
# nothing on the run that needed it.)
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v powershell.exe >/dev/null 2>&1; then
  echo "powershell.exe is not on the PATH - is this WSL with Windows interop enabled?" >&2
  exit 1
fi

exec powershell.exe -ExecutionPolicy Bypass \
  -File "$(wslpath -w tools/perf_native.ps1)" "$@"
