#!/bin/bash
powershell.exe -ExecutionPolicy Bypass -File "$(wslpath -w tools/perf_native.ps1)"
