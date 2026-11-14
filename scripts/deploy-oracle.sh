#!/usr/bin/env bash
# Builds the game and publishes it to the Oracle server (static files in /srv/vals, served by Caddy).
# Usage: scripts/deploy-oracle.sh        (needs the `oracle` SSH alias in ~/.ssh/config)
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
npm run build
rsync -az --delete dist/ oracle:/tmp/vals-dist/
ssh oracle 'sudo mkdir -p /srv/vals && sudo rsync -a --delete /tmp/vals-dist/ /srv/vals/ && sudo chown -R root:root /srv/vals && sudo chmod -R a+rX /srv/vals'
echo "Yayında: https://vals.130-61-214-155.sslip.io"
