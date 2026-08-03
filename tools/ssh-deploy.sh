#!/bin/bash
# tools/ssh-deploy.sh — push local code to the public Fireline host + restart.
# Ported from the sibling project's proven pattern (multiciv ssh-deploy.sh);
# the playbook with the reasoning behind every guard lives in DEPLOYING.md.
#
# ALLOWLIST deploy: only what the server RUNS is synced. Dev/agent/internal
# files (.claude, debugging/, test/, specs/, reports/, batch tooling, dev-*.md)
# never leave this machine. Runtime state (data/replays, data/autosave.json)
# is never touched on the box.
#
# Host identity is NOT in the repo: tools/deploy.env (gitignored) defines
# DEPLOY, APP, SSH_OPTS, SERVICE, PUBLIC_URL — template in DEPLOYING.md.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="tools/deploy.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found — copy the template from DEPLOYING.md first."
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"
: "${DEPLOY:?deploy.env must set DEPLOY}" "${APP:?deploy.env must set APP}"
: "${SERVICE:=fireline}" "${SSH_OPTS:=}" "${PUBLIC_URL:=}"

SSH="ssh $SSH_OPTS"
SSH_SHOW="$SSH"
# One SSH connection for the whole deploy (mux): one prompt, no auth storm.
MUX_SOCK="${TMPDIR:-/tmp}/fireline-deploy-%r@%h:%p"
SSH="$SSH -o ControlMaster=auto -o ControlPath=$MUX_SOCK -o ControlPersist=300 -o ServerAliveInterval=30 -o ServerAliveCountMax=6"
cleanup_mux() { ssh -O exit -o ControlPath="$MUX_SOCK" "$DEPLOY" 2>/dev/null || true; }
trap cleanup_mux EXIT

# Provenance guard: this deploys the WORKING TREE. Say what is about to become
# public and stop for confirmation when it is not a clean, pushed commit.
YES=0; [ "${1:-}" = "--yes" ] && YES=1
BRANCH=$(git rev-parse --abbrev-ref HEAD)
SHA=$(git rev-parse --short HEAD)
DIRTY=$(git status --porcelain | grep -vc '^??' || true)
echo "==> Deploying working tree: $BRANCH @ $SHA"
if [ "${DIRTY:-0}" -gt 0 ] && [ "$YES" -eq 0 ]; then
  echo "    !! $DIRTY uncommitted tracked change(s) — they WILL be published"
  read -r -p "    Continue anyway? [y/N] " REPLY
  case "$REPLY" in y|Y|yes|YES) ;; *) echo "    aborted — nothing was sent"; exit 1 ;; esac
fi

# Regenerate the roster data if the source moved (data/units.json is deployed).
if [ engine/units.js -nt data/units.json ] 2>/dev/null; then
  echo "==> engine/units.js is newer than data/units.json — regenerating"
  node debugging/regen_units_json.mjs 2>/dev/null || echo "    (regen failed — deploying the existing data/units.json; the 3A mirror test is the truth)"
fi

echo "==> Ensuring $APP exists and is owned by the deploy user"
$SSH "$DEPLOY" "sudo mkdir -p $APP/data/replays && sudo chown -R \$(id -un):\$(id -gn) $APP"

# Shared-box sanity BEFORE the restart — a bad neighbour is visible while the
# old process is still serving (nginx validity, port ownership, headroom).
echo "==> Shared-box sanity"
$SSH "$DEPLOY" "
  if command -v nginx >/dev/null 2>&1 && ! sudo nginx -t 2>/dev/null; then
    echo '    !! nginx -t FAILS — the next reload drops EVERY site on this box'
  fi
  owner=\$(sudo ss -ltnp 2>/dev/null | grep -w ':8080' | grep -oE 'users:\(\(\"[^\"]+' | head -1 | cut -d'\"' -f2)
  if [ -n \"\$owner\" ] && [ \"\$owner\" != 'node' ]; then
    echo \"    !! port 8080 is held by '\$owner', not node\"
  fi
  df -h / | awk 'NR==2 && \$5+0 > 90 { print \"    !! disk \" \$5 \" full — replay/autosave writes will fail\" }'
  free -m | awk '/^Mem:/ { if (\$7 < 200) print \"    !! only \" \$7 \"MB available — OOM risk\" }'
"

echo "==> Syncing runtime code to $DEPLOY:$APP (allowlist)"
rsync -av --no-owner --no-group \
    --exclude 'data/replays' \
    --exclude 'data/autosave.json' \
    --exclude '*:Zone.Identifier' \
    --include '/client/***' \
    --include '/engine/***' \
    --include '/shared/***' \
    --include '/server/***' \
    --include '/data/' \
    --include '/data/units.json' \
    --include '/package.json' \
    --include '/package-lock.json' \
    --include '/LICENSE' \
    --exclude '*' \
    -e "$SSH" \
    ./ "$DEPLOY:$APP/"

echo "==> Installing deps + restarting $SERVICE"
$SSH "$DEPLOY" \
    "if ! command -v npm >/dev/null 2>&1; then \
       echo 'ERROR: npm not found — Node is not installed (see DEPLOYING.md).'; exit 1; \
     fi && \
     cd $APP && (npm ci --omit=dev 2>/dev/null || npm install --omit=dev) && \
     sudo systemctl restart $SERVICE && \
     sleep 3 && \
     systemctl is-active $SERVICE && \
     curl -fsS http://127.0.0.1:8080/health >/dev/null && echo '    local /health OK'"
# The sleep+health tail is the DEPLOY GUARD: restart + immediate is-active can
# report success while the unit crash-loops. A dead listener fails loudly here.

if [ -n "$PUBLIC_URL" ]; then
  echo "==> Verifying the PUBLIC endpoint ($PUBLIC_URL)"
  if ! curl -fsS --max-time 15 "$PUBLIC_URL/health" >/dev/null; then
    echo "ERROR: the public endpoint did not answer though the local port did —"
    echo "       that means nginx or TLS, not the game (see DEPLOYING.md §7)."
    exit 1
  fi
  echo "    public /health OK"
fi

echo "==> Deployed + verified serving."
echo "    Logs: $SSH_SHOW $DEPLOY 'journalctl -u $SERVICE -f'"
