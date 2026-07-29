# Native GPU perf on the gaming PC

Every FPS number this project had before 2026-07-29 was measured on a
**software rasteriser**. The batch worker runs in WSL, WSL cannot reach
the discrete GPU, so Chromium silently falls back to SwiftShader and the
harness dutifully measures the CPU pretending to be a graphics card.
This runner exists to get real numbers off the actual adapter.

## Quick start

```bash
# from WSL (the wrapper passes every argument through to PowerShell)
bash tools/perf_native.sh -InstallDeps      # FIRST RUN on a fresh checkout
bash tools/perf_native.sh                   # every run after that
```

```powershell
# or natively on the PC, from the repo root
powershell -ExecutionPolicy Bypass -File tools\perf_native.ps1 -InstallDeps
powershell -ExecutionPolicy Bypass -File tools\perf_native.ps1
```

**`-InstallDeps` is required the first time on any machine** — it runs
`npm ci` and `npx playwright install chromium`. Without it the run stops
with a MISSING line and prints the exact command to fix it. (The first
real run tripped on this, which is why the message now spells it out
instead of just naming the missing folder.)

## Options

| Flag | Default | Why you would change it |
|---|---|---|
| `-Duration <s>` | 30 | Longer sample if the numbers look noisy |
| `-Seed <n>` | 2026 | Measure a different war |
| `-Angle d3d11\|d3d9\|gl` | d3d11 | If d3d11 misreports the adapter, try `gl` |
| `-Headless` | off | ONLY to reproduce the bad WSL-style numbers for comparison |
| `-Uncapped` | off | **Remove the vsync ceiling and measure HEADROOM.** Turn vsync off in the driver too |
| `-InstallDeps` | off | First run on a machine |

## What it guarantees

Two guards, because the whole point is not to be fooled again:

1. **It refuses a `node.exe` that lives inside WSL.** A WSL node on the
   Windows PATH would reintroduce software rendering while looking like
   a native run.
2. **It exits 2 if the summary still names SwiftShader / llvmpipe /
   Software.** A software run can never be quietly recorded as native.
   If this fires, try `-Angle gl`, and check the browser is opening on
   the discrete GPU rather than the integrated one.

On success it prints `GPU confirmed: <adapter>` and the summary table.

## Output

- `reports/sweeps/perf.csv` - per-second samples
- `reports/sweeps/perf_summary.json` - median / p5 fps, draw calls, `gl`
- `reports/sweeps/perf_native_<timestamp>.json` - a stamped copy, so
  repeat runs do not overwrite each other
- `reports/sweeps/perf_native_run.log` - full harness output

**`reports/sweeps/` is gitignored**, so results do NOT travel with a
push. To get numbers off the PC, paste the summary, or mail it through
the batch lane:

```bash
python3 tools/agent-mail.py send --from batch-pc --to dev --tag done \
  "native perf: $(cat reports/sweeps/perf_summary.json)"
```

## Editing the .ps1 (read before you touch it)

**Keep it pure ASCII.** PowerShell 5.1 — still the default on Windows
10/11 — reads a BOM-less file as Windows-1252, not UTF-8. A single em
dash inside a double-quoted string decodes to three characters ending in
a quote, which terminates the string early; the file then fails to parse
with errors pointing at innocent words several lines away. This cost a
debugging round on day one. `test/powershell_ascii.test.js` now fails the
suite if any `.ps1` gains a non-ASCII character.

## Vsync: why the first numbers were not the whole story

The first real 4070 run returned a flat **61 / 60 / 59 fps** with 265
draw calls and 223k triangles. That is a pass, but it is a VSYNC
READING: it proves the GPU is never troubled and says nothing about how
much room is left. Run `-Uncapped` (and turn vsync off in the driver or
raise the refresh rate) to get headroom. A capped run now warns about
this on the way out, and the summary records `uncapped: true|false` so a
capped reading can never be quoted as headroom later.

## What to do with the numbers

The open question these unblock: whether the 2D sprite fallback's
auto-engage fps floor (14D) is set anywhere near reality. The floor was
guessed, because the only data available was SwiftShader. With a real
median and p5 from the 4070, the floor becomes a decision instead of a
placeholder — and the same numbers tell us whether the worst-case
theatre (32 assets, 24 mines, 8 drones, labels) is comfortably inside
frame budget on a mid-range card.
