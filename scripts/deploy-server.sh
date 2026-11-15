#!/usr/bin/env bash
# Publishes the usage-event and report server (server/) to the Oracle host: /opt/vals/kod, service vals-olay.
# Data stays in /opt/vals/veri (events, report key, location database).
# Usage: scripts/deploy-server.sh        (needs the `oracle` SSH alias in ~/.ssh/config)
set -euo pipefail
cd "$(dirname "$0")/.."
node --check server/vals-sunucu.js
rsync -az --delete --exclude node_modules server/ oracle:/tmp/vals-sunucu/
scp -q infra/vals-olay.service oracle:/tmp/vals-olay.service
ssh oracle 'set -e
  id vals >/dev/null 2>&1 || sudo useradd --system --no-create-home --home-dir /opt/vals --shell /usr/sbin/nologin vals
  sudo install -d -o root -g root -m 755 /opt/vals /opt/vals/kod
  sudo install -d -o vals -g vals -m 750 /opt/vals/veri
  sudo rsync -a --delete --exclude node_modules /tmp/vals-sunucu/ /opt/vals/kod/
  cd /opt/vals/kod && sudo npm ci --omit=dev --no-audit --no-fund --silent
  sudo chown -R root:root /opt/vals/kod && sudo chmod -R a+rX /opt/vals/kod
  sudo install -m 644 /tmp/vals-olay.service /etc/systemd/system/vals-olay.service
  sudo systemctl daemon-reload && sudo systemctl enable -q vals-olay && sudo systemctl restart vals-olay
  sleep 1; curl -fsS http://127.0.0.1:8791/api/durum >/dev/null && echo "vals-olay çalışıyor"'
echo "Rapor: https://vals.130-61-214-155.sslip.io/api/rapor"
