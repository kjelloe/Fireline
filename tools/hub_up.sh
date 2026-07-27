#!/bin/bash
# tools/hub_up.sh — start (or confirm) the firepower agent-mail hub on
# this machine, LAN-reachable. Idempotent; run after any WSL restart.
cd "$(dirname "$0")/.."
if ss -tln 2>/dev/null | grep -q ":8971 "; then
  echo "hub already listening on 8971"
else
  setsid nohup python3 tools/agent-mail.py serve --port 8971 --host 0.0.0.0 \
    > /tmp/agent-mail-hub.log 2>&1 &
  sleep 1
  ss -tln | grep ":8971 " && echo "hub started (log: /tmp/agent-mail-hub.log)"
fi
echo "WSL IP (portproxy target): $(hostname -I | awk '{print $1}')"
