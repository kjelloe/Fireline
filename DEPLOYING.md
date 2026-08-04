# Deploying Fireline Command to a public host (O6)

The playbook ports the sibling project's proven ssh-deploy pattern
(multiciv, ~200 deploys without an unnoticed outage). The principles,
in the order they saved us over there:

1. **Allowlist rsync** — only what the server RUNS leaves the dev
   machine. Dev tooling (`.claude/`, `debugging/`, `test/`, `specs/`,
   `reports/`, batch/agent-mail tooling, `dev-*.md`) is never synced.
2. **Runtime state is never touched** — `data/replays/` and
   `data/autosave.json` belong to the box once it is live.
3. **One SSH connection** (ControlMaster mux) — one passphrase prompt,
   no rate-limited auth storms.
4. **Provenance guard** — the script deploys the WORKING TREE; it
   prints branch/sha/dirty-count and stops for confirmation unless
   HEAD is a clean, pushed commit (`--yes` skips for repeat deploys).
5. **Deploy guard** — after restart: `sleep 3`, `systemctl is-active`,
   then `curl /health`. A crash-looping unit fails the deploy loudly
   instead of printing success.
6. **Public verification** — curl the PUBLIC https endpoint too. The
   loopback check proves our process; only the public check proves
   nginx, TLS, and that no neighbour vhost hijacked the name.
7. **Shared-box sanity before restart** — `nginx -t`, port ownership,
   disk/RAM headroom, and a listing of neighbour sites. On a shared
   box their mistakes become your outage.

## What the server is

One Node process: `server/index.js` serves the HTTP client, the
WebSocket war, and the REST surface (`/health`, `/version`,
`/metrics`, `/rotation`, `/replays`). No build step, no database.
Health probe: `curl http://127.0.0.1:8080/health`.

## The runtime allowlist

```
client/***  engine/***  shared/***  server/***
data/units.json            (generated roster — regenerate before deploy if units.js changed)
package.json  package-lock.json  LICENSE
```
Excluded always: `data/replays/`, `data/autosave.json` (runtime
state), everything else (dev surface).

## systemd unit (template)

```ini
# /etc/systemd/system/fireline.service
[Unit]
Description=Fireline Command war server
After=network.target

[Service]
User=fireline
WorkingDirectory=/opt/fireline
# Session config lives HERE, not in the code: map/mode/difficulty/rules.
ExecStart=/usr/bin/node server/index.js --map frontier_corridor --difficulty normal
# Competitive public host? add --teambalance (default lets friends stack one team vs the AI)
Restart=on-failure
RestartSec=3
Environment=PORT=8080
# Optional: MASTER_URL=... (discovery), SPECTATE=0, REPLAYS=0, RULES=normal

[Install]
WantedBy=multi-user.target
```

`RESUME` note: the CLI path runs with crash persistence ON (30 s
autosave, resume within 10 min) — a `Restart=on-failure` unit
therefore resumes the war the players were in. `RESUME=0` disables.

## nginx (template)

```nginx
server {
    server_name fireline.example.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;      # the WebSocket war
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
    # TLS via certbot --nginx as usual.
}
```

## The deploy script

`tools/ssh-deploy.sh` implements all seven principles. Host identity
is NOT in the repo — it reads `deploy.env` (gitignored) next to it:

```bash
# tools/deploy.env  (gitignored — your box, your key)
DEPLOY="user@fireline.example.com"
APP="/opt/fireline"
SSH_OPTS="-i ~/.ssh/id_ed25519_yourkey -p 22"
SERVICE="fireline"
PUBLIC_URL="https://fireline.example.com"
```

Then: `bash tools/ssh-deploy.sh` (or `--yes` for repeat deploys).

## First-time box setup

1. Node 22: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`
2. `sudo useradd -r -m -d /opt/fireline fireline`
3. Install the systemd unit + nginx block above; `sudo systemctl enable fireline`.
4. Run the deploy script once; certbot for TLS.
5. Verify from OUTSIDE the box: the public `/health`, then join a war
   from a phone (the mobile-resilience path exercises reconnects).

## Operations

- Logs: `journalctl -u fireline -f`
- War archive: `/opt/fireline/data/replays/` (grows ~100-500 KB/war —
  put a cron on it or set `REPLAYS=0`)
- Map/mode rotation without redeploying: `POST /rotation` is
  loopback-only by design — ssh in and curl it, or use the vote pool
  (`VOTE_MAPS`/`VOTE_MODES` in the unit's Environment).
- The lobby's join gate, spectator booth, and difficulty label all
  come from the unit's CLI/env — change the unit, `daemon-reload`,
  restart; no code involved.
