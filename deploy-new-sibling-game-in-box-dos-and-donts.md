# Deploying a NEW sibling game on the shared box — dos and don'ts

For coding allies bringing a new game onto the shared Hetzner host that
already serves several live games (multiciv, pitfall, retromulticiv,
fireline, the games index) behind ONE nginx and ONE certbot.

Everything below was paid for in real breakage during the Fireline
deploy (2026-08-05, prompts 187-190 in its dev log). The one-sentence
version: **the box is a NEIGHBOURHOOD — every global thing you touch
(nginx, certbot, ports, disk, RAM) is shared, so make each change
self-testing and self-rolling-back, one change at a time.**

## Before you touch the box

- **DO claim your port first** in `multiciv/ops/multi-game-hosting.md`
  (one port per game, loopback-bound; take the next free row and write
  your name in it). Fireline is 8131; 8132+ is free.
- **DO bind 127.0.0.1 only** (`HOST=127.0.0.1` or equivalent). A
  `0.0.0.0` bind exposes your raw port through the firewall and
  bypasses TLS entirely. Verify with:
  `sudo ss -ltnpH "sport = :<port>"` — it must show 127.0.0.1.
- **DON'T verify ports with `grep -w ":<port>"`** — a colon preceded
  by a digit breaks grep's word boundary, so `127.0.0.1:8131` NEVER
  matches and the check reports every port as free, forever. This
  exact bug shipped in two deploy scripts on this box before it was
  caught. Use ss's own `sport =` filter.
- **DO cap your systemd unit**: `MemoryMax=` (512M is plenty for a
  Node game) AND `--max-old-space-size` ~25% BELOW it in ExecStart —
  V8 cannot see the cgroup, so without the flag your first sign of
  memory pressure is a SIGKILL mid-write, not a stack trace. Cap disk
  growth too (log/replay retention) — disk is shared.

## nginx — the part that bit us hardest

- **DON'T assume `$connection_upgrade` exists.** The classic WebSocket
  snippet (`proxy_set_header Connection $connection_upgrade;`) needs a
  `map` block that on THIS box may or may not be loaded when your file
  parses. Fireline's deploy failed with
  `unknown "connection_upgrade" variable` even though a sibling's notes
  said the map was "already defined". **DO define your own map under a
  UNIQUE name** in your own vhost file:

  ```nginx
  map $http_upgrade $mygame_connection_upgrade {
      default upgrade;
      ''      close;
  }
  ...
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $mygame_connection_upgrade;
  ```

- **DON'T `ln -sf` into sites-enabled BEFORE `nginx -t`.** This is the
  most dangerous mistake on a shared box: nginx keeps serving the OLD
  config from memory, so everything looks fine — but every FUTURE
  reload (a neighbour's deploy, certbot's renewal!) now fails against
  your broken linked file. **The safe form:**

  ```bash
  sudo ln -s /etc/nginx/sites-available/mygame /etc/nginx/sites-enabled/mygame
  sudo nginx -t || sudo rm /etc/nginx/sites-enabled/mygame
  ```

- **DO the self-rollback pattern for EVERY edit of an existing file:**

  ```bash
  sudo cp /etc/nginx/sites-available/mygame /root/mygame.nginx.bak
  # ...edit...
  sudo nginx -t || sudo cp /root/mygame.nginx.bak /etc/nginx/sites-available/mygame
  ```

  This pattern caught its own author during the Fireline deploy (a
  stale cert path left in the TLS block) and restored the working file
  automatically. On a shared box, "fail safe, roll back yourself" is
  the difference between your mistake and everyone's outage.

- **DO make ONE change at a time and `nginx -t` between each.** The
  Fireline deploy needed several edits (HTTP vhost → cert → TLS block)
  and every combined-edit attempt made diagnosis harder. Sequence:
  HTTP-only vhost → verify `curl http://yourname/health` → THEN
  certificate → THEN the TLS server block.

- **DON'T add `http2` to your listen directives.** It is a per-SOCKET
  property; the box already logs `protocol options redefined` from one
  site declaring it — inherit it instead of adding a third voice to
  someone else's warning.

- **DON'T touch neighbour files, ever.** Unique filenames only, no
  `default_server`, no edits to `nginx.conf` or another game's vhost.

## Certificates

- **DO extend the SHARED lineage** rather than minting a new one
  (owner's call, established practice): run certbot with `--expand`
  and the COMPLETE existing `-d` list plus your new name — transcribe
  the existing list EXACTLY from `sudo certbot certificates` (the real
  risk is a wrong `-d` list, not the expansion; a FAILED certbot run
  leaves the old certificate intact).
- **DO know the consequence**: renewal is shared. If it ever fails,
  every name on the lineage loses TLS together — so after ANY cert
  work, sweep the neighbours (below).
- **DON'T point your TLS block at
  `/etc/letsencrypt/live/<yourname>/`** if you joined the shared
  lineage — the path is the LINEAGE's name (e.g.
  `multiciv.kjell.today-0001`), not yours. This exact mistake broke
  the Fireline TLS block on first try.

## Verify like you mean it

- **DO verify the PUBLIC endpoint, not loopback**: `is-active` +
  loopback curl prove the process runs, not that players can reach it.
  `curl https://yourname.kjell.today/healthz` from OUTSIDE is the only
  truth. (Serve `/healthz` — it is the box-wide convention; every
  monitoring sweep hits one path across all ports.)
- **DO sweep the neighbours after any nginx/cert work:**

  ```bash
  for h in multiciv aworldbegun pitfall retromulticiv games fireline servers.multiciv; do
    echo -n "$h: "; curl -sI --max-time 10 "https://$h.kjell.today" | head -1
  done
  ```

  **A 404 can be a PASS**: `servers.multiciv` serves no root page, so
  `404` on `/` is its healthy state — and any HTTP status PROVES the
  TLS chain worked, because a bad certificate fails as a curl ERROR,
  not a status code.
- **DON'T trust an empty diagnostic.** Three times in one evening,
  `nginx -T 2>/dev/null | grep ...` returned nothing because `-T`
  itself was ERRORING (broken config), not because the answer was
  "not found". Run the tool WITHOUT `2>/dev/null` first; an empty
  result from a broken tool looks identical to a negative answer.

## Runtime lessons that saved us later

- **DO make your crash-persistence writes ATOMIC** (tmp + rename): the
  memory-cap SIGKILL lands whenever it likes, including mid-write, and
  a truncated autosave silently becomes "no autosave".
- **DO give your ws transport a REALISTIC heartbeat timeout** (30 s,
  not 5): phone radios waking from power-save and WiFi→5G handovers
  routinely stall longer than 5 s, and an aggressive server-side kick
  reads as "random connectivity issues" on every client. Log every
  heartbeat kick with ids — `journalctl -u yourgame | grep heartbeat`
  then settles kick-vs-network in one look.
- **DO expose `rssMb` (and ideally a tick/loop jitter digest) on your
  health endpoint** — the box caps you, and a sweep should see the
  climb before the OOM reaper acts. Fireline's `/healthz` shows the
  shape.

## The checklist form

1. Claim port (hosting doc) → unit with caps → loopback bind → deploy
   code → loopback `/healthz` answers.
2. HTTP-only vhost, own upgrade map, `ln` THEN `nginx -t || rm` →
   public HTTP answers.
3. Certbot `--expand` with the exact transcribed `-d` list + yours.
4. TLS block pointing at the LINEAGE path, self-rollback pattern →
   `nginx -t` → reload.
5. Public HTTPS `/healthz` from outside + the neighbour sweep.
6. Record: port row, your game in the games index, and any new lesson
   in THIS file.
