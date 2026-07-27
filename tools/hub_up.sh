#!/bin/bash
# tools/hub_up.sh — start (or confirm) the firepower agent-mail hub on
# this machine, LAN-reachable. Idempotent; run after any WSL restart.
#
# ── PREREQUISITES (Windows side, ADMIN PowerShell — done 2026-07-27) ──
#
# The hub lives inside WSL2, so the Windows host must (1) forward the
# port into WSL and (2) allow it through the firewall:
#
#   netsh interface portproxy add v4tov4 listenport=8971 listenaddress=0.0.0.0 connectport=8971 connectaddress=<WSL-IP>
#   netsh advfirewall firewall add rule name="firepower agent-mail hub" dir=in action=allow protocol=TCP localport=8971
#
# The FIREWALL rule is one-time. The PORTPROXY is NOT: the WSL IP changes
# on (almost) every reboot, and a stale connectaddress silently black-holes
# all inbound hub traffic — the gaming PC's worker will sit in flag-wait
# forever with no error anywhere. THIS SCRIPT DETECTS THAT and prints the
# exact refresh commands. If remote machines can't reach the hub, run this
# script FIRST and do what it says.
#
#   refresh (admin PowerShell, both lines):
#     netsh interface portproxy delete v4tov4 listenport=8971 listenaddress=0.0.0.0
#     netsh interface portproxy add v4tov4 listenport=8971 listenaddress=0.0.0.0 connectport=8971 connectaddress=<fresh WSL-IP>

cd "$(dirname "$0")/.."
PORT=8971
WSL_IP=$(hostname -I | awk '{print $1}')

# 1. The hub process itself.
if ss -tln 2>/dev/null | grep -q ":$PORT "; then
  echo "hub: already listening on $PORT"
else
  setsid nohup python3 tools/agent-mail.py serve --port $PORT --host 0.0.0.0 \
    > /tmp/agent-mail-hub.log 2>&1 &
  sleep 1
  if ss -tln | grep -q ":$PORT "; then
    echo "hub: started (log: /tmp/agent-mail-hub.log)"
  else
    echo "hub: FAILED to start — see /tmp/agent-mail-hub.log" >&2
    exit 1
  fi
fi
echo "hub: WSL IP is $WSL_IP"

# 2. The Windows portproxy — THE thing that goes stale on reboot.
PROXY_TARGET=$(netsh.exe interface portproxy show v4tov4 2>/dev/null \
  | awk -v p="$PORT" '$2 == p { print $3 }' | tr -d '\r' | head -1)
if [ -z "$PROXY_TARGET" ]; then
  cat >&2 <<EOF

!! portproxy MISSING for $PORT — remote machines CANNOT reach the hub.
   Fix in an ADMIN PowerShell on Windows:
     netsh interface portproxy add v4tov4 listenport=$PORT listenaddress=0.0.0.0 connectport=$PORT connectaddress=$WSL_IP
EOF
elif [ "$PROXY_TARGET" != "$WSL_IP" ]; then
  cat >&2 <<EOF

!! portproxy is STALE: it forwards $PORT to $PROXY_TARGET but WSL now
   lives at $WSL_IP (this happens after reboots). Remote machines will
   hang silently until it is refreshed in an ADMIN PowerShell:
     netsh interface portproxy delete v4tov4 listenport=$PORT listenaddress=0.0.0.0
     netsh interface portproxy add v4tov4 listenport=$PORT listenaddress=0.0.0.0 connectport=$PORT connectaddress=$WSL_IP
EOF
else
  echo "portproxy: OK ($PORT -> $PROXY_TARGET)"
fi

# 3. The firewall rule (one-time; verify it survived).
if netsh.exe advfirewall firewall show rule name="firepower agent-mail hub" 2>/dev/null \
   | grep -q "8971"; then
  echo "firewall: OK (rule 'firepower agent-mail hub' present)"
else
  cat >&2 <<EOF

!! firewall rule missing — inbound $PORT is blocked on Windows.
   Fix in an ADMIN PowerShell:
     netsh advfirewall firewall add rule name="firepower agent-mail hub" dir=in action=allow protocol=TCP localport=$PORT
EOF
fi
